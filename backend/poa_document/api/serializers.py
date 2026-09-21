import re

from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Sum

# Modelos del paquete
from poa_document.models import (
    DocumentoPOA,
    ObjetivoEspecifico,
    Actividad,
    DetallePresupuesto,
    UsuarioPOA,
    HistorialDocumentoPOA,
    ObservacionDocumentoPOA,
    SolicitudCambioPOA,
    MensajeChat,
    VersionDocumentoPOA,
    SeguimientoActividadPOA,
    OrdenCompraPOA, DetalleOrdenCompraPOA, RecepcionMaterialPOA, DetalleRecepcionMaterialPOA, EntregaMaterialActividad,
)
from poa_document.models import Evidencia, EvidenciaArchivo, ProgramaPOA, ItemCatalogo, IndicadorCatalogo
from fondos.models import Docente, Carrera


class PartidaCatalogoSerializer(serializers.Serializer):
    id = serializers.CharField()
    codigo = serializers.CharField()
    nombre = serializers.CharField()


class ItemCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCatalogo
        fields = ['id', 'detalle', 'unidad_medida', 'partida']
        read_only_fields = ['id']


class IndicadorCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndicadorCatalogo
        fields = ['id', 'indicador']
        read_only_fields = ['id']

    def validate_indicador(self, value):
        text = str(value or '').strip()
        if not text:
            raise serializers.ValidationError('El indicador no puede estar vacío.')
        return text


def _carrera_usuario_autenticado(user):
    perfil = getattr(user, 'perfil', None)
    if not perfil:
        return None
    if getattr(perfil, 'carrera_id', None):
        return perfil.carrera
    carreras = perfil.get_carreras_activas() if hasattr(perfil, 'get_carreras_activas') else None
    if carreras and carreras.exists():
        return carreras.first()
    return None


class DocenteSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()

    class Meta:
        model = Docente
        fields = ['id', 'nombre_completo', 'apellido_paterno', 'apellido_materno',
                  'nombres', 'ci', 'email']


class UserSimpleSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo']

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username


class CarreraSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrera
        fields = ['id', 'nombre', 'codigo']


class ProgramaPOASerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)

    class Meta:
        model = ProgramaPOA
        fields = ['id', 'carrera', 'carrera_nombre', 'nombre', 'activo', 'creado_en', 'actualizado_en']
        read_only_fields = ['id', 'carrera', 'carrera_nombre', 'creado_en', 'actualizado_en']

    def validate_nombre(self, value):
        nombre = str(value or '').strip()
        if not nombre:
            raise serializers.ValidationError('El nombre del programa es obligatorio.')
        return nombre


class UsuarioPOASerializer(serializers.ModelSerializer):
    user_detalle = UserSimpleSerializer(source='user', read_only=True)
    docente_detalle = DocenteSimpleSerializer(source='docente', read_only=True)
    carrera_detalle = CarreraSimpleSerializer(source='carrera', read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    nombre_display = serializers.SerializerMethodField()

    class Meta:
        model = UsuarioPOA
        fields = ['id', 'user', 'user_detalle', 'docente', 'docente_detalle',
                  'carrera', 'carrera_detalle',
                  'rol', 'rol_display', 'nombre_display',
                  'nombre_entidad', 'activo', 'fecha_asignacion']
        read_only_fields = ['fecha_asignacion']
        extra_kwargs = {
            'user': {'required': False, 'allow_null': True},
            'docente': {'required': False, 'allow_null': True},
        }

    def get_nombre_display(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        if obj.docente:
            return obj.docente.nombre_completo
        return f'UsuarioPOA #{obj.pk}'

    def validate_rol(self, value):
        if value != 'elaborador':
            raise serializers.ValidationError('Solo se permite asignar el rol Elaborador del POA.')
        return value


class VersionDocumentoPOASerializer(serializers.ModelSerializer):
    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = VersionDocumentoPOA
        fields = ['id', 'numero', 'motivo', 'creado_por', 'creado_por_nombre', 'creado_en', 'vigente']
        read_only_fields = fields

    def get_creado_por_nombre(self, obj):
        return obj.creado_por.get_full_name() or obj.creado_por.username


class SeguimientoActividadPOASerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SeguimientoActividadPOA
        fields = ['id', 'estado_anterior', 'estado_nuevo', 'avance_porcentaje', 'nota', 'registrado_por', 'registrado_por_nombre', 'registrado_en']
        read_only_fields = fields

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.get_full_name() or obj.registrado_por.username


class HistorialDocumentoPOASerializer(serializers.ModelSerializer):
    tipo_evento_display = serializers.CharField(source='get_tipo_evento_display', read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    justificacion = serializers.SerializerMethodField()

    class Meta:
        model = HistorialDocumentoPOA
        fields = [
            'id', 'fecha', 'tipo_evento', 'tipo_evento_display', 'descripcion',
            'estado_anterior', 'estado_nuevo', 'datos_evento', 'usuario', 'usuario_nombre',
            'justificacion',
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    def get_justificacion(self, obj):
        return (obj.datos_evento or {}).get('justificacion', '')


class ObservacionDocumentoPOASerializer(serializers.ModelSerializer):
    creado_por_nombre = serializers.SerializerMethodField()
    resuelto_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ObservacionDocumentoPOA
        fields = [
            'id', 'documento', 'ciclo_revision', 'texto', 'creado_por',
            'creado_por_nombre', 'creado_en', 'resuelta', 'resuelto_por',
            'resuelto_por_nombre', 'resuelto_en',
        ]
        read_only_fields = [
            'id', 'documento', 'ciclo_revision', 'texto', 'creado_por',
            'creado_por_nombre', 'creado_en', 'resuelto_por',
            'resuelto_por_nombre', 'resuelto_en',
        ]

    def get_creado_por_nombre(self, obj):
        return obj.creado_por.get_full_name() or obj.creado_por.username

    def get_resuelto_por_nombre(self, obj):
        if not obj.resuelto_por:
            return ''
        return obj.resuelto_por.get_full_name() or obj.resuelto_por.username


class SolicitudCambioPOASerializer(serializers.ModelSerializer):
    solicitado_por_nombre = serializers.SerializerMethodField()
    revisado_por_nombre = serializers.SerializerMethodField()
    tipo_objeto_display = serializers.CharField(source='get_tipo_objeto_display', read_only=True)
    accion_display = serializers.CharField(source='get_accion_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = SolicitudCambioPOA
        fields = [
            'id', 'documento', 'tipo_objeto', 'tipo_objeto_display', 'objeto_id',
            'accion', 'accion_display', 'payload', 'resumen', 'descripcion',
            'estado', 'estado_display', 'solicitado_por', 'solicitado_por_nombre',
            'revisado_por', 'revisado_por_nombre', 'respuesta', 'creado_en',
            'actualizado_en', 'respondido_en',
        ]
        read_only_fields = [
            'id', 'estado', 'estado_display', 'solicitado_por', 'solicitado_por_nombre',
            'revisado_por', 'revisado_por_nombre', 'respuesta', 'creado_en',
            'actualizado_en', 'respondido_en',
        ]

    def get_solicitado_por_nombre(self, obj):
        return obj.solicitado_por.get_full_name() or obj.solicitado_por.username

    def get_revisado_por_nombre(self, obj):
        if not obj.revisado_por:
            return ''
        return obj.revisado_por.get_full_name() or obj.revisado_por.username


class DocumentoPOASerializer(serializers.ModelSerializer):
    unidad_solicitante_detalle = CarreraSimpleSerializer(source='unidad_solicitante', read_only=True)
    programa_id = serializers.PrimaryKeyRelatedField(
        queryset=ProgramaPOA.objects.all(), write_only=True, required=False, allow_null=True
    )

    elaborado_por_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), write_only=True, required=False, allow_null=True)
    jefe_unidad_id = serializers.PrimaryKeyRelatedField(queryset=UsuarioPOA.objects.all(), write_only=True, required=False, allow_null=True)

    objetivos = serializers.SerializerMethodField()
    historial = serializers.SerializerMethodField()
    observaciones_checklist = serializers.SerializerMethodField()
    solicitudes_cambio_pendientes = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoPOA
        fields = [
            'id', 'gestion', 'unidad_solicitante', 'unidad_solicitante_detalle', 'programa', 'programa_id', 'objetivo_gestion_institucional',
            'elaborado_por', 'jefe_unidad', 'fecha_elaboracion', 'estado', 'observaciones', 'observacion_elaboracion', 'ciclo_revision_actual',
            'creado_en', 'actualizado_en', 'elaborado_por_id', 'jefe_unidad_id',
            'objetivos', 'historial',
            'observaciones_checklist', 'solicitudes_cambio_pendientes'
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        programa_obj = attrs.pop('programa_id', None)
        elaborado_por_obj = attrs.pop('elaborado_por_id', None)
        jefe_unidad_obj = attrs.pop('jefe_unidad_id', None)
        elaborado_por = elaborado_por_obj or attrs.get('elaborado_por', getattr(self.instance, 'elaborado_por', ''))
        jefe_unidad = jefe_unidad_obj or attrs.get('jefe_unidad', getattr(self.instance, 'jefe_unidad', ''))
        estado = attrs.get('estado', getattr(self.instance, 'estado', 'elaboracion'))
        observaciones = attrs.get('observaciones', getattr(self.instance, 'observaciones', ''))

        errors = {}

        if user and user.is_authenticated and not user.is_superuser:
            carrera = _carrera_usuario_autenticado(user)
            if not carrera:
                errors['unidad_solicitante'] = 'El usuario no tiene una carrera asignada para crear o editar documentos POA.'
            else:
                attrs['unidad_solicitante'] = carrera

        carrera_documento = attrs.get('unidad_solicitante', getattr(self.instance, 'unidad_solicitante', None))
        if programa_obj is not None:
            if not programa_obj.activo:
                errors['programa_id'] = 'El programa seleccionado está inactivo.'
            elif not carrera_documento or programa_obj.carrera_id != carrera_documento.id:
                errors['programa_id'] = 'El programa seleccionado no pertenece a la carrera del documento.'
            else:
                # El campo de texto conserva una fotografía histórica del programa.
                attrs['programa'] = programa_obj.nombre

        if elaborado_por is not None:
            if hasattr(elaborado_por, 'activo') and not elaborado_por.activo:
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe estar activo en Accesos POA.'
            elif hasattr(elaborado_por, 'rol') and elaborado_por.rol != 'elaborador':
                errors['elaborado_por_id'] = 'El usuario seleccionado para "Elaborado por" debe tener el rol Elaborador del POA.'

        if jefe_unidad is not None:
            if hasattr(jefe_unidad, 'activo') and not jefe_unidad.activo:
                errors['jefe_unidad_id'] = 'El usuario seleccionado para "Jefe de unidad" debe estar activo en Accesos POA.'

        if hasattr(elaborado_por, 'pk') and hasattr(jefe_unidad, 'pk') and elaborado_por.pk == jefe_unidad.pk:
            errors['non_field_errors'] = '"Elaborado por" y "Jefe de unidad" deben ser personas diferentes.'

        if estado == 'observado' and not str(observaciones or '').strip():
            errors['observaciones'] = 'Debe registrar observaciones cuando el estado es Observado.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _resolver_nombre_usuario_poa(self, usuario_poa):
        if not usuario_poa:
            return ''
        if getattr(usuario_poa, 'user_id', None):
            return usuario_poa.user.get_full_name() or usuario_poa.user.username
        if getattr(usuario_poa, 'docente_id', None):
            return usuario_poa.docente.nombre_completo
        return getattr(usuario_poa, 'nombre_display', '') or f'UsuarioPOA #{usuario_poa.pk}'

    def create(self, validated_data):
        elaborado_por_obj = validated_data.pop('elaborado_por_id', None)
        jefe_unidad_obj = validated_data.pop('jefe_unidad_id', None)
        if elaborado_por_obj is not None:
            validated_data['elaborado_por'] = self._resolver_nombre_usuario_poa(elaborado_por_obj)
        if jefe_unidad_obj is not None:
            validated_data['jefe_unidad'] = self._resolver_nombre_usuario_poa(jefe_unidad_obj)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        elaborado_por_obj = validated_data.pop('elaborado_por_id', None)
        jefe_unidad_obj = validated_data.pop('jefe_unidad_id', None)
        if elaborado_por_obj is not None:
            validated_data['elaborado_por'] = self._resolver_nombre_usuario_poa(elaborado_por_obj)
        if jefe_unidad_obj is not None:
            validated_data['jefe_unidad'] = self._resolver_nombre_usuario_poa(jefe_unidad_obj)
        return super().update(instance, validated_data)

    def get_objetivos(self, obj):
        return ObjetivoEspecificoSerializer(obj.objetivos.all(), many=True).data

    def get_historial(self, obj):
        historial = obj.historial.select_related('usuario').all()[:10]
        return HistorialDocumentoPOASerializer(historial, many=True, context=self.context).data

    def get_observaciones_checklist(self, obj):
        observaciones = obj.observaciones_checklist.filter(
            ciclo_revision=obj.ciclo_revision_actual,
        ).select_related('creado_por', 'resuelto_por')
        return ObservacionDocumentoPOASerializer(observaciones, many=True, context=self.context).data

    def get_solicitudes_cambio_pendientes(self, obj):
        solicitudes = obj.solicitudes_cambio.filter(estado='pendiente').select_related('solicitado_por', 'revisado_por')[:20]
        return SolicitudCambioPOASerializer(solicitudes, many=True, context=self.context).data


# Serializers para Objetivos/Actividades (integrados en poa_document)
class ObjetivoEspecificoSerializer(serializers.ModelSerializer):
    # Para crear/editar desde la API requerimos relacionar explícitamente el documento
    # No forzamos el campo en updates/patches; la vista validará su presencia en create
    documento_id = serializers.PrimaryKeyRelatedField(queryset=DocumentoPOA.objects.all(), source='documento', write_only=True, required=False)
    documento = serializers.IntegerField(source='documento_id', read_only=True)
    documento_estado = serializers.CharField(source='documento.estado', read_only=True)
    documento_gestion = serializers.IntegerField(source='documento.gestion', read_only=True)
    actividades_count = serializers.SerializerMethodField()
    monto_funcion_total = serializers.SerializerMethodField()
    monto_inversion_total = serializers.SerializerMethodField()
    monto_total = serializers.SerializerMethodField()

    class Meta:
        model = ObjetivoEspecifico
        fields = [
            'id', 'codigo', 'descripcion', 'documento_id', 'documento',
            'documento_estado', 'documento_gestion',
            'actividades_count', 'monto_funcion_total', 'monto_inversion_total', 'monto_total',
        ]

    def _decimal_attr(self, obj, attr):
        value = getattr(obj, attr, None)
        return value if value is not None else 0

    def _sum_actividades(self, obj, field):
        return obj.actividades.aggregate(total=Sum(field)).get('total') or 0

    def get_actividades_count(self, obj):
        annotated = getattr(obj, 'actividades_count', None)
        if annotated is not None:
            return annotated
        return obj.actividades.count()

    def get_monto_funcion_total(self, obj):
        annotated = getattr(obj, 'monto_funcion_total', None)
        if annotated is not None:
            return annotated
        return self._sum_actividades(obj, 'monto_funcion')

    def get_monto_inversion_total(self, obj):
        annotated = getattr(obj, 'monto_inversion_total', None)
        if annotated is not None:
            return annotated
        return self._sum_actividades(obj, 'monto_inversion')

    def get_monto_total(self, obj):
        return self.get_monto_funcion_total(obj) + self.get_monto_inversion_total(obj)


class ActividadSerializer(serializers.ModelSerializer):
    # indicador_descripcion ahora es un TextField: se puede escribir directamente como texto
    indicador_descripcion_texto = serializers.CharField(source='indicador_descripcion', read_only=True)
    indicadores_disponibles = serializers.SerializerMethodField()
    evidencia_registrada = serializers.SerializerMethodField()
    evidencia_cumplimiento = serializers.SerializerMethodField()

    # campo write-only para relacionar el objetivo (misma convención)
    objetivo_id = serializers.PrimaryKeyRelatedField(queryset=ObjetivoEspecifico.objects.all(), source='objetivo', write_only=True, required=False)
    objetivo = serializers.IntegerField(source='objetivo_id', read_only=True)
    documento_id = serializers.IntegerField(source='objetivo.documento_id', read_only=True)
    documento_estado = serializers.CharField(source='objetivo.documento.estado', read_only=True)
    documento_gestion = serializers.IntegerField(source='objetivo.documento.gestion', read_only=True)

    class Meta:
        model = Actividad
        fields = [
            'id', 'objetivo_id', 'objetivo', 'documento_id', 'documento_estado', 'documento_gestion',
            'codigo', 'nombre', 'responsable', 'productos_esperados',
            'mes_inicio', 'mes_fin', 'indicador_descripcion', 'indicador_descripcion_texto',
            'indicadores_disponibles',
            'indicador_unidad', 'indicador_linea_base', 'indicador_meta',
            'riesgo_previsto',
            'monto_funcion', 'monto_inversion', 'estado',
            'evidencia_registrada', 'evidencia_cumplimiento'
        ]
        read_only_fields = ['id']

    def validate_objetivo(self, value):
        if value and (not hasattr(value, 'documento') or not value.documento):
            raise serializers.ValidationError("El objetivo debe tener un documento POA asociado")
        return value

    def validate(self, attrs):
        # Si es POST (crear), exigir que venga objetivo_id en los datos (write-only)
        request = self.context.get('request')
        if request and request.method == 'POST':
            if 'objetivo' not in attrs:
                raise serializers.ValidationError({ 'objetivo_id': 'El campo objetivo_id es obligatorio para crear una actividad.' })
        meses = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
        }
        inicio = str(attrs.get('mes_inicio', getattr(self.instance, 'mes_inicio', ''))).strip().lower()
        fin = str(attrs.get('mes_fin', getattr(self.instance, 'mes_fin', ''))).strip().lower()
        errors = {}
        if inicio not in meses:
            errors['mes_inicio'] = 'Seleccione un mes de inicio válido.'
        if fin not in meses:
            errors['mes_fin'] = 'Seleccione un mes de finalización válido.'
        if inicio in meses and fin in meses and meses[inicio] > meses[fin]:
            errors['mes_fin'] = 'El mes de finalización no puede ser anterior al mes de inicio.'

        unidad = attrs.get('indicador_unidad', getattr(self.instance, 'indicador_unidad', 'numero'))
        if unidad == 'porcentaje':
            for campo in ('indicador_linea_base', 'indicador_meta'):
                valor = attrs.get(campo, getattr(self.instance, campo, 0))
                if valor is not None and not 0 <= valor <= 100:
                    errors[campo] = 'Cuando la unidad es porcentaje, el valor debe estar entre 0 y 100.'

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        try:
            actividad = Actividad.objects.create(**validated_data)
            return actividad
        except Exception as e:
            raise serializers.ValidationError(f"Error al crear la actividad: {str(e)}")

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.save()
            return instance
        except Exception as e:
            raise serializers.ValidationError(f"Error al actualizar la actividad: {str(e)}")

    def get_indicadores_disponibles(self, obj):
        # La carrera solicitante ya está resuelta en el documento; no aplica filtro adicional aquí.
        return []

    def get_evidencia_registrada(self, obj):
        return bool(getattr(obj, 'evidencias', None) and obj.evidencias.exists())

    def get_evidencia_cumplimiento(self, obj):
        try:
            evidencia = obj.evidencias.first()
            if not evidencia:
                return 0
            return float(evidencia.grado_cumplimiento or 0)
        except Exception:
            return 0


# Compra, recepción y entrega: solo se exponen snapshots, nunca se crean usuarios para receptores.
class DetalleOrdenCompraPOASerializer(serializers.ModelSerializer):
    costo_total_real = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    cantidad_recibida = serializers.SerializerMethodField()
    cantidad_entregada = serializers.SerializerMethodField()
    saldo_recepcion = serializers.SerializerMethodField()
    saldo_entrega = serializers.SerializerMethodField()
    actividades_origen = serializers.SerializerMethodField()

    def get_cantidad_recibida(self, obj):
        return sum(detalle.cantidad_recibida for detalle in obj.recepciones_detalle.filter(recepcion__anulada=False))

    def get_cantidad_entregada(self, obj):
        return sum(entrega.cantidad_entregada for recepcion in obj.recepciones_detalle.filter(recepcion__anulada=False) for entrega in recepcion.entregas.filter(anulada=False))

    def get_saldo_recepcion(self, obj):
        return obj.cantidad_comprada - self.get_cantidad_recibida(obj)

    def get_saldo_entrega(self, obj):
        return self.get_cantidad_recibida(obj) - self.get_cantidad_entregada(obj)

    def get_actividades_origen(self, obj):
        detalles = DetallePresupuesto.objects.filter(id__in=obj.origen_detalles).select_related('actividad')
        resultado = {}
        for detalle in detalles:
            actividad = detalle.actividad
            actual = resultado.setdefault(actividad.id, {
                'id': actividad.id, 'codigo': actividad.codigo, 'nombre': actividad.nombre,
                'cantidad_requerida': 0, 'cantidad_entregada': 0,
            })
            actual['cantidad_requerida'] += detalle.cantidad
        entregas = EntregaMaterialActividad.objects.filter(
            anulada=False, detalle_recepcion__detalle_orden=obj,
        ).values('actividad').annotate(total=Sum('cantidad_entregada'))
        for entrega in entregas:
            if entrega['actividad'] in resultado:
                resultado[entrega['actividad']]['cantidad_entregada'] = entrega['total']
        return list(resultado.values())

    class Meta:
        model = DetalleOrdenCompraPOA
        fields = ['id', 'partida', 'item', 'unidad_medida', 'caracteristicas', 'tipo', 'cantidad_planificada', 'cantidad_comprada', 'costo_unitario_real', 'costo_total_real', 'origen_detalles', 'cantidad_recibida', 'cantidad_entregada', 'saldo_recepcion', 'saldo_entrega', 'actividades_origen']
        read_only_fields = fields


class OrdenCompraPOASerializer(serializers.ModelSerializer):
    detalles = DetalleOrdenCompraPOASerializer(many=True, read_only=True)
    recepciones = serializers.SerializerMethodField()

    def get_recepciones(self, obj):
        return RecepcionMaterialPOASerializer(obj.recepciones.all(), many=True, context=self.context).data
    class Meta:
        model = OrdenCompraPOA
        fields = ['id', 'carrera', 'gestion', 'numero', 'proveedor', 'fecha', 'estado', 'respaldo', 'observacion', 'creado_por', 'creado_en', 'motivo_anulacion', 'detalles', 'recepciones']
        read_only_fields = fields


class DetalleRecepcionMaterialPOASerializer(serializers.ModelSerializer):
    entregas = serializers.SerializerMethodField()
    saldo_entrega = serializers.SerializerMethodField()

    def get_entregas(self, obj):
        return EntregaMaterialActividadSerializer(obj.entregas.all(), many=True, context=self.context).data

    def get_saldo_entrega(self, obj):
        return obj.cantidad_recibida - sum(entrega.cantidad_entregada for entrega in obj.entregas.filter(anulada=False))

    class Meta:
        model = DetalleRecepcionMaterialPOA
        fields = ['id', 'detalle_orden', 'cantidad_recibida', 'costo_unitario_real', 'entregas', 'saldo_entrega']
        read_only_fields = fields


class RecepcionMaterialPOASerializer(serializers.ModelSerializer):
    detalles = DetalleRecepcionMaterialPOASerializer(many=True, read_only=True)
    class Meta:
        model = RecepcionMaterialPOA
        fields = ['id', 'orden', 'fecha', 'numero_respaldo', 'recibido_por', 'respaldo', 'observacion', 'registrado_por', 'registrado_en', 'anulada', 'motivo_anulacion', 'detalles']
        read_only_fields = fields


class EntregaMaterialActividadSerializer(serializers.ModelSerializer):
    actividad_nombre = serializers.CharField(source='actividad.nombre', read_only=True)
    actividad_codigo = serializers.CharField(source='actividad.codigo', read_only=True)
    class Meta:
        model = EntregaMaterialActividad
        fields = ['id', 'detalle_recepcion', 'actividad', 'actividad_nombre', 'actividad_codigo', 'cantidad_entregada', 'fecha', 'nombre_receptor', 'ci_receptor', 'cargo_receptor', 'telefono_receptor', 'acta_archivo', 'observacion', 'registrado_por', 'registrado_en', 'anulada', 'motivo_anulacion']
        read_only_fields = fields


# Serializer para DetallePresupuesto (integrado en poa_document)
class DetallePresupuestoSerializer(serializers.ModelSerializer):
    # actividad_id no es obligatorio en updates; la vista exige su presencia al crear
    actividad_id = serializers.PrimaryKeyRelatedField(queryset=Actividad.objects.all(), source='actividad', write_only=True, required=False)
    actividad = serializers.IntegerField(source='actividad_id', read_only=True)
    documento_id = serializers.IntegerField(source='actividad.objetivo.documento_id', read_only=True)
    documento_estado = serializers.CharField(source='actividad.objetivo.documento.estado', read_only=True)
    # Asegurar que 'cantidad' sea validada como entero en el endpoint
    cantidad = serializers.IntegerField(min_value=1)
    costo_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    tipo = serializers.ChoiceField(choices=DetallePresupuesto.TIPOS, default='funcion')
    catalogo_item_id = serializers.SerializerMethodField()
    catalogo_item_ref = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    class Meta:
        model = DetallePresupuesto
        # Exponer sólo los campos que existen en la base de datos. No incluimos

        fields = [
            'id',
            'actividad_id',
            'actividad',
            'documento_id',
            'documento_estado',
            'tipo',
            'partida',
            'item',
            'unidad_medida',
            'caracteristicas',
            'cantidad',
            'costo_unitario',
            'costo_total',
            'mes_requerimiento',
            'catalogo_item_id',
            'catalogo_item_ref',
        ]
        read_only_fields = ['id', 'costo_total']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        meses = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
            'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
        }
        actividad = attrs.get('actividad', getattr(self.instance, 'actividad', None))
        catalogo_item_ref = attrs.get('catalogo_item_ref')
        unidad_medida = str(attrs.get('unidad_medida', getattr(self.instance, 'unidad_medida', '')) or '').strip()
        valor = str(attrs.get('mes_requerimiento', getattr(self.instance, 'mes_requerimiento', '')) or '').strip().lower()
        partes = [parte.strip() for parte in re.split(r'\s*(?:-|hasta|\ba\b)\s*', valor) if parte.strip()]
        errors = {}

        if not unidad_medida or unidad_medida.lower() in {'sin unidad', 'sin_unidad'}:
            errors['unidad_medida'] = 'Ingrese una unidad de medida válida.'

        if catalogo_item_ref is not None:
            catalogo_item = ItemCatalogo.objects.filter(pk=catalogo_item_ref).first()
            item = str(attrs.get('item', getattr(self.instance, 'item', '')) or '').strip()
            partida = str(attrs.get('partida', getattr(self.instance, 'partida', '')) or '').strip()
            if not catalogo_item:
                errors['item'] = 'El ítem seleccionado ya no existe en el catálogo.'
            elif catalogo_item.detalle.strip().casefold() != item.casefold() or str(catalogo_item.partida).strip() != partida:
                errors['item'] = 'El ítem seleccionado no coincide con el registro del catálogo.'

        if not partes or len(partes) > 2 or any(parte not in meses for parte in partes):
            errors['mes_requerimiento'] = 'Seleccione un rango de meses válido.'
        elif actividad:
            inicio = partes[0]
            fin = partes[-1]
            actividad_inicio = str(actividad.mes_inicio or '').strip().lower()
            actividad_fin = str(actividad.mes_fin or '').strip().lower()
            if actividad_inicio not in meses or actividad_fin not in meses:
                errors['mes_requerimiento'] = 'La actividad no tiene un rango de meses válido.'
            elif meses[inicio] > meses[fin]:
                errors['mes_requerimiento'] = 'El mes final no puede ser anterior al mes inicial.'
            elif meses[inicio] < meses[actividad_inicio] or meses[fin] > meses[actividad_fin]:
                errors['mes_requerimiento'] = (
                    f'El requerimiento debe estar entre {actividad_inicio.capitalize()} '
                    f'y {actividad_fin.capitalize()}, que es el rango planificado de la actividad.'
                )
            else:
                attrs['mes_requerimiento'] = inicio.capitalize() if inicio == fin else f'{inicio.capitalize()} - {fin.capitalize()}'

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def get_catalogo_item_id(self, obj):
        coincidencias = ItemCatalogo.objects.filter(partida=str(obj.partida).strip(), detalle__iexact=str(obj.item).strip())
        if coincidencias.count() == 1:
            return coincidencias.values_list('id', flat=True).first()
        return None

    def _actualizar_unidad_catalogo(self, catalogo_item_ref, unidad_medida):
        if catalogo_item_ref is None:
            return
        catalogo_item = ItemCatalogo.objects.filter(pk=catalogo_item_ref).first()
        if catalogo_item and str(catalogo_item.unidad_medida or '').strip().lower() in {'', 'sin unidad', 'sin_unidad'}:
            catalogo_item.unidad_medida = str(unidad_medida).strip()
            catalogo_item.save(update_fields=['unidad_medida'])

    def create(self, validated_data):
        catalogo_item_ref = validated_data.pop('catalogo_item_ref', None)
        detalle = super().create(validated_data)
        self._actualizar_unidad_catalogo(catalogo_item_ref, detalle.unidad_medida)
        return detalle

    def update(self, instance, validated_data):
        catalogo_item_ref = validated_data.pop('catalogo_item_ref', None)
        detalle = super().update(instance, validated_data)
        self._actualizar_unidad_catalogo(catalogo_item_ref, detalle.unidad_medida)
        return detalle


class MensajeChatSerializer(serializers.ModelSerializer):
    emisor_nombre = serializers.SerializerMethodField()
    emisor_username = serializers.CharField(source='emisor.username', read_only=True)
    receptor_nombre = serializers.SerializerMethodField()
    receptor_username = serializers.CharField(source='receptor.username', read_only=True)
    leido = serializers.SerializerMethodField()
    entregado = serializers.SerializerMethodField()

    class Meta:
        model = MensajeChat
        fields = [
            'id', 'emisor', 'emisor_nombre', 'emisor_username',
            'receptor', 'receptor_nombre', 'receptor_username',
            'texto', 'fecha', 'leido_en', 'leido', 'entregado',
        ]
        read_only_fields = fields

    def get_emisor_nombre(self, obj):
        return obj.emisor.get_full_name() or obj.emisor.username

    def get_receptor_nombre(self, obj):
        return obj.receptor.get_full_name() or obj.receptor.username

    def get_leido(self, obj):
        return bool(obj.leido_en)

    def get_entregado(self, obj):
        return bool(obj.pk)


class EvidenciaArchivoSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = EvidenciaArchivo
        fields = ['id', 'tipo', 'archivo', 'archivo_url', 'url', 'creado_en']
        read_only_fields = ['id', 'archivo_url', 'creado_en']

    def get_archivo_url(self, obj):
        request = self.context.get('request')
        if obj.archivo and request:
            return request.build_absolute_uri(obj.archivo.url)
        return None


class EvidenciaSerializer(serializers.ModelSerializer):
    archivos = EvidenciaArchivoSerializer(many=True, read_only=True)
    actividad_id = serializers.PrimaryKeyRelatedField(queryset=Actividad.objects.all(), source='actividad', write_only=True)
    resultados_logrados = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = Evidencia
        fields = ['id', 'actividad', 'actividad_id', 'resultados_logrados', 'programado', 'ejecutado', 'grado_cumplimiento', 'creado_en', 'actualizado_en', 'archivos']
        read_only_fields = ['id', 'actividad', 'creado_en', 'actualizado_en', 'archivos']

    def create(self, validated_data):
        # actividad llega como objeto por actividad_id
        return Evidencia.objects.create(**validated_data)
