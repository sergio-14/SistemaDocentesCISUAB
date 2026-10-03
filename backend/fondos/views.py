from rest_framework import viewsets, filters, status, generics, serializers as drf_serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from django.http import Http404, HttpResponse, FileResponse
from django.db import transaction, IntegrityError
from django.db.models import Max, ProtectedError, prefetch_related_objects, Q
from django.core.exceptions import ValidationError as DjangoValidationError
from datetime import datetime, date
from decimal import Decimal
from .utils.carrera_pdf_generator import CarreraPDFGenerator
from .utils.pdf_generator import FondoPDFGenerator, InformePDFGenerator
from .utils.informe_texto import CAMPOS_TEXTO_INFORME
from .utils.informe_imagenes import ImagenInformeInvalida, carpeta_imagenes, validar_imagenes_informe
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Docente, Carrera, Materia, FondoTiempo, PerfilUsuario, CargaHoraria,
    CalendarioAcademico, InformeFondo, ObservacionFondo, MensajeObservacion, HistorialFondo,
    SaldoVacacionesGestion, FacultadCatalogo, DatosLaborales, DocenteCarrera, ProgramaAnalitico,
    AsignacionCarrera,
)
from .serializers import (
    DocenteSerializer, CarreraSerializer, MateriaSerializer, FondoTiempoSerializer,
    FondoTiempoListSerializer, CargaHorariaSerializer,
    UsuarioSerializer, CrearUsuarioSerializer, ActualizarUsuarioSerializer,
    FotoPerfilSerializer, PerfilUsuarioSerializer,
    CalendarioAcademicoSerializer,
    InformeFondoSerializer,
    ObservacionFondoSerializer, HiloObservacionSerializer, MensajeObservacionSerializer,
    _usuario_puede_ver_mensajes_internos,
    HistorialFondoSerializer,
    FondoTiempoDetalleSerializer,
    AprobarFondoSerializer, ObservarFondoSerializer,
    SaldoVacacionesGestionSerializer, DatosLaboralesSerializer,
    CustomTokenObtainPairSerializer, DocumentoActividadSerializer, ProgramaAnaliticoSerializer,
    # Validadores estructurales de asignación (blindaje de reactivación, normativa UABJB)
    validar_unicidad_cargo_por_carrera,
    ROLES_UNICOS_POR_CARRERA,
    _validar_fondo_tiempo_contractual_doble_rol,
    datos_registrados_usuario,
    docente_del_usuario,
    texto_datos_registrados,
    desactivar_si_solo_docente_sin_ficha,
    carreras_docencia_usuario,
    MENSAJE_FICHA_EN_CARRERA_DEL_USUARIO,
)
from .role_context import get_effective_profile, get_active_careers_for_user
from .solo_lectura import CarreraInactivaSoloLecturaMixin as CarreraInactivaSoloLecturaBase
from .models import DocumentoActividad, actualizar_con_historial, clase_documento_actividad
from .utils.archivos import es_pdf


_es_pdf = es_pdf


def _obtener_perfil_usuario(user):
    if not user or not user.is_authenticated:
        return None
    return getattr(user, 'perfil', None)


def _obtener_perfil_efectivo(user, request=None):
    return get_effective_profile(user, request)


def _obtener_carreras_activas_usuario(user, request=None):
    return get_active_careers_for_user(user, request)


def _usuario_tiene_acceso_a_carrera(user, carrera, request=None):
    if not user or not user.is_authenticated or not carrera:
        return False
    if user.is_superuser:
        return True
    carreras = _obtener_carreras_activas_usuario(user, request)
    return carreras.filter(id=carrera.id).exists()


def _docentes_por_carreras(carreras):
    """Docentes con vínculo activo en esas carreras. Los de otra carrera (doble
    carrera) no salen en listas ni detalles: solo en DocenteViewSet.buscar, con
    nombre y últimos 4 dígitos del C.I."""
    if not carreras:
        return Docente.objects.none()
    return Docente.objects.filter(
        vinculos_carrera__carrera__in=carreras, vinculos_carrera__activo=True,
    ).distinct()


class CarreraInactivaSoloLecturaMixin(CarreraInactivaSoloLecturaBase):
    """Solo lectura para carreras inactivas en el módulo de fondos (ver fondos/solo_lectura.py)."""

    campos_con_carrera = {
        'carrera': Carrera,
        'fondo_tiempo': FondoTiempo,
        'fondo': FondoTiempo,
        'calendario': CalendarioAcademico,
        'materia': Materia,
        'carga_horaria': CargaHoraria,
    }

    def es_rol_solo_lectura(self, request):
        perfil = _obtener_perfil_efectivo(request.user, request)
        return bool(perfil and perfil.rol == 'iiisyp')

    def carreras_de_contexto(self, request):
        # Carrera de X-Active-Assignment o del perfil: si todas sus carreras están
        # inactivas, el usuario no puede escribir nada.
        carreras = _obtener_carreras_activas_usuario(request.user, request)
        if carreras.exists() and not carreras.filter(activo=True).exists():
            return [carreras.first()]
        return []


def _validar_revisor_del_fondo(request, fondo, accion):
    """Quién puede aprobar, observar, iniciar ejecución o evaluar un fondo.

    - Nadie actúa sobre su propio fondo.
    - El fondo del Director de la carrera lo revisa el superusuario.
    - El resto, el Director de la carrera (y, donde ya se permitía, el superusuario).
    Devuelve True si la revisión la hace el superusuario por ser fondo de un Director.
    """
    user = request.user
    if fondo.pertenece_a(user):
        raise PermissionDenied(f'No puedes {accion} tu propio fondo.')
    if fondo.es_de_director_de_su_carrera():
        if not user.is_superuser:
            raise PermissionDenied(f'El fondo del Director de la carrera solo lo puede {accion} el superusuario.')
        return True
    return False


class IsFullAdmin(BasePermission):
    """
    Permite acceso solo a usuarios autenticados que sean superusuarios.
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )

def _rol_activo(request):
    """Rol con el que trabaja el usuario (X-Active-Assignment), nunca el rol base del perfil."""
    perfil = _obtener_perfil_efectivo(request.user, request)
    return getattr(perfil, 'rol', None)


class IsAdminOrDirector(BasePermission):
    """Superusuario, o Director / Jefe de Estudios como rol activo."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or _rol_activo(request) in ['director', 'jefe_estudios']
        ))


class IsFullAdminOrDirectorCarrera(BasePermission):
    """
    Permite gestionar recursos de carrera al superusuario o al Director de Carrera.
    El alcance por carrera se aplica en get_queryset/get_object.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_superuser or _rol_activo(request) == 'director'
        ))

class DocenteViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    queryset = Docente.objects.select_related('user', 'datos_laborales').prefetch_related('vinculos_carrera__carrera').all()
    serializer_class = DocenteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'nombres', 'apellido_paterno', 'apellido_materno', 'datos_laborales__ci']
    ordering_fields = ['apellido_paterno', 'nombres']
    ordering = ['apellido_paterno']

    def get_permissions(self):
        """
        Restringir listado y creación a administradores.
        Docentes solo pueden ver/editar su propio perfil.
        """
        # Crear la ficha: superusuario o Director (en su carrera, ver perform_create).
        if self.action == 'create':
            return [IsFullAdminOrDirectorCarrera()]
        # Editar y eliminar: ESTRICTAMENTE para Admin Real (bloquea a Jefe de Estudios).
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsFullAdmin()]
            
        # List y Retrieve permitidos para autenticados (el filtro se hace en get_queryset)
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
            
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'], url_path='buscar')
    def buscar(self, request):
        """Búsqueda por nombre de docentes de OTRAS carreras, para el Jefe de Estudios que les
        asigna una materia de la suya (doble carrera). Solo nombre completo y los últimos 4
        dígitos del C.I.: no expone la ficha de otra carrera."""
        perfil = _obtener_perfil_efectivo(request.user, request)
        if not request.user.is_superuser and (not perfil or perfil.rol != 'jefe_estudios'):
            raise PermissionDenied('Solo Jefatura de Estudios busca docentes de otras carreras.')
        palabras = str(request.query_params.get('q') or '').split()
        if sum(len(palabra) for palabra in palabras) < 3:
            return Response([])
        docentes = Docente.objects.filter(activo=True, vinculos_carrera__activo=True).select_related(
            'user', 'datos_laborales',
        )
        if not request.user.is_superuser:
            # Los docentes de su propia carrera se gestionan desde su fondo.
            docentes = docentes.exclude(
                vinculos_carrera__carrera__in=_obtener_carreras_activas_usuario(request.user, request),
                vinculos_carrera__activo=True,
            )
        for palabra in palabras:
            docentes = docentes.filter(
                Q(nombres__icontains=palabra) | Q(apellido_paterno__icontains=palabra)
                | Q(apellido_materno__icontains=palabra) | Q(user__first_name__icontains=palabra)
                | Q(user__last_name__icontains=palabra)
            )
        resultados = []
        for docente in docentes.distinct().order_by('apellido_paterno', 'nombres')[:20]:
            ci = (docente.ci or '').strip()
            resultados.append({
                'id': docente.pk,
                'nombre_completo': docente.nombre_completo,
                'ci_ultimos': ci[-4:] if ci else '',
            })
        return Response(resultados)

    def get_queryset(self):
        user = self.request.user
        carrera_id = self.request.query_params.get('carrera')
        gestion_sin_fondo = self.request.query_params.get('sin_fondo_gestion')

        def aplicar_filtros_selector(qs):
            if carrera_id:
                qs = qs.filter(
                    vinculos_carrera__carrera_id=carrera_id,
                    vinculos_carrera__activo=True,
                )

            if gestion_sin_fondo:
                docentes_con_fondo = FondoTiempo.objects.filter(
                    gestion=gestion_sin_fondo,
                    archivado=False,
                ).values_list('docente_id', flat=True)
                qs = qs.exclude(id__in=docentes_con_fondo)

            return qs.distinct()
        
        # Superusuario ve todos los docentes sin restricciones
        if user.is_superuser:
            return aplicar_filtros_selector(Docente.objects.all())

        # Director, Jefe de Estudios e Instituto (rol activo): solo los docentes con
        # vínculo activo en su carrera. Antes el Jefe veía todos los de todas las carreras.
        perfil = _obtener_perfil_efectivo(user, self.request)
        if perfil and perfil.rol in ['iiisyp', 'director', 'jefe_estudios']:
            return aplicar_filtros_selector(
                _docentes_por_carreras(_obtener_carreras_activas_usuario(user, self.request))
            )

        # Docente: solo su propia ficha
        if perfil and perfil.rol == 'docente' and perfil.docente_id:
            return aplicar_filtros_selector(Docente.objects.filter(id=perfil.docente_id))

        return Docente.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        # Toda ficha de docente pertenece a un usuario (existente o creado con user_data).
        # Aquí y no en DocenteSerializer: el alta y la edición de usuarios lo usan para
        # crear la ficha antes de vincularla.
        if not serializer.validated_data.get('user') and not serializer.validated_data.get('user_data'):
            raise drf_serializers.ValidationError({'user': 'La ficha de docente debe estar vinculada a un usuario.'})
        if not user.is_superuser:
            # El Director solo crea fichas en su carrera y para usuarios que ya
            # están asignados a ella (no crea usuarios desde aquí).
            carrera = serializer.validated_data.get('carrera')
            usuario = serializer.validated_data.get('user')
            if not _usuario_tiene_acceso_a_carrera(user, carrera, self.request):
                raise PermissionDenied('Solo puedes crear fichas de docente en tu carrera.')
            if serializer.validated_data.get('user_data') or not usuario:
                raise PermissionDenied('Selecciona un usuario de tu carrera para crear su ficha de docente.')
            asignaciones_en_carrera = AsignacionCarrera.objects.filter(user=usuario, carrera=carrera)
            perfil_usuario = getattr(usuario, 'perfil', None)
            if perfil_usuario and perfil_usuario.inactivo_por_ficha_pendiente:
                # Inactivo por falta de ficha: su asignación docente está en pausa.
                asignaciones_en_carrera = asignaciones_en_carrera.filter(rol='docente')
            else:
                asignaciones_en_carrera = asignaciones_en_carrera.filter(activo=True)
            if not asignaciones_en_carrera.exists():
                raise PermissionDenied('El usuario seleccionado no pertenece a tu carrera.')
        # Un solo vínculo, en la carrera del usuario (la de su contrato).
        carreras_usuario = carreras_docencia_usuario(serializer.validated_data.get('user'))
        carrera_ficha = serializer.validated_data.get('carrera')
        if carreras_usuario and carrera_ficha and carrera_ficha.pk not in carreras_usuario:
            raise drf_serializers.ValidationError({'carrera': MENSAJE_FICHA_EN_CARRERA_DEL_USUARIO})
        # Dedicación y condición (titular o invitado) elegidas: no se asumen.
        vinculo = serializer.validated_data.get('_vinculo') or {}
        if not vinculo.get('dedicacion'):
            raise drf_serializers.ValidationError({'dedicacion': 'Seleccione la dedicación.'})
        if not vinculo.get('condicion'):
            raise drf_serializers.ValidationError({'condicion': 'Seleccione la condición (titular o invitado).'})
        # La fecha de ingreso es la real de planilla de RR.HH.: no se completa con la de hoy.
        if not serializer.validated_data.get('fecha_ingreso'):
            raise drf_serializers.ValidationError({
                'fecha_ingreso': 'La fecha de ingreso es obligatoria: use la fecha de la planilla de RR.HH.',
            })
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """
        Borrado inteligente del docente.
        Si existe trazabilidad, se bloquea explicando la causa exacta.
        Si no tiene historial, se elimina el docente y se limpian perfiles huérfanos
        para liberar el C.I. y evitar registros fantasmas.
        """
        docente = self.get_object()

        fondos_count = FondoTiempo.objects.filter(docente=docente).count()
        if fondos_count > 0:
            mensaje = (
                f'No se puede eliminar al docente porque tiene {fondos_count} '
                f'fondo(s) de tiempo registrados en el sistema.'
            )
            return Response(
                {'error': mensaje, 'detail': mensaje},
                status=status.HTTP_400_BAD_REQUEST
            )

        saldos_count = SaldoVacacionesGestion.objects.filter(docente=docente).count()
        if saldos_count > 0:
            mensaje = (
                f'No se puede eliminar al docente porque tiene {saldos_count} '
                f'registro(s) de saldo de vacaciones asociados.'
            )
            return Response(
                {'error': mensaje, 'detail': mensaje},
                status=status.HTTP_400_BAD_REQUEST
            )

        cargas_qs = CargaHoraria.objects.filter(docente=docente)
        cargas_count = cargas_qs.count()
        if cargas_count > 0:
            gestiones = list(
                cargas_qs.order_by().values_list('fondo__gestion', flat=True).distinct()
            )
            detalle_gestiones = f" en la(s) gestión(es) {', '.join(map(str, gestiones))}" if gestiones else ''
            mensaje = (
                f'No se puede eliminar al docente porque tiene {cargas_count} '
                f'materia(s) o carga(s) horaria(s) asignada(s){detalle_gestiones}.'
            )
            return Response(
                {'error': mensaje, 'detail': mensaje},
                status=status.HTTP_400_BAD_REQUEST
            )

        perfiles = list(PerfilUsuario.objects.filter(docente=docente).select_related('user'))
        for perfil in perfiles:
            if not perfil.user_id:
                continue

            user = perfil.user

            historial_count = HistorialFondo.objects.filter(usuario=user).count()
            if historial_count > 0:
                mensaje = (
                    f'No se puede eliminar al docente porque el usuario "{user.username}" '
                    f'tiene {historial_count} registro(s) de historial de fondos.'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

            informes_elaborados = InformeFondo.objects.filter(elaborado_por=user).count()
            if informes_elaborados > 0:
                mensaje = (
                    f'No se puede eliminar: ya existen {informes_elaborados} informe(s) '
                    f'elaborado(s) por el usuario "{user.username}".'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

            informes_evaluados = InformeFondo.objects.filter(evaluado_por=user).count()
            if informes_evaluados > 0:
                mensaje = (
                    f'No se puede eliminar: ya existen {informes_evaluados} informe(s) '
                    f'evaluado(s) por el usuario "{user.username}".'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

            observaciones_resueltas = ObservacionFondo.objects.filter(resuelta_por=user).count()
            if observaciones_resueltas > 0:
                mensaje = (
                    f'No se puede eliminar: el usuario "{user.username}" ya resolvió '
                    f'{observaciones_resueltas} observación(es) de fondos.'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

            mensajes_count = MensajeObservacion.objects.filter(autor=user).count()
            if mensajes_count > 0:
                mensaje = (
                    f'No se puede eliminar: ya existen {mensajes_count} mensaje(s) u observación(es) '
                    f'firmados por el usuario "{user.username}".'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

            cargas_creadas = CargaHoraria.objects.filter(creado_por=user).count()
            if cargas_creadas > 0:
                mensaje = (
                    f'No se puede eliminar: el usuario "{user.username}" creó '
                    f'{cargas_creadas} registro(s) de carga horaria.'
                )
                return Response({'error': mensaje, 'detail': mensaje}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                for perfil in perfiles:
                    if not perfil.user_id:
                        perfil.delete()

                docente_nombre = docente.nombre_completo
                docente.delete()

                return Response(
                    {
                        'success': f'Docente "{docente_nombre}" eliminado correctamente.',
                        'detail': 'Se eliminó el docente sin historial y se liberó el C.I. asociado.'
                    },
                    status=status.HTTP_204_NO_CONTENT
                )

        except Exception as e:
            mensaje = f'Error interno al eliminar docente: {str(e)}'
            return Response(
                {'error': mensaje, 'detail': mensaje},
                status=status.HTTP_400_BAD_REQUEST
            )


class SaldoVacacionesGestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar saldos de vacaciones por docente y gestión.
    Permite cargar masivamente los saldos del PDF de 'Vacaciones 2024'.
    """
    queryset = SaldoVacacionesGestion.objects.all()
    serializer_class = SaldoVacacionesGestionSerializer
    permission_classes = [IsFullAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['docente__nombres', 'docente__apellido_paterno', 'docente__apellido_materno', 'gestion']
    ordering_fields = ['gestion', 'docente']
    ordering = ['-gestion', 'docente']

    def get_queryset(self):
        """Solo admin puede acceder a los saldos de vacaciones."""
        return SaldoVacacionesGestion.objects.all()

    @action(detail=False, methods=['post'], permission_classes=[IsFullAdmin])
    def cargar_masivo(self, request):
        """
        Endpoint para cargar masivamente saldos de vacaciones.
        
        Esperado (JSON):
        [
            {"docente_id": 5, "gestion": 2024, "dias_disponibles": 15},
            {"docente_id": 7, "gestion": 2024, "dias_disponibles": 20},
            ...
        ]
        
        Retorna: Cantidad de registros creados/actualizados y errores (si los hay)
        """
        data = request.data
        
        if not isinstance(data, list):
            return Response(
                {'error': 'Se esperaba una lista de registros'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resultado = {
            'creados': 0,
            'actualizados': 0,
            'errores': []
        }
        
        for idx, item in enumerate(data):
            serializer = SaldoVacacionesGestionSerializer(data=item)
            if serializer.is_valid():
                try:
                    obj, created = SaldoVacacionesGestion.objects.update_or_create(
                        docente_id=item.get('docente_id'),
                        gestion=item.get('gestion'),
                        defaults={'dias_disponibles': item.get('dias_disponibles')}
                    )
                    if created:
                        resultado['creados'] += 1
                    else:
                        resultado['actualizados'] += 1
                except Exception as e:
                    resultado['errores'].append({
                        'fila': idx + 1,
                        'docente_id': item.get('docente_id'),
                        'gestion': item.get('gestion'),
                        'error': str(e)
                    })
            else:
                resultado['errores'].append({
                    'fila': idx + 1,
                    'validacion': serializer.errors
                })
        
        return Response(resultado, status=status.HTTP_201_CREATED if resultado['errores'] == [] else status.HTTP_207_MULTI_STATUS)


class DatosLaboralesViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar DatosLaborales de cualquier usuario.

    Solo el superusuario puede gestionar los datos de empleo (vacaciones,
    feriados, antigüedad) de usuarios administrativos puros.
    """
    # "perfiles" es una relación inversa (FK desde PerfilUsuario): va en
    # prefetch_related; con select_related la consulta fallaba (error 500).
    queryset = DatosLaborales.objects.all().select_related('docente').prefetch_related('perfiles')
    serializer_class = DatosLaboralesSerializer
    permission_classes = [IsFullAdmin]
    # Sin DELETE: borrar DatosLaborales borraría en cascada la ficha de docente
    # saltándose las validaciones de DocenteViewSet.destroy (única vía de borrado).
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ci', 'docente__nombres', 'docente__apellido_paterno']
    ordering_fields = ['fecha_ingreso', 'ci']
    ordering = ['-fecha_creacion']

    def get_queryset(self):
        return DatosLaborales.objects.all().select_related('docente').prefetch_related('perfiles')


class CarreraViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    queryset = Carrera.objects.all()
    serializer_class = CarreraSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['nombre', 'codigo', 'facultad__nombre']

    def get_queryset(self):
        queryset = Carrera.objects.all()
        user = self.request.user

        # ?activo=false: el aviso de solo lectura del superusuario lista las inactivas.
        activo = self.request.query_params.get('activo')
        if activo is not None:
            queryset = queryset.filter(activo=activo.strip().lower() in ('true', '1', 'si', 'yes'))

        if self._is_superuser(user):
            return queryset

        # Director, Jefe, Instituto y Docente: solo la carrera de su rol activo.
        carreras = _obtener_carreras_activas_usuario(user, self.request)
        return queryset.filter(id__in=carreras.values_list('id', flat=True))

    def get_permissions(self):
        # Crear y eliminar carreras: solo superusuario.
        if self.action in ['create', 'destroy']:
            return [IsAuthenticated()]

        # Actualizar carreras: permitido para autenticados,
        # pero con validación fina por rol en update/partial_update.
        if self.action in ['update', 'partial_update']:
            return [IsAuthenticated()]

        return [IsAuthenticated()]

    def _is_superuser(self, user):
        return bool(user and user.is_authenticated and user.is_superuser)

    def permite_escritura_en_carrera_inactiva(self, request):
        # Única excepción al solo lectura: el superusuario reactiva la carrera
        # (update() rechaza que esa petición cambie algo más que `activo`).
        activo = str(request.data.get('activo', '')).strip().lower() if hasattr(request.data, 'get') else ''
        return (
            self._is_superuser(request.user)
            and self.action in ('update', 'partial_update')
            and activo in ('true', '1', 'yes', 'si', 'on')
        )

    def _rol_usuario(self, user):
        """Rol activo del usuario (no el rol base del perfil)."""
        if not user or not user.is_authenticated:
            return None
        return _rol_activo(self.request)

    def _can_edit_logo_only(self, user):
        return self._rol_usuario(user) == 'jefe_estudios'

    def _can_edit_own_profile(self, user):
        return self._rol_usuario(user) == 'director'

    def _user_can_access_carrera(self, user, carrera):
        if self._is_superuser(user):
            return True
        carreras = _obtener_carreras_activas_usuario(user, self.request)
        return carreras.filter(pk=carrera.pk).exists()

    def _enforce_create_destroy_permission(self, request):
        if not self._is_superuser(request.user):
            raise PermissionDenied('Solo el superusuario puede crear o eliminar carreras.')

    def _enforce_manage_facultad_permission(self, request):
        if not self._is_superuser(request.user):
            raise PermissionDenied('Solo el superusuario puede gestionar facultades.')

    @staticmethod
    def _buscar_facultad(nombre):
        """Facultad del catálogo con nombre equivalente (sin distinguir mayúsculas ni tildes)."""
        nombre_norm = FacultadCatalogo._normalizar(nombre)
        for facultad in FacultadCatalogo.objects.all():
            if FacultadCatalogo._normalizar(facultad.nombre) == nombre_norm:
                return facultad
        return None

    @staticmethod
    def _mensaje_validacion(error):
        """Primer mensaje legible de un ValidationError de Django."""
        if hasattr(error, 'message_dict'):
            mensajes = [m for msgs in error.message_dict.values() for m in msgs]
            return mensajes[0] if mensajes else 'Dato inválido.'
        if hasattr(error, 'message'):
            return error.message
        return str(error)

    def _serialize_facultades(self):
        # Solo devolver facultades que están en el catálogo editable
        # No incluir las por defecto para evitar confusión al eliminar
        return [
            {'value': facultad.nombre, 'label': facultad.nombre}
            for facultad in FacultadCatalogo.objects.order_by('nombre')
        ]

    def create(self, request, *args, **kwargs):
        self._enforce_create_destroy_permission(request)
        return super().create(request, *args, **kwargs)

    def _build_dependency_counts(self, carrera):
        # Todo lo que apunta a Carrera. Una carrera solo se puede eliminar si todo es 0.
        from poa_document.models import UsuarioPOA, ProgramaPOA, OrdenCompraPOA

        fondos_qs = FondoTiempo.objects.filter(carrera=carrera)
        dependencias = [
            ('materias', 'Materias', Materia.objects.filter(carrera=carrera).count()),
            ('fondos', 'Fondos de tiempo', fondos_qs.count()),
            ('informes', 'Informes', InformeFondo.objects.filter(fondo_tiempo__in=fondos_qs).count()),
            ('docentes_vinculados', 'Docentes vinculados', DocenteCarrera.objects.filter(carrera=carrera).count()),
            ('asignaciones', 'Asignaciones de usuarios', AsignacionCarrera.objects.filter(carrera=carrera).count()),
            ('perfiles', 'Perfiles de usuario', PerfilUsuario.objects.filter(carrera=carrera).count()),
            ('calendarios', 'Calendarios académicos', CalendarioAcademico.objects.filter(carrera=carrera).count()),
            ('usuarios_poa', 'Usuarios POA', UsuarioPOA.objects.filter(carrera=carrera).count()),
            ('programas_poa', 'Programas POA', ProgramaPOA.objects.filter(carrera=carrera).count()),
            ('ordenes_compra_poa', 'Órdenes de compra POA', OrdenCompraPOA.objects.filter(carrera=carrera).count()),
        ]
        counts = {clave: cantidad for clave, _etiqueta, cantidad in dependencias}
        counts['detalle'] = [
            {'clave': clave, 'etiqueta': etiqueta, 'cantidad': cantidad, 'academico': clave in self.DEPENDENCIAS_ACADEMICAS}
            for clave, etiqueta, cantidad in dependencias
            if cantidad > 0
        ]
        counts['tiene_datos'] = bool(counts['detalle'])
        counts['tiene_datos_academicos'] = any(item['academico'] for item in counts['detalle'])
        counts['can_delete'] = not counts['tiene_datos']
        return counts

    # Datos académicos: si existen, la identidad de la carrera queda fija porque ya
    # aparece en documentos. Usuarios, perfiles y POA no la bloquean (sí impiden borrar).
    DEPENDENCIAS_ACADEMICAS = {'materias', 'fondos', 'informes', 'docentes_vinculados', 'calendarios'}

    @staticmethod
    def _texto_dependencias(counts, solo_academicas=False):
        return ', '.join(
            f"{item['etiqueta']}: {item['cantidad']}"
            for item in counts['detalle']
            if item['academico'] or not solo_academicas
        )

    # Datos que identifican a la carrera en documentos oficiales. Si la carrera ya
    # tiene datos académicos no se pueden cambiar; el resto (misión, visión,
    # perfil, objetivo, logo) sigue editable.
    CAMPOS_IDENTIDAD = {
        'nombre': 'el nombre',
        'codigo': 'el código',
        'facultad': 'la facultad',
        'resolucion_ministerial': 'la Resolución de Creación (HCU)',
        'fecha_resolucion': 'la fecha de resolución de creación (HCU)',
    }

    @staticmethod
    def _valor_identidad(valor):
        if isinstance(valor, str):
            return valor.strip()
        return getattr(valor, 'pk', valor)

    def _validar_campos_identidad(self, carrera, validated_data):
        cambiados = [
            campo for campo in self.CAMPOS_IDENTIDAD
            if campo in validated_data
            and self._valor_identidad(validated_data[campo]) != self._valor_identidad(getattr(carrera, campo))
        ]
        if not cambiados:
            return
        counts = self._build_dependency_counts(carrera)
        if not counts['tiene_datos_academicos']:
            return
        texto = self._texto_dependencias(counts, solo_academicas=True)
        raise drf_serializers.ValidationError({
            campo: (
                f'No se puede cambiar {self.CAMPOS_IDENTIDAD[campo]} de la carrera porque ya tiene '
                f'datos académicos ({texto}).'
            )
            for campo in cambiados
        })

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dependencias(self, request, pk=None):
        carrera = self.get_object()
        counts = self._build_dependency_counts(carrera)
        return Response(counts, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated], url_path='pdf-oficial')
    def generar_pdf_oficial(self, request, pk=None):
        carrera = self.get_object()
        if not self._user_can_access_carrera(request.user, carrera):
            raise PermissionDenied('No tienes acceso a esta carrera.')

        buffer = CarreraPDFGenerator.generar_ficha(carrera)
        nombre = ''.join(
            char if char.isalnum() else '_'
            for char in f"{carrera.nombre}_{carrera.codigo}"
        ).strip('_')
        nombre_archivo = f"Carrera_{nombre or carrera.pk}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=nombre_archivo)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def facultades(self, request):
        opciones = self._serialize_facultades()
        return Response(opciones, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='facultades/agregar')
    def agregar_facultad(self, request):
        self._enforce_manage_facultad_permission(request)

        nombre = str(request.data.get('value') or request.data.get('nombre') or '').strip()
        if not nombre:
            return Response(
                {'detail': 'Debe enviar el nombre de la facultad.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core.exceptions import ValidationError
        try:
            FacultadCatalogo.objects.create(nombre=nombre)
        except ValidationError as e:
            return Response(
                {'detail': self._mensaje_validacion(e)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(self._serialize_facultades(), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['patch'], permission_classes=[IsAuthenticated], url_path='facultades/renombrar')
    def renombrar_facultad(self, request):
        """Cambia el nombre de la MISMA facultad: sus carreras siguen vinculadas a ella."""
        self._enforce_manage_facultad_permission(request)

        actual = str(request.data.get('value') or '').strip()
        nuevo = str(request.data.get('nuevo') or '').strip()
        if not actual or not nuevo:
            return Response(
                {'detail': 'Debe enviar la facultad y su nombre nuevo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        facultad = self._buscar_facultad(actual)
        if not facultad:
            return Response(
                {'detail': 'La facultad no existe en el catálogo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from django.core.exceptions import ValidationError
        facultad.nombre = nuevo
        try:
            # save() valida que no exista otra con nombre equivalente (sin mayúsculas ni tildes).
            facultad.save()
        except ValidationError as e:
            return Response(
                {'detail': self._mensaje_validacion(e)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(self._serialize_facultades(), status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='facultades/eliminar')
    def eliminar_facultad(self, request):
        self._enforce_manage_facultad_permission(request)

        nombre = str(request.data.get('value') or request.data.get('nombre') or '').strip()
        if not nombre:
            return Response(
                {'detail': 'Debe enviar la facultad a eliminar.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        facultad = self._buscar_facultad(nombre)

        if not facultad:
            return Response(
                {'detail': 'La facultad no existe en el catálogo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        carreras_vinculadas = Carrera.objects.filter(facultad=facultad).count()
        if carreras_vinculadas:
            return Response(
                {
                    'detail': (
                        f'No se puede eliminar "{facultad.nombre}": tiene {carreras_vinculadas} '
                        f'carrera(s) vinculada(s). Cámbieles la facultad antes de eliminarla.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        facultad.delete()
        return Response(self._serialize_facultades(), status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        self._enforce_create_destroy_permission(request)
        carrera = self.get_object()
        counts = self._build_dependency_counts(carrera)

        if not counts['can_delete']:
            return Response(
                {
                    'code': 'dependency_exists',
                    'detail': (
                        f"No se puede eliminar la carrera {carrera.nombre} porque tiene datos asociados "
                        f"({self._texto_dependencias(counts)})."
                    ),
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            carrera.delete()
            return Response({'detail': 'Carrera eliminada correctamente.'}, status=status.HTTP_200_OK)
        except ProtectedError:
            # Relación nueva que el conteo todavía no conoce: la base de datos la protege igual.
            return Response(
                {
                    'code': 'protected_error',
                    'detail': f"No se puede eliminar la carrera {carrera.nombre} porque tiene datos asociados.",
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT,
            )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        user = request.user

        # Superusuario: edición total de carrera.
        if self._is_superuser(user):
            # Carrera inactiva: la única escritura permitida es reactivarla, sola.
            # Editar el resto se hace después, con la carrera ya activa.
            if not instance.activo:
                otros_campos = sorted(set(request.data.keys()) - {'activo'})
                if otros_campos:
                    return Response(
                        {
                            'code': 'reactivar_primero',
                            'detail': 'Primero reactive la carrera y luego edítela.',
                            'campos': otros_campos,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Desactivar carrera: advertir con conteo pero permitir
            raw_activo = request.data.get('activo', None)
            if raw_activo is not None:
                normalized = str(raw_activo).strip().lower()
                next_activo = normalized in ['true', '1', 'yes', 'si', 'on']

                if instance.activo and not next_activo:
                    counts = self._build_dependency_counts(instance)
                    if counts['tiene_datos']:
                        # Se permite desactivar pero con advertencia en la respuesta
                        request._desactivar_warning = (
                            f'Advertencia: se está desactivando la carrera "{instance.nombre}" '
                            f'que tiene datos asociados: {self._texto_dependencias(counts)}.'
                        )

            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self._validar_campos_identidad(instance, serializer.validated_data)
            self.perform_update(serializer)

            response_data = serializer.data.copy()
            if hasattr(request, '_desactivar_warning'):
                response_data['_warning'] = request._desactivar_warning

            return Response(response_data, status=status.HTTP_200_OK)

        # Autoridades (admin/director/jefe): solo edición de logo desde modal Ver.
        if self._can_edit_own_profile(user):
            if not self._user_can_access_carrera(user, instance):
                raise PermissionDenied('Solo puedes editar la carrera asociada a tu usuario.')

            data = request.data.copy()
            allowed_fields = {
                'resolucion_ministerial',
                'fecha_resolucion',
                'mision',
                'vision',
                'perfil_profesional',
                'objetivo_carrera',
                'logo_carrera_file',
                'remove_logo_carrera',
            }

            for field in list(data.keys()):
                if field not in allowed_fields:
                    data.pop(field, None)

            if not data:
                raise drf_serializers.ValidationError({
                    'detail': 'No hay campos institucionales para actualizar.'
                })

            serializer = self.get_serializer(instance, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            self._validar_campos_identidad(instance, serializer.validated_data)
            self.perform_update(serializer)
            return Response(serializer.data, status=status.HTTP_200_OK)

        if self._can_edit_logo_only(user):
            if not self._user_can_access_carrera(user, instance):
                raise PermissionDenied('Solo puedes editar la carrera asociada a tu usuario.')

            data = request.data.copy()
            allowed_fields = {'logo_carrera_file', 'remove_logo_carrera'}
            provided_fields = set(data.keys())

            # Si no se envía logo ni bandera de eliminación, no hay nada que actualizar.
            if not provided_fields.intersection(allowed_fields):
                raise drf_serializers.ValidationError({
                    'logo_carrera_file': 'Solo puedes actualizar el logo de la carrera.'
                })

            for field in list(data.keys()):
                if field not in allowed_fields:
                    data.pop(field, None)

            serializer = self.get_serializer(instance, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data, status=status.HTTP_200_OK)

        raise PermissionDenied('No tienes permiso para editar carreras.')

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class MateriaViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    queryset = Materia.objects.select_related('carrera').all()
    serializer_class = MateriaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['semestre', 'carrera', 'activo']
    search_fields = ['nombre', 'sigla', 'carrera__nombre']
    ordering_fields = ['semestre', 'nombre', 'carrera']
    ordering = ['carrera', 'semestre', 'nombre']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Superusuario ve todas las materias sin restricciones
        if user.is_superuser:
            return queryset

        # Todos los demás (Jefe, Director, Instituto y Docente) ven solo las
        # materias de sus carreras.
        carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
        if not carreras_activas.exists():
            return queryset.none()
        return queryset.filter(carrera__in=carreras_activas)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrDirector()]
        return [IsAuthenticated()]

    def _validar_carrera_propia(self, carrera):
        """Director y Jefe de Estudios solo gestionan materias de su carrera; el superusuario, de todas."""
        if not carrera or self.request.user.is_superuser:
            return
        if not _usuario_tiene_acceso_a_carrera(self.request.user, carrera, self.request):
            raise PermissionDenied('Solo puedes gestionar materias de tu carrera.')

    def perform_create(self, serializer):
        carrera = serializer.validated_data.get('carrera')
        if carrera and not carrera.activo:
            raise PermissionDenied('No se puede crear una materia en una carrera inactiva.')
        self._validar_carrera_propia(carrera)
        serializer.save()

    def perform_update(self, serializer):
        self._validar_carrera_propia(serializer.validated_data.get('carrera'))
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Una materia con cargas horarias no se elimina (se conserva el historial): se desactiva."""
        materia = self.get_object()
        cargas = CargaHoraria.objects.filter(materia=materia).count()
        if cargas:
            mensaje = (
                f'No se puede eliminar la materia {materia.nombre}: tiene {cargas} carga(s) horaria(s). '
                'Desactívela en su lugar.'
            )
            return Response({'error': mensaje, 'detail': mensaje, 'cargas_horarias': cargas},
                            status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class CargaHorariaViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    """
    ViewSet para la asignación de horas por parte de Jefes de Estudio y Admins.
    - Jefes/Admins: CRUD completo.
    - Directores: Lectura de su carrera.
    - Docentes: Lectura de sus propias asignaciones.
    """
    queryset = CargaHoraria.objects.select_related('docente', 'fondo', 'materia', 'calendario', 'creado_por').all()
    serializer_class = CargaHorariaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['fondo', 'docente', 'calendario', 'categoria', 'materia', 'paralelo', 'dia_semana', 'aula']
    search_fields = ['materia__nombre', 'materia__sigla', 'docente__nombres', 'docente__apellido_paterno', 'aula']
    ordering_fields = ['fondo__gestion', 'docente', 'horas', 'dia_semana', 'hora_inicio']
    # 'id' desempata: sin él, las páginas de un mismo fondo pueden repetir u omitir cargas.
    ordering = ['-fondo__gestion', 'id']

    def get_permissions(self):
        """
        Super Admin y Jefes de Estudio pueden crear, editar o borrar.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            user = self.request.user
            if not user.is_superuser and _rol_activo(self.request) != 'jefe_estudios':
                raise PermissionDenied("Solo Jefes de Estudio pueden modificar cargas horarias.")
        
        return super().get_permissions()

    def get_queryset(self):
        """
        Filtra la carga horaria según el rol del usuario.
        """
        user = self.request.user
        queryset = super().get_queryset()
        # El superusuario ve, edita y elimina todas (su perfil no tiene rol de carrera).
        if user.is_superuser:
            return queryset
        try:
            perfil = _obtener_perfil_efectivo(user, self.request)
        except Exception:
            perfil = None

        # Sin perfil no hay carrera ni ficha: no ve ninguna (antes veía todas).
        if not perfil:
            return queryset.none()

        if perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
            carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
            if carreras_activas.exists():
                # Las cargas de los fondos de su carrera y las materias de sus calendarios.
                return queryset.filter(
                    Q(fondo__carrera__in=carreras_activas) | Q(calendario__carrera__in=carreras_activas)
                )
            return queryset.none()

        if perfil.rol == 'docente' and perfil.docente:
            return queryset.filter(docente=perfil.docente)

        return queryset.none()
    
    def _validar_estado_fondo(self, fondo):
        """Valida que el fondo de la carga esté en estado editable (borrador/observado)."""
        if fondo.archivado:
            raise PermissionDenied("No se puede modificar la carga horaria porque el Fondo de Tiempo está archivado.")

        if fondo.carrera and not fondo.carrera.activo:
            raise PermissionDenied("No se puede modificar la carga horaria porque la carrera está inactiva.")

        if fondo.estado not in ['borrador', 'observado']:
            raise PermissionDenied(f"No se puede modificar la carga horaria. El fondo está en estado '{fondo.get_estado_display()}'.")

    def _validar_carrera_responsable(self, fondo, calendario):
        """Las materias las gestiona el Jefe de la carrera del calendario (en doble carrera,
        el de otra carrera asigna al fondo del docente en la suya); los demás ítems, el
        Jefe de la carrera del fondo."""
        carrera = calendario.carrera if calendario else fondo.carrera
        if not _usuario_tiene_acceso_a_carrera(self.request.user, carrera, self.request):
            raise PermissionDenied(
                f'Solo el Jefe de Estudios de {carrera.nombre} puede gestionar esta carga horaria.'
            )

    def perform_create(self, serializer):
        # El serializer asigna el fondo (o rechaza la carga si el docente no tiene).
        datos = serializer.validated_data
        self._validar_carrera_responsable(datos['fondo'], datos.get('calendario'))
        self._validar_estado_fondo(datos['fondo'])
        serializer.save()

    def perform_update(self, serializer):
        # Si cambian el docente o el calendario, la carga pasa a otro fondo: ambos deben ser editables.
        instance = serializer.instance
        datos = serializer.validated_data
        self._validar_carrera_responsable(instance.fondo, instance.calendario)
        self._validar_carrera_responsable(datos['fondo'], datos.get('calendario'))
        self._validar_estado_fondo(instance.fondo)
        self._validar_estado_fondo(datos['fondo'])
        carga = serializer.save()
        # Si el ítem deja de ser proyecto o curso, su documento ya no corresponde.
        if not clase_documento_actividad(carga.tipo_actividad):
            DocumentoActividad.objects.filter(carga=carga).delete()

    def perform_destroy(self, instance):
        self._validar_carrera_responsable(instance.fondo, instance.calendario)
        self._validar_estado_fondo(instance.fondo)
        instance.delete()

# =====================================================
# PROGRAMA ANALÍTICO (Art. 15 y 18)
# =====================================================

class ProgramaAnaliticoViewSet(CarreraInactivaSoloLecturaMixin, viewsets.GenericViewSet):
    """POST /api/programas-analiticos/: sube o reemplaza el PDF del programa analítico de
    una materia en un calendario del fondo. Lo hacen el superusuario y el Jefe de
    Estudios de la carrera de la materia, con el fondo en borrador u observado."""
    queryset = ProgramaAnalitico.objects.all()
    serializer_class = ProgramaAnaliticoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        fondo, materia, calendario = datos['fondo'], datos['materia'], datos['calendario']

        if not request.user.is_superuser:
            perfil = _obtener_perfil_efectivo(request.user, request)
            if not (perfil and perfil.rol == 'jefe_estudios'
                    and _usuario_tiene_acceso_a_carrera(request.user, calendario.carrera, request)):
                raise PermissionDenied(
                    f'Solo el Jefe de Estudios de {calendario.carrera.nombre} sube el programa analítico de esta materia.'
                )
        if fondo.archivado or fondo.estado not in ['borrador', 'observado']:
            raise PermissionDenied('El programa analítico solo se sube con el fondo en borrador u observado.')

        programa = ProgramaAnalitico.objects.filter(fondo=fondo, materia=materia, calendario=calendario).first()
        anterior = programa.archivo.name if programa and programa.archivo else None
        if programa is None:
            programa = ProgramaAnalitico(fondo=fondo, materia=materia, calendario=calendario)
        if anterior:
            # Reemplazo: se borra el PDF anterior para que el nuevo quede con el mismo nombre.
            programa.archivo.storage.delete(anterior)
        programa.archivo = datos['archivo']
        programa.subido_por = request.user
        programa.save()
        return Response(
            self.get_serializer(programa).data,
            status=status.HTTP_200_OK if anterior else status.HTTP_201_CREATED,
        )

# =====================================================
# DOCUMENTO DE PROYECTO O CURSO (Arts. 14, 16, 17 y 20)
# =====================================================

class DocumentoActividadViewSet(CarreraInactivaSoloLecturaMixin, viewsets.GenericViewSet):
    """POST /api/documentos-actividad/: sube o reemplaza el PDF del proyecto o curso de un
    ítem del fondo. Como el programa analítico: el superusuario o el Jefe de Estudios de la
    carrera del fondo, con el fondo en borrador u observado."""
    queryset = DocumentoActividad.objects.all()
    serializer_class = DocumentoActividadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        carga = serializer.validated_data['carga']
        fondo = carga.fondo

        if not request.user.is_superuser:
            perfil = _obtener_perfil_efectivo(request.user, request)
            if not (perfil and perfil.rol == 'jefe_estudios'
                    and _usuario_tiene_acceso_a_carrera(request.user, fondo.carrera, request)):
                raise PermissionDenied(
                    f'Solo el Jefe de Estudios de {fondo.carrera.nombre} sube el documento de esta actividad.'
                )
        if fondo.archivado or fondo.estado not in ['borrador', 'observado']:
            raise PermissionDenied('El documento solo se sube con el fondo en borrador u observado.')

        documento = DocumentoActividad.objects.filter(carga=carga).first()
        anterior = documento.archivo.name if documento and documento.archivo else None
        if documento is None:
            documento = DocumentoActividad(carga=carga)
        if anterior:
            # Reemplazo: se borra el PDF anterior para que el nuevo quede con el mismo nombre.
            documento.archivo.storage.delete(anterior)
        documento.archivo = serializer.validated_data['archivo']
        documento.subido_por = request.user
        documento.save()
        return Response(
            self.get_serializer(documento).data,
            status=status.HTTP_200_OK if anterior else status.HTTP_201_CREATED,
        )

# =====================================================
# CALENDARIO ACADÉMICO VIEWSET
# =====================================================

class CalendarioAcademicoViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    """ViewSet para gestionar calendarios académicos"""
    queryset = CalendarioAcademico.objects.select_related('carrera').all()
    serializer_class = CalendarioAcademicoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['gestion', 'periodo']
    ordering = ['-gestion', '-periodo']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_superuser:
            carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
            queryset = queryset.filter(carrera__in=carreras_activas) if carreras_activas.exists() else queryset.none()

        carrera_id = self.request.query_params.get('carrera')
        if carrera_id:
            queryset = queryset.filter(carrera_id=carrera_id)

        return queryset
    
    def get_permissions(self):
        """Superusuario, Director y Jefe de Estudios pueden gestionar calendarios."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrDirector()]
        return [IsAuthenticated()]

    def _validar_carrera_propia(self, carrera):
        """Director y Jefe de Estudios solo gestionan calendarios de su carrera; el superusuario, de todas."""
        if not carrera or self.request.user.is_superuser:
            return
        if not _usuario_tiene_acceso_a_carrera(self.request.user, carrera, self.request):
            raise PermissionDenied('Solo puedes gestionar calendarios de tu carrera.')

    @staticmethod
    def _recalcular_fondos(*gestiones):
        """Los fondos no presentados de esas (carrera, gestión) toman feriados e inicio de gestión nuevos."""
        for carrera_id, gestion in set(gestiones):
            FondoTiempo.recalcular_encabezados_de_gestion(carrera_id, gestion)

    def perform_create(self, serializer):
        self._validar_carrera_propia(serializer.validated_data.get('carrera'))
        with transaction.atomic():
            calendario = serializer.save()
            self._recalcular_fondos((calendario.carrera_id, calendario.gestion))

    def perform_update(self, serializer):
        carrera = serializer.validated_data.get('carrera')
        # Solo el superusuario mueve un calendario a otra carrera.
        if carrera and carrera.pk != serializer.instance.carrera_id and not self.request.user.is_superuser:
            raise PermissionDenied('No puedes mover el calendario a otra carrera.')
        self._validar_carrera_propia(carrera)
        anterior = (serializer.instance.carrera_id, serializer.instance.gestion)
        with transaction.atomic():
            calendario = serializer.save()
            # Feriados de la gestión: el mismo valor en todos sus calendarios de la carrera.
            CalendarioAcademico.objects.filter(
                carrera_id=calendario.carrera_id, gestion=calendario.gestion,
            ).exclude(pk=calendario.pk).update(dias_feriados_gestion=calendario.dias_feriados_gestion)
            self._recalcular_fondos(anterior, (calendario.carrera_id, calendario.gestion))

    def _build_dependency_counts(self, calendario):
        cargas_horarias_count = CargaHoraria.objects.filter(calendario=calendario).count()
        # El último calendario de la gestión en la carrera da a sus fondos los feriados y
        # el inicio de la gestión (antigüedad): no se borra mientras haya fondos.
        es_el_unico = not CalendarioAcademico.objects.filter(
            carrera_id=calendario.carrera_id, gestion=calendario.gestion,
        ).exclude(pk=calendario.pk).exists()
        fondos_gestion_count = FondoTiempo.objects.filter(
            carrera_id=calendario.carrera_id, gestion=calendario.gestion,
        ).count() if es_el_unico else 0
        can_delete = cargas_horarias_count == 0 and fondos_gestion_count == 0

        if fondos_gestion_count:
            detalle = (
                f'No se puede eliminar: es el único calendario de la gestión {calendario.gestion} '
                f'y hay {fondos_gestion_count} fondos de esa gestión.'
            )
        elif cargas_horarias_count:
            detalle = f'No se puede eliminar porque tiene {cargas_horarias_count} cargas horarias asociadas.'
        else:
            detalle = ''

        return {
            'cargas_horarias': cargas_horarias_count,
            'fondos_gestion': fondos_gestion_count,
            'detalle': detalle,
            'can_delete': can_delete,
            'has_dependencies': not can_delete,
        }

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dependencias(self, request, pk=None):
        calendario = self.get_object()
        counts = self._build_dependency_counts(calendario)
        return Response(counts, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """Eliminar calendario respetando integridad referencial (PROTECT)."""
        instance = self.get_object()
        counts = self._build_dependency_counts(instance)
        if not counts['can_delete']:
            return Response(
                {
                    'code': 'protected_error',
                    'detail': counts['detalle'],
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT
            )

        try:
            grupo = (instance.carrera_id, instance.gestion)
            with transaction.atomic():
                instance.delete()
                self._recalcular_fondos(grupo)
            return Response({'detail': 'Calendario eliminado correctamente.'}, status=status.HTTP_200_OK)
        except ProtectedError:
            counts = self._build_dependency_counts(instance)
            detalle_dependencias = (
                f"{counts['cargas_horarias']} cargas horarias asociadas"
                if counts['cargas_horarias'] else 'dependencias protegidas'
            )
            return Response(
                {
                    'code': 'protected_error',
                    'detail': f"No se puede eliminar porque tiene {detalle_dependencias}.",
                    'dependencias': counts,
                },
                status=status.HTTP_409_CONFLICT
            )
        except IntegrityError:
            counts = self._build_dependency_counts(instance)
            return Response(
                {
                    'code': 'integrity_error',
                    'detail': 'No se puede eliminar el calendario por integridad referencial.',
                    'dependencias': counts,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def activo(self, request):
        """Obtener el calendario académico activo"""
        queryset = self.get_queryset().filter(activo=True)
        carrera_id = request.query_params.get('carrera')
        if carrera_id:
            queryset = queryset.filter(carrera_id=carrera_id)
        calendario = queryset.first()
        if calendario:
            serializer = self.get_serializer(calendario)
            return Response(serializer.data)
        return Response(
            {'error': 'No hay un calendario académico activo'},
            status=status.HTTP_404_NOT_FOUND
        )


class FondoTiempoViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    """
    ViewSet con sistema híbrido de permisos:
    - Admin: puede editar solo borradores, cambiar estados, archivar
    - Docente: puede editar solo sus borradores
    """
    queryset = FondoTiempo.objects.select_related(
        'docente', 'carrera', 'aprobado_por', 'validado_por'
    ).prefetch_related('observaciones_detalladas')
    serializer_class = FondoTiempoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        """
        Filtrar fondos según el usuario:
        - Admin: ve todos.
        - Director/Jefe de Estudios: ve todos los de su carrera.
        - Docente: solo ve los suyos.
        """
        queryset = super().get_queryset().filter(archivado=False)
        user = self.request.user
        try:
            perfil = _obtener_perfil_efectivo(user, self.request)
        except Exception:
            perfil = None

        def aplicar_filtros_query_params(qs):
            docente_id = self.request.query_params.get('docente')
            gestion = self.request.query_params.get('gestion')
            if docente_id:
                qs = qs.filter(docente_id=docente_id)
            if gestion:
                qs = qs.filter(gestion=gestion)
            return qs

        # Permitir que superusuarios vean todo siempre (evita problemas si su rol es 'docente' por defecto)
        if user.is_superuser:
            return aplicar_filtros_query_params(queryset)

        if not perfil:
            return queryset.none()

        # Director, Jefe de Estudios e IIISYP ven los fondos de sus carreras activas
        if perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
            carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
            if carreras_activas.exists():
                return aplicar_filtros_query_params(queryset.filter(carrera__in=carreras_activas))
            return queryset.none()

        # Docente ve solo los suyos
        if perfil.rol == 'docente':
            if perfil.docente:
                return aplicar_filtros_query_params(queryset.filter(docente=perfil.docente))
            return queryset.none()

        return aplicar_filtros_query_params(queryset)
    
    def get_object(self):
        """
        Permitir acceso a fondos archivados para acciones específicas
        (retrieve, restaurar, destroy)
        """
        # 1. Definir Queryset Base SIN Prefetch inicial (para evitar caché obsoleto)
        queryset = FondoTiempo.objects.select_related(
            'docente', 'carrera', 'aprobado_por', 'validado_por'
        )

        # 2. Aplicar filtros según la acción
        if self.action in ['retrieve', 'restaurar', 'destroy', 'generar_pdf_oficial', 'generar_pdf_informe']:
            # Acciones que permiten ver archivados (con validación de dueño)
            if not self.request.user.is_superuser:
                perfil = _obtener_perfil_efectivo(self.request.user, self.request)
                if perfil and perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
                    carreras_activas = _obtener_carreras_activas_usuario(self.request.user, self.request)
                    queryset = queryset.filter(carrera__in=carreras_activas) if carreras_activas.exists() else queryset.none()
                elif perfil and perfil.rol == 'docente' and perfil.docente:
                    queryset = queryset.filter(docente=perfil.docente)
                else:
                    queryset = queryset.none()
        else:
            # Acciones estándar: NO mostrar archivados
            queryset = queryset.filter(archivado=False)
            
            # Replicar lógica de permisos de get_queryset para consistencia
            user = self.request.user
            try:
                perfil = _obtener_perfil_efectivo(user, self.request)
            except Exception:
                perfil = None

            if not perfil:
                queryset = queryset.none()
            elif perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
                carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
                if carreras_activas.exists():
                    queryset = queryset.filter(carrera__in=carreras_activas)
                else:
                    queryset = queryset.none()
            elif perfil.rol == 'docente':
                if perfil.docente:
                    queryset = queryset.filter(docente=perfil.docente)
                else:
                    queryset = queryset.none()
        
        # Obtener el objeto por pk
        obj = get_object_or_404(queryset, pk=self.kwargs.get('pk'))
        
        # Verificar permisos de objeto
        self.check_object_permissions(self.request, obj)

        # Prefetch manual de las relaciones del detalle
        prefetch_related_objects([obj],
            'informes', 'observaciones_detalladas'
        )
        
        return obj
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FondoTiempoListSerializer
        elif self.action == 'retrieve':
            return FondoTiempoDetalleSerializer
        return FondoTiempoSerializer

    def _flatten_validation_messages(self, detail):
        if isinstance(detail, dict):
            messages = []
            for value in detail.values():
                nested = self._flatten_validation_messages(value)
                if nested:
                    messages.append(nested)
            return ' '.join([m for m in messages if m]).strip()
        if isinstance(detail, list):
            messages = [self._flatten_validation_messages(item) for item in detail]
            return ' '.join([m for m in messages if m]).strip()
        return str(detail) if detail is not None else ''

    def _validation_error_response(self, detail):
        message = self._flatten_validation_messages(detail) or 'Error de validación en los datos enviados.'
        return Response({'error': message, 'details': detail}, status=status.HTTP_400_BAD_REQUEST)

    def _validar_docente_no_exclusivo(self, docente, carrera=None):
        filtros = {'docente': docente, 'activo': True}
        if carrera:
            filtros['carrera'] = carrera

        vinculos = DocenteCarrera.objects.filter(**filtros)
        if vinculos.filter(es_exento_fondo_tiempo=True).exists():
            raise drf_serializers.ValidationError(
                {'docente': 'Docente exento de distribución de tiempo según Art. 25°'}
            )

    def _puede_editar_fondo(self, fondo):
        user = self.request.user
        if user.is_superuser:
            return True

        if fondo.estado not in ['borrador', 'observado']:
            return False

        perfil = _obtener_perfil_efectivo(user, self.request)
        if not perfil:
            return False

        if perfil.rol in ['director', 'jefe_estudios']:
            return _usuario_tiene_acceso_a_carrera(user, fondo.carrera, self.request)

        return False

    def create(self, request, *args, **kwargs):
        """
        Aplica reglas de negocio para la creación de Fondos de Tiempo.
        Según Reglamento (Art. 9, 14), la creación es responsabilidad de Jefatura, no del Docente.
        """
        user = self.request.user
        try:
            perfil = _obtener_perfil_efectivo(user, request)
        except Exception:
            perfil = None

        # 1. Permitir solo Super Admin
        if user.is_superuser:
            pass
        # 2. Permitir solo Jefatura de Estudios entre usuarios operativos
        elif perfil and perfil.rol == 'jefe_estudios':
            pass
        elif perfil and perfil.rol == 'director':
             raise PermissionDenied("Los Directores solo pueden revisar y aprobar Fondos de Tiempo; la creación corresponde a Jefatura de Estudios.")
        # 3. Bloquear a Docentes
        elif perfil and perfil.rol == 'docente':
             raise PermissionDenied("Los docentes no pueden crear Fondos de Tiempo. Esta tarea corresponde a Jefatura de Estudios.")
        # 4. IIISYP solo tiene acceso de lectura para fiscalizacion de investigacion.
        elif perfil and perfil.rol == 'iiisyp':
             raise PermissionDenied("IIISYP solo tiene acceso de lectura a los Fondos de Tiempo.")
        # 5. Bloquear usuarios sin perfil
        elif not perfil:
             raise PermissionDenied("El usuario no tiene un perfil asignado.")

        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
        except drf_serializers.ValidationError as exc:
            return self._validation_error_response(exc.detail)
        except DjangoValidationError as exc:
            detail = getattr(exc, 'message_dict', None) or getattr(exc, 'messages', None) or str(exc)
            return self._validation_error_response(detail)
        except IntegrityError as exc:
            return self._validation_error_response(str(exc))

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Un fondo por docente y gestión: la gestión debe tener calendario académico en la carrera."""
        docente = serializer.validated_data.get('docente')
        carrera = serializer.validated_data.get('carrera')
        gestion = serializer.validated_data.get('gestion')
        # Solo en la carrera propia: un Jefe de otra carrera no crea fondos aquí.
        if not _usuario_tiene_acceso_a_carrera(self.request.user, carrera, self.request):
            raise PermissionDenied('Solo puedes crear Fondos de Tiempo en tu carrera.')
        self._validar_docente_no_exclusivo(docente, carrera)
        if not CalendarioAcademico.objects.filter(carrera=carrera, gestion=gestion).exists():
            raise drf_serializers.ValidationError({
                'gestion': f'La carrera no tiene calendario académico de la gestión {gestion}.'
            })

        serializer.save()

    @action(detail=False, methods=['post'], url_path='generar-masivo')
    def generar_masivo(self, request):
        """
        Genera Fondos de Tiempo para los docentes activos de las carreras
        accesibles al usuario, omitiendo dedicacion exclusiva y fondos existentes.
        """
        user = request.user
        perfil = _obtener_perfil_efectivo(user, request)

        if not user.is_superuser and (not perfil or perfil.rol != 'jefe_estudios'):
            raise PermissionDenied("No tienes permisos para generar Fondos de Tiempo masivamente.")

        carreras_activas = _obtener_carreras_activas_usuario(user, request)
        if not carreras_activas.exists():
            return Response(
                {'error': 'No tienes carreras activas disponibles para generar Fondos de Tiempo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        vinculos = DocenteCarrera.objects.filter(
            activo=True,
            carrera__in=carreras_activas,
            docente__activo=True,
            carrera__activo=True,
        ).select_related('docente', 'carrera').order_by('carrera__nombre', 'docente__apellido_paterno')

        creados = 0
        omitidos_exclusiva = 0
        omitidos_ya_existentes = 0

        with transaction.atomic():
            for vinculo in vinculos:
                calendario_activo = CalendarioAcademico.objects.filter(activo=True, carrera=vinculo.carrera).first()
                if not calendario_activo:
                    omitidos_ya_existentes += 1
                    continue

                vinculos_docente = DocenteCarrera.objects.filter(
                    docente=vinculo.docente,
                    activo=True,
                )
                if vinculos_docente.filter(es_exento_fondo_tiempo=True).exists():
                    omitidos_exclusiva += 1
                    continue

                ya_existe = FondoTiempo.objects.filter(
                    docente=vinculo.docente,
                    gestion=calendario_activo.gestion,
                    archivado=False,
                ).exists()
                if ya_existe:
                    omitidos_ya_existentes += 1
                    continue

                FondoTiempo.objects.create(
                    docente=vinculo.docente,
                    carrera=vinculo.carrera,
                    gestion=calendario_activo.gestion,
                    estado='borrador',
                )

                creados += 1

        return Response({
            'creados': creados,
            'omitidos_exclusiva': omitidos_exclusiva,
            'omitidos_ya_existentes': omitidos_ya_existentes,
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Verificar permisos de edición"""
        instance = self.get_object()
        
        if not self._puede_editar_fondo(instance):
            raise PermissionDenied(
                "Acción no permitida. Solo se pueden editar fondos en estado borrador u observado."
            )
        
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        except drf_serializers.ValidationError as exc:
            return self._validation_error_response(exc.detail)
        except DjangoValidationError as exc:
            detail = getattr(exc, 'message_dict', None) or getattr(exc, 'messages', None) or str(exc)
            return self._validation_error_response(detail)
        except IntegrityError as exc:
            return self._validation_error_response(str(exc))

        return Response(serializer.data)
    
    def partial_update(self, request, *args, **kwargs):
        """Verificar permisos de edición parcial"""
        instance = self.get_object()
        
        if not self._puede_editar_fondo(instance):
            raise PermissionDenied(
                "Acción no permitida. Solo se pueden editar fondos en estado borrador u observado."
            )
        
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)
    
    def _validar_archivo(self, fondo, accion):
        """Archivar y restaurar: superusuario, o Director y Jefe de Estudios de la carrera del fondo."""
        user = self.request.user
        if user.is_superuser:
            return
        perfil = _obtener_perfil_efectivo(user, self.request)
        if not (
            perfil
            and perfil.rol in ['director', 'jefe_estudios']
            and _usuario_tiene_acceso_a_carrera(user, fondo.carrera, self.request)
        ):
            raise PermissionDenied(
                f"Solo el superusuario o el Director y el Jefe de Estudios de la carrera pueden {accion} fondos."
            )

    def destroy(self, request, *args, **kwargs):
        """No se elimina: se archiva (superusuario, o Director y Jefe de Estudios de la carrera)."""
        instance = self.get_object()
        self._validar_archivo(instance, 'archivar')

        # Archivar en lugar de eliminar
        instance.archivado = True
        instance.save()
        
        return Response(
            {'message': 'Fondo archivado correctamente'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrDirector])
    def agregar_comentario(self, request, pk=None):
        """Comentario administrativo: superusuario, o Director / Jefe de Estudios (rol
        activo) de la carrera del fondo (get_object limita a su carrera)."""
        fondo = self.get_object()
        comentario = request.data.get('comentario', '')
        
        if not comentario:
            return Response(
                {'error': 'El comentario no puede estar vacío'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if fondo.comentarios_admin:
            fondo.comentarios_admin += f"\n\n[{request.user.username}]: {comentario}"
        else:
            fondo.comentarios_admin = f"[{request.user.username}]: {comentario}"
        
        fondo.save()
        
        serializer = self.get_serializer(fondo)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def comparar(self, request):
        """Endpoint para comparar fondos de tiempo entre gestiones"""
        docente_id = request.query_params.get('docente')
        gestion1 = request.query_params.get('gestion1')
        gestion2 = request.query_params.get('gestion2')
        
        if not all([docente_id, gestion1, gestion2]):
            return Response({
                'error': 'Se requieren los parámetros: docente, gestion1, gestion2'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Dentro del alcance del usuario (get_queryset): antes devolvía los fondos de
        # cualquier docente de cualquier carrera.
        fondos = self.get_queryset().filter(
            docente_id=docente_id,
            gestion__in=[gestion1, gestion2],
        ).select_related('docente', 'carrera')
        
        serializer = self.get_serializer(fondos, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def archivados(self, request):
        """
        Ver fondos archivados.
        - Docentes ven solo sus fondos archivados.
        - Admins ven todos los fondos archivados.
        """
        queryset = FondoTiempo.objects.filter(archivado=True).select_related('docente', 'carrera')

        if not request.user.is_superuser:
            perfil = _obtener_perfil_efectivo(request.user, request)
            if perfil and perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
                carreras_activas = _obtener_carreras_activas_usuario(request.user, request)
                queryset = queryset.filter(carrera__in=carreras_activas) if carreras_activas.exists() else queryset.none()
            elif perfil and perfil.rol == 'docente' and perfil.docente:
                queryset = queryset.filter(docente=perfil.docente)
            else:
                queryset = queryset.none()
        
        serializer = FondoTiempoListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def restaurar(self, request, pk=None):
        """Restaurar un fondo archivado (superusuario, o Director y Jefe de Estudios de la carrera)."""
        # get_object() excluye los archivados: se busca directo y se valida la carrera.
        fondo = get_object_or_404(FondoTiempo, pk=pk)
        self._validar_archivo(fondo, 'restaurar')
        
        if not fondo.archivado:
            return Response(
                {'error': 'Este fondo no está archivado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if FondoTiempo.objects.filter(docente=fondo.docente, gestion=fondo.gestion, archivado=False).exists():
            return Response(
                {'error': f'El docente ya tiene otro Fondo de Tiempo vigente de la gestión {fondo.gestion}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        fondo.archivado = False
        fondo.save()
        
        serializer = self.get_serializer(fondo)
        return Response(serializer.data)

    # NUEVAS ACCIONES SEGÚN REGLAMENTO UAB

    def _extraer_secciones_informe(self, request, fondo):
        """Lee las 7 secciones del informe MAS los 12 campos del documento
        tipo carta (encabezado, fecha, destinatario/remitente/referencia,
        saludo+intro, cierre, firma) desde request.data. El editor del
        frontend envia el documento completo en cada guardado, no solo las
        secciones. Compartido por guardar-informe-borrador y presentar.

        Rechaza (400) las imágenes que no se admiten, con el motivo."""
        campos = [
            'seccion_academica', 'seccion_investigacion', 'seccion_extension_interaccion',
            'seccion_asesorias_tutorias', 'seccion_academica_administrativa',
            'seccion_social_cultural_deportiva', 'conclusiones_generales',
            *CAMPOS_TEXTO_INFORME,
        ]
        secciones = {campo: (request.data.get(campo) or '').strip() for campo in campos}
        try:
            validar_imagenes_informe(secciones, carpeta_imagenes(InformeFondo(fondo_tiempo=fondo)))
        except ImagenInformeInvalida as exc:
            raise drf_serializers.ValidationError({'imagenes': str(exc)})
        return secciones

    @action(detail=True, methods=['patch'], url_path='guardar-informe-borrador')
    def guardar_informe_borrador(self, request, pk=None):
        """
        Guarda el progreso del informe SIN presentarlo formalmente al
        Director. El docente puede llamar esto tantas veces como quiera
        mientras redacta; no cambia el estado del Fondo de Tiempo.
        """
        fondo = self.get_object()

        perfil = _obtener_perfil_efectivo(request.user, request)
        if not fondo.puede_redactar_informe(request.user, perfil):
            raise PermissionDenied("Solo el docente dueño del fondo puede editar su informe.")

        if fondo.estado != 'en_ejecucion':
            return Response(
                {'error': f'Solo se puede editar el informe mientras el fondo está "En Ejecución". Estado actual: {fondo.get_estado_display()}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        informe_existente = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if informe_existente and informe_existente.estado not in ['borrador', 'observado']:
            return Response(
                {'error': f'El informe ya fue enviado formalmente (estado: {informe_existente.get_estado_display()}) y no se puede editar como borrador.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        secciones = self._extraer_secciones_informe(request, fondo)
        informe, _creado = InformeFondo.objects.update_or_create(
            fondo_tiempo=fondo,
            tipo='parcial',
            defaults={
                'elaborado_por': request.user,
                'estado': 'borrador',
                **secciones,
            }
        )

        return Response(InformeFondoSerializer(informe, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='observar-informe')
    @transaction.atomic
    def observar_informe(self, request, pk=None):
        """
        El Director solicita correcciones al informe presentado: el informe
        vuelve a ser editable por el docente (estado 'observado') y el fondo
        vuelve a 'en_ejecucion'. Se notifica al docente con el comentario.
        """
        fondo = self.get_object()
        user = request.user

        perfil = _obtener_perfil_efectivo(user, request)
        if not _validar_revisor_del_fondo(request, fondo, 'observar'):
            if not (perfil and perfil.rol == 'director' and _usuario_tiene_acceso_a_carrera(user, fondo.carrera, request)):
                raise PermissionDenied("Solo el Director de la carrera correspondiente puede solicitar correcciones al informe.")

        if fondo.estado != 'informe_presentado':
            return Response(
                {'error': f'Solo se pueden observar informes en estado "Presentado". Estado actual: {fondo.get_estado_display()}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if not informe:
            return Response({'error': 'No se encontró informe asociado al fondo.'}, status=status.HTTP_400_BAD_REQUEST)

        comentario = (request.data.get('comentario') or '').strip()
        if len(comentario) < 10:
            return Response(
                {'comentario': 'Debe explicar qué debe corregir el docente (mínimo 10 caracteres).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        informe.estado = 'observado'
        informe.evaluacion_director = comentario
        informe.evaluado_por = user
        informe.fecha_evaluacion = timezone.localdate()
        informe.save()

        estado_anterior = fondo.estado
        fondo.estado = 'en_ejecucion'
        fondo.save()

        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=user,
            tipo_cambio='observacion',
            descripcion=f'Director solicitó correcciones al informe: {comentario}',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )

        # Notificar al docente (mismo canal que las demas observaciones del fondo).
        observacion = ObservacionFondo.objects.create(fondo_tiempo=fondo, resuelta=False)
        MensajeObservacion.objects.create(
            observacion=observacion,
            autor=user,
            texto=f'Se solicitaron correcciones a tu Informe de Cumplimiento:\n\n{comentario}',
            es_admin=True,
        )

        return Response(InformeFondoSerializer(informe, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def presentar(self, request, pk=None):
        """Presentar el informe final (fondo en ejecución). El fondo lo presenta Jefatura al
        Director con presentar-a-director."""
        fondo = self.get_object()
        
        # Solo el docente dueño (con su rol de docente) o el superusuario: Jefatura
        # y Dirección no redactan ni presentan el informe de otro docente.
        perfil = _obtener_perfil_efectivo(request.user, request)
        if not fondo.puede_redactar_informe(request.user, perfil):
            raise PermissionDenied("Solo el docente dueño del fondo puede presentar su informe.")

        if fondo.estado != 'en_ejecucion':
            return Response(
                {'error': 'Solo se presenta el informe con el fondo en ejecución. El fondo lo presenta Jefatura al Director.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        secciones = self._extraer_secciones_informe(request, fondo)

        # Minimos exigibles: Academica (todo docente dicta materias) y
        # Conclusiones (cierre del informe). Las demas secciones quedan
        # opcionales porque no todos los docentes tienen actividad en
        # investigacion, gestion, tutorias, etc. en una gestion dada.
        errores_secciones = {}
        if not secciones['seccion_academica']:
            errores_secciones['seccion_academica'] = 'Debe describir el cumplimiento de la sección Académica.'
        if not secciones['conclusiones_generales']:
            errores_secciones['conclusiones_generales'] = 'Debe redactar las conclusiones generales del informe.'
        if errores_secciones:
            return Response(errores_secciones, status=status.HTTP_400_BAD_REQUEST)

        # Transición directa para informe (Modo Flexible)
        estado_anterior = fondo.estado
        fondo.estado = 'informe_presentado'
        fondo.fecha_informe = timezone.now()
        fondo.save()

        # Crear o actualizar el informe con datos reales; queda marcado
        # 'enviado' (formal, ya no editable por el docente) hasta que el
        # Director lo apruebe o lo observe.
        InformeFondo.objects.update_or_create(
            fondo_tiempo=fondo,
            tipo='parcial',
            defaults={
                'elaborado_por': request.user,
                'estado': 'enviado',
                **secciones,
            }
        )

        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='informe_presentado',
            descripcion='Docente presentó Informe Final de cumplimiento.',
            estado_anterior=estado_anterior,
            estado_nuevo='informe_presentado'
        )
        
        return Response({'message': 'Informe presentado exitosamente'})

    @action(detail=True, methods=['patch'], url_path='presentar-a-director')
    def presentar_a_director(self, request, pk=None):
        """
        Endpoint para presentar fondo directamente a Director.
        """
        fondo = self.get_object()
        user = request.user

        if not user.is_superuser:
            perfil = _obtener_perfil_efectivo(user, request)
            if not (perfil and perfil.rol == 'jefe_estudios' and _usuario_tiene_acceso_a_carrera(user, fondo.carrera, request)):
                raise PermissionDenied("Solo Jefatura de Estudios puede presentar fondos al Director.")

        if fondo.estado not in ['borrador', 'observado']:
            return Response(
                {'error': 'Solo se pueden presentar fondos en estado borrador u observado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Art. 15 y 18: un programa analítico por materia y calendario de clases en aula.
        # Arts. 14, 16, 17 y 20: el documento de cada proyecto o curso.
        faltantes = fondo.programas_analiticos_faltantes() + fondo.documentos_actividad_faltantes()
        if faltantes:
            return Response({'error': '. '.join(faltantes) + '.'}, status=status.HTTP_400_BAD_REQUEST)

        # La suma de todas las unidades debe ser exactamente las horas efectivas.
        total_unidades = Decimal(fondo.total_asignado)
        horas_efectivas = Decimal(str(fondo.horas_efectivas or 0))
        if horas_efectivas <= 0 or total_unidades != horas_efectivas:
            return Response(
                {'error': (
                    f'La suma de las unidades debe ser exactamente {horas_efectivas.normalize():f} horas '
                    f'(horas efectivas). Total actual: {total_unidades.normalize():f}.'
                )},
                status=status.HTTP_400_BAD_REQUEST
            )

        estado_anterior = fondo.estado
        if estado_anterior == 'observado':
            for observacion in ObservacionFondo.objects.filter(fondo_tiempo=fondo, resuelta=False):
                observacion.marcar_resuelta(user)

        fondo.estado = 'presentado_director'
        fondo.fecha_presentacion = timezone.now()
        # Arts. 15 y 18: se registra (sin bloquear) si se presentó después de los plazos del
        # calendario. Se mide en la presentación desde borrador; el reenvío tras una
        # observación conserva lo registrado.
        if estado_anterior == 'borrador':
            fondo.fuera_de_plazo = fondo.plazos_vencidos(timezone.localdate())
        try:
            fondo.save()
        except DjangoValidationError as exc:
            detail = getattr(exc, 'message_dict', None) or getattr(exc, 'messages', None) or str(exc)
            return self._validation_error_response(detail)

        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=user,
            tipo_cambio='presentacion',
            descripcion='Fondo presentado por Jefatura de Estudios al Director.'
            + (' ' + '. '.join(fondo.textos_fuera_de_plazo()) + '.' if fondo.fuera_de_plazo else ''),
            estado_anterior=estado_anterior,
            estado_nuevo='presentado_director'
        )

        return Response({'status': 'Fondo presentado correctamente'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='volver-a-borrador')
    @transaction.atomic
    def volver_a_borrador(self, request, pk=None):
        """Un fondo rechazado vuelve a borrador para corregirlo: Jefe de su carrera o superusuario."""
        fondo = self.get_object()
        user = request.user
        if not user.is_superuser:
            perfil = _obtener_perfil_efectivo(user, request)
            if not (perfil and perfil.rol == 'jefe_estudios' and _usuario_tiene_acceso_a_carrera(user, fondo.carrera, request)):
                raise PermissionDenied("Solo el Jefe de Estudios de la carrera puede devolver a borrador un fondo rechazado.")

        if fondo.estado != 'rechazado':
            return Response(
                {'error': 'Solo un fondo rechazado puede volver a borrador.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fondo.estado = 'borrador'
        fondo.save()
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=user,
            tipo_cambio='edicion',
            descripcion='Fondo rechazado devuelto a borrador para corregirlo.',
            estado_anterior='rechazado',
            estado_nuevo='borrador',
        )
        return Response({'status': 'Fondo devuelto a borrador'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def aprobar(self, request, pk=None):
        """Aprobar fondo (Director)"""
        fondo = self.get_object()
        aprueba_superusuario = _validar_revisor_del_fondo(request, fondo, 'aprobar')
        documento_decanatura = None
        if aprueba_superusuario:
            documento_decanatura = request.FILES.get('documento_decanatura')
            if not documento_decanatura:
                return Response(
                    {'documento_decanatura': 'Adjunte el documento de la Decanatura (PDF) para aprobar el fondo del Director.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _es_pdf(documento_decanatura):
                return Response(
                    {'documento_decanatura': 'El documento de la Decanatura debe ser un archivo PDF.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # MEJORA: Solo un Director debería poder aprobar, no un Admin genérico.
            perfil = _obtener_perfil_efectivo(request.user, request)
            if not (perfil and perfil.rol == 'director' and _usuario_tiene_acceso_a_carrera(request.user, fondo.carrera, request)):
                raise PermissionDenied("Solo los Directores de Carrera pueden aprobar fondos.")
        
        # Un director puede aprobar fondos presentados o que él mismo haya observado y el docente corrigió.
        if fondo.estado != 'presentado_director':
            return Response(
                {'error': f'Solo se pueden aprobar fondos en estado "Presentado a Director". Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AprobarFondoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Cambiar estado
        estado_anterior = fondo.estado
        fondo.estado = 'aprobado_director'
        fondo.fecha_aprobacion = timezone.now()
        fondo.aprobado_por = request.user
        if documento_decanatura:
            fondo.documento_decanatura = documento_decanatura
        
        observacion = serializer.validated_data.get('observacion', '')
        if observacion:
            if fondo.comentarios_admin:
                fondo.comentarios_admin += f"\n\n[Aprobación - {request.user.username}]: {observacion}"
            else:
                fondo.comentarios_admin = f"[Aprobación - {request.user.username}]: {observacion}"
        
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='aprobacion',
            descripcion=f'Fondo aprobado por Director. {observacion}',
            estado_anterior=estado_anterior,
            estado_nuevo='aprobado_director'
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(output_serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def observar(self, request, pk=None):
        """Observar o rechazar fondo (Director)"""
        try:
            fondo = self.get_object()
            if not _validar_revisor_del_fondo(request, fondo, 'observar'):
                # MEJORA: Solo un Director debería poder observar, no un Admin genérico.
                perfil = _obtener_perfil_efectivo(request.user, request)
                if not (perfil and perfil.rol == 'director' and _usuario_tiene_acceso_a_carrera(request.user, fondo.carrera, request)):
                    raise PermissionDenied("Solo los Directores de Carrera pueden observar fondos.")

            if fondo.estado != 'presentado_director':
                return Response(
                    {'error': f'Solo se pueden observar fondos en estado "Presentado a Director". Estado actual: {fondo.get_estado_display()}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = ObservarFondoSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            accion = serializer.validated_data['accion']
            observacion_texto = serializer.validated_data['observacion']
            
            # Crear hilo de observación con primer mensaje
            observacion = ObservacionFondo.objects.create(
                fondo_tiempo_id=fondo.id, # Usar ID explícito para evitar problemas de referencia
                resuelta=False
            )
            
            # Crear primer mensaje del admin
            MensajeObservacion.objects.create(
                observacion=observacion,
                autor=request.user,
                texto=observacion_texto,
                es_admin=True # Director es una autoridad
            )
            
            # Cambiar estado
            estado_anterior = fondo.estado
            if accion == 'observar':
                fondo.estado = 'observado'
                tipo_cambio = 'observacion'
                descripcion = 'Fondo observado por Director'
            else:  # rechazar
                fondo.estado = 'rechazado'
                tipo_cambio = 'rechazo'
                descripcion = 'Fondo rechazado por Director'
            
            fondo.save()
            
            # Registrar en historial
            HistorialFondo.objects.create(
                fondo_tiempo=fondo,
                usuario=request.user,
                tipo_cambio=tipo_cambio,
                descripcion=f'{descripcion}: {observacion_texto}',
                estado_anterior=estado_anterior,
                estado_nuevo=fondo.estado
            )
            
            return Response(self.get_serializer(fondo).data)
            
        except Exception as e:
            # Excepciones de DRF (validación, permisos) y el 404 de un fondo fuera del
            # alcance pasan tal cual: no son errores internos (antes daban 500).
            if hasattr(e, 'detail') or isinstance(e, Http404):
                raise e
            # Si es otro error interno, lo capturamos y devolvemos el detalle
            transaction.set_rollback(True)
            return Response(
                {'error': f'Error interno al procesar la observación: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def iniciar_ejecucion(self, request, pk=None):
        """
        Iniciar ejecución del fondo (cuando comienza el semestre)
        El Director de la carrera; el fondo del Director, el superusuario.
        Estado: aprobado_director → en_ejecucion
        """
        fondo = self.get_object()
        perfil = _obtener_perfil_efectivo(request.user, request)
        # Como aprobar, observar y evaluar: el superusuario solo inicia el fondo del Director.
        if not _validar_revisor_del_fondo(request, fondo, 'iniciar la ejecución de'):
            if not perfil or perfil.rol != 'director':
                raise PermissionDenied("Solo el Director de Carrera puede iniciar la ejecucion del Fondo de Tiempo.")
            if not _usuario_tiene_acceso_a_carrera(request.user, fondo.carrera, request):
                raise PermissionDenied("No tienes acceso a la carrera de este Fondo de Tiempo.")
        
        # Validar estado actual
        if fondo.estado != 'aprobado_director':
            return Response(
                {'error': f'Solo se pueden iniciar fondos aprobados. Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cambiar estado
        estado_anterior = fondo.estado
        fondo.estado = 'en_ejecucion'
        fondo.fecha_inicio_ejecucion = timezone.now()
        fondo.save()
        
        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='inicio_ejecucion',
            descripcion='Fondo iniciado - Semestre en curso',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )
        
        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response(output_serializer.data)


    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='evaluar-y-finalizar')
    @transaction.atomic
    def evaluar_y_finalizar(self, request, pk=None):
        """
        Evaluar informe y finalizar el ciclo del fondo
        Solo el Director de Carrera puede hacerlo (Art. 19)
        Estado: informe_presentado → finalizado
        """
        fondo = self.get_object()
        user = request.user
        try:
            perfil = _obtener_perfil_efectivo(user, request)
        except Exception:
            perfil = None

        # REGLA: Solo el Director de la carrera correspondiente puede evaluar
        # (el fondo del Director lo evalúa el superusuario).
        evalua_superusuario = _validar_revisor_del_fondo(request, fondo, 'evaluar')
        if not evalua_superusuario:
            if not (perfil and perfil.rol == 'director' and _usuario_tiene_acceso_a_carrera(user, fondo.carrera, request)):
                raise PermissionDenied("Solo el Director de la carrera correspondiente puede evaluar y finalizar el fondo.")

        # Art. 28: el informe final del Director se eleva a Decanatura.
        documento_decanatura = None
        if evalua_superusuario:
            documento_decanatura = request.FILES.get('documento_decanatura')
            if not documento_decanatura:
                return Response(
                    {'documento_decanatura': 'Adjunte el documento de la Decanatura (PDF) para evaluar y finalizar el fondo del Director.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not _es_pdf(documento_decanatura):
                return Response(
                    {'documento_decanatura': 'El documento de la Decanatura debe ser un archivo PDF.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        # Validar estado actual
        if fondo.estado != 'informe_presentado':
            return Response(
                {'error': f'Solo se pueden evaluar fondos con informe presentado. Estado actual: {fondo.get_estado_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar que exista al menos un informe
        informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        if not informe:
            return Response(
                {'error': 'No se encontró informe asociado al fondo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validar datos de evaluación
        cumplimiento = request.data.get('cumplimiento', '').strip()
        evaluacion_director = request.data.get('evaluacion_director', '').strip()
        
        cumplimientos_validos = ['cumplido', 'parcial', 'incumplido']
        if cumplimiento not in cumplimientos_validos:
            return Response(
                {'error': f'Cumplimiento inválido. Valores válidos: {", ".join(cumplimientos_validos)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not evaluacion_director or len(evaluacion_director) < 30:
            return Response(
                {'error': 'Debe proporcionar una evaluación detallada (mínimo 30 caracteres)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Actualizar el informe con la evaluación
        informe.estado = 'aprobado'
        informe.cumplimiento = cumplimiento
        informe.evaluacion_director = evaluacion_director
        informe.evaluado_por = request.user
        informe.fecha_evaluacion = timezone.localdate()
        informe.save()

        # Cambiar estado del fondo a finalizado
        estado_anterior = fondo.estado
        fondo.estado = 'finalizado'
        fondo.fecha_finalizacion = timezone.now()
        if documento_decanatura:
            fondo.documento_decanatura_informe = documento_decanatura
        fondo.save()

        # Registrar en historial
        HistorialFondo.objects.create(
            fondo_tiempo=fondo,
            usuario=request.user,
            tipo_cambio='finalizacion',
            descripcion=f'Fondo evaluado y finalizado - Cumplimiento: {cumplimiento}',
            estado_anterior=estado_anterior,
            estado_nuevo=fondo.estado
        )

        # Notificar al docente que su informe fue aprobado.
        observacion = ObservacionFondo.objects.create(fondo_tiempo=fondo, resuelta=True)
        MensajeObservacion.objects.create(
            observacion=observacion,
            autor=request.user,
            texto=f'Tu Informe de Cumplimiento fue aprobado (Cumplimiento: {dict(InformeFondo.CUMPLIMIENTO_CHOICES).get(cumplimiento, cumplimiento)}).\n\n{evaluacion_director}',
            es_admin=True,
        )

        output_serializer = FondoTiempoDetalleSerializer(fondo, context={'request': request})
        return Response({
            'fondo': output_serializer.data,
            'informe_id': informe.id,
            'cumplimiento': cumplimiento,
            'message': 'Fondo evaluado y finalizado exitosamente'
        })

    @action(detail=True, methods=['get'], url_path='pdf-oficial')
    def generar_pdf_oficial(self, request, pk=None):
        # Fuera del try: un fondo fuera del alcance del usuario debe dar 404, no 500.
        fondo = self.get_object()
        try:
            checklist = self._build_checklist_salud_pdf(fondo)
            if not checklist['ok']:
                return Response(
                    {
                        'error': 'No se puede generar el PDF: el checklist de salud tiene observaciones críticas.',
                        'checklist': checklist,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # 1. Generar el buffer (Llama a tu generador en utils)
            buffer = FondoPDFGenerator.generar_reporte_individual(fondo)
            
            # 2. CONSTRUIR NOMBRE DESCRIPTIVO (Sugerencia de tu AI mejorada)
            # Limpiamos el nombre del docente (cambiamos espacios por guiones bajos)
            nombre_docente = "Docente"
            if fondo.docente:
                nombre_docente = fondo.docente.nombre_completo.replace(" ", "_")
            
            # Obtenemos la gestión (año)
            gestion = fondo.gestion
            
            # Construimos el nombre final: Ej. Fondo_Victor_Cruz_2026.pdf
            nombre_archivo = f"Fondo_{nombre_docente}_{gestion}.pdf"

            # 3. RETORNAR ARCHIVO
            # as_attachment=True fuerza la descarga con el nombre que definimos arriba
            return FileResponse(buffer, as_attachment=True, filename=nombre_archivo)

        except Exception as e:
            print(f"❌ ERROR PDF: {e}")
            import traceback
            traceback.print_exc()
            return HttpResponse(f"Error crítico: {str(e)}", status=500)

    @action(detail=True, methods=['get'], url_path='pdf-informe')
    def generar_pdf_informe(self, request, pk=None):
        """
        Carta institucional narrativa del Informe de Fondo de Tiempo (las 7
        secciones que redacta el docente), como documento independiente del
        reporte de horas de 'pdf-oficial'.
        """
        # Fuera del try: un fondo fuera del alcance del usuario debe dar 404, no 500.
        fondo = self.get_object()
        try:
            buffer = InformePDFGenerator.generar_informe_individual(fondo)

            nombre_docente = fondo.docente.nombre_completo.replace(' ', '_') if fondo.docente else 'Docente'
            nombre_archivo = f"Informe_{nombre_docente}_{fondo.gestion}.pdf"

            return FileResponse(
                buffer, as_attachment=False, filename=nombre_archivo, content_type='application/pdf',
            )
        except Exception as e:
            print(f"❌ ERROR PDF INFORME: {e}")
            import traceback
            traceback.print_exc()
            return HttpResponse(f"Error crítico: {str(e)}", status=500)

    def _duracion_horas_bloque(self, hora_inicio, hora_fin):
        if not hora_inicio or not hora_fin:
            return 0.0

        inicio = datetime.combine(date.today(), hora_inicio)
        fin = datetime.combine(date.today(), hora_fin)
        segundos = (fin - inicio).total_seconds()
        return max(segundos / 3600.0, 0.0)

    def _obtener_nombre_director_carrera(self, carrera):
        if not carrera:
            return ''

        perfil_director = PerfilUsuario.objects.filter(
            carrera=carrera,
            rol='director',
            activo=True,
        ).select_related('docente', 'user').first()

        if not perfil_director:
            return ''

        if perfil_director.docente:
            return perfil_director.docente.nombre_completo.strip()

        if perfil_director.user:
            nombre = perfil_director.user.get_full_name().strip()
            return nombre or perfil_director.user.username

        return ''

    def _build_checklist_salud_pdf(self, fondo):
        from .models import DocenteCarrera

        errores = []
        advertencias = []

        carrera = fondo.carrera
        docente = fondo.docente

        # Obtener el vínculo DocenteCarrera para esta carrera
        vinculo = DocenteCarrera.objects.filter(
            docente=docente, carrera=carrera, activo=True
        ).first()
        horas_semanales = vinculo.horas_semanales_maximas if vinculo else 0

        # 1) Datos legales de la carrera
        if not carrera:
            errores.append('La planificación no tiene carrera asociada.')
        else:
            if not (carrera.resolucion_ministerial or '').strip():
                errores.append('Falta la Resolución de Creación (HCU) de la carrera.')
            if not carrera.fecha_resolucion:
                errores.append('Falta la Fecha de Resolución de Creación (HCU) de la carrera.')
            if not (carrera.logo_carrera_cifrada or carrera.logo_carrera):
                errores.append('Falta el logo oficial de la carrera.')

        # 2) Firmas dinámicas
        nombre_firma_docente = docente.nombre_completo.strip() if docente else ''
        nombre_firma_director = self._obtener_nombre_director_carrera(carrera)

        if not nombre_firma_docente:
            errores.append('No se pudo determinar el nombre del Docente para la firma.')
        if not nombre_firma_director:
            errores.append('No se encontró un Director activo en la carrera para la firma oficial.')

        # 3) Totales de carga horaria vs dedicación
        cargas = fondo.cargas.filter(categoria='academica').select_related('materia')

        if not cargas.exists():
            errores.append('No existen registros de Carga Horaria académica para este fondo/calendario.')

        total_horas_anuales = 0.0
        total_horas_semanales_horario = 0.0
        for carga in cargas:
            total_horas_anuales += float(carga.horas or 0)
            total_horas_semanales_horario += self._duracion_horas_bloque(carga.hora_inicio, carga.hora_fin)

        dedicacion_esperada = float(horas_semanales) if horas_semanales else 0.0
        diferencia = abs(total_horas_semanales_horario - dedicacion_esperada)
        # BUGFIX 2026-09-13: este chequeo bloqueaba la generación del PDF para
        # cualquier fondo cuya CargaHoraria se cargó por horas anuales totales
        # (el flujo real y mayoritario) en lugar de bloques semanales con
        # hora_inicio/hora_fin (usados solo para armar la grilla de horario
        # L-S). Sin bloques cargados, total_horas_semanales_horario da 0 y
        # esto se reportaba como "0.00h vs 40.00h", bloqueando el PDF aunque
        # el fondo estuviera correctamente cargado. Ahora solo es un error
        # bloqueante si SÍ hay bloques horarios cargados y no cuadran; si no
        # hay ninguno, es solo una advertencia (no hay grilla de horario que
        # mostrar, pero el resto del PDF se genera igual).
        if total_horas_semanales_horario > 0 and diferencia > 0.01:
            errores.append(
                'La suma semanal de bloques horarios no coincide con la dedicación del docente '
                f'({total_horas_semanales_horario:.2f}h vs {dedicacion_esperada:.2f}h).'
            )
        elif total_horas_semanales_horario == 0:
            advertencias.append(
                'No hay bloques horarios (hora_inicio/hora_fin) cargados para armar la grilla de horario '
                'semanal; el PDF se generará sin esa tabla.'
            )

        # 4) Criterio de mapeo de horarios para tabla L-S
        estrategia_mapeo = (
            'Se agrupan bloques contiguos de la misma materia, paralelo y aula en el mismo día. '
            'Ejemplo: 08:00-10:00 + 10:00-12:00 de la misma materia se muestra como 08:00-12:00 (4h).'
        )

        if total_horas_anuales <= 0:
            advertencias.append('La suma anual de Carga Horaria es 0h; revise asignaciones antes de emitir el reporte.')

        return {
            'ok': len(errores) == 0,
            'errores': errores,
            'advertencias': advertencias,
            'datos_legales': {
                'resolucion_ministerial': bool(carrera and (carrera.resolucion_ministerial or '').strip()),
                'fecha_resolucion': bool(carrera and carrera.fecha_resolucion),
                'logo': bool(carrera and (carrera.logo_carrera_cifrada or carrera.logo_carrera)),
            },
            'firmas': {
                'director_carrera': nombre_firma_director,
                'docente': nombre_firma_docente,
            },
            'totales': {
                'horas_anuales_carga_horaria': round(total_horas_anuales, 2),
                'horas_semanales_por_horario': round(total_horas_semanales_horario, 2),
                'horas_semanales_dedicacion': round(dedicacion_esperada, 2),
            },
            'mapeo_horarios': {
                'criterio': 'agrupacion_contigua_misma_materia_paralelo_aula',
                'descripcion': estrategia_mapeo,
            },
        }

    @action(detail=True, methods=['get'], url_path='checklist-salud-pdf')
    def checklist_salud_pdf(self, request, pk=None):
        fondo = self.get_object()
        checklist = self._build_checklist_salud_pdf(fondo)
        return Response(checklist, status=status.HTTP_200_OK)
        
# =====================================================
# OBSERVACIÓN FONDO VIEWSET
# =====================================================

class ObservacionFondoViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ReadOnlyModelViewSet):
    """Hilos de observaciones del fondo (chat).

    Solo lectura más sus acciones: los hilos los crean las acciones del fondo
    (observar, observar-informe). Cada usuario ve los de su alcance, igual que
    los fondos: superusuario todo; Director, Jefe e Instituto su carrera;
    docente solo los de su propio fondo.
    """
    queryset = ObservacionFondo.objects.select_related(
        'fondo_tiempo', 'resuelta_por',
        'fondo_tiempo__docente'
    ).prefetch_related('mensajes__autor').order_by('-fecha_creacion') # Asegurar orden
    serializer_class = ObservacionFondoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fondo_tiempo', 'resuelta']
    ordering_fields = ['fecha_creacion']
    ordering = ['-fecha_creacion']

    @action(detail=False, methods=['get'])
    def novedades(self, request):
        """Chat del fondo, incremental: GET /observaciones/novedades/?fondo_tiempo=&desde_id=

        Devuelve los hilos sin sus mensajes (son pocos y así se ve si alguno se
        resolvió), solo los mensajes visibles con id > desde_id y el id del último
        mensaje propio que otro ya leyó (para el "leído"). Con marcar_leido=1 (chat
        abierto) se marcan como leídos los mensajes de otros que trae esta respuesta:
        solo hay escritura cuando llegan mensajes nuevos.
        """
        try:
            fondo_id = int(request.query_params.get('fondo_tiempo'))
            desde_id = int(request.query_params.get('desde_id') or 0)
        except (TypeError, ValueError):
            return Response(
                {'detail': "Los parámetros 'fondo_tiempo' y 'desde_id' deben ser enteros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hilos = self.get_queryset().prefetch_related(None).filter(fondo_tiempo_id=fondo_id)
        mensajes = MensajeObservacion.objects.filter(
            observacion__in=hilos, id__gt=desde_id,
        ).select_related('autor', 'responde_a__autor').order_by('id')
        if not _usuario_puede_ver_mensajes_internos(request):
            mensajes = mensajes.exclude(es_interno=True)
        mensajes = list(mensajes)

        # El Instituto (solo lectura) lee el chat sin marcar nada como leído.
        marcar_leido = request.query_params.get('marcar_leido') == '1' and not self.es_rol_solo_lectura(request)
        entrantes = [m for m in mensajes if m.autor_id != request.user.id and m.leido_en is None]
        if marcar_leido and entrantes:
            ahora = timezone.now()
            MensajeObservacion.objects.filter(id__in=[m.id for m in entrantes]).update(leido_en=ahora)
            for mensaje in entrantes:
                mensaje.leido_en = ahora

        leidos_propios_hasta = MensajeObservacion.objects.filter(
            observacion__in=hilos, autor=request.user, leido_en__isnull=False,
        ).aggregate(maximo=Max('id'))['maximo']

        return Response({
            'observaciones': HiloObservacionSerializer(hilos, many=True).data,
            'mensajes': MensajeObservacionSerializer(mensajes, many=True).data,
            'leidos_propios_hasta': leidos_propios_hasta,
        })

    def get_queryset(self):
        """Observaciones al alcance del usuario (rol activo), como en FondoTiempoViewSet."""
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_superuser:
            perfil = _obtener_perfil_efectivo(user, self.request)
            if perfil and perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
                carreras = _obtener_carreras_activas_usuario(user, self.request)
                queryset = queryset.filter(fondo_tiempo__carrera__in=carreras)
            elif perfil and perfil.rol == 'docente' and perfil.docente_id:
                queryset = queryset.filter(fondo_tiempo__docente_id=perfil.docente_id)
            else:
                queryset = queryset.none()

        # Filtrar por fondo_tiempo si viene en parámetros (DESPUÉS del filtro de permisos)
        fondo_id = self.request.query_params.get('fondo_tiempo', None)
        if fondo_id:
            queryset = queryset.filter(fondo_tiempo_id=fondo_id)

        return queryset

    @action(detail=True, methods=['post'], url_path='agregar-mensaje')
    def agregar_mensaje(self, request, pk=None):
        """Agregar un mensaje al hilo. get_object ya limita el hilo al alcance del
        usuario (el docente, a su fondo) y el Instituto es solo lectura (mixin)."""
        observacion = self.get_object()

        # Validar que haya texto
        texto = request.data.get('texto', '').strip()
        if not texto:
            return Response(
                {'error': 'El mensaje no puede estar vacio'},
                status=status.HTTP_400_BAD_REQUEST
            )

        responde_a = None
        responde_a_id = request.data.get('responde_a')
        if responde_a_id:
            try:
                responde_a = MensajeObservacion.objects.get(
                    id=responde_a_id,
                    observacion=observacion
                )
            except (MensajeObservacion.DoesNotExist, ValueError, TypeError):
                return Response(
                    {'error': 'El mensaje citado no pertenece a esta conversacion'},
                    status=status.HTTP_400_BAD_REQUEST
                )
    
        # Nota interna Director <-> Jefe de Estudios: nunca visible para el docente.
        # Solo Director/Jefe de Estudios (o superuser) pueden marcar un mensaje como interno;
        # cualquier otro rol que envie el flag es ignorado y se fuerza a False.
        rol_activo = getattr(_obtener_perfil_efectivo(request.user, request), 'rol', None)
        puede_marcar_interno = request.user.is_superuser or rol_activo in ['director', 'jefe_estudios']
        es_interno = puede_marcar_interno and str(request.data.get('es_interno', '')).lower() in ('1', 'true', 'yes')

        # Crear mensaje
        MensajeObservacion.objects.create(
            observacion=observacion,
            autor=request.user,
            responde_a=responde_a,
            texto=texto,
            es_admin=rol_activo in ['director', 'jefe_estudios'],
            es_interno=es_interno,
       )

        output_serializer = self.get_serializer(observacion)
        return Response(output_serializer.data)

    @action(detail=True, methods=['post'], url_path='marcar-resuelta')
    def marcar_resuelta(self, request, pk=None):
        """Marcar hilo como resuelto."""
        # get_object limita el hilo: el docente, a su fondo; Jefatura, a su carrera.
        observacion = self.get_object()
        perfil = _obtener_perfil_efectivo(request.user, request)
        if not (request.user.is_superuser or (perfil and perfil.rol in ('docente', 'jefe_estudios'))):
            raise PermissionDenied('Solo el docente del fondo o Jefatura de Estudios marcan la observación como resuelta.')

        if observacion.resuelta:
            return Response(
                {'error': 'Esta observación ya fue resuelta'},
                status=status.HTTP_400_BAD_REQUEST
        )   
    
        observacion.marcar_resuelta(request.user)

        output_serializer = self.get_serializer(observacion)
        return Response(output_serializer.data)


# =====================================================
# HISTORIAL FONDO VIEWSET
# =====================================================

class HistorialFondoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet de solo lectura para historial (auditoría)"""
    queryset = HistorialFondo.objects.select_related(
        'fondo_tiempo', 'usuario', 'fondo_tiempo__docente'
    ).all()
    serializer_class = HistorialFondoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fondo_tiempo', 'tipo_cambio', 'usuario']
    # El modelo HistorialFondo usa el campo "fecha" (no "fecha_creacion").
    ordering_fields = ['fecha']
    ordering = ['-fecha']
    
    def get_queryset(self):
        """Historial de los fondos al alcance del usuario (rol activo), como en los fondos:
        superusuario todo; Director, Jefe e Instituto su carrera; docente sus fondos.
        Antes cualquier staff veía el historial de todas las carreras."""
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        perfil = _obtener_perfil_efectivo(user, self.request)
        if perfil and perfil.rol in ['director', 'jefe_estudios', 'iiisyp']:
            return queryset.filter(fondo_tiempo__carrera__in=_obtener_carreras_activas_usuario(user, self.request))
        if perfil and perfil.rol == 'docente' and perfil.docente_id:
            return queryset.filter(fondo_tiempo__docente_id=perfil.docente_id)
        return queryset.none()


# ============================================
# VIEWSET PARA GESTIÓN DE USUARIOS
# ============================================

class UsuarioViewSet(CarreraInactivaSoloLecturaMixin, viewsets.ModelViewSet):
    """
    ViewSet para gestión completa de usuarios.
    Solo usuarios administradores pueden crear, editar y eliminar usuarios.
    """
    queryset = User.objects.select_related('perfil', 'perfil__carrera', 'perfil__docente').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name', 'perfil__docente__datos_laborales__ci']
    ordering_fields = ['username', 'date_joined', 'last_name']
    ordering = ['-date_joined']

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def roles(self, request):
        """
        Retorna la lista de roles de usuario disponibles en el sistema. 
        Se define explícitamente para evitar problemas de caché o reinicio del servidor
        que puedan causar que la lista en el frontend esté incompleta.
        """
        roles = [
            ('iiisyp', 'Instituto de investigación'),
            ('director', 'Director de Carrera'),
            ('jefe_estudios', 'Jefe de Estudios'),
            ('docente', 'Docente'),
        ]
        return Response([{'value': r[0], 'label': r[1]} for r in roles])
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CrearUsuarioSerializer
        elif self.action in ['update', 'partial_update']:
            return ActualizarUsuarioSerializer
        return UsuarioSerializer
    
    def get_permissions(self):
        """
        Superusuario gestiona todo. Director gestiona usuarios dentro de su carrera.
        """
        if self.action == 'list':
            return [IsAuthenticated()]
        if self.action in ['create', 'update', 'partial_update', 'toggle_activo', 'cambiar_password', 'resetear_password']:
            return [IsFullAdminOrDirectorCarrera()]
        # Eliminar: superusuario, o el Director dentro de su carrera (ver destroy).
        if self.action in ['destroy']:
            return [IsFullAdminOrDirectorCarrera()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related('perfil').all()
        perfil = _obtener_perfil_efectivo(user, self.request)

        # Superusuario ve todos los usuarios sin restricciones
        if user.is_superuser:
            return queryset

        # IIISYP de carrera solo ve usuarios de su misma carrera
        if perfil and perfil.rol in ['iiisyp', 'director', 'jefe_estudios']:
            carreras_activas = _obtener_carreras_activas_usuario(user, self.request)
            if carreras_activas.exists():
                return queryset.filter(
                    Q(perfil__carrera__in=carreras_activas)
                    | Q(asignaciones_carrera__carrera__in=carreras_activas, asignaciones_carrera__activo=True)
                ).distinct()
            return queryset.none()

        # Usuario normal solo ve su propio perfil
        return queryset.filter(id=user.id)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Crear nuevo usuario con perfil.

        Todo en una transacción: si algo falla a mitad (asignaciones, ficha de
        docente o la sincronización final) no queda un usuario a medias con el
        perfil 'docente' que crea la señal.
        """
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        # Releer de la base: el objeto guardado conserva en caché el perfil que la
        # señal crea con rol 'docente', y la respuesta mostraba un rol que no se marcó.
        # Docente con cargo y sin ficha: activo, con su cargo funcionando.
        # Solo docente y sin ficha: inactivo hasta que se le cree la ficha.
        user = serializer.save()
        desactivar_si_solo_docente_sin_ficha(user)
        user = self._releer_usuario(user)

        # Retornar con el serializer de lectura
        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _releer_usuario(user):
        return User.objects.select_related('perfil').get(pk=user.pk)

    def update(self, request, *args, **kwargs):
        """Actualizar usuario y perfil"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            # Releer de la base: get_object() trajo el perfil anterior (select_related).
            user = self._releer_usuario(serializer.save())
        except IntegrityError:
            return Response(
                {
                    'rol': [
                        'No se puede cambiar el rol de este usuario porque ya tiene registros asociados en el sistema.'
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        # Retornar con el serializer de lectura
        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def dependencias(self, request, pk=None):
        """Datos registrados del usuario: si hay alguno no se puede eliminar y su identidad queda fija."""
        return Response(datos_registrados_usuario(self.get_object()), status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        BORRADO CONTROLADO DE USUARIO (misma regla que Carrera)
        - Con datos registrados (fondos, informes, cargas, saldos, POA...): no se
          elimina, solo se desactiva.
        - Sin datos: se borra el usuario junto con sus asignaciones, su perfil y su
          ficha de docente, sin dejar registros huérfanos.
        """
        user = self.get_object()

        if user.is_superuser:
            return Response(
                {'error': 'No se puede eliminar a un superusuario por seguridad. Debe hacerlo desde la consola.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.is_superuser:
            error_director = self._validar_eliminacion_por_director(request.user, user)
            if error_director:
                return Response({'error': error_director}, status=status.HTTP_403_FORBIDDEN)

        datos = datos_registrados_usuario(user)
        if datos['tiene_datos']:
            return Response(
                {
                    'code': 'dependency_exists',
                    'error': (
                        f'No se puede eliminar al usuario {user.username} porque tiene datos registrados '
                        f'({texto_datos_registrados(datos)}). Desactívelo en su lugar.'
                    ),
                    'dependencias': datos,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                self._eliminar_usuario_sin_datos(user)
        except ProtectedError:
            # Algún registro nuevo que datos_registrados_usuario todavía no cuenta.
            return Response(
                {
                    'code': 'protected_error',
                    'error': f'No se puede eliminar al usuario {user.username} porque tiene datos registrados. Desactívelo en su lugar.',
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    CARGOS = {'director', 'jefe_estudios', 'iiisyp'}

    @classmethod
    def _cargos_del_usuario(cls, user):
        """Cargos (Director, Jefe de Estudios, Instituto) del usuario. Desactivar libera
        sus asignaciones: de un usuario inactivo cuentan también las inactivas."""
        asignaciones = AsignacionCarrera.objects.filter(user=user)
        if user.is_active:
            asignaciones = asignaciones.filter(activo=True)
        roles = set(asignaciones.values_list('rol', flat=True))
        perfil = PerfilUsuario.objects.filter(user=user).first()
        if perfil and perfil.rol:
            roles.add(perfil.rol)
        return roles & cls.CARGOS

    def _validar_gestion_por_director(self, user, accion):
        """Lo que el Director (no el superusuario) puede hacer con otro usuario de su carrera.

        - Contraseña: solo de docentes sin cargo (no de Jefe, Instituto ni Director).
        - Activar o desactivar: docentes sin cargo y el Instituto; nunca al Jefe de
          Estudios (lo designa el Consejo de Carrera) ni a un Director.
        """
        editor = self.request.user
        if editor.is_superuser:
            return
        if user.is_superuser:
            raise PermissionDenied('Solo el superusuario gestiona la cuenta del superusuario.')
        cargos = self._cargos_del_usuario(user)
        if accion == 'password' and user.pk != editor.pk and cargos:
            raise PermissionDenied(
                'Solo el superusuario cambia la contraseña de un usuario con cargo '
                '(Director, Jefe de Estudios o Instituto).'
            )
        if accion == 'estado' and cargos & {'director', 'jefe_estudios'}:
            raise PermissionDenied(
                'No puedes activar ni desactivar a un Director ni al Jefe de Estudios: '
                'el Jefe lo designa el Consejo de Carrera.'
            )

    def _validar_eliminacion_por_director(self, director, user):
        """El Director elimina solo usuarios de su carrera; nunca a sí mismo ni a otro Director.

        Que no tenga datos registrados lo exige destroy igual que al superusuario.
        """
        if user.pk == director.pk:
            return 'No puedes eliminar tu propia cuenta.'
        perfil = PerfilUsuario.objects.filter(user=user).first()
        cargos = self._cargos_del_usuario(user)
        if 'director' in cargos:
            return 'No puedes eliminar a un Director de Carrera.'
        if 'jefe_estudios' in cargos:
            return 'No puedes eliminar al Jefe de Estudios: lo designa el Consejo de Carrera.'
        propias = set(_obtener_carreras_activas_usuario(director, self.request).values_list('id', flat=True))
        carreras_usuario = set(AsignacionCarrera.objects.filter(user=user).values_list('carrera_id', flat=True))
        if perfil and perfil.carrera_id:
            carreras_usuario.add(perfil.carrera_id)
        carreras_usuario.discard(None)
        if not carreras_usuario or not carreras_usuario <= propias:
            return 'Solo puedes eliminar usuarios de tu carrera.'
        return None

    @staticmethod
    def _eliminar_usuario_sin_datos(user):
        perfil = PerfilUsuario.objects.filter(user=user).select_related('docente').first()
        docente = docente_del_usuario(user)
        datos_laborales_ids = {
            perfil.datos_laborales_id if perfil else None,
            docente.datos_laborales_id if docente else None,
        } - {None}

        # La ficha de docente es de esta persona salvo que otro usuario la use.
        if docente and (
            (docente.user_id and docente.user_id != user.id)
            or PerfilUsuario.objects.filter(docente=docente, user__isnull=False).exclude(user=user).exists()
        ):
            docente = None

        AsignacionCarrera.objects.filter(user=user).delete()
        PerfilUsuario.objects.filter(user=user).delete()
        if docente:
            AsignacionCarrera.objects.filter(docente=docente, user__isnull=True).delete()
            PerfilUsuario.objects.filter(docente=docente, user__isnull=True).delete()
            docente.delete()  # sus vínculos DocenteCarrera caen en cascada
        user.delete()

        # Datos laborales que ya no usa nadie (la ficha de docente borrada o el perfil).
        DatosLaborales.objects.filter(
            pk__in=datos_laborales_ids, docente__isnull=True, perfiles__isnull=True,
        ).delete()

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdminOrDirectorCarrera])
    def cambiar_password(self, request, pk=None):
        """Cambiar contraseña de un usuario"""
        user = self.get_object()
        self._validar_gestion_por_director(user, 'password')
        password = request.data.get('password')
        password_confirm = request.data.get('password_confirm')
        
        if not password or not password_confirm:
            return Response(
                {'error': 'Se requieren ambas contraseñas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if password != password_confirm:
            return Response(
                {'error': 'Las contraseñas no coinciden'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(password) < 8:
            return Response(
                {'error': 'La contraseña debe tener al menos 8 caracteres'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(password)
        user.save()
        # Contraseña puesta por otra persona: el usuario la cambia en su siguiente ingreso.
        if user != request.user:
            actualizar_con_historial(PerfilUsuario.objects.filter(user=user), debe_cambiar_password=not user.is_superuser)

        return Response({'success': 'Contraseña actualizada correctamente'})

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdminOrDirectorCarrera])
    def resetear_password(self, request, pk=None):
        """Restablece la contraseña del usuario a la inicial (usuario + UABJB). La respuesta
        no la incluye: ninguna respuesta de la API devuelve contraseñas."""
        user = self.get_object()
        self._validar_gestion_por_director(user, 'password')
        user.set_password(f"{user.username}UABJB")
        user.save()
        actualizar_con_historial(PerfilUsuario.objects.filter(user=user), debe_cambiar_password=not user.is_superuser)
        return Response({'success': 'Contraseña restablecida a la contraseña inicial. Deberá cambiarla al ingresar.'})

    @action(detail=True, methods=['post'], permission_classes=[IsFullAdminOrDirectorCarrera])
    def toggle_activo(self, request, pk=None):
        """
        Activar o desactivar usuario.

        FLUJO DE REACTIVACIÓN (user inactivo -> activo):
        Aplica blindaje estricto de normativa UABJB:
          1. Unicidad de cargo de gestión (Director / Jefe de Estudios por carrera).
          2. Fondo de tiempo contractual en combinaciones autoridad + docencia.
        Si alguna validación falla, el estado NO se modifica y se retorna HTTP 400.
        """
        user = self.get_object()
        self._validar_gestion_por_director(user, 'estado')

        # Proteger al superusuario administrador
        if user.is_superuser:
            return Response(
                {'error': 'No se puede desactivar al superusuario administrador'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Detectar si es una reactivación (usuario actualmente inactivo)
        es_reactivacion = not user.is_active

        if es_reactivacion:
            error_ficha = self._validar_reactivacion_sin_ficha(user)
            if error_ficha:
                return Response(error_ficha, status=status.HTTP_400_BAD_REQUEST)

            # Blindaje estructural de reactivación (normativa UABJB)
            error_reactivacion = self._validar_reactivacion_asignaciones(user)
            if error_reactivacion:
                return Response(error_reactivacion, status=status.HTTP_400_BAD_REQUEST)

        # Aplicar cambio de estado
        user.is_active = not user.is_active
        user.save()

        # Regla de sincronización: activar/desactivar usuario también afecta su docente y asignaciones
        perfil = PerfilUsuario.objects.filter(user=user).select_related('docente').first()

        if user.is_active is False:
            # Desactivar usuario: también su docente. Sus asignaciones (todas, incluidos
            # los cargos de gestión) las libera la señal guardar_perfil_usuario.
            if perfil and perfil.docente and perfil.docente.activo:
                perfil.docente.activo = False
                perfil.docente.save(update_fields=['activo'])
        else:
            # Reactivar usuario: también activar docente y asignaciones docentes.
            # Los cargos de gestión no vuelven solos: pudieron asignarse a otra persona.
            PerfilUsuario.objects.filter(user=user, inactivo_por_ficha_pendiente=True).update(
                inactivo_por_ficha_pendiente=False,
            )
            if perfil and perfil.docente and not perfil.docente.activo:
                perfil.docente.activo = True
                perfil.docente.save(update_fields=['activo'])

            actualizar_con_historial(user.asignaciones_carrera.filter(rol='docente', activo=False), activo=True)

        user = self._releer_usuario(user)

        output_serializer = UsuarioSerializer(user, context={'request': request})
        return Response(output_serializer.data)

    @staticmethod
    def _validar_reactivacion_sin_ficha(user):
        """Un usuario que al reactivarse quedaría solo docente necesita su ficha.

        Al reactivar vuelven sus asignaciones docentes, pero no sus cargos.
        """
        perfil = PerfilUsuario.objects.filter(user=user).first()
        roles = {perfil.rol} if perfil and perfil.rol else set()
        if user.asignaciones_carrera.filter(rol='docente').exists():
            roles.add('docente')
        if roles == {'docente'} and docente_del_usuario(user) is None:
            mensaje = (
                'No se puede activar: el usuario solo es docente y aún no tiene ficha de docente. '
                'Se activará automáticamente al crearle la ficha.'
            )
            return {'error': mensaje, 'detail': mensaje}
        return None

    def _validar_reactivacion_asignaciones(self, user):
        """
        Blindaje de reactivación (normativa UABJB).

        Antes de permitir que un usuario pausado vuelva a estar activo, verifica:
          1. Que ningún cargo de gestión (Director / Jefe de Estudios) haya sido
             ocupado por otro titular mientras el usuario estuvo inactivo.
          2. Que las horas semanales activas sigan respetando el tope contractual
             vigente (fondo de tiempo) para combinaciones doble rol.

        Retorna un dict {'error': mensaje} si la validación falla, o None si todo está OK.
        """
        perfil = PerfilUsuario.objects.filter(user=user).select_related('docente', 'carrera').first()
        if not perfil:
            return None

        # ------------------------------------------------
        # 1) RECOLECTAR ASIGNACIONES A REACTIVAR
        # ------------------------------------------------
        bloques = []

        # Rol principal del PerfilUsuario (cargo de gestión)
        if perfil.rol in ('director', 'jefe_estudios') and perfil.carrera_id:
            bloques.append({
                'rol': perfil.rol,
                'carrera': perfil.carrera,
                'docente': perfil.docente,
            })

        # Asignaciones explícitas en AsignacionCarrera (todas, sin importar estado activo)
        for asignacion in user.asignaciones_carrera.select_related('carrera', 'docente'):
            bloques.append({
                'rol': asignacion.rol,
                'carrera': asignacion.carrera,
                'docente': asignacion.docente or perfil.docente,
            })

        # Eliminar duplicados (rol, carrera) manteniendo la primera ocurrencia
        vistos = set()
        bloques_unicos = []
        for bloque in bloques:
            carrera_id = bloque['carrera'].id if bloque.get('carrera') else None
            clave = (bloque.get('rol'), carrera_id)
            if clave not in vistos:
                vistos.add(clave)
                bloques_unicos.append(bloque)
        bloques = bloques_unicos

        if not bloques:
            return None

        # ------------------------------------------------
        # 2) VALIDAR UNICIDAD DE CARGO DE GESTIÓN
        # ------------------------------------------------
        cargos_display = {
            'director': 'Director de Carrera',
            'jefe_estudios': 'Jefe de Estudios',
        }

        for bloque in bloques:
            rol = bloque.get('rol')
            carrera = bloque.get('carrera')
            if rol in ROLES_UNICOS_POR_CARRERA and carrera:
                try:
                    validar_unicidad_cargo_por_carrera(
                        carrera=carrera,
                        rol=rol,
                        exclude_user_id=user.id,
                    )
                except drf_serializers.ValidationError:
                    cargo = cargos_display.get(rol, rol)
                    return {
                        'error': (
                            f'No se puede reactivar al usuario porque la carrera '
                            f'"{carrera.nombre}" ya cuenta con un {cargo} activo. '
                            f'Debe dar de baja al titular actual antes de reactivar este usuario.'
                        )
                    }

        # ------------------------------------------------
        # 3) VALIDAR FONDO DE TIEMPO CONTRACTUAL (DOBLE ROL)
        # ------------------------------------------------
        try:
            _validar_fondo_tiempo_contractual_doble_rol(
                bloques,
                docente_por_defecto=perfil.docente,
            )
        except drf_serializers.ValidationError as exc:
            detalle = self._extraer_mensaje_validation_error(exc.detail)
            return {
                'error': (
                    f'No se puede reactivar al usuario debido a una violación de fondo de tiempo '
                    f'contractual: {detalle}'
                )
            }

        return None

    def _extraer_mensaje_validation_error(self, detail):
        """Convierte el detail de un ValidationError de DRF en un mensaje legible."""
        if isinstance(detail, dict):
            for valor in detail.values():
                return self._extraer_mensaje_validation_error(valor)
        if isinstance(detail, list):
            return self._extraer_mensaje_validation_error(detail[0]) if detail else ''
        return str(detail) if detail is not None else ''


# ============================================
# FUNCIÓN PARA USUARIO ACTUAL
# ============================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def usuario_actual(request):
    """Retorna la información completa del usuario actual"""
    user = request.user
    serializer = UsuarioSerializer(user, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil_actual(request):
    """Retorna el perfil del usuario actual."""
    perfil = getattr(request.user, 'perfil', None)
    if not perfil:
        return Response({'detail': 'El usuario no tiene perfil asignado.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = PerfilUsuarioSerializer(perfil, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Retorna estadísticas rápidas para el dashboard de administración.
    """
    try:
        if request.user.is_superuser:
            user_count = User.objects.count()
            docente_count = Docente.objects.count()
            carrera_count = Carrera.objects.filter(activo=True).count()
        else:
            # Roles de carrera: solo lo de sus carreras (mismas reglas que los listados).
            carreras = _obtener_carreras_activas_usuario(request.user, request)
            user_count = User.objects.filter(
                Q(perfil__carrera__in=carreras)
                | Q(asignaciones_carrera__carrera__in=carreras, asignaciones_carrera__activo=True)
            ).distinct().count()
            docente_count = _docentes_por_carreras(carreras).count()
            carrera_count = carreras.filter(activo=True).count()

        stats = {
            'usuarios': user_count,
            'docentes': docente_count,
            'carreras': carrera_count,
        }
        return Response(stats)
    except Exception as e:
        return Response(
            {'error': f'Error al obtener estadísticas: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class FotoPerfilUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    Endpoint para que un usuario obtenga, actualice o elimine su propia foto de perfil.
    - PATCH: Sube una nueva foto.
    - DELETE: Elimina la foto actual.
    """
    serializer_class = FotoPerfilSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """Retorna el perfil del usuario autenticado."""
        return self.request.user.perfil

    def perform_destroy(self, instance):
        """Al hacer DELETE, solo borra la foto de perfil, no el objeto PerfilUsuario."""
        instance.clear_foto_perfil()
        instance.save(update_fields=['foto_perfil', 'foto_perfil_cifrada', 'foto_perfil_mime'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_password_inicial(request):
    """
    Endpoint para que el usuario cambie su contraseña obligatoria al primer inicio de sesión.
    """
    user = request.user
    nueva_password = request.data.get('password')
    
    if not nueva_password or len(nueva_password) < 8:
        return Response(
            {'error': 'La contraseña debe tener al menos 8 caracteres.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.set_password(nueva_password)
    user.save()
    
    user.perfil.debe_cambiar_password = False
    user.perfil.save()
    
    return Response({'message': 'Contraseña actualizada correctamente. Por favor inicie sesión nuevamente.'})

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vista de login personalizada que usa el serializer extendido"""
    serializer_class = CustomTokenObtainPairSerializer
