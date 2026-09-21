# -*- coding: utf-8 -*-
"""
Corrige el hallazgo P2 de la auditoria del Fondo de Tiempo: evidencias vacias
en CargaHoraria y evidencias genericas reutilizadas para varios tipos de
actividad distintos dentro de la misma categoria.

Reemplaza el campo `evidencias` de un registro cuando:
  - esta vacio, o
  - su texto es identico al de otro registro con un `tipo_actividad`
    distinto dentro del mismo (docente, calendario, categoria) -- es decir,
    es un texto generico copiado entre actividades que no le corresponden.

El valor de reemplazo sale de los catalogos de evidencias sugeridas por
tipo de actividad definidos en `fondos.serializers`
(CARGA_HORARIA_EVIDENCIAS_POR_CATEGORIA), los mismos que ya usa el
serializer para autocompletar evidencias en registros nuevos.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from fondos.models import CargaHoraria
from fondos.serializers import CARGA_HORARIA_EVIDENCIAS_POR_CATEGORIA


class Command(BaseCommand):
    help = (
        'Normaliza el campo evidencias de CargaHoraria: rellena vacios y '
        'reemplaza texto generico reutilizado entre distintos tipos de '
        'actividad, usando los catalogos de evidencias por categoria.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los cambios que se harian sin escribir en la base de datos.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        grupos = defaultdict(list)
        for carga in CargaHoraria.objects.all().only(
            'id', 'docente_id', 'calendario_id', 'categoria', 'tipo_actividad', 'evidencias'
        ):
            grupos[(carga.docente_id, carga.calendario_id, carga.categoria)].append(carga)

        actualizaciones = []
        resumen_por_categoria = defaultdict(int)

        for (_docente_id, _calendario_id, categoria), cargas in grupos.items():
            texto_por_tipo = defaultdict(set)
            for carga in cargas:
                texto = (carga.evidencias or '').strip()
                if texto:
                    texto_por_tipo[texto].add(carga.tipo_actividad)

            textos_genericos = {
                texto for texto, tipos in texto_por_tipo.items() if len(tipos) > 1
            }

            catalogo = CARGA_HORARIA_EVIDENCIAS_POR_CATEGORIA.get(categoria, {})

            for carga in cargas:
                texto_actual = (carga.evidencias or '').strip()
                necesita_fix = not texto_actual or texto_actual in textos_genericos
                if not necesita_fix:
                    continue

                nuevo_texto = catalogo.get(carga.tipo_actividad, '')
                if not nuevo_texto or nuevo_texto == texto_actual:
                    continue

                actualizaciones.append((carga, texto_actual, nuevo_texto))
                resumen_por_categoria[categoria] += 1

        if not actualizaciones:
            self.stdout.write(self.style.SUCCESS('No se encontraron registros con evidencias vacias o genericas.'))
            return

        self.stdout.write(f'Registros a corregir: {len(actualizaciones)}')
        for categoria, cantidad in sorted(resumen_por_categoria.items()):
            self.stdout.write(f'  - {categoria}: {cantidad}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n--dry-run activo: no se escribio nada. Detalle de cambios:'))
            for carga, antes, despues in actualizaciones:
                self.stdout.write(
                    f'  [{carga.categoria}] id={carga.id} tipo_actividad={carga.tipo_actividad!r}: '
                    f'{antes!r} -> {despues!r}'
                )
            return

        with transaction.atomic():
            for carga, _antes, despues in actualizaciones:
                CargaHoraria.objects.filter(pk=carga.pk).update(evidencias=despues)

        self.stdout.write(self.style.SUCCESS(f'\nSe actualizaron {len(actualizaciones)} registros correctamente.'))
