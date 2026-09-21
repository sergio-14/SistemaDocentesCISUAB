import pandas as pd
from django.core.management.base import BaseCommand
from fondos.models import Docente, Carrera, FondoTiempo, CategoriaFuncion, Actividad
import os

# OBSOLETO desde 2026-09-12: este comando escribe sobre el modelo `Actividad`
# (deprecado, ver docstring en fondos/models.py) y sobre un esquema de
# CategoriaFuncion.tipo ('docente', 'extension', 'asesorias', 'tribunales',
# 'administrativo', 'vida_universitaria') que ya no existe en
# CategoriaFuncion.TIPO_CHOICES. Ademas usa `Docente(categoria=..., dedicacion=...)`,
# campos que se movieron a DocenteCarrera en un refactor posterior, asi que
# fallaria con TypeError si se ejecuta contra el esquema actual. Se conserva
# solo como referencia historica de como se cargaron los primeros fondos de
# ejemplo; no ejecutar. El flujo real de carga hoy es CargaHorariaViewSet /
# el formulario de Jefatura de Estudios en el frontend.


class Command(BaseCommand):
    help = 'OBSOLETO - no funciona con el esquema actual. Ver comentario al inicio del archivo.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Iniciando carga de datos desde Excel...\n')
        
        # Rutas de los archivos
        base_path = 'data/'
        archivo_2024 = os.path.join(base_path, 'FONDO_TIEMPO_WILLIAM_CHAO_2024.xlsx')
        archivo_2023 = os.path.join(base_path, 'Plantilla Fondo de Tiempo CIS 2023_WCHAO.xlsx')
        
        # Crear docente William Chao si no existe
        docente, created = Docente.objects.get_or_create(
            ci='12345678',
            defaults={
                'nombres': 'William',
                'apellido_paterno': 'Chao',
                'apellido_materno': 'Rivero',
                'categoria': 'catedratico',
                'dedicacion': 'tiempo_completo',
                'activo': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Docente creado: {docente.nombre_completo}'))
        else:
            self.stdout.write(f'✓ Docente ya existe: {docente.nombre_completo}')
        
        # Crear carrera si no existe
        carrera, created = Carrera.objects.get_or_create(
            codigo='CIS',
            defaults={
                'nombre': 'Ingeniería de Sistemas',
                'facultad': 'Facultad de Ingeniería y Tecnología',
                'activo': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Carrera creada: {carrera.nombre}'))
        else:
            self.stdout.write(f'✓ Carrera ya existe: {carrera.nombre}')
        
        # Cargar archivo 2024
        self.stdout.write('\n--- Cargando Fondo de Tiempo 2024 ---')
        self.cargar_fondo_2024(archivo_2024, docente, carrera)
        
        # Cargar archivo 2023
        self.stdout.write('\n--- Cargando Fondo de Tiempo 2023 ---')
        self.cargar_fondo_2023(archivo_2023, docente, carrera)
        
        self.stdout.write(self.style.SUCCESS('\n¡Carga completada exitosamente! ✓'))

    def cargar_fondo_2024(self, archivo, docente, carrera):
        """Carga el fondo de tiempo 2024"""
        
        # Leer Excel
        df = pd.read_excel(archivo, header=None)
        
        # Crear Fondo de Tiempo
        fondo, created = FondoTiempo.objects.get_or_create(
            docente=docente,
            carrera=carrera,
            gestion=2024,
            asignatura='Gestión de Proyectos',
            defaults={
                'semanas_año': 52,
                'horas_semana': 40,
                'horas_vacacion': 120,
                'horas_feriados': 128,
                'contrato_horas': 2080,
                'clases_aula_horas': 240,
                'funciones_sustantivas_horas': 1124,
                'horas_efectivas': 1832,
                'estado': 'validado'
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Fondo de Tiempo 2024 creado'))
        else:
            self.stdout.write(self.style.WARNING(f'⚠ Fondo de Tiempo 2024 ya existe, se actualizará'))
            # Limpiar categorías y actividades existentes
            fondo.categorias.all().delete()
        
        # Mapeo de categorías
        categorias_map = {
            'DOCENTE': ('docente', 836, 45.6),
            'INVESTIGACIÓN': ('investigacion', 60, 3.28),
            'EXTENSIÓN E INTERACCIÓN SOCIAL': ('extension', 180, 9.8),
            'ASESORÍAS Y TUTORÍAS': ('asesorias', 0, 0),
            'TRIBUNALES': ('tribunales', 24, 1.3),
            'ADMINISTRATIVO': ('administrativo', 697, 38.1),
            'VIDA UNIVERSITARIA': ('vida_universitaria', 35, 1.91),
        }
        
        # Crear categorías
        categorias = {}
        for nombre, (tipo, total, porcentaje) in categorias_map.items():
            cat = CategoriaFuncion.objects.create(
                fondo_tiempo=fondo,
                tipo=tipo,
                total_horas=total,
                porcentaje=porcentaje
            )
            categorias[nombre] = cat
            self.stdout.write(f'  ✓ Categoría: {nombre} ({total}h)')
        
        # Actividades por categoría (basado en la imagen)
        actividades_data = {
            'DOCENTE': [
                ('Preparación de temas', 3, 120, 'Programa de clases'),
                ('Clases en aula', 6, 240, 'Plan de clases'),
                ('Elaboración de Trabajos Prácticos', 1, 40, 'Archivos semestrales'),
                ('Revisión y Calificación de Trabajos Prácticos', 2, 80, 'Calificación'),
                ('Elaboración de Examenes', 0.4, 16, 'Examenes'),
                ('Revisión y Calificación de Examenes', 1.5, 60, 'Notas'),
                ('Consultas y Reclamos de Calificaciones', 0.4, 16, ''),
                ('Elaboración de planillas e introducción de notas al sistema moxos', 0.2, 8, 'Planilla de calificaciones'),
                ('Planificación y gestión de practica extra aula', 0.4, 16, 'Programa de clases'),
                ('Ejecución de practica extra aula', 2, 80, 'Imagenes fotográficas'),
                ('Practicas de Campo', 2, 80, ''),
                ('Producción docente (textos guías)', 2, 80, 'Texto Guía'),
            ],
            'INVESTIGACIÓN': [
                ('Elaboración de trabajos de investigación', 16, 32, 'Productos de investigación'),
                ('Participación en actividades del I.I.C.-C.I.S', 6, 12, 'Informes de investigación'),
                ('Organización y participación de eventos científicos de la UABJB y otras instituciones', 8, 16, ''),
            ],
            'EXTENSIÓN E INTERACCIÓN SOCIAL': [
                ('Proyectos de extensión', 6, 36, 'Productos de trabajo de extensión e interacción social'),
                ('Proyectos de Interacción', 6, 36, 'Informes de extensión e interacción social'),
                ('Tareas en proyectos de extensión e interacción', 0, 0, ''),
                ('Participación en ferias, campañas, jornadas, tribunal externo, capacitación externa, actividades de extensión, etc.', 8, 48, ''),
                ('Capacitación complementaria', 10, 60, ''),
            ],
            'TRIBUNALES': [
                ('Modalidad de Graduación', 8, 16, 'Memorandum, Acta'),
                ('Auxiliarias de docencia', 0, 0, 'Acta, Memorandum'),
                ('Examenes de mesa', 4, 8, 'Memorandum, Planillas'),
            ],
            'ADMINISTRATIVO': [
                ('APOYO INSTITUTO DE INVESTIGACIÓN', 200, 697, 'Memorandum de designación'),
                ('Otras comisiones académicas', 497, 0, 'Informes'),
            ],
            'VIDA UNIVERSITARIA': [
                ('Participación de actividades culturales, sociales y deportivas', 1, 40, 'Asistencias'),
                ('Desfile día del mar', 4, 4, ''),
                ('Bautizo de la carrera', 4, 8, ''),
                ('Día de la autonomía universitaria', 4, 4, ''),
                ('Desfile 6 de agosto', 4, 4, ''),
                ('Acto académico facultivo', 4, 4, ''),
                ('Entrada folclórica universitaria', 4, 4, ''),
                ('Acto académico universitario', 4, 4, ''),
                ('Desfile del 18 de noviembre', 4, 4, ''),
                ('Asociación Docente', 2, 80, ''),
            ],
        }
        
        # Crear actividades
        total_actividades = 0
        for cat_nombre, actividades in actividades_data.items():
            if cat_nombre in categorias:
                for detalle, hrs_sem, hrs_año, evidencias in actividades:
                    Actividad.objects.create(
                        categoria=categorias[cat_nombre],
                        detalle=detalle,
                        horas_semana=hrs_sem,
                        horas_año=hrs_año,
                        evidencias=evidencias,
                        orden=total_actividades
                    )
                    total_actividades += 1
        
        self.stdout.write(self.style.SUCCESS(f'✓ {total_actividades} actividades creadas'))

    def cargar_fondo_2023(self, archivo, docente, carrera):
        """Carga el fondo de tiempo 2023 (parcial - Álgebra II-B)"""
        
        # Crear Fondo de Tiempo
        fondo, created = FondoTiempo.objects.get_or_create(
            docente=docente,
            carrera=carrera,
            gestion=2023,
            asignatura='Álgebra II-B',
            defaults={
                'semanas_año': 52,
                'horas_semana': 40,
                'horas_vacacion': 120,
                'horas_feriados': 128,
                'contrato_horas': 2080,
                'clases_aula_horas': 40,
                'funciones_sustantivas_horas': 224,
                'horas_efectivas': 264,  # Fondo parcial
                'estado': 'validado',
                'observaciones': 'Fondo de tiempo parcial para una asignatura'
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Fondo de Tiempo 2023 creado (parcial)'))
        else:
            self.stdout.write(self.style.WARNING(f'⚠ Fondo de Tiempo 2023 ya existe'))
            return
        
        # Crear categorías básicas para 2023
        CategoriaFuncion.objects.create(
            fondo_tiempo=fondo,
            tipo='docente',
            total_horas=264,
            porcentaje=100
        )
        
        self.stdout.write(f'  ✓ Categoría: DOCENTE (264h - 100%)')
        self.stdout.write(self.style.SUCCESS(f'✓ Fondo 2023 completado'))