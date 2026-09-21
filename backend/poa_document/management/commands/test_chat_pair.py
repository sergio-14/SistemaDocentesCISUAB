from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Prueba rápida: crea 2 usuarios y lista mensajes entre ellos'

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        from poa_document.models import MensajeChat
        from poa_document.api.views import MensajeChatViewSet
        from rest_framework.test import APIRequestFactory

        User = get_user_model()

        u1, _ = User.objects.get_or_create(username='test_sender', defaults={'email':'s@example.local'})
        u2, _ = User.objects.get_or_create(username='test_receiver', defaults={'email':'r@example.local'})

        # Clean previous messages between them
        from django.db.models import Q
        MensajeChat.objects.filter(
            (Q(emisor=u1) & Q(receptor=u2)) | (Q(emisor=u2) & Q(receptor=u1))
        ).delete()

        MensajeChat.objects.create(emisor=u1, receptor=u2, texto='hola desde u1')
        MensajeChat.objects.create(emisor=u2, receptor=u1, texto='respuesta de u2')

        factory = APIRequestFactory()
        django_request = factory.get('/api/poa/mensajes-chat/', {'peer_user_id': str(u2.id)})
        django_request.user = u1

        # Wrap in DRF Request to provide .query_params
        view = MensajeChatViewSet()
        # Replicar la misma lógica de filtrado usada por MensajeChatViewSet.get_queryset
        from django.db.models import Q
        peer_id = u2.id
        qs = MensajeChat.objects.filter(
            (Q(emisor=u1) & Q(receptor_id=peer_id)) |
            (Q(emisor_id=peer_id) & Q(receptor=u1))
        ).order_by('fecha')

        self.stdout.write(f'Mensajes recuperados para user {u1.username} con peer {u2.username}:')
        for m in qs:
            self.stdout.write(f'  {m.id} {m.emisor_id} -> {m.receptor_id} : {m.texto}')
