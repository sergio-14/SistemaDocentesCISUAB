"""Ajustes posteriores a la auditoría de Usuarios.

1. Vacaciones del fondo por antigüedad (15/20/30 días) proporcionales a la jornada.
2. El C.I. de Docentes se guarda y se edita mientras no haya historial.
3. El Director crea fichas de docente en su carrera.
4. El Director cambia rol y carrera de usuarios sin datos, dentro de su carrera.
5. Director y Jefe de Estudios únicos por carrera según las asignaciones activas.
6. El docente ve solo las materias de sus carreras.
"""
from datetime import date

from django.contrib.auth.models import User
from rest_framework import status

from fondos.models import (
    AsignacionCarrera, CalendarioAcademico, DatosLaborales, Docente, FondoTiempo, Materia, PerfilUsuario,
    calcular_horas_fondo,
)
from .tests_usuarios_auditoria import UsuariosBaseTestCase, con_resolucion_jefe


def calendario_con_feriados(carrera, dias=3):
    # Calendario 2026 de la carrera con sus días de feriado: el fondo sin calendario
    # propio toma los de un calendario de su carrera y gestión.
    return CalendarioAcademico.objects.create(
        carrera=carrera, gestion=2026, periodo='anual', dias_feriados_gestion=dias,
        fecha_inicio=date(2026, 2, 2), fecha_fin=date(2026, 12, 11),
        fecha_inicio_presentacion_proyectos=date(2026, 2, 2),
        fecha_limite_presentacion_proyectos=date(2026, 3, 31),
    )


# Misma tabla que frontend/tests/horasFondo.test.js: la vista previa debe dar lo mismo.
# (horas_semana, dias_vacacion, dias_feriados_gestion) -> (contrato, vacacion, feriados, efectivas)
CASOS_HORAS_FONDO = [
    ((40, 15, 16), (2080, 120, 128, 1832)),
    ((40, 30, 16), (2080, 240, 128, 1712)),
    ((20, 20, 16), (1040, 80, 64, 896)),
    ((10, 20, 16), (520, 40, 32, 448)),
    ((6, 15, 16), (312, 18, 19, 275)),
    ((4, 15, 16), (208, 12, 12, 184)),
    ((12, 30, 11), (624, 72, 26, 526)),
    ((12, 30, 0), (624, 72, 0, 552)),
]


class VacacionesEnElFondoTests(UsuariosBaseTestCase):
    def test_calculo_de_horas_del_fondo(self):
        for (horas_semana, dias, feriados), esperado in CASOS_HORAS_FONDO:
            with self.subTest(horas_semana=horas_semana, dias=dias, feriados=feriados):
                resultado = calcular_horas_fondo(horas_semana, dias, feriados)
                self.assertEqual(
                    (resultado['contrato_horas'], resultado['horas_vacacion'],
                     resultado['horas_feriados'], resultado['horas_efectivas']),
                    esperado,
                )

    def _fondo_con_antiguedad(self, username, anios, dedicacion='tiempo_completo'):
        usuario = self.crear_usuario(username, 'docente', carrera=self.carrera)
        docente = self.crear_docente(f'CI-{username}', usuario=usuario, dedicacion='horario_40')
        docente.vinculos_carrera.update(dedicacion=dedicacion)
        # Sin calendario, la antigüedad se mide al 1 de enero de la gestión: años exactos.
        DatosLaborales.objects.filter(pk=docente.datos_laborales_id).update(fecha_ingreso=date(2026 - anios, 1, 1))
        return FondoTiempo.objects.create(docente=Docente.objects.get(pk=docente.pk), carrera=self.carrera, gestion=2026)

    def test_el_fondo_descuenta_vacaciones_segun_antiguedad(self):
        calendario_con_feriados(self.carrera, dias=3)
        horas_feriados = 3 * 8
        # Tiempo completo: 8 h/día x días por antigüedad (antes: 240 h fijas).
        casos = {4: 15 * 8, 7: 20 * 8, 12: 30 * 8}
        for anios, horas_vacacion in casos.items():
            with self.subTest(antiguedad=anios):
                fondo = self._fondo_con_antiguedad(f'tc_{anios}', anios)
                self.assertEqual(fondo.horas_vacacion, horas_vacacion)
                self.assertEqual(fondo.horas_efectivas, 2080 - horas_vacacion - horas_feriados)

    def test_proporcional_para_medio_tiempo_y_horario(self):
        medio = self._fondo_con_antiguedad('mt', 7, dedicacion='medio_tiempo')  # 4 h/día
        horario = self._fondo_con_antiguedad('th', 12, dedicacion='horario_40')  # 10 h/sem = 2 h/día

        self.assertEqual(medio.horas_vacacion, 20 * 4)
        self.assertEqual(horario.horas_vacacion, 30 * 2)


class CIEnDocentesTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)
        self.usuario = self.crear_usuario('docente_ci', 'docente', carrera=self.carrera, ci='1000')
        self.docente = self.crear_docente('1000', usuario=self.usuario)
        PerfilUsuario.objects.filter(user=self.usuario).update(docente=self.docente)

    def test_el_ci_se_guarda_sin_historial(self):
        response = self.client.patch(f'/api/docentes/{self.docente.pk}/', {'ci': '2000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.docente.refresh_from_db()
        self.assertEqual(self.docente.datos_laborales.ci, '2000')
        self.assertEqual(PerfilUsuario.objects.get(user=self.usuario).ci, '2000')
        self.assertFalse(response.data['tiene_historial'])

    def test_con_historial_el_ci_no_se_puede_cambiar(self):
        FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026)

        response = self.client.patch(f'/api/docentes/{self.docente.pk}/', {'ci': '2000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ci', response.data)
        self.docente.refresh_from_db()
        self.assertEqual(self.docente.datos_laborales.ci, '1000')

    def test_ci_de_otra_persona_se_rechaza(self):
        self.crear_docente('3000')

        response = self.client.patch(f'/api/docentes/{self.docente.pk}/', {'ci': '3000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(response.data['ci'][0]), 'Este C.I. ya está registrado.')

    def test_el_ci_se_guarda_al_crear(self):
        usuario = self.crear_usuario('nuevo_docente', 'docente', carrera=self.carrera)

        response = self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': self.carrera.pk, 'categoria': 'catedratico',
            'dedicacion': 'horario_40', 'condicion': 'titular', 'ci': '4000', 'fecha_ingreso': '2015-01-01',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Docente.objects.get(pk=response.data['id']).datos_laborales.ci, '4000')


class DirectorCreaDocentesTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_doc', 'director', carrera=self.carrera, is_staff=True)
        self.client.force_authenticate(self.director)

    def _crear_ficha(self, usuario, carrera):
        return self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': carrera.pk, 'categoria': 'catedratico',
            'dedicacion': 'horario_40', 'condicion': 'titular', 'ci': f'CI-{usuario.username}', 'fecha_ingreso': '2015-01-01',
        }, format='json')

    def test_director_crea_la_ficha_en_su_carrera(self):
        usuario = self.crear_usuario('docente_propio', 'docente', carrera=self.carrera)

        response = self._crear_ficha(usuario, self.carrera)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(Docente.objects.filter(user=usuario).exists())

    def test_director_no_crea_fichas_en_otra_carrera(self):
        usuario = self.crear_usuario('docente_ajeno', 'docente', carrera=self.otra_carrera)

        response = self._crear_ficha(usuario, self.otra_carrera)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Docente.objects.filter(user=usuario).exists())

    def test_el_usuario_debe_ser_de_su_carrera(self):
        usuario = self.crear_usuario('docente_de_otra', 'docente', carrera=self.otra_carrera)

        response = self._crear_ficha(usuario, self.carrera)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_jefe_de_estudios_no_crea_fichas(self):
        jefe = self.crear_usuario('jefe_doc', 'jefe_estudios', carrera=self.carrera, is_staff=True)
        usuario = self.crear_usuario('docente_jefe', 'docente', carrera=self.carrera)
        self.client.force_authenticate(jefe)

        self.assertEqual(self._crear_ficha(usuario, self.carrera).status_code, status.HTTP_403_FORBIDDEN)


class DirectorCambiaRolTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_rol', 'director', carrera=self.carrera, is_staff=True, ci='800')
        self.usuario = self.crear_usuario('cambia_rol', 'docente', carrera=self.carrera, ci='801')
        self.client.force_authenticate(self.director)

    def test_director_cambia_el_rol_de_un_usuario_sin_datos(self):
        response = self.client.patch(
            f'/api/usuarios/{self.usuario.pk}/',
            con_resolucion_jefe({'rol': 'jefe_estudios', 'carrera': self.carrera.pk, 'asignaciones': []}),
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(AsignacionCarrera.objects.filter(
            user=self.usuario, rol='jefe_estudios', carrera=self.carrera, activo=True,
        ).exists())
        self.assertFalse(AsignacionCarrera.objects.filter(user=self.usuario, rol='docente', activo=True).exists())

    def test_director_no_lo_lleva_a_otra_carrera(self):
        response = self.client.patch(
            f'/api/usuarios/{self.usuario.pk}/',
            {'rol': 'docente', 'carrera': self.otra_carrera.pk, 'asignaciones': []},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AsignacionCarrera.objects.filter(user=self.usuario, carrera=self.otra_carrera).exists())

    def test_director_no_cambia_el_rol_de_un_usuario_con_datos(self):
        docente = self.crear_docente('801', usuario=self.usuario)
        PerfilUsuario.objects.filter(user=self.usuario).update(docente=docente)
        FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

        response = self.client.patch(
            f'/api/usuarios/{self.usuario.pk}/',
            {'rol': 'jefe_estudios', 'carrera': self.carrera.pk, 'asignaciones': []},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AsignacionCarrera.objects.filter(user=self.usuario, rol='jefe_estudios').exists())


class UnicidadDeCargosTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def _crear_director(self, username, ci):
        return self.client.post('/api/usuarios/', self.datos_usuario(username, 'director', self.carrera, ci), format='json')

    def test_director_como_asignacion_secundaria_ocupa_el_cargo(self):
        # Su perfil dice 'docente': antes la validación (por perfil) no lo veía.
        titular = self.crear_usuario('titular_secundario', 'docente', carrera=self.carrera)
        AsignacionCarrera.objects.create(user=titular, carrera=self.carrera, rol='director')

        response = self._crear_director('director_nuevo', '601')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='director_nuevo').exists())

    def test_una_asignacion_inactiva_no_ocupa_el_cargo(self):
        anterior = self.crear_usuario('director_anterior', 'docente', carrera=self.carrera)
        AsignacionCarrera.objects.create(user=anterior, carrera=self.carrera, rol='director', activo=False)

        response = self._crear_director('director_libre', '602')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_jefe_de_estudios_tambien_es_unico(self):
        self.crear_usuario('jefe_titular', 'docente', carrera=self.carrera)
        AsignacionCarrera.objects.create(
            user=User.objects.get(username='jefe_titular'), carrera=self.carrera, rol='jefe_estudios',
        )

        response = self.client.post(
            '/api/usuarios/', self.datos_usuario('jefe_nuevo', 'jefe_estudios', self.carrera, '603'), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MateriasDelDocenteTests(UsuariosBaseTestCase):
    def test_el_docente_ve_solo_las_materias_de_sus_carreras(self):
        docente = self.crear_usuario('docente_materias', 'docente', carrera=self.carrera)
        Materia.objects.create(nombre='Propia', sigla='PRO-DOC', carrera=self.carrera, semestre=1, horas_teoricas=2)
        Materia.objects.create(nombre='Ajena', sigla='AJE-DOC', carrera=self.otra_carrera, semestre=1, horas_teoricas=2)
        self.client.force_authenticate(docente)

        response = self.client.get('/api/materias/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resultados = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual([m['nombre'] for m in resultados], ['Propia'])

    def test_sin_carrera_no_ve_materias(self):
        sin_carrera = self.crear_usuario('docente_sin_carrera', 'docente')
        Materia.objects.create(nombre='Alguna', sigla='ALG-SIN', carrera=self.carrera, semestre=1, horas_teoricas=2)
        self.client.force_authenticate(sin_carrera)

        response = self.client.get('/api/materias/')

        resultados = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(resultados, [])
