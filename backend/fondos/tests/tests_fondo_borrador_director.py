"""El Director no ve un fondo en borrador de su carrera hasta que se presenta.

- Lista y detalle: el borrador ajeno no aparece (404 en el detalle).
- Presentado al Director, sí aparece.
- Su propio fondo en borrador sí lo ve.
- El Jefe de Estudios y el superusuario siguen viendo los borradores.
"""
from rest_framework import status

from fondos.models import FondoTiempo, PerfilUsuario
from fondos.tests.tests_usuarios_auditoria import UsuariosBaseTestCase


class BorradorNoVisibleParaDirectorTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_carrera', 'director', carrera=self.carrera, is_staff=True)
        self.jefe = self.crear_usuario('jefe_carrera', 'jefe_estudios', carrera=self.carrera, is_staff=True)
        self.docente = self.crear_docente('CI-BORRADOR')
        self.fondo = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026, estado='borrador')

    def _ids_lista(self):
        response = self.client.get('/api/fondos-tiempo/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        datos = response.data['results'] if isinstance(response.data, dict) else response.data
        return [item['id'] for item in datos]

    def test_director_no_ve_el_borrador_en_la_lista_ni_en_el_detalle(self):
        self.client.force_authenticate(self.director)

        self.assertNotIn(self.fondo.id, self._ids_lista())
        self.assertEqual(self.client.get(f'/api/fondos-tiempo/{self.fondo.id}/').status_code, status.HTTP_404_NOT_FOUND)

    def test_director_lo_ve_una_vez_presentado(self):
        FondoTiempo.objects.filter(pk=self.fondo.pk).update(estado='presentado_director')
        self.client.force_authenticate(self.director)

        self.assertIn(self.fondo.id, self._ids_lista())
        self.assertEqual(self.client.get(f'/api/fondos-tiempo/{self.fondo.id}/').status_code, status.HTTP_200_OK)

    def test_director_ve_su_propio_borrador(self):
        docente_director = self.crear_docente('CI-DIRECTOR', usuario=self.director)
        PerfilUsuario.objects.filter(user=self.director).update(docente=docente_director)
        propio = FondoTiempo.objects.create(docente=docente_director, carrera=self.carrera, gestion=2026, estado='borrador')
        self.client.force_authenticate(self.director)

        ids = self._ids_lista()
        self.assertIn(propio.id, ids)
        self.assertNotIn(self.fondo.id, ids)

    def test_jefe_y_superusuario_si_ven_el_borrador(self):
        for usuario in (self.jefe, self.superuser):
            with self.subTest(usuario=usuario.username):
                self.client.force_authenticate(usuario)
                self.assertIn(self.fondo.id, self._ids_lista())
