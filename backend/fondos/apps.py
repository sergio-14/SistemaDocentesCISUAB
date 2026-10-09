from django.apps import AppConfig


class FondosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fondos'

    def ready(self):
        # Señales que publican en tiempo real (avisos y chat por WebSocket).
        from fondos import tiempo_real  # noqa: F401
