from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Docente, Carrera, FondoTiempo, CalendarioAcademico, InformeFondo

class FondoTiempoEvaluationTests(APITestCase):
    def setUp(self):
        # Crear Carreras
        self.carrera_sistemas = Carrera.objects.create(nombre="Ingeniería de Sistemas", codigo="SIS", facultad="Ciencia y Tecnología")
        self.carrera_derecho = Carrera.objects.create(nombre="Derecho", codigo="DER", facultad="Ciencias Jurídicas")

        # Crear Docentes
        self.docente_sistemas = Docente.objects.create(nombres="Juan", apellido_paterno="Perez", ci="123", carrera=self.carrera_sistemas, categoria="catedratico", dedicacion="tiempo_completo")
        
        # Crear Usuarios y Perfiles
        self.admin_user = User.objects.create_user(username="admin", password="password123", is_staff=True)
        self.admin_user.perfil.rol = 'iiisyp'
        self.admin_user.perfil.save()

        self.director_sistemas_user = User.objects.create_user(username="director_sis", password="password123", is_staff=True)
        self.director_sistemas_user.perfil.rol = 'director'
        self.director_sistemas_user.perfil.carrera = self.carrera_sistemas
        self.director_sistemas_user.perfil.save()

        self.director_derecho_user = User.objects.create_user(username="director_der", password="password123", is_staff=True)
        self.director_derecho_user.perfil.rol = 'director'
        self.director_derecho_user.perfil.carrera = self.carrera_derecho
        self.director_derecho_user.perfil.save()

        self.docente_user = User.objects.create_user(username="docente_juan", password="password123")
        self.docente_user.perfil.rol = 'docente'
        self.docente_user.perfil.docente = self.docente_sistemas
        self.docente_user.perfil.save()

        # Crear Calendario
        self.calendario = CalendarioAcademico.objects.create(gestion=2024, periodo='1', fecha_inicio='2024-02-01', fecha_fin='2024-06-30', fecha_inicio_presentacion_proyectos='2024-01-15', fecha_limite_presentacion_proyectos='2024-01-31')

        # Crear Fondo de Tiempo en estado 'informe_presentado'
        self.fondo = FondoTiempo.objects.create(
            docente=self.docente_sistemas,
            carrera=self.carrera_sistemas,
            calendario_academico=self.calendario,
            gestion=2024,
            periodo='1',
            asignatura="Programación Avanzada",
            estado='informe_presentado' # Estado clave para la prueba
        )
        
        # Crear un informe asociado
        self.informe = InformeFondo.objects.create(
            fondo_tiempo=self.fondo,
            elaborado_por=self.docente_user,
            tipo='parcial',
            actividades_realizadas="Se completaron todas las actividades del semestre.",
            logros="Los estudiantes aprendieron sobre patrones de diseño."
        )
        
        self.url = reverse('fondotiempo-evaluar-y-finalizar', kwargs={'pk': self.fondo.pk})
        self.eval_data = {
            'cumplimiento': 'cumplido',
            'evaluacion_director': 'El docente ha cumplido satisfactoriamente con los objetivos planteados.'
        }

    def test_director_can_evaluate_fund_in_own_career(self):
        """Verifica que el Director de la carrera correcta PUEDE evaluar."""
        self.client.force_authenticate(user=self.director_sistemas_user)
        response = self.client.post(self.url, self.eval_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'finalizado')

    def test_admin_cannot_evaluate_fund(self):
        """Verifica que un Administrador NO PUEDE evaluar."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.url, self.eval_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_director_cannot_evaluate_fund_in_other_career(self):
        """Verifica que un Director de otra carrera NO PUEDE evaluar."""
        self.client.force_authenticate(user=self.director_derecho_user)
        response = self.client.post(self.url, self.eval_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_evaluate_fund(self):
        """Verifica que un Docente NO PUEDE evaluar."""
        self.client.force_authenticate(user=self.docente_user)
        response = self.client.post(self.url, self.eval_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class UsuarioCargoUnicoTests(APITestCase):
    def setUp(self):
        self.carrera_sistemas = Carrera.objects.create(
            nombre="Ingeniería de Sistemas",
            codigo="SIS",
            facultad="Ciencia y Tecnología",
        )
        self.carrera_derecho = Carrera.objects.create(
            nombre="Derecho",
            codigo="DER",
            facultad="Ciencias Jurídicas",
        )

        self.admin_user = User.objects.create_user(
            username="admin_users",
            password="password123",
            is_staff=True,
        )
        self.admin_user.perfil.rol = 'iiisyp'
        self.admin_user.perfil.save()

        self.director_actual = User.objects.create_user(
            username="director_actual",
            password="password123",
            is_staff=True,
        )
        self.director_actual.perfil.rol = 'director'
        self.director_actual.perfil.carrera = self.carrera_sistemas
        self.director_actual.perfil.activo = True
        self.director_actual.perfil.save()

        self.url_lista = '/api/usuarios/'
        self.url_detalle_director = f'/api/usuarios/{self.director_actual.pk}/'

        self.client.force_authenticate(user=self.admin_user)

    def test_rechaza_director_duplicado_activo_en_misma_carrera(self):
        response = self.client.post(
            self.url_lista,
            {
                'username': 'director_nuevo',
                'email': 'nuevo@uabjb.edu.bo',
                'password': 'password123',
                'password_confirm': 'password123',
                'first_name': 'Nuevo',
                'last_name': 'Director',
                'rol': 'director',
                'carrera': self.carrera_sistemas.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            'Operación denegada: La carrera de Ingeniería de Sistemas ya tiene un Director asignado. Debe dar de baja al titular actual antes de asignar uno nuevo',
            str(response.data),
        )

    def test_permite_editar_al_mismo_titular_sin_autobloqueo(self):
        response = self.client.patch(
            self.url_detalle_director,
            {
                'first_name': 'Director',
                'last_name': 'Actualizado',
                'rol': 'director',
                'carrera': self.carrera_sistemas.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.director_actual.refresh_from_db()
        self.assertEqual(self.director_actual.last_name, 'Actualizado')

    def test_permite_nuevo_director_si_el_titular_actual_esta_inactivo(self):
        self.director_actual.is_active = False
        self.director_actual.save()
        self.director_actual.refresh_from_db()

        response = self.client.post(
            self.url_lista,
            {
                'username': 'director_reemplazo',
                'email': 'reemplazo@uabjb.edu.bo',
                'password': 'password123',
                'password_confirm': 'password123',
                'first_name': 'Director',
                'last_name': 'Reemplazo',
                'rol': 'director',
                'carrera': self.carrera_sistemas.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
