"""Tests de la auditoría del módulo de Usuarios.

- La fecha de ingreso del formulario de Docentes se guarda y las vacaciones
  salen de la antigüedad.
- Las dedicaciones "horario" son horas mensuales: se dividen entre 4.
- Editar y eliminar usuarios sigue la misma regla que Carrera.
- Un C.I. repetido es un error; solo el superusuario agrega asignaciones.
- Desactivar un usuario libera todos sus cargos.
- El backend exige carrera en todos los roles y gestión + docencia en la misma carrera.
- El superusuario no tiene rol de carrera y el Instituto (iiisyp) solo puede ver.
"""
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from poa_document.models import HistorialDocumentoPOA, DocumentoPOA

from fondos.models import (
    SEMANAS_POR_MES, AsignacionCarrera, Carrera, DatosLaborales, Docente, DocenteCarrera,
    FacultadCatalogo, FondoTiempo, Materia, PerfilUsuario,
)
from fondos.solo_lectura import MENSAJE_ROL_SOLO_LECTURA


class UsuariosBaseTestCase(APITestCase):
    def setUp(self):
        self.facultad, _ = FacultadCatalogo.objects.get_or_create(nombre='Facultad de Ingeniería y Tecnología')
        self.carrera = Carrera.objects.create(nombre='Sistemas', codigo='SIS', facultad=self.facultad)
        self.otra_carrera = Carrera.objects.create(nombre='Civil', codigo='CIV', facultad=self.facultad)
        self.superuser = User.objects.create_superuser('super_usuarios', password='x')

    def crear_usuario(self, username, rol, carrera=None, is_staff=False, **perfil):
        usuario = User.objects.create_user(username, password='x', is_staff=is_staff)
        PerfilUsuario.objects.filter(user=usuario).update(rol=rol, carrera=carrera, **perfil)
        if carrera:
            AsignacionCarrera.objects.create(user=usuario, carrera=carrera, rol=rol, docente=perfil.get('docente'))
        # Recargar: el perfil que crea la señal queda en caché con el rol inicial.
        return User.objects.get(pk=usuario.pk)

    def crear_docente(self, ci, usuario=None, dedicacion='horario_40', carrera=None):
        docente = Docente.objects.create(
            nombres='Ana', apellido_paterno='Rojas', user=usuario,
            datos_laborales=DatosLaborales.objects.create(ci=ci),
        )
        DocenteCarrera.objects.create(
            docente=docente, carrera=carrera or self.carrera, categoria='catedratico', dedicacion=dedicacion,
        )
        return docente

    def datos_usuario(self, username, rol, carrera, ci, **extra):
        return {
            'username': username, 'email': f'{username}@uabjb.edu.bo',
            'password': f'{username}UABJB', 'password_confirm': f'{username}UABJB',
            'first_name': 'Nombre', 'last_name': 'Apellido',
            'rol': rol, 'carrera': carrera.pk if carrera else None, 'ci': ci, **extra,
        }


class FechaIngresoYVacacionesTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def _crear_docente_por_api(self, username, fecha_ingreso):
        usuario = self.crear_usuario(username, 'docente', carrera=self.carrera, ci=f'CI-{username}')
        return self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': self.carrera.pk, 'categoria': 'catedratico',
            'dedicacion': 'horario_40', 'fecha_ingreso': fecha_ingreso.isoformat(),
        }, format='json')

    def test_fecha_de_ingreso_se_guarda_y_vacaciones_segun_antiguedad(self):
        hoy = date.today()
        casos = {4: 15, 7: 20, 12: 30}
        for anios, dias in casos.items():
            with self.subTest(antiguedad=anios):
                # 1 de enero: a partir de hoy ya se cumplieron los años completos.
                fecha = date(hoy.year - anios, 1, 1)

                response = self._crear_docente_por_api(f'docente_{anios}', fecha)

                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
                docente = Docente.objects.get(pk=response.data['id'])
                self.assertEqual(docente.datos_laborales.fecha_ingreso, fecha)
                self.assertEqual(docente.dias_vacacion, dias)
                self.assertEqual(docente.datos_laborales.dias_vacacion, dias)
                self.assertEqual(response.data['dias_vacacion'], dias)

    def test_crear_docente_para_un_usuario_sin_ci_no_falla(self):
        # Antes el C.I. temporal (TEMP_<timestamp>) superaba los 20 caracteres: error 500.
        usuario = self.crear_usuario('sin_ci', 'docente', carrera=self.carrera)

        response = self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': self.carrera.pk, 'categoria': 'catedratico', 'dedicacion': 'horario_40',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(Docente.objects.get(pk=response.data['id']).datos_laborales.ci.startswith('TEMP_'))

    def test_editar_la_fecha_recalcula_las_vacaciones(self):
        hoy = date.today()
        response = self._crear_docente_por_api('docente_edita', date(hoy.year - 4, 1, 1))
        docente_id = response.data['id']

        nueva = date(hoy.year - 12, 1, 1)
        response = self.client.patch(f'/api/docentes/{docente_id}/', {'fecha_ingreso': nueva.isoformat()}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        docente = Docente.objects.get(pk=docente_id)
        self.assertEqual(docente.datos_laborales.fecha_ingreso, nueva)
        self.assertEqual(docente.dias_vacacion, 30)


class HorasMensualesTests(UsuariosBaseTestCase):
    def test_las_dedicaciones_horario_son_mensuales(self):
        self.assertEqual(SEMANAS_POR_MES, Decimal('4'))
        esperado = {
            'horario_16': 4, 'horario_24': 6, 'horario_40': 10, 'horario_48': 12,
            'tiempo_completo': 40, 'medio_tiempo': 20,
        }
        for dedicacion, horas in esperado.items():
            with self.subTest(dedicacion=dedicacion):
                vinculo = DocenteCarrera(dedicacion=dedicacion)
                self.assertEqual(vinculo.horas_semanales_maximas, Decimal(horas))

    def test_horario_48_se_puede_guardar(self):
        docente = self.crear_docente('H48', dedicacion='horario_48')

        self.assertEqual(docente.vinculos_carrera.get().horas_semanales_maximas, Decimal('12'))

    def test_el_tope_de_40_suma_las_horas_convertidas(self):
        docente = self.crear_docente('TOPE', dedicacion='horario_48')  # 12 h/sem

        # 12 + 20 = 32 h/sem: entra en el tope.
        DocenteCarrera.objects.create(
            docente=docente, carrera=self.otra_carrera, categoria='adjunto', dedicacion='medio_tiempo',
        )
        # 32 + 40 = 72 h/sem: supera el tope.
        tercera = Carrera.objects.create(nombre='Derecho', codigo='DER', facultad=self.facultad)
        with self.assertRaises(ValidationError):
            DocenteCarrera.objects.create(
                docente=docente, carrera=tercera, categoria='adjunto', dedicacion='tiempo_completo',
            )

    def test_el_fondo_usa_las_horas_semanales_convertidas(self):
        usuario = self.crear_usuario('docente_fondo', 'docente', carrera=self.carrera)
        docente = self.crear_docente('FONDO', usuario=usuario, dedicacion='horario_40')

        fondo = FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

        self.assertEqual(fondo.horas_semana, Decimal('10'))
        self.assertEqual(fondo.contrato_horas, 10 * 52)


class EliminarYEditarUsuarioTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_eliminar_usuario_sin_datos_no_deja_huerfanos(self):
        usuario = self.crear_usuario('limpio', 'docente', carrera=self.carrera)
        docente = self.crear_docente('LIMPIO', usuario=usuario)
        PerfilUsuario.objects.filter(user=usuario).update(docente=docente)
        AsignacionCarrera.objects.filter(user=usuario).update(docente=docente)
        datos_laborales_id = docente.datos_laborales_id

        response = self.client.delete(f'/api/usuarios/{usuario.pk}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=usuario.pk).exists())
        self.assertFalse(AsignacionCarrera.objects.filter(user__isnull=True).exists())
        self.assertFalse(PerfilUsuario.objects.filter(user__isnull=True).exists())
        self.assertFalse(Docente.objects.filter(pk=docente.pk).exists())
        self.assertFalse(DocenteCarrera.objects.filter(docente_id=docente.pk).exists())
        self.assertFalse(DatosLaborales.objects.filter(pk=datos_laborales_id).exists())

    def test_eliminar_usuario_con_datos_falla(self):
        usuario = self.crear_usuario('con_fondo', 'docente', carrera=self.carrera)
        docente = self.crear_docente('CONFONDO', usuario=usuario)
        PerfilUsuario.objects.filter(user=usuario).update(docente=docente)
        FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

        response = self.client.delete(f'/api/usuarios/{usuario.pk}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'dependency_exists')
        self.assertTrue(User.objects.filter(pk=usuario.pk).exists())
        self.assertTrue(AsignacionCarrera.objects.filter(user=usuario).exists())

    def test_eliminar_usuario_con_historial_poa_falla(self):
        usuario = self.crear_usuario('con_poa', 'docente', carrera=self.carrera)
        documento = DocumentoPOA.objects.create(
            gestion=2026, unidad_solicitante=self.carrera, programa='Programa',
            objetivo_gestion_institucional='Objetivo', fecha_elaboracion=date(2026, 1, 1),
        )
        HistorialDocumentoPOA.objects.create(documento=documento, usuario=usuario, tipo_evento='creacion', descripcion='x')

        response = self.client.delete(f'/api/usuarios/{usuario.pk}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(User.objects.filter(pk=usuario.pk).exists())

    def test_con_datos_la_identidad_queda_bloqueada(self):
        usuario = self.crear_usuario('identidad', 'docente', carrera=self.carrera, ci='111')
        docente = self.crear_docente('111', usuario=usuario)
        PerfilUsuario.objects.filter(user=usuario).update(docente=docente)
        FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

        for campo, valor in {'username': 'otro_nombre', 'first_name': 'Otro', 'ci': '222'}.items():
            with self.subTest(campo=campo):
                response = self.client.patch(f'/api/usuarios/{usuario.pk}/', {campo: valor}, format='json')

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(campo, response.data)
        self.assertEqual(User.objects.get(pk=usuario.pk).username, 'identidad')

    def test_sin_datos_se_puede_cambiar_el_usuario(self):
        usuario = self.crear_usuario('sin_datos', 'jefe_estudios', carrera=self.carrera, ci='333', is_staff=True)

        response = self.client.patch(
            f'/api/usuarios/{usuario.pk}/', {'username': 'nuevo_nombre', 'first_name': 'Nuevo'}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(User.objects.get(pk=usuario.pk).username, 'nuevo_nombre')

    def test_dependencias_informa_si_tiene_datos(self):
        usuario = self.crear_usuario('deps', 'jefe_estudios', carrera=self.carrera, is_staff=True)

        response = self.client.get(f'/api/usuarios/{usuario.pk}/dependencias/')

        self.assertEqual(response.data, {'detalle': [], 'tiene_datos': False, 'can_delete': True})


class CIExistenteYAsignacionesTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director', 'director', carrera=self.carrera, is_staff=True, ci='900')
        self.existente = self.crear_usuario('existente', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='555')
        self.client.force_authenticate(self.director)

    def test_director_con_ci_repetido_recibe_error_y_no_modifica_al_usuario(self):
        asignaciones_antes = list(AsignacionCarrera.objects.filter(user=self.existente).values_list('rol', 'carrera_id', 'activo'))

        response = self.client.post('/api/usuarios/', self.datos_usuario('nuevo', 'docente', self.carrera, '555'), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(response.data['ci'][0]), 'Este C.I. ya está registrado.')
        self.assertFalse(User.objects.filter(username='nuevo').exists())
        self.assertEqual(
            list(AsignacionCarrera.objects.filter(user=self.existente).values_list('rol', 'carrera_id', 'activo')),
            asignaciones_antes,
        )

    def test_director_no_puede_agregar_asignaciones_a_un_usuario_con_datos(self):
        # Sin datos sí puede (ver tests_usuarios_ajustes); con datos, solo el superusuario.
        documento = DocumentoPOA.objects.create(
            gestion=2026, unidad_solicitante=self.carrera, programa='Programa',
            objetivo_gestion_institucional='Objetivo', fecha_elaboracion=date(2026, 1, 1),
        )
        HistorialDocumentoPOA.objects.create(documento=documento, usuario=self.existente, tipo_evento='creacion', descripcion='x')

        response = self.client.patch(
            f'/api/usuarios/{self.existente.pk}/',
            {'asignaciones': [{'rol': 'docente', 'carrera': self.carrera.pk}]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('asignaciones', response.data)
        self.assertFalse(AsignacionCarrera.objects.filter(user=self.existente, rol='docente').exists())

    def test_superusuario_si_puede_agregar_asignaciones(self):
        self.client.force_authenticate(self.superuser)
        docente = self.crear_docente('555')

        response = self.client.patch(
            f'/api/usuarios/{self.existente.pk}/',
            {'asignaciones': [{'rol': 'docente', 'carrera': self.carrera.pk, 'docente': docente.pk}], 'docente': docente.pk},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(AsignacionCarrera.objects.filter(user=self.existente, rol='docente', activo=True).exists())


class DesactivarUsuarioTests(UsuariosBaseTestCase):
    def test_desactivar_un_director_libera_el_cargo(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.post(
            '/api/usuarios/', self.datos_usuario('director_a', 'director', self.carrera, '701'), format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        director_a = User.objects.get(username='director_a')

        response = self.client.post(f'/api/usuarios/{director_a.pk}/toggle_activo/')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(AsignacionCarrera.objects.filter(user=director_a, activo=True).exists())

        response = self.client.post(
            '/api/usuarios/', self.datos_usuario('director_b', 'director', self.carrera, '702'), format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(AsignacionCarrera.objects.filter(
            user__username='director_b', carrera=self.carrera, rol='director', activo=True,
        ).exists())


class ValidacionesBackendTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_crear_usuario_sin_carrera_falla(self):
        for rol in ['docente', 'iiisyp', 'jefe_estudios', 'director']:
            with self.subTest(rol=rol):
                response = self.client.post(
                    '/api/usuarios/', self.datos_usuario(f'sin_carrera_{rol}', rol, None, f'SC-{rol}'), format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('carrera', response.data)
                self.assertFalse(User.objects.filter(username=f'sin_carrera_{rol}').exists())

    def test_gestion_y_docencia_en_distinta_carrera_falla(self):
        datos = self.datos_usuario(
            'doble_rol', 'jefe_estudios', self.carrera, 'DR-1',
            asignaciones=[{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('asignaciones', response.data)
        self.assertFalse(User.objects.filter(username='doble_rol').exists())


class SuperusuarioEInstitutoTests(UsuariosBaseTestCase):
    def test_superusuario_no_tiene_rol_iiisyp(self):
        perfil = PerfilUsuario.objects.get(user=self.superuser)
        self.assertEqual(perfil.rol, '')
        self.assertIsNone(perfil.carrera)

        self.client.force_authenticate(self.superuser)
        response = self.client.get('/api/usuario/')
        self.assertIsNone(response.data['perfil']['rol'])

    def test_permisos_del_superusuario_no_dependen_del_rol(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.post(
            '/api/materias/',
            {'nombre': 'Física', 'sigla': 'CIS-FIS-O11101', 'carrera': self.carrera.pk, 'semestre': 1, 'horas_teoricas': 2},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_iiisyp_no_puede_crear_editar_ni_eliminar(self):
        instituto = self.crear_usuario('instituto', 'iiisyp', carrera=self.carrera)
        materia = Materia.objects.create(nombre='Álgebra', sigla='ALG-IIS', carrera=self.carrera, semestre=1, horas_teoricas=2)
        otro = self.crear_usuario('otro_docente', 'docente', carrera=self.carrera)
        self.client.force_authenticate(instituto)

        respuestas = {
            'crear materia': self.client.post(
                '/api/materias/',
                {'nombre': 'Física', 'sigla': 'CIS-FIS-O11102', 'carrera': self.carrera.pk, 'semestre': 1, 'horas_teoricas': 2},
                format='json',
            ),
            'editar materia': self.client.patch(f'/api/materias/{materia.pk}/', {'nombre': 'Otra'}, format='json'),
            'eliminar materia': self.client.delete(f'/api/materias/{materia.pk}/'),
            'editar usuario': self.client.patch(f'/api/usuarios/{otro.pk}/', {'first_name': 'X'}, format='json'),
            'crear fondo': self.client.post('/api/fondos-tiempo/', {'carrera': self.carrera.pk}, format='json'),
        }
        for accion, response in respuestas.items():
            with self.subTest(accion=accion):
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        # Las rutas que no tienen otra regla antes responden con el mensaje de solo lectura.
        self.assertEqual(str(respuestas['crear fondo'].data['detail']), MENSAJE_ROL_SOLO_LECTURA)
        self.assertTrue(Materia.objects.filter(pk=materia.pk, nombre='Álgebra').exists())

    def test_iiisyp_ve_solo_lo_de_su_carrera(self):
        instituto = self.crear_usuario('instituto_lee', 'iiisyp', carrera=self.carrera)
        Materia.objects.create(nombre='Propia', sigla='PRO-PIA', carrera=self.carrera, semestre=1, horas_teoricas=2)
        Materia.objects.create(nombre='Ajena', sigla='AJE-NAA', carrera=self.otra_carrera, semestre=1, horas_teoricas=2)
        self.client.force_authenticate(instituto)

        response = self.client.get('/api/materias/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resultados = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual([m['nombre'] for m in resultados], ['Propia'])
