# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from django.db import transaction

from fondos.models import Carrera, FacultadCatalogo, Materia


CARRERA_NOMBRE = 'Ingeniería de Sistemas'
CARRERA_CODIGO = 'CIS'
CARRERA_FACULTAD = 'Facultad de Ingeniería y Tecnología'


# Semestres 1 a 9 del PDC 2021-2025 (Cuadros 4, 5 y 6). En el 8.º y el 9.º: materias
# comunes, de la Mención Software y de la Mención Teleinformática. Modalidad de
# Graduación no se carga.
MATERIAS = [
    {'semestre': 1, 'sigla': 'CIS-ALG-o11101', 'nombre': 'Álgebra I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-FIS-o11102', 'nombre': 'Física I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-CAL-o11103', 'nombre': 'Cálculo I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-PRO-o11104', 'nombre': 'Programación I', 'horas_teoricas': 4, 'horas_practicas': 4},
    {'semestre': 1, 'sigla': 'CIS-SIE-o11201', 'nombre': 'Sistemas Económicos', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 1, 'sigla': 'CIS-ITE-o11202', 'nombre': 'Inglés Técnico I', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 2, 'sigla': 'CIS-ALG-o12105', 'nombre': 'Álgebra II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-CAL-o12106', 'nombre': 'Cálculo II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-FIS-o12107', 'nombre': 'Física III', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-PRO-o12301', 'nombre': 'Programación II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-ADE-o12203', 'nombre': 'Administración de Empresas', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-ITE-o12204', 'nombre': 'Inglés Técnico II', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 3, 'sigla': 'CIS-EST-o13108', 'nombre': 'Estadística I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-CAL-o13109', 'nombre': 'Cálculo III', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-MAD-o13302', 'nombre': 'Matemática Discreta', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-PRO-o13303', 'nombre': 'Programación III', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-COE-o13205', 'nombre': 'Comunicación Oral y Escrita', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-MIC-o13304', 'nombre': 'Metodología de la Investigación I', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-EDA-o14305', 'nombre': 'Estructura de Datos I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-BDA-o14306', 'nombre': 'Base de Datos I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-EST-o14110', 'nombre': 'Estadística II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-SDI-o14307', 'nombre': 'Sistemas Digitales', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-MEN-o14308', 'nombre': 'Métodos Numéricos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-ADA-o14309', 'nombre': 'Análisis y Diseño de Algoritmos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-ACO-o15310', 'nombre': 'Arquitectura de Computadoras', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-BDA-o15311', 'nombre': 'Base de Datos II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-INS-o15312', 'nombre': 'Ingeniería de Sistemas', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-SII-o15313', 'nombre': 'Sistemas de Información I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-INO-o15314', 'nombre': 'Investigación Operativa I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-EDA-o15401', 'nombre': 'Estructura de Datos II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-COB-o16206', 'nombre': 'Contabilidad Básica', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-SIO-o16315', 'nombre': 'Sistemas Operativos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-RED-o16316', 'nombre': 'Redes I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-SII-o16402', 'nombre': 'Sistemas de Información II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-INO-o16403', 'nombre': 'Investigación Operativa II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-INS-o16317', 'nombre': 'Ingeniería de Software I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-INM-o17404', 'nombre': 'Ingeniería de Métodos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-SIG-o17405', 'nombre': 'Sistemas de Información Geográfica', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-TEM-o17406', 'nombre': 'Tecnologías Emergentes', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-ILE-o17207', 'nombre': 'Ingeniería Legal/Ética Deontología', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-MER-o17208', 'nombre': 'Mercadotecnia', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-PEP-o17209', 'nombre': 'Preparación y Evaluación de Proyectos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-GEP-o18318', 'nombre': 'Gestión de Proyectos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-GEC-o18319', 'nombre': 'Gestión de Calidad', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-MSS-o18407', 'nombre': 'Modelación y Simulación de Sistemas I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-MIC-o18408', 'nombre': 'Metodología de la Investigación II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-TBD-e18320', 'nombre': 'Taller de Base de Datos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-INS-e18412', 'nombre': 'Ingeniería de Software II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-CEL-e18011', 'nombre': 'Circuitos Eléctricos', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-RED-e18416', 'nombre': 'Redes II', 'horas_teoricas': 4, 'horas_practicas': 2},
    # 9.º semestre. Horas deducidas del total oficial del PDC (612 h = 34 h/sem); siglas IMA y CEE
    # asignadas (la malla oficial trae el código ilegible).
    # Comunes (16 h/sem):
    {'semestre': 9, 'sigla': 'CIS-MSS-o19415', 'nombre': 'Modelación y Simulación de Sistemas II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-ASI-o19410', 'nombre': 'Auditoría y Seguridad Informática', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-PRP-o19210', 'nombre': 'Práctica Profesional', 'horas_teoricas': 2, 'horas_practicas': 2},
    # Mención Software (18 h/sem):
    {'semestre': 9, 'sigla': 'CIS-INA-e19415', 'nombre': 'Inteligencia Artificial', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-DIS-e19413', 'nombre': 'Dinámica de Sistemas', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-TAP-e19414', 'nombre': 'Taller de Programación', 'horas_teoricas': 4, 'horas_practicas': 2},
    # Mención Teleinformática (18 h/sem):
    {'semestre': 9, 'sigla': 'CIS-TRE-e19417', 'nombre': 'Taller de Redes', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-IMA-e19418', 'nombre': 'Ingeniería de Mantenimiento', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-CEE-e19112', 'nombre': 'Circuitos Electrónicos', 'horas_teoricas': 4, 'horas_practicas': 2},
]


class Command(BaseCommand):
    help = 'Carga o actualiza las materias oficiales del PDC de Ingeniería de Sistemas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--carrera',
            default=CARRERA_NOMBRE,
            help='Nombre de la carrera a la que se asociaran las materias.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        nombre_carrera = options['carrera'].strip()
        facultad, _ = FacultadCatalogo.objects.get_or_create(nombre=CARRERA_FACULTAD)

        carrera = Carrera.objects.filter(nombre__iexact=nombre_carrera).first()
        carrera_created = False
        if carrera is None:
            carrera, carrera_created = Carrera.objects.get_or_create(
                codigo=CARRERA_CODIGO,
                defaults={
                    'nombre': nombre_carrera,
                    'facultad': facultad,
                    'activo': True,
                },
            )

        creadas = 0
        actualizadas = 0
        sin_cambios = 0

        for item in MATERIAS:
            sigla = item['sigla'].strip()
            defaults = {
                'nombre': item['nombre'],
                'semestre': item['semestre'],
                'horas_teoricas': item['horas_teoricas'],
                'horas_practicas': item['horas_practicas'],
                'carrera': carrera,
            }
            materia = Materia.objects.filter(sigla__iexact=sigla).first()
            created = False
            if materia is None:
                materia = Materia.objects.create(sigla=sigla, **defaults)
                created = True

            if created:
                creadas += 1
                continue

            cambios = []
            sigla_normalizada = sigla.upper()
            if materia.sigla != sigla_normalizada:
                materia.sigla = sigla_normalizada
                cambios.append('sigla')
            for field, value in defaults.items():
                if getattr(materia, field) != value:
                    setattr(materia, field, value)
                    cambios.append(field)

            if cambios:
                materia.save(update_fields=cambios)
                actualizadas += 1
            else:
                sin_cambios += 1

        if carrera_created:
            self.stdout.write(self.style.SUCCESS(f'Carrera creada: {carrera.nombre}'))
        else:
            self.stdout.write(f'Carrera usada: {carrera.nombre}')

        self.stdout.write(self.style.SUCCESS(f'Materias procesadas: {len(MATERIAS)}'))
        self.stdout.write(self.style.SUCCESS(f'Materias creadas: {creadas}'))
        self.stdout.write(self.style.WARNING(f'Materias actualizadas: {actualizadas}'))
        self.stdout.write(f'Materias sin cambios: {sin_cambios}')
