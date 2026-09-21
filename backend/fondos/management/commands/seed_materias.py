# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from django.db import transaction

from fondos.models import Carrera, FacultadCatalogo, Materia


CARRERA_NOMBRE = 'Ingeniería de Sistemas'
CARRERA_CODIGO = 'CIS'
CARRERA_FACULTAD = 'Facultad de Ingeniería y Tecnología'


MATERIAS = [
    {'semestre': 1, 'sigla': 'CIS-ALG-o11101', 'nombre': 'ALGEBRA I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-FIS-o11102', 'nombre': 'FÍSICA I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-CAL-o11103', 'nombre': 'CÁLCULO I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 1, 'sigla': 'CIS-PRO-o11104', 'nombre': 'PROGRAMACIÓN I', 'horas_teoricas': 4, 'horas_practicas': 4},
    {'semestre': 1, 'sigla': 'CIS-SIE-o11201', 'nombre': 'SISTEMAS ECONÓMICOS', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 1, 'sigla': 'CIS-ITE-o11202', 'nombre': 'INGLÉS TÉCNICO I', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 2, 'sigla': 'CIS-ALG-o12105', 'nombre': 'ALGEBRA II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-CAL-o12106', 'nombre': 'CÁLCULO II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-FIS-o12107', 'nombre': 'FÍSICA II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-PRO-o12301', 'nombre': 'PROGRAMACIÓN II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-ADE-o12203', 'nombre': 'ADMINISTRACIÓN DE EMPRESAS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 2, 'sigla': 'CIS-ITE-o12204', 'nombre': 'INGLÉS TÉCNICO II', 'horas_teoricas': 3, 'horas_practicas': 3},
    {'semestre': 3, 'sigla': 'CIS-EST-o13108', 'nombre': 'ESTADÍSTICA I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-CAL-o13109', 'nombre': 'CÁLCULO III', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-MAD-o13302', 'nombre': 'MATEMÁTICA DISCRETA', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-PRO-o13303', 'nombre': 'PROGRAMACIÓN III', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-COE-o13205', 'nombre': 'COMUNICACIÓN ORAL Y ESCRITA', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 3, 'sigla': 'CIS-MIC-o13304', 'nombre': 'METODOLOGÍA DE LA INVESTIGACIÓN I', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-EDA-o14305', 'nombre': 'ESTRUCTURA DE DATOS I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-BDA-o14306', 'nombre': 'BASE DE DATOS I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-EST-o14110', 'nombre': 'ESTADÍSTICA II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-SDI-o14307', 'nombre': 'SISTEMAS DIGITALES', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-MEN-o14308', 'nombre': 'MÉTODOS NUMÉRICOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 4, 'sigla': 'CIS-ADA-o14309', 'nombre': 'ANÁLISIS Y DISEÑO DE ALGORITMOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-ACO-o15310', 'nombre': 'ARQUITECTURA DE COMPUTADORAS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-BDA-o15311', 'nombre': 'BASE DE DATOS II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-INS-o15312', 'nombre': 'INGENIERÍA DE SISTEMAS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-SII-o15313', 'nombre': 'SISTEMAS DE INFORMACIÓN I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-INO-o15314', 'nombre': 'INVESTIGACIÓN OPERATIVA I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 5, 'sigla': 'CIS-EDA-o15401', 'nombre': 'ESTRUCTURA DE DATOS II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-COB-o16206', 'nombre': 'CONTABILIDAD BÁSICA', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-SIO-o16315', 'nombre': 'SISTEMAS OPERATIVOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-RED-o16316', 'nombre': 'REDES I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-SII-o16402', 'nombre': 'SISTEMAS DE INFORMACIÓN II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-INO-o16403', 'nombre': 'INVESTIGACIÓN OPERATIVA II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 6, 'sigla': 'CIS-INS-o16317', 'nombre': 'INGENIERÍA DE SOFTWARE I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-INM-o17404', 'nombre': 'INGENIERÍA DE MÉTODOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-SIG-o17405', 'nombre': 'SISTEMAS DE INFORMACIÓN GEOGRÁFICA', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-TEM-o17406', 'nombre': 'TECNOLOGÍAS EMERGENTES', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-ILE-o17207', 'nombre': 'INGENIERÍA LEGAL/ÉTICA DEONTOLOGÍA', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-MER-o17208', 'nombre': 'MERCADOTECNIA', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 7, 'sigla': 'CIS-PEP-o17209', 'nombre': 'PREPARACIÓN Y EVALUACIÓN DE PROYECTOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-GEP-o18318', 'nombre': 'GESTIÓN DE PROYECTOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-GEC-o18319', 'nombre': 'GESTIÓN DE CALIDAD', 'horas_teoricas': 2, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-MSS-o18407', 'nombre': 'MODELACIÓN Y SIMULACIÓN DE SISTEMAS I', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-MIC-o18408', 'nombre': 'METODOLOGÍA DE LA INVESTIGACIÓN II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-TBD-e18320', 'nombre': 'TALLER DE BASE DE DATOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-INS-e18412', 'nombre': 'INGENIERÍA DE SOFTWARE II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-CEL-e18011', 'nombre': 'CIRCUITOS ELÉCTRICOS', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 8, 'sigla': 'CIS-RED-e18416', 'nombre': 'REDES II', 'horas_teoricas': 4, 'horas_practicas': 2},
    {'semestre': 9, 'sigla': 'CIS-MOG-o19411', 'nombre': 'MODALIDAD DE GRADUACIÓN I', 'horas_teoricas': 6, 'horas_practicas': 6},
    {'semestre': 9, 'sigla': 'CIS-TDG-o19412', 'nombre': 'TESIS DE GRADO', 'horas_teoricas': 6, 'horas_practicas': 6},
    {'semestre': 9, 'sigla': 'CIS-PDG-o19413', 'nombre': 'PROYECTO DE GRADO', 'horas_teoricas': 6, 'horas_practicas': 6},
    {'semestre': 10, 'sigla': 'CIS-MOG-o10412', 'nombre': 'MODALIDAD DE GRADUACIÓN II', 'horas_teoricas': 6, 'horas_practicas': 6},
    {'semestre': 10, 'sigla': 'CIS-TRD-o10413', 'nombre': 'TRABAJO DIRIGIDO', 'horas_teoricas': 6, 'horas_practicas': 6},
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
        FacultadCatalogo.objects.get_or_create(nombre=CARRERA_FACULTAD)

        carrera = Carrera.objects.filter(nombre__iexact=nombre_carrera).first()
        carrera_created = False
        if carrera is None:
            carrera, carrera_created = Carrera.objects.get_or_create(
                codigo=CARRERA_CODIGO,
                defaults={
                    'nombre': nombre_carrera,
                    'facultad': CARRERA_FACULTAD,
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
