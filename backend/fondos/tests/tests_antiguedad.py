"""Antigüedad y vacaciones.

1. La antigüedad son años COMPLETOS cumplidos al inicio de la gestión del fondo.
2. Con menos de 1 año de antigüedad no hay días de vacación.
3. La unicidad de Director, Jefe de Estudios e Instituto (IIISyP) ya no está en
   PerfilUsuario: se valida con las asignaciones activas.
Además: la regla de combinaciones (un usuario pertenece a una sola carrera:
sus roles, cargo y docencia, son todos de esa carrera).
"""
from datetime import date

from django.contrib.auth.models import User
from rest_framework import status

from fondos.models import AsignacionCarrera, CalendarioAcademico, DatosLaborales, Docente, FondoTiempo, PerfilUsuario
from .tests_usuarios_ajustes import cargar_feriados_2026
from .tests_usuarios_auditoria import UsuariosBaseTestCase, con_resolucion_jefe


class AniosCompletosTests(UsuariosBaseTestCase):
    def test_la_antiguedad_mira_dia_y_mes(self):
        datos = DatosLaborales(ci='AC-1', fecha_ingreso=date(2014, 3, 10))

        self.assertEqual(datos.calcular_antiguedad(date(2026, 3, 9)), 11)   # un día antes del aniversario
        self.assertEqual(datos.calcular_antiguedad(date(2026, 3, 10)), 12)  # el día del aniversario
        self.assertEqual(datos.calcular_antiguedad(2026), 11)               # gestión: al 1 de enero

    def test_dias_de_vacacion_en_los_limites(self):
        ingreso = date(2016, 3, 10)
        datos = DatosLaborales(ci='AC-2', fecha_ingreso=ingreso)
        casos = {
            date(2016, 12, 31): 0,   # menos de 1 año
            date(2017, 3, 10): 15,   # 1 año justo
            date(2021, 3, 9): 15,    # 4 años y 364 días
            date(2021, 3, 10): 20,   # 5 años
            date(2026, 3, 9): 20,    # 9 años y 364 días
            date(2026, 3, 10): 30,   # 10 años
        }
        for referencia, dias in casos.items():
            with self.subTest(referencia=referencia):
                self.assertEqual(datos.calcular_dias_vacacion(referencia), dias)

    def _fondo(self, username, fecha_ingreso, fecha_inicio_gestion=None, periodo='anual'):
        usuario = self.crear_usuario(username, 'docente', carrera=self.carrera)
        docente = self.crear_docente(f'CI-{username}', usuario=usuario)
        docente.vinculos_carrera.update(dedicacion='tiempo_completo')  # 8 h/día
        DatosLaborales.objects.filter(pk=docente.datos_laborales_id).update(fecha_ingreso=fecha_ingreso)
        calendario = None
        if fecha_inicio_gestion:
            calendario = CalendarioAcademico.objects.create(
                carrera=self.carrera, gestion=2026, periodo=periodo,
                fecha_inicio=fecha_inicio_gestion, fecha_fin=date(2026, 12, 15),
                fecha_inicio_presentacion_proyectos=fecha_inicio_gestion,
                fecha_limite_presentacion_proyectos=date(2026, 3, 31),
            )
        return FondoTiempo.objects.create(
            docente=Docente.objects.get(pk=docente.pk), carrera=self.carrera, gestion=2026,
            calendario_academico=calendario,
        )

    def test_el_fondo_mide_la_antiguedad_al_inicio_de_su_gestion(self):
        # Ingresó el 1-mar-2016. Si la gestión empieza el 1-feb-2026 tiene 9 años
        # completos (20 días); si empieza el 15-mar-2026 ya tiene 10 (30 días).
        antes = self._fondo('antes_aniv', date(2016, 3, 1), date(2026, 2, 1))
        despues = self._fondo('despues_aniv', date(2016, 3, 1), date(2026, 3, 15), periodo='1')

        self.assertEqual(antes.fecha_referencia_antiguedad(), date(2026, 2, 1))
        self.assertEqual(antes.horas_vacacion, 20 * 8)
        self.assertEqual(despues.horas_vacacion, 30 * 8)

    def test_sin_calendario_se_usa_el_1_de_enero_de_la_gestion(self):
        fondo = self._fondo('sin_calendario', date(2016, 3, 1))

        self.assertEqual(fondo.fecha_referencia_antiguedad(), date(2026, 1, 1))
        self.assertEqual(fondo.horas_vacacion, 20 * 8)  # 9 años completos al 1-ene-2026

    def test_menos_de_un_anio_no_descuenta_vacaciones(self):
        cargar_feriados_2026()   # 3 días hábiles
        fondo = self._fondo('nuevo_ingreso', date(2025, 6, 1), date(2026, 2, 1))

        self.assertEqual(fondo.horas_vacacion, 0)
        self.assertEqual(fondo.horas_efectivas, 2080 - 3 * 8)


class UnicidadFueraDelPerfilTests(UsuariosBaseTestCase):
    def test_las_restricciones_del_perfil_ya_no_existen(self):
        nombres = {constraint.name for constraint in PerfilUsuario._meta.constraints}

        self.assertNotIn('unico_director_por_carrera', nombres)
        self.assertNotIn('unico_jefe_por_carrera', nombres)
        self.assertNotIn('unico_iiisyp_por_carrera', nombres)

    def test_dos_perfiles_director_de_la_misma_carrera_no_rompen_la_base(self):
        # Datos antiguos incoherentes ya no dan IntegrityError: manda la asignación.
        for username in ('perfil_director_1', 'perfil_director_2'):
            usuario = User.objects.create_user(username, password='x')
            PerfilUsuario.objects.filter(user=usuario).update(rol='director', carrera=self.carrera, activo=True)

        self.assertEqual(PerfilUsuario.objects.filter(rol='director', carrera=self.carrera, activo=True).count(), 2)

    def test_la_unicidad_sigue_validandose_con_las_asignaciones(self):
        self.client.force_authenticate(self.superuser)
        primero = self.client.post(
            '/api/usuarios/', self.datos_usuario('director_uno', 'director', self.carrera, 'U-1'), format='json',
        )
        segundo = self.client.post(
            '/api/usuarios/', self.datos_usuario('director_dos', 'director', self.carrera, 'U-2'), format='json',
        )

        self.assertEqual(primero.status_code, status.HTTP_201_CREATED, primero.data)
        self.assertEqual(segundo.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='director_dos').exists())


class UnicidadDelInstitutoTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def _crear_instituto(self, username, carrera, ci):
        return self.client.post('/api/usuarios/', self.datos_usuario(username, 'iiisyp', carrera, ci), format='json')

    def test_un_instituto_por_carrera(self):
        primero = self._crear_instituto('instituto_uno', self.carrera, 'I-1')
        segundo = self._crear_instituto('instituto_dos', self.carrera, 'I-2')

        self.assertEqual(primero.status_code, status.HTTP_201_CREATED, primero.data)
        self.assertEqual(segundo.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='instituto_dos').exists())

    def test_cada_carrera_tiene_su_instituto(self):
        self.assertEqual(self._crear_instituto('instituto_a', self.carrera, 'I-3').status_code, status.HTTP_201_CREATED)
        otra = self._crear_instituto('instituto_b', self.otra_carrera, 'I-4')

        self.assertEqual(otra.status_code, status.HTTP_201_CREATED, otra.data)

    def test_se_valida_con_la_asignacion_no_con_el_perfil(self):
        # Instituto como asignación secundaria: su perfil dice 'docente'.
        titular = self.crear_usuario('instituto_secundario', 'docente', carrera=self.carrera)
        AsignacionCarrera.objects.create(user=titular, carrera=self.carrera, rol='iiisyp')

        response = self._crear_instituto('instituto_nuevo', self.carrera, 'I-5')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_una_asignacion_inactiva_no_ocupa_el_cargo(self):
        anterior = self.crear_usuario('instituto_anterior', 'docente', carrera=self.carrera)
        AsignacionCarrera.objects.create(user=anterior, carrera=self.carrera, rol='iiisyp', activo=False)

        response = self._crear_instituto('instituto_libre', self.carrera, 'I-6')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_dos_perfiles_iiisyp_de_la_misma_carrera_no_rompen_la_base(self):
        for username in ('perfil_iiisyp_1', 'perfil_iiisyp_2'):
            usuario = User.objects.create_user(username, password='x')
            PerfilUsuario.objects.filter(user=usuario).update(rol='iiisyp', carrera=self.carrera, activo=True)

        self.assertEqual(PerfilUsuario.objects.filter(rol='iiisyp', carrera=self.carrera, activo=True).count(), 2)


class UnSoloCargoDeMandoTests(UsuariosBaseTestCase):
    """Director, Jefe de Estudios e Instituto: un solo cargo de mando por usuario."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_el_instituto_no_se_combina_con_otro_cargo(self):
        casos = {
            'director_misma_carrera': ('director', self.carrera),
            'director_otra_carrera': ('director', self.otra_carrera),
            'jefe_misma_carrera': ('jefe_estudios', self.carrera),
            'jefe_otra_carrera': ('jefe_estudios', self.otra_carrera),
        }
        for i, (caso, (rol, carrera)) in enumerate(casos.items()):
            with self.subTest(caso=caso):
                username = f'mando_{i}'
                datos = self.datos_usuario(
                    username, 'iiisyp', self.carrera, f'MU-{i}',
                    asignaciones=[{'rol': rol, 'carrera': carrera.pk}],
                )

                response = self.client.post('/api/usuarios/', datos, format='json')

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn('asignaciones', response.data)
                self.assertFalse(User.objects.filter(username=username).exists())

    def test_al_editar_no_se_suma_el_instituto_a_un_director(self):
        director = self.crear_usuario('director_mando', 'director', carrera=self.carrera, is_staff=True, ci='MU-9')

        response = self.client.patch(
            f'/api/usuarios/{director.pk}/',
            {'asignaciones': [{'rol': 'iiisyp', 'carrera': self.carrera.pk}]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AsignacionCarrera.objects.filter(user=director, rol='iiisyp').exists())

    def test_director_y_jefe_siguen_sin_combinarse(self):
        datos = self.datos_usuario(
            'director_jefe', 'director', self.carrera, 'MU-10',
            asignaciones=[{'rol': 'jefe_estudios', 'carrera': self.carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ReglaDeCombinacionesTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_un_docente_no_puede_estar_en_dos_carreras(self):
        # Un usuario pertenece a una sola carrera (la de su contrato).
        datos = self.datos_usuario(
            'docente_dos_carreras', 'docente', self.carrera, 'DC-1',
            asignaciones=[{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertFalse(User.objects.filter(username='docente_dos_carreras').exists())

    def test_un_director_no_puede_ser_docente_de_otra_carrera(self):
        datos = self.datos_usuario(
            'director_docente_ajeno', 'director', self.carrera, 'DC-2',
            asignaciones=[{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='director_docente_ajeno').exists())

    def test_un_jefe_de_estudios_no_puede_ser_docente_de_otra_carrera(self):
        datos = self.datos_usuario(
            'jefe_docente_ajeno', 'jefe_estudios', self.carrera, 'DC-4',
            asignaciones=[{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('asignaciones', response.data)
        self.assertFalse(User.objects.filter(username='jefe_docente_ajeno').exists())

    def test_un_jefe_de_estudios_puede_ser_docente_de_su_misma_carrera(self):
        datos = self.datos_usuario(
            'jefe_docente_propio', 'jefe_estudios', self.carrera, 'DC-5',
            asignaciones=[{'rol': 'docente', 'carrera': self.carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', con_resolucion_jefe(datos), format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_el_instituto_no_puede_ser_docente_de_otra_carrera(self):
        datos = self.datos_usuario(
            'instituto_docente_ajeno', 'iiisyp', self.carrera, 'DC-6',
            asignaciones=[{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('asignaciones', response.data)
        self.assertFalse(User.objects.filter(username='instituto_docente_ajeno').exists())

    def test_el_instituto_puede_ser_docente_de_su_misma_carrera(self):
        datos = self.datos_usuario(
            'instituto_docente_propio', 'iiisyp', self.carrera, 'DC-7',
            asignaciones=[{'rol': 'docente', 'carrera': self.carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_al_editar_el_instituto_tampoco_suma_docencia_en_otra_carrera(self):
        instituto = self.crear_usuario('instituto_edita', 'iiisyp', carrera=self.carrera, ci='DC-8')

        response = self.client.patch(
            f'/api/usuarios/{instituto.pk}/',
            {'asignaciones': [{'rol': 'docente', 'carrera': self.otra_carrera.pk}]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AsignacionCarrera.objects.filter(user=instituto, rol='docente').exists())

    def test_un_director_puede_ser_docente_de_su_misma_carrera(self):
        datos = self.datos_usuario(
            'director_docente_propio', 'director', self.carrera, 'DC-3',
            asignaciones=[{'rol': 'docente', 'carrera': self.carrera.pk}],
        )

        response = self.client.post('/api/usuarios/', datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
