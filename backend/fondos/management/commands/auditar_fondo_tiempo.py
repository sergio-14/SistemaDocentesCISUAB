# -*- coding: utf-8 -*-
"""
Auditoria de consistencia numerica de un Fondo de Tiempo: compara los
valores YA GUARDADOS en FondoTiempo (contrato_horas, horas_vacacion,
horas_feriados, horas_efectivas) contra lo que producirian HOY las mismas
formulas del modelo (FondoTiempo._recalcular_horas_automaticas() y sus
metodos auxiliares), sin guardar nada -- si difieren, es que algo cambio
despues (dedicacion, antiguedad, etc.) y el fondo quedo desactualizado.

Tambien suma CargaHoraria por categoria (las mismas 7 categorias de
CategoriaFuncion.TIPO_CHOICES: academica, investigacion,
extension_universitaria, interaccion_social, gestion,
academica_administrativa, social_cultural_deportiva -- OJO: no son
necesariamente las mismas 7 etiquetas/agrupaciones que puede traer un PDF de
referencia externo, p.ej. si ese PDF fusiona "Extension" e "Interaccion
social" en una sola fila o separa "Tribunales" como categoria propia), y
verifica que la suma total coincida con horas_efectivas y que los
porcentajes sumen 100%.

Uso:
    python manage.py auditar_fondo_tiempo --docente "William Chao Rivero" --gestion 2024
    python manage.py auditar_fondo_tiempo --docente-id 5 --gestion 2024 --carrera "Ingenieria de Sistemas"
"""
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count, Sum

from fondos.models import CargaHoraria, CategoriaFuncion, Docente, DocenteCarrera, FondoTiempo

TOLERANCIA = Decimal('0.01')
SEMANAS_CLASES_AULA = Decimal('40')


class Command(BaseCommand):
    help = (
        'Audita la consistencia numerica de un Fondo de Tiempo: compara los '
        'campos guardados contra lo que las formulas del modelo calcularian '
        'hoy, y verifica que las horas de CargaHoraria por categoria sumen '
        'exactamente horas_efectivas.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--docente', type=str, default=None, help='Nombre (o parte) del docente a buscar.')
        parser.add_argument('--docente-id', type=int, default=None, help='ID exacto del Docente.')
        parser.add_argument('--gestion', type=int, required=True, help='Gestion (año) del Fondo de Tiempo a auditar.')
        parser.add_argument('--carrera', type=str, default=None, help='Nombre (o parte) de la carrera, si el docente tiene mas de un fondo en esa gestion.')

    def handle(self, *args, **options):
        docente = self._resolver_docente(options)
        fondo = self._resolver_fondo(docente, options)

        self.errores = []
        self.advertencias = []

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n=== AUDITORIA FONDO DE TIEMPO - {docente.nombre_completo.upper()} - {fondo.gestion} ===\n"
        ))

        self._auditar_docente(docente, fondo)
        self._auditar_encabezado(fondo)
        totales_categoria = self._auditar_categorias(fondo)
        self._auditar_totales(fondo, totales_categoria)
        self._auditar_duplicados(fondo)
        self._conclusion()

    # ------------------------------------------------------------------
    # Resolucion de docente / fondo
    # ------------------------------------------------------------------
    def _resolver_docente(self, options):
        if options['docente_id']:
            try:
                return Docente.objects.select_related('user', 'datos_laborales').get(pk=options['docente_id'])
            except Docente.DoesNotExist:
                raise CommandError(f"No existe Docente con id={options['docente_id']}.")

        nombre = options['docente']
        if not nombre:
            raise CommandError('Debes pasar --docente "Nombre" o --docente-id <id>.')

        candidatos = list(Docente.objects.select_related('user', 'datos_laborales').all())
        coincidencias = [d for d in candidatos if nombre.strip().lower() in d.nombre_completo.lower()]
        if not coincidencias:
            raise CommandError(f'No se encontro ningun Docente cuyo nombre contenga "{nombre}".')
        if len(coincidencias) > 1:
            listado = '\n'.join(f'  - id={d.pk}: {d.nombre_completo}' for d in coincidencias)
            raise CommandError(f'Hay {len(coincidencias)} docentes que coinciden con "{nombre}", usa --docente-id:\n{listado}')
        return coincidencias[0]

    def _resolver_fondo(self, docente, options):
        qs = FondoTiempo.objects.select_related('docente', 'carrera', 'calendario_academico').filter(
            docente=docente, gestion=options['gestion'],
        )
        if options['carrera']:
            qs = qs.filter(carrera__nombre__icontains=options['carrera'])

        fondos = list(qs)
        if not fondos:
            raise CommandError(
                f'{docente.nombre_completo} no tiene ningun FondoTiempo en la gestion {options["gestion"]}'
                + (f' para una carrera que contenga "{options["carrera"]}".' if options['carrera'] else '.')
            )
        if len(fondos) > 1:
            listado = '\n'.join(f'  - id={f.pk}: carrera={f.carrera.nombre!r} periodo={f.periodo!r}' for f in fondos)
            raise CommandError(f'{docente.nombre_completo} tiene {len(fondos)} fondos en {options["gestion"]}, usa --carrera para elegir uno:\n{listado}')
        return fondos[0]

    # ------------------------------------------------------------------
    # Secciones de la auditoria
    # ------------------------------------------------------------------
    def _auditar_docente(self, docente, fondo):
        vinculo = DocenteCarrera.objects.filter(docente=docente, carrera=fondo.carrera, activo=True).first()
        dedicacion_texto = vinculo.get_dedicacion_display() if vinculo else '(sin vinculo activo con esta carrera)'
        datos = getattr(docente, 'datos_laborales', None)
        antiguedad = datos.calcular_antiguedad(fondo.gestion) if datos else None
        dias_vacacion = datos.calcular_dias_vacacion(fondo.gestion) if datos else None

        self.stdout.write('DATOS DEL DOCENTE:')
        self.stdout.write(f'  - Nombre: {docente.nombre_completo}')
        self.stdout.write(f'  - Carrera del fondo: {fondo.carrera.nombre}')
        self.stdout.write(f'  - Dedicacion (DocenteCarrera): {dedicacion_texto}')
        self.stdout.write(f'  - Fecha de ingreso: {datos.fecha_ingreso if datos else "N/D"}')
        self.stdout.write(f'  - Antiguedad en gestion {fondo.gestion}: {antiguedad if antiguedad is not None else "N/D"} años')
        self.stdout.write(f'  - Dias de vacacion segun antiguedad: {dias_vacacion if dias_vacacion is not None else "N/D"}')
        self.stdout.write('')

    def _comparar(self, etiqueta, guardado, calculado_ahora):
        guardado_dec = Decimal(str(guardado))
        calculado_dec = Decimal(str(calculado_ahora))
        diferencia = abs(guardado_dec - calculado_dec)
        if diferencia <= TOLERANCIA:
            self.stdout.write(self.style.SUCCESS(f'  OK {etiqueta}: {guardado_dec} (coincide con la formula actual)'))
        else:
            self.stdout.write(self.style.ERROR(
                f'  X  {etiqueta}: guardado={guardado_dec}  |  la formula actual da={calculado_dec}  '
                f'(diferencia={diferencia}) -> el fondo quedo desactualizado, falta volver a .save()'
            ))
            self.errores.append(f'{etiqueta}: guardado={guardado_dec} vs formula actual={calculado_dec}')

    def _auditar_encabezado(self, fondo):
        self.stdout.write('CALCULOS DEL ENCABEZADO (valor guardado en FondoTiempo vs. lo que la formula del '
                           'modelo calcularia si se recalculara hoy):')

        horas_semana_actual = fondo._obtener_horas_semanales_contractuales()
        contrato_actual = int(horas_semana_actual * 52) if horas_semana_actual else 0
        vacacion_actual = fondo._obtener_horas_vacacion_docente()
        feriados_actual = fondo._obtener_horas_feriados_docente()
        efectivas_actual = max(contrato_actual - vacacion_actual - feriados_actual, 0)

        self.stdout.write(f'  Horas/semana contractuales: {fondo.horas_semana} (formula actual: {horas_semana_actual})')
        self._comparar('Contrato (hrs/año)', fondo.contrato_horas, contrato_actual)
        self._comparar('Vacacion (hrs)', fondo.horas_vacacion, vacacion_actual)
        self._comparar('Feriados (hrs)', fondo.horas_feriados, feriados_actual)
        self._comparar('Horas efectivas', fondo.horas_efectivas, efectivas_actual)

        self.stdout.write(
            f'  Verificacion aritmetica: {fondo.contrato_horas} (contrato) - {fondo.horas_vacacion} (vacacion) '
            f'- {fondo.horas_feriados} (feriados) = {fondo.contrato_horas - fondo.horas_vacacion - fondo.horas_feriados} '
            f'(guardado como horas_efectivas={fondo.horas_efectivas})'
        )
        if Decimal(str(fondo.contrato_horas - fondo.horas_vacacion - fondo.horas_feriados)) != Decimal(str(fondo.horas_efectivas)):
            self.errores.append('horas_efectivas guardado no coincide con contrato - vacacion - feriados (tambien guardados).')
        self.stdout.write('')

    def _auditar_categorias(self, fondo):
        self.stdout.write('CATEGORIAS - SUMA REAL DE CargaHoraria (agrupada por tipo_actividad, igual que el PDF):')
        horas_efectivas = Decimal(str(fondo.horas_efectivas)) or Decimal('1')

        categorias = fondo.categorias.all().order_by('id')
        totales = {}
        for idx, cat in enumerate(categorias, start=1):
            cargas = CargaHoraria.objects.filter(
                docente=fondo.docente, calendario=fondo.calendario_academico, categoria=cat.tipo,
            )
            agregados = cargas.aggregate(total=Sum('horas'), n=Count('id'))
            total_cat = Decimal(str(agregados['total'] or 0))
            porcentaje = (total_cat / horas_efectivas) * 100 if horas_efectivas else Decimal('0')
            totales[cat.tipo] = total_cat

            n_tipos = cargas.values('tipo_actividad').distinct().count()
            self.stdout.write(
                f'  {idx}. {cat.get_tipo_display().upper()}: {total_cat} hrs/año  '
                f'({porcentaje:.2f}%)  [{agregados["n"]} registros de CargaHoraria en {n_tipos} tipos de actividad distintos]'
            )

            for fila in cargas.values('tipo_actividad').annotate(total=Sum('horas'), n=Count('id')).order_by('tipo_actividad'):
                hrs_sem = (Decimal(str(fila['total'])) / SEMANAS_CLASES_AULA) if cat.tipo == 'academica' else None
                extra = f', {hrs_sem:.2f} hrs/sem' if hrs_sem is not None else ''
                self.stdout.write(f'       - {fila["tipo_actividad"] or "(sin tipo)"}: {fila["total"]} hrs/año{extra} ({fila["n"]} registro(s))')

        self.stdout.write('')
        return totales

    def _auditar_totales(self, fondo, totales_categoria):
        self.stdout.write('TOTAL GENERAL:')
        horas_efectivas = Decimal(str(fondo.horas_efectivas))
        suma_categorias = sum(totales_categoria.values(), Decimal('0'))
        suma_porcentajes = sum(
            ((v / horas_efectivas) * 100 if horas_efectivas else Decimal('0')) for v in totales_categoria.values()
        )

        diferencia_horas = abs(suma_categorias - horas_efectivas)
        if diferencia_horas <= TOLERANCIA:
            self.stdout.write(self.style.SUCCESS(
                f'  OK Suma de categorias ({suma_categorias}) == horas_efectivas ({horas_efectivas})'
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f'  X  Suma de categorias ({suma_categorias}) != horas_efectivas ({horas_efectivas}) '
                f'(diferencia={diferencia_horas}) -> el fondo NO esta balanceado: '
                + ('sobran' if suma_categorias > horas_efectivas else 'faltan')
                + f' {diferencia_horas} hrs por asignar/quitar.'
            ))
            self.errores.append(f'Suma de categorias {suma_categorias} != horas_efectivas {horas_efectivas} (diferencia {diferencia_horas})')

        diferencia_pct = abs(suma_porcentajes - 100)
        if diferencia_pct <= TOLERANCIA:
            self.stdout.write(self.style.SUCCESS(f'  OK Suma de porcentajes = {suma_porcentajes:.2f}%'))
        else:
            self.stdout.write(self.style.WARNING(f'  !  Suma de porcentajes = {suma_porcentajes:.2f}% (esperado 100%)'))
            self.advertencias.append(f'Suma de porcentajes = {suma_porcentajes:.2f}% (no 100%)')
        self.stdout.write('')

    def _auditar_duplicados(self, fondo):
        self.stdout.write('VALIDACION DE DUPLICADOS:')
        duplicados = (
            CargaHoraria.objects
            .filter(docente=fondo.docente, calendario=fondo.calendario_academico)
            .values('categoria', 'tipo_actividad', 'materia_id')
            .annotate(n=Count('id'))
            .filter(n__gt=1)
        )
        duplicados = list(duplicados)
        if not duplicados:
            self.stdout.write(self.style.SUCCESS('  OK No hay registros de CargaHoraria duplicados (misma categoria+tipo_actividad+materia).'))
        else:
            for dup in duplicados:
                self.stdout.write(self.style.ERROR(
                    f'  X  Duplicado: categoria={dup["categoria"]} tipo_actividad={dup["tipo_actividad"]} '
                    f'materia_id={dup["materia_id"]} -> {dup["n"]} registros'
                ))
                self.errores.append(f'CargaHoraria duplicada: {dup}')
        self.stdout.write('')

    def _conclusion(self):
        self.stdout.write(self.style.MIGRATE_HEADING('CONCLUSION:'))
        if not self.errores:
            self.stdout.write(self.style.SUCCESS('  TODOS LOS DATOS SON CONSISTENTES.'))
        else:
            self.stdout.write(self.style.ERROR(f'  Se encontraron {len(self.errores)} discrepancia(s):'))
            for err in self.errores:
                self.stdout.write(self.style.ERROR(f'   - {err}'))
        if self.advertencias:
            self.stdout.write(self.style.WARNING(f'  {len(self.advertencias)} advertencia(s):'))
            for adv in self.advertencias:
                self.stdout.write(self.style.WARNING(f'   - {adv}'))
        self.stdout.write('')
