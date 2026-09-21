from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from fondos.models import (
    Docente, Carrera, FondoTiempo, CalendarioAcademico, 
    CargaHoraria, InformeFondo, HistorialFondo, MensajeObservacion,
    ObservacionFondo, PerfilUsuario, Materia
)

class Command(BaseCommand):
    help = 'Elimina TODOS los datos del sistema (Usuarios, Fondos, Docentes) para iniciar de cero.'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('⚠️  INICIANDO RESETEO TOTAL DEL SISTEMA...'))
        
        # Confirmación de seguridad
        self.stdout.write(self.style.WARNING('Esta acción eliminará TODOS los datos de la base de datos.'))
        confirm = input("¿Estás seguro de que quieres continuar? (escribe 'si' para confirmar): ")
        
        if confirm.lower() != 'si':
            self.stdout.write(self.style.ERROR('Operación cancelada.'))
            return

        try:
            with transaction.atomic():
                # 1. Eliminar registros que protegen a los Usuarios (PROTECT)
                self.stdout.write('Eliminando historiales, mensajes e informes...')
                HistorialFondo.objects.all().delete()
                MensajeObservacion.objects.all().delete()
                InformeFondo.objects.all().delete()
                
                # 2. Eliminar registros que protegen a los Calendarios (PROTECT)
                self.stdout.write('Eliminando cargas horarias...')
                CargaHoraria.objects.all().delete()

                # 3. Eliminar el núcleo del negocio (Cascada elimina Proyectos, Actividades, etc.)
                self.stdout.write('Eliminando fondos de tiempo y observaciones...')
                ObservacionFondo.objects.all().delete()
                FondoTiempo.objects.all().delete()
                
                # 4. Eliminar catálogos principales
                self.stdout.write('Eliminando calendarios, docentes y carreras...')
                CalendarioAcademico.objects.all().delete()
                Materia.objects.all().delete()
                # Desvincular perfiles antes de borrar docentes para evitar conflictos
                PerfilUsuario.objects.update(docente=None) 
                Docente.objects.all().delete()
                Carrera.objects.all().delete()
                
                # 5. Eliminar Usuarios
                self.stdout.write('Eliminando TODOS los usuarios...')
                User.objects.all().delete()

                self.stdout.write(self.style.SUCCESS('✅ ¡Sistema limpiado exitosamente!'))
                self.stdout.write(self.style.WARNING('IMPORTANTE: Ahora debes crear un nuevo superusuario ejecutando:'))
                self.stdout.write(self.style.SUCCESS('python manage.py createsuperuser'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error al resetear: {str(e)}'))
