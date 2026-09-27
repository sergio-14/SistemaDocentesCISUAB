"""Tests de la auditoría del módulo de Carreras.

- Una carrera solo se elimina si está vacía (cualquier dependencia da 409).
- Si la carrera tiene datos académicos, sus campos de identidad no se pueden cambiar.
- Crear una carrera exige logo también en el backend.
- Una carrera desactivada es de solo lectura para todos, incluido el
  superusuario (en el módulo de fondos; el POA no es de este proyecto). La
  única excepción es que el superusuario edite la carrera para reactivarla.
- En el admin de Django solo el superusuario agrega y elimina carreras.
"""
import io
import shutil
import tempfile
from datetime import date

from django.contrib import admin
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from poa_document.models import OrdenCompraPOA, ProgramaPOA, UsuarioPOA

from fondos.models import (
    AsignacionCarrera, CalendarioAcademico, Carrera, DatosLaborales, Docente, DocenteCarrera,
    FacultadCatalogo, FondoTiempo, InformeFondo, Materia, PerfilUsuario,
)
from fondos.views import CarreraInactivaSoloLecturaMixin


def _logo(nombre='logo.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (8, 8), 'blue').save(buffer, 'PNG')
    return SimpleUploadedFile(nombre, buffer.getvalue(), content_type='image/png')


class CarreraBaseTestCase(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()

        self.facultad, _ = FacultadCatalogo.objects.get_or_create(nombre='Facultad de Ingeniería y Tecnología')
        self.otra_facultad, _ = FacultadCatalogo.objects.get_or_create(nombre='Facultad de Ciencias Agrícolas')
        self.superuser = User.objects.create_superuser('super_carreras', password='x')
        self._secuencia = 0

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def crear_carrera(self, **campos):
        self._secuencia += 1
        datos = {
            'nombre': f'Carrera {self._secuencia}',
            'codigo': f'CA{self._secuencia}',
            'facultad': self.facultad,
            'resolucion_ministerial': f'Res. HCU {self._secuencia}/2020',
            'fecha_resolucion': date(2020, 1, 1),
        }
        datos.update(campos)
        return Carrera.objects.create(**datos)

    def crear_usuario(self, username, rol, is_staff=False, **perfil):
        usuario = User.objects.create_user(username, password='x', is_staff=is_staff)
        PerfilUsuario.objects.filter(user=usuario).update(rol=rol, **perfil)
        # Recargar: el perfil creado por la señal queda en caché con el rol inicial.
        return User.objects.get(pk=usuario.pk)

    def crear_docente(self, ci):
        return Docente.objects.create(
            nombres='Ana', apellido_paterno='Rojas', datos_laborales=DatosLaborales.objects.create(ci=ci),
        )


class EliminarCarreraTests(CarreraBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def _crear_dependencia(self, clave, carrera):
        """Crea un único registro del tipo `clave` apuntando a la carrera."""
        if clave == 'materias':
            Materia.objects.create(nombre='Álgebra', sigla=f'ALG-{carrera.pk}', carrera=carrera, semestre=1, horas_teoricas=2)
        elif clave == 'fondos':
            FondoTiempo.objects.create(docente=self.crear_docente(f'F{carrera.pk}'), carrera=carrera, gestion=2026)
        elif clave == 'informes':
            fondo = FondoTiempo.objects.create(docente=self.crear_docente(f'I{carrera.pk}'), carrera=carrera, gestion=2026)
            InformeFondo.objects.create(fondo_tiempo=fondo, elaborado_por=self.superuser, tipo='parcial')
        elif clave == 'docentes_vinculados':
            DocenteCarrera.objects.create(
                docente=self.crear_docente(f'D{carrera.pk}'), carrera=carrera,
                categoria='catedratico', dedicacion='tiempo_completo',
            )
        elif clave == 'asignaciones':
            usuario = User.objects.create_user(f'asig_{carrera.pk}', password='x')
            AsignacionCarrera.objects.create(user=usuario, carrera=carrera, rol='jefe_estudios')
        elif clave == 'perfiles':
            usuario = User.objects.create_user(f'perfil_{carrera.pk}', password='x')
            PerfilUsuario.objects.filter(user=usuario).update(carrera=carrera)
        elif clave == 'calendarios':
            CalendarioAcademico.objects.create(
                carrera=carrera, gestion=2026, periodo='1',
                fecha_inicio=date(2026, 2, 1), fecha_fin=date(2026, 6, 30),
                fecha_inicio_presentacion_proyectos=date(2026, 2, 1),
                fecha_limite_presentacion_proyectos=date(2026, 2, 28),
            )
        elif clave == 'usuarios_poa':
            usuario = User.objects.create_user(f'poa_{carrera.pk}', password='x')
            UsuarioPOA.objects.create(user=usuario, carrera=carrera, rol='elaborador')
        elif clave == 'programas_poa':
            ProgramaPOA.objects.create(carrera=carrera, nombre='Programa de prueba')
        elif clave == 'ordenes_compra_poa':
            OrdenCompraPOA.objects.create(
                carrera=carrera, gestion=2026, numero='OC-1', proveedor='Proveedor', fecha=date(2026, 3, 1),
                creado_por=self.superuser,
            )
        else:
            raise AssertionError(f'Dependencia desconocida: {clave}')

    def test_borrar_carrera_vacia_funciona(self):
        carrera = self.crear_carrera()

        response = self.client.delete(f'/api/carreras/{carrera.pk}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Carrera.objects.filter(pk=carrera.pk).exists())

    def test_borrar_carrera_con_cada_tipo_de_dependencia_falla(self):
        dependencias = [
            'materias', 'fondos', 'informes', 'docentes_vinculados', 'asignaciones', 'perfiles',
            'calendarios', 'usuarios_poa', 'programas_poa', 'ordenes_compra_poa',
        ]
        for clave in dependencias:
            with self.subTest(dependencia=clave):
                carrera = self.crear_carrera()
                self._crear_dependencia(clave, carrera)

                response = self.client.delete(f'/api/carreras/{carrera.pk}/')

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertEqual(response.data['code'], 'dependency_exists')
                self.assertTrue(Carrera.objects.filter(pk=carrera.pk).exists())
                self.assertGreater(response.data['dependencias'][clave], 0)
                claves_detalle = [item['clave'] for item in response.data['dependencias']['detalle']]
                self.assertIn(clave, claves_detalle)

    def test_la_base_de_datos_protege_la_carrera_de_asignaciones_y_perfiles(self):
        # Antes eran SET_NULL: borrar la carrera dejaba esos registros huérfanos.
        # (UsuarioPOA sigue en SET_NULL porque el POA no es de este proyecto; la
        # API igual impide borrar la carrera, ver el test anterior.)
        for clave in ['asignaciones', 'perfiles']:
            with self.subTest(dependencia=clave):
                carrera = self.crear_carrera()
                self._crear_dependencia(clave, carrera)
                with self.assertRaises(Exception):
                    carrera.delete()
                self.assertTrue(Carrera.objects.filter(pk=carrera.pk).exists())

    def test_eliminar_requiere_superusuario(self):
        carrera = self.crear_carrera()
        director = self.crear_usuario('director_elim', 'director', is_staff=True)
        self.client.force_authenticate(director)

        response = self.client.delete(f'/api/carreras/{carrera.pk}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Carrera.objects.filter(pk=carrera.pk).exists())


class CamposIdentidadTests(CarreraBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)
        self.carrera = self.crear_carrera()
        Materia.objects.create(nombre='Álgebra', sigla='ALG-001', carrera=self.carrera, semestre=1, horas_teoricas=2)

    def test_editar_campos_bloqueados_con_datos_falla(self):
        cambios = {
            'nombre': 'Otro nombre',
            'codigo': 'OTRO',
            'facultad': self.otra_facultad.nombre,
            'resolucion_ministerial': 'Res. HCU 999/2021',
            'fecha_resolucion': '2021-05-05',
        }
        for campo, valor in cambios.items():
            with self.subTest(campo=campo):
                response = self.client.patch(f'/api/carreras/{self.carrera.pk}/', {campo: valor}, format='json')

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, response.data)

        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.nombre, 'Carrera 1')
        self.assertEqual(self.carrera.codigo, 'CA1')
        self.assertEqual(self.carrera.facultad, self.facultad)
        self.assertEqual(self.carrera.resolucion_ministerial, 'Res. HCU 1/2020')
        self.assertEqual(self.carrera.fecha_resolucion, date(2020, 1, 1))

    def test_director_tampoco_puede_cambiar_la_resolucion_si_hay_datos(self):
        director = self.crear_usuario('director_ident', 'director', is_staff=True)
        AsignacionCarrera.objects.create(user=director, carrera=self.carrera, rol='director')
        self.client.force_authenticate(director)

        response = self.client.patch(
            f'/api/carreras/{self.carrera.pk}/', {'resolucion_ministerial': 'Res. HCU 5/2024'}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('resolucion_ministerial', response.data)

    def test_campos_institucionales_siguen_editables_con_datos(self):
        response = self.client.patch(
            f'/api/carreras/{self.carrera.pk}/',
            {'mision': 'Nueva misión', 'vision': 'Nueva visión', 'perfil_profesional': 'Perfil', 'objetivo_carrera': 'Objetivo'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.mision, 'Nueva misión')

    def test_reenviar_los_mismos_valores_no_se_considera_cambio(self):
        # El formulario de edición manda todos los campos aunque no cambien.
        response = self.client.patch(
            f'/api/carreras/{self.carrera.pk}/',
            {
                'nombre': self.carrera.nombre, 'codigo': self.carrera.codigo.lower(),
                'facultad': self.facultad.nombre, 'resolucion_ministerial': self.carrera.resolucion_ministerial,
                'fecha_resolucion': '2020-01-01', 'mision': 'Cambio permitido',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_datos_no_academicos_no_bloquean_la_identidad(self):
        # Usuarios asignados, perfiles y POA no fijan la identidad (sí impiden borrar).
        carrera = self.crear_carrera()
        usuario = User.objects.create_user('jefe_no_academico', password='x')
        AsignacionCarrera.objects.create(user=usuario, carrera=carrera, rol='jefe_estudios')
        ProgramaPOA.objects.create(carrera=carrera, nombre='Programa')

        response = self.client.patch(f'/api/carreras/{carrera.pk}/', {'nombre': 'Nombre corregido'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        carrera.refresh_from_db()
        self.assertEqual(carrera.nombre, 'Nombre corregido')
        self.assertEqual(self.client.delete(f'/api/carreras/{carrera.pk}/').status_code, status.HTTP_409_CONFLICT)

    def test_dependencias_marca_cuales_son_academicas(self):
        response = self.client.get(f'/api/carreras/{self.carrera.pk}/dependencias/')

        self.assertTrue(response.data['tiene_datos_academicos'])
        self.assertEqual(response.data['detalle'], [
            {'clave': 'materias', 'etiqueta': 'Materias', 'cantidad': 1, 'academico': True},
        ])

    def test_carrera_sin_datos_permite_cambiar_identidad(self):
        vacia = self.crear_carrera()

        response = self.client.patch(f'/api/carreras/{vacia.pk}/', {'nombre': 'Nombre corregido'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        vacia.refresh_from_db()
        self.assertEqual(vacia.nombre, 'Nombre corregido')

    def test_responsable_no_es_editable(self):
        response = self.client.patch(
            f'/api/carreras/{self.carrera.pk}/', {'responsable': 'Alguien', 'mision': 'x'}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.responsable, '')


class CrearCarreraTests(CarreraBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)
        self.datos = {
            'nombre': 'Ingeniería de Sistemas',
            'codigo': 'sis',
            'facultad': self.facultad.nombre,
            'resolucion_ministerial': 'Res. HCU 10/2019',
            'fecha_resolucion': '2019-03-01',
        }

    def test_crear_sin_logo_falla(self):
        response = self.client.post('/api/carreras/', self.datos, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo_carrera_file', response.data)
        self.assertFalse(Carrera.objects.filter(nombre='Ingeniería de Sistemas').exists())

    def test_crear_con_logo_funciona_y_guarda_la_facultad_como_relacion(self):
        response = self.client.post('/api/carreras/', {**self.datos, 'logo_carrera_file': _logo()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        carrera = Carrera.objects.get(nombre='Ingeniería de Sistemas')
        self.assertEqual(carrera.codigo, 'SIS')
        self.assertEqual(carrera.facultad, self.facultad)
        self.assertEqual(response.data['facultad'], self.facultad.nombre)

    def test_crear_con_facultad_fuera_del_catalogo_falla(self):
        datos = {**self.datos, 'facultad': 'Facultad Inventada', 'logo_carrera_file': _logo()}

        response = self.client.post('/api/carreras/', datos, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('facultad', response.data)

    def test_save_valida_el_modelo(self):
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            Carrera.objects.create(
                nombre='Futura', codigo='FUT', facultad=self.facultad, fecha_resolucion=date(2999, 1, 1),
            )


class CarreraInactivaSoloLecturaTests(CarreraBaseTestCase):
    def setUp(self):
        super().setUp()
        self.carrera = self.crear_carrera()
        self.docente = self.crear_docente('DOC-1')
        DocenteCarrera.objects.create(
            docente=self.docente, carrera=self.carrera, categoria='catedratico', dedicacion='tiempo_completo',
        )
        self.fondo = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026)

        self.usuario = self.crear_usuario('docente_inactiva', 'docente', docente=self.docente)
        self.asignacion = AsignacionCarrera.objects.create(
            user=self.usuario, carrera=self.carrera, rol='docente', docente=self.docente,
        )
        self.client.force_authenticate(self.usuario)
        self.headers = {'HTTP_X_ACTIVE_ASSIGNMENT': str(self.asignacion.pk)}

        Carrera.objects.filter(pk=self.carrera.pk).update(activo=False)

    def _guardar_borrador(self, **headers):
        return self.client.patch(
            f'/api/fondos-tiempo/{self.fondo.pk}/guardar-informe-borrador/',
            {'seccion_academica': 'Avance'}, format='json', **headers,
        )

    def test_docente_no_puede_editar_en_carrera_inactiva_con_asignacion_activa(self):
        # Caso reportado: con X-Active-Assignment la carrera inactiva no se detectaba.
        response = self._guardar_borrador(**self.headers)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(response.data['detail']), CarreraInactivaSoloLecturaMixin.MENSAJE_CARRERA_INACTIVA)

    def test_docente_no_puede_editar_en_carrera_inactiva_sin_encabezado(self):
        response = self._guardar_borrador()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(response.data['detail']), CarreraInactivaSoloLecturaMixin.MENSAJE_CARRERA_INACTIVA)

    def test_docente_sigue_viendo_el_historico(self):
        response = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/', **self.headers)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.fondo.pk)

    def test_con_la_carrera_activa_el_bloqueo_no_aplica(self):
        Carrera.objects.filter(pk=self.carrera.pk).update(activo=True)

        response = self._guardar_borrador(**self.headers)

        self.assertNotEqual(
            str(response.data.get('detail', '')) if isinstance(response.data, dict) else '',
            CarreraInactivaSoloLecturaMixin.MENSAJE_CARRERA_INACTIVA,
        )

    def test_director_no_puede_crear_materias_en_carrera_inactiva(self):
        director = self.crear_usuario('director_inactiva', 'director', is_staff=True)
        asignacion = AsignacionCarrera.objects.create(user=director, carrera=self.carrera, rol='director')
        self.client.force_authenticate(director)

        response = self.client.post(
            '/api/materias/',
            {'nombre': 'Física', 'sigla': 'CIS-FIS-O11101', 'carrera': self.carrera.pk, 'semestre': 1, 'horas_teoricas': 2},
            format='json', HTTP_X_ACTIVE_ASSIGNMENT=str(asignacion.pk),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(response.data['detail']), CarreraInactivaSoloLecturaMixin.MENSAJE_CARRERA_INACTIVA)
        self.assertFalse(Materia.objects.filter(sigla='CIS-FIS-O11101').exists())

    def _assert_bloqueado(self, response):
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(response.data['detail']), CarreraInactivaSoloLecturaMixin.MENSAJE_CARRERA_INACTIVA)

    def test_superusuario_no_puede_editar_la_carrera_inactiva_sin_reactivarla(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(f'/api/carreras/{self.carrera.pk}/', {'mision': 'Actualizada'}, format='json')

        self._assert_bloqueado(response)
        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.mision, '')

    def test_superusuario_puede_reactivar_la_carrera(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(f'/api/carreras/{self.carrera.pk}/', {'activo': True}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.carrera.refresh_from_db()
        self.assertTrue(self.carrera.activo)

        # Ya activa, se puede editar el resto.
        response = self.client.patch(f'/api/carreras/{self.carrera.pk}/', {'mision': 'Reactivada'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_reactivar_con_otros_campos_se_rechaza(self):
        self.client.force_authenticate(self.superuser)
        peticiones = {
            'patch con misión': lambda: self.client.patch(
                f'/api/carreras/{self.carrera.pk}/', {'activo': True, 'mision': 'Reactivada'}, format='json',
            ),
            'put completo': lambda: self.client.put(
                f'/api/carreras/{self.carrera.pk}/',
                {
                    'activo': 'true', 'nombre': self.carrera.nombre, 'codigo': self.carrera.codigo,
                    'facultad': self.facultad.nombre, 'resolucion_ministerial': self.carrera.resolucion_ministerial,
                    'fecha_resolucion': '2020-01-01', 'logo_carrera_file': _logo(),
                },
                format='multipart',
            ),
            'otros campos sin activo': lambda: self.client.patch(
                f'/api/carreras/{self.carrera.pk}/', {'activo': True, 'nombre': 'Otro'}, format='json',
            ),
        }
        for caso, peticion in peticiones.items():
            with self.subTest(caso=caso):
                response = peticion()

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.data['code'], 'reactivar_primero')
                self.assertEqual(response.data['detail'], 'Primero reactive la carrera y luego edítela.')

        self.carrera.refresh_from_db()
        self.assertFalse(self.carrera.activo)
        self.assertEqual(self.carrera.mision, '')
        self.assertFalse(self.carrera.logo_carrera)

    def test_la_excepcion_de_reactivar_es_solo_del_superusuario(self):
        director = self.crear_usuario('director_reactiva', 'director', is_staff=True)
        AsignacionCarrera.objects.create(user=director, carrera=self.carrera, rol='director')
        self.client.force_authenticate(director)

        response = self.client.patch(f'/api/carreras/{self.carrera.pk}/', {'activo': True}, format='json')

        self._assert_bloqueado(response)
        self.carrera.refresh_from_db()
        self.assertFalse(self.carrera.activo)

    def test_superusuario_no_puede_eliminar_una_carrera_inactiva(self):
        vacia = self.crear_carrera(activo=False)
        self.client.force_authenticate(self.superuser)

        self._assert_bloqueado(self.client.delete(f'/api/carreras/{vacia.pk}/'))
        self.assertTrue(Carrera.objects.filter(pk=vacia.pk).exists())

    def test_superusuario_no_puede_escribir_en_materias_ni_fondos_de_carrera_inactiva(self):
        materia = Materia.objects.create(nombre='Álgebra', sigla='ALG-INA', carrera=self.carrera, semestre=1, horas_teoricas=2)
        self.client.force_authenticate(self.superuser)

        respuestas = {
            'crear materia': self.client.post(
                '/api/materias/',
                {'nombre': 'Física', 'sigla': 'CIS-FIS-O11102', 'carrera': self.carrera.pk, 'semestre': 1, 'horas_teoricas': 2},
                format='json',
            ),
            'editar materia': self.client.patch(f'/api/materias/{materia.pk}/', {'nombre': 'Otra'}, format='json'),
            'borrar materia': self.client.delete(f'/api/materias/{materia.pk}/'),
            'editar fondo': self.client.patch(f'/api/fondos-tiempo/{self.fondo.pk}/', {'gestion': 2027}, format='json'),
            'distribuir horas': self.client.patch(
                f'/api/fondos-tiempo/{self.fondo.pk}/distribuir-horas/', {'categorias': {}}, format='json',
            ),
            'crear fondo': self.client.post(
                '/api/fondos-tiempo/', {'docente': self.docente.pk, 'carrera': self.carrera.pk}, format='json',
            ),
        }
        for accion, response in respuestas.items():
            with self.subTest(accion=accion):
                self._assert_bloqueado(response)
        self.assertTrue(Materia.objects.filter(pk=materia.pk, nombre='Álgebra').exists())

    def test_superusuario_puede_ver_el_historico(self):
        self.client.force_authenticate(self.superuser)

        self.assertEqual(self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(f'/api/carreras/{self.carrera.pk}/').status_code, status.HTTP_200_OK)


class CarreraAdminPermisosTests(CarreraBaseTestCase):
    def test_solo_superusuario_agrega_y_elimina_en_el_admin(self):
        model_admin = admin.site._registry[Carrera]
        staff = User.objects.create_user('staff_admin', password='x', is_staff=True)
        request = RequestFactory().get('/django-admin/fondos/carrera/')

        request.user = staff
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request))

        request.user = self.superuser
        self.assertTrue(model_admin.has_add_permission(request))
        self.assertTrue(model_admin.has_delete_permission(request))


class CarreraActivaEnAsignacionesTests(CarreraBaseTestCase):
    """El frontend usa carrera_activa y ?activo=false para mostrar el modo solo lectura."""

    def test_superusuario_puede_listar_solo_las_carreras_inactivas(self):
        self.crear_carrera()
        inactiva = self.crear_carrera(activo=False)
        self.client.force_authenticate(self.superuser)

        response = self.client.get('/api/carreras/', {'activo': 'false'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([c['id'] for c in response.data['results']], [inactiva.pk])

    def test_usuario_actual_informa_si_la_carrera_de_cada_asignacion_esta_activa(self):
        activa = self.crear_carrera()
        inactiva = self.crear_carrera(activo=False)
        usuario = self.crear_usuario('docente_dos_carreras', 'docente')
        AsignacionCarrera.objects.create(user=usuario, carrera=activa, rol='docente')
        AsignacionCarrera.objects.create(user=usuario, carrera=inactiva, rol='jefe_estudios')
        self.client.force_authenticate(usuario)

        response = self.client.get('/api/usuario/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        estado = {item['carrera']: item['carrera_activa'] for item in response.data['asignaciones']}
        self.assertEqual(estado, {activa.pk: True, inactiva.pk: False})
