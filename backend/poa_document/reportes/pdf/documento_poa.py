from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
)

from .estilos import crear_estilos_documento, estilo_tabla_base, texto_seguro


class DocumentoPOAPDFGenerator:
    """Generador PDF POA: Formulario 1, 2 y 3 en ese orden."""

    DEFAULT_ENTIDAD = 'UABJB'

    @staticmethod
    def _texto(valor, default=''):
        return texto_seguro(valor, default)

    @staticmethod
    def _money(valor):
        try:
            return f"{float(valor):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except Exception:
            return '0,00'

    @staticmethod
    def _unidad_solicitante_texto(documento):
        unidad = getattr(documento, 'unidad_solicitante', None)
        if unidad is None:
            return ''
        if hasattr(unidad, 'nombre') and getattr(unidad, 'nombre', ''):
            return DocumentoPOAPDFGenerator._texto(unidad.nombre)
        if hasattr(unidad, 'codigo') and getattr(unidad, 'codigo', ''):
            return DocumentoPOAPDFGenerator._texto(unidad.codigo)
        return DocumentoPOAPDFGenerator._texto(unidad)

    @staticmethod
    def _styles():
        return crear_estilos_documento()

    @staticmethod
    def _table_base_style(extra=None):
        return estilo_tabla_base(extra, color_borde=colors.black)

    @staticmethod
    def _header_table(documento, styles, orientation='landscape'):
        if orientation == 'portrait':
            col_widths = [150, 425]
        else:
            col_widths = [160, 565]

        data = [
            [Paragraph('<b>ENTIDAD</b>', styles['cell_bold']), Paragraph(DocumentoPOAPDFGenerator.DEFAULT_ENTIDAD, styles['cell'])],
            [Paragraph('<b>GESTIÓN</b>', styles['cell_bold']), Paragraph(DocumentoPOAPDFGenerator._texto(documento.gestion), styles['cell'])],
            [Paragraph('<b>PROGRAMA</b>', styles['cell_bold']), Paragraph(DocumentoPOAPDFGenerator._texto(documento.programa), styles['cell'])],
            [Paragraph('<b>UNIDAD SOLICITANTE</b>', styles['cell_bold']), Paragraph(DocumentoPOAPDFGenerator._unidad_solicitante_texto(documento), styles['cell'])],
            [Paragraph('<b>OBJETIVO DE GESTIÓN INSTITUCIONAL</b>', styles['cell_bold']), Paragraph(DocumentoPOAPDFGenerator._texto(documento.objetivo_gestion_institucional), styles['cell'])],
        ]
        t = Table(data, colWidths=col_widths, repeatRows=0)
        t.setStyle(DocumentoPOAPDFGenerator._table_base_style())
        return t

    @staticmethod
    def _responsables_table(documento, styles, orientation='landscape'):
        if orientation == 'portrait':
            col_widths = [140, 330, 105]
        else:
            col_widths = [170, 430, 125]

        jefe = DocumentoPOAPDFGenerator._texto(documento.jefe_unidad, 'No asignado')
        elaborado = DocumentoPOAPDFGenerator._texto(documento.elaborado_por, 'No asignado')
        fecha = DocumentoPOAPDFGenerator._texto(documento.fecha_elaboracion)
        data = [
            [Paragraph('<b>Responsables de la información</b>', styles['cell_bold']), '', ''],
            [Paragraph('<b>JEFE DE UNIDAD</b>', styles['cell_bold']), Paragraph(jefe, styles['cell']), ''],
            [Paragraph('<b>ELABORADO POR</b>', styles['cell_bold']), Paragraph(elaborado, styles['cell']), Paragraph(f'Fecha: {fecha}', styles['cell'])],
        ]
        t = Table(data, colWidths=col_widths)
        t.setStyle(DocumentoPOAPDFGenerator._table_base_style([
            ('SPAN', (0, 0), (2, 0)),
            ('BACKGROUND', (0, 0), (2, 0), colors.HexColor('#7a7a7a')),
            ('TEXTCOLOR', (0, 0), (2, 0), colors.white),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        return t

    @staticmethod
    def _totales_objetivo(objetivo):
        funcion = 0.0
        inversion = 0.0
        for act in objetivo.actividades.all():
            try:
                funcion += float(act.monto_funcion or 0)
            except Exception:
                pass
            try:
                inversion += float(act.monto_inversion or 0)
            except Exception:
                pass
        return funcion, inversion

    @staticmethod
    def _formulario_1(documento, styles):
        elems = [
            Paragraph('PROGRAMACIÓN DE OPERACIONES ANUAL', styles['title']),
            Paragraph('OPERACIONES POR OBJETIVOS ESPECÍFICOS', styles['title']),
            Paragraph('Formulario Nro. 1', styles['subtitle']),
            DocumentoPOAPDFGenerator._header_table(documento, styles, orientation='landscape'),
            Spacer(1, 6),
        ]

        header = [
            Paragraph('<b>Actividad o Programa</b>', styles['cell_bold']),
            Paragraph('<b>Responsable</b>', styles['cell_bold']),
            Paragraph('<b>Productos Esperados<br/>Bien, Servicio o Norma</b>', styles['cell_bold']),
            Paragraph('<b>Mes de Inicio</b>', styles['cell_bold']),
            Paragraph('<b>Mes Fin</b>', styles['cell_bold']),
            Paragraph('<b>Indicador</b>', styles['cell_bold']),
            '',
            '',
            '',
            Paragraph('<b>Monto Bs.</b>', styles['cell_bold']),
            '',
        ]
        subheader = ['', '', '', '', '',
            Paragraph('<b>Descripcion del Indicador</b>', styles['cell_bold']),
            Paragraph('<b>Unidad de Medida</b>', styles['cell_bold']),
            Paragraph('<b>Linea Base</b>', styles['cell_bold']),
            Paragraph('<b>Meta</b>', styles['cell_bold']),
            Paragraph('<b>Funcion</b>', styles['cell_bold']),
            Paragraph('<b>Inversion</b>', styles['cell_bold']),
        ]
        data = [header, subheader]

        objetivos = list(documento.objetivos.prefetch_related('actividades').all())
        if not objetivos:
            data.append([Paragraph('Sin objetivos/actividades registrados.', styles['cell'])] + [''] * 10)
        else:
            for obj in objetivos:
                total_funcion, total_inversion = DocumentoPOAPDFGenerator._totales_objetivo(obj)
                data.append([
                    Paragraph(f"<b>{DocumentoPOAPDFGenerator._texto(obj.codigo, 'OE')}</b> . {DocumentoPOAPDFGenerator._texto(obj.descripcion, 'Sin descripcion')}", styles['cell_bold']),
                    '', '', '', '', '', '', '', '',
                    Paragraph(f"<b>{DocumentoPOAPDFGenerator._money(total_funcion)}</b>", styles['cell_bold']),
                    Paragraph(f"<b>{DocumentoPOAPDFGenerator._money(total_inversion)}</b>", styles['cell_bold']),
                ])
                actividades = list(obj.actividades.all())
                if not actividades:
                    data.append([Paragraph('Sin actividades registradas para este objetivo.', styles['cell'])] + [''] * 10)
                    continue
                for act in actividades:
                    data.append([
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.codigo) + ' - ' + DocumentoPOAPDFGenerator._texto(act.nombre), styles['cell_small']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.responsable), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.productos_esperados), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.mes_inicio), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.mes_fin), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.indicador_descripcion), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.indicador_unidad), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.indicador_linea_base), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._texto(act.indicador_meta), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._money(act.monto_funcion), styles['cell']),
                        Paragraph(DocumentoPOAPDFGenerator._money(act.monto_inversion), styles['cell']),
                    ])

        tabla = Table(
            data,
            colWidths=[132, 86, 86, 36, 36, 78, 64, 58, 54, 48, 47],
            repeatRows=2,
        )
        style = [
            ('SPAN', (0, 0), (0, 1)),
            ('SPAN', (1, 0), (1, 1)),
            ('SPAN', (2, 0), (2, 1)),
            ('SPAN', (3, 0), (3, 1)),
            ('SPAN', (4, 0), (4, 1)),
            ('SPAN', (5, 0), (8, 0)),
            ('SPAN', (9, 0), (10, 0)),
            ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor('#e6e6e6')),
            ('ALIGN', (3, 2), (10, -1), 'CENTER'),
        ]
        for i, row in enumerate(data[2:], start=2):
            if row[1] == '':
                tiene_totales = bool(row[9] or row[10])
                style.append(('SPAN', (0, i), (8 if tiene_totales else 10, i)))
                style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f2f2f2')))
                style.append(('FONTNAME', (0, i), (-1, i), 'Helvetica-Bold'))
                if tiene_totales:
                    style.append(('ALIGN', (9, i), (10, i), 'RIGHT'))
        tabla.setStyle(DocumentoPOAPDFGenerator._table_base_style(style))
        elems.extend([tabla, Spacer(1, 8), DocumentoPOAPDFGenerator._responsables_table(documento, styles, orientation='landscape')])
        return elems

    @staticmethod
    def _formulario_2(documento, styles):
        elems = [
            Paragraph('PROGRAMACIÓN DE OPERACIONES ANUAL', styles['title']),
            Paragraph('OPERACIONES POR PARTIDAS PRESUPUESTARIAS', styles['title']),
            Paragraph('Formulario Nro. 2', styles['subtitle']),
            DocumentoPOAPDFGenerator._header_table(documento, styles, orientation='landscape'),
            Spacer(1, 6),
        ]

        detalles = []
        for objetivo in documento.objetivos.prefetch_related('actividades__detalles_presupuesto').all():
            for actividad in objetivo.actividades.all():
                for d in actividad.detalles_presupuesto.all():
                    detalles.append((actividad, d))

        data = [[
            Paragraph('<b>Partida / Detalle</b>', styles['cell_bold']),
            Paragraph('<b>Función</b>', styles['cell_bold']),
            Paragraph('<b>Inversión</b>', styles['cell_bold']),
        ]]

        total_funcion = 0
        total_inversion = 0
        if not detalles:
            data.append([Paragraph('Sin partidas presupuestarias registradas.', styles['cell']), '', ''])
        else:
            for actividad, d in detalles:
                monto = float(d.costo_total or 0)
                es_inversion = str(d.tipo).lower() == 'inversion'
                if es_inversion:
                    total_inversion += monto
                else:
                    total_funcion += monto

                data.append([
                    Paragraph(f"{DocumentoPOAPDFGenerator._texto(d.partida)} . {DocumentoPOAPDFGenerator._texto(d.item)}", styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._money(0 if es_inversion else monto), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._money(monto if es_inversion else 0), styles['cell']),
                ])
            data.append([
                Paragraph('<b>TOTAL</b>', styles['cell_bold']),
                Paragraph(f"<b>{DocumentoPOAPDFGenerator._money(total_funcion)}</b>", styles['cell_bold']),
                Paragraph(f"<b>{DocumentoPOAPDFGenerator._money(total_inversion)}</b>", styles['cell_bold']),
            ])

        tabla = Table(data, colWidths=[610, 58, 58], repeatRows=1)
        tabla.setStyle(DocumentoPOAPDFGenerator._table_base_style([
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e6e6e6')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f2f2f2')),
        ]))

        elems.extend([tabla, Spacer(1, 8), DocumentoPOAPDFGenerator._responsables_table(documento, styles, orientation='landscape')])
        return elems

    @staticmethod
    def _formulario_3_actividad(documento, actividad, detalles, styles):
        titulo_actividad = 'Sin actividad específica'
        if actividad is not None:
            titulo_actividad = f"{DocumentoPOAPDFGenerator._texto(actividad.codigo)} - {DocumentoPOAPDFGenerator._texto(actividad.nombre)}"

        elems = [
            Paragraph('REQUERIMIENTO DE RECURSOS FÍSICOS Y FINANCIEROS', styles['title']),
            Paragraph('Formulario Nro. 3', styles['subtitle']),
            Paragraph(titulo_actividad, styles['cell_bold']),
            Spacer(1, 4),
            DocumentoPOAPDFGenerator._header_table(documento, styles, orientation='portrait'),
            Spacer(1, 6),
        ]

        data = [[
            Paragraph('<b>Detalle</b>', styles['cell_bold']),
            Paragraph('<b>Unidad de medida</b>', styles['cell_bold']),
            Paragraph('<b>Características</b>', styles['cell_bold']),
            Paragraph('<b>Partida Presupuestaria</b>', styles['cell_bold']),
            Paragraph('<b>Cantidad Requerida</b>', styles['cell_bold']),
            Paragraph('<b>Costo Bs.<br/>Unitario</b>', styles['cell_bold']),
            Paragraph('<b>Costo Bs.<br/>Total</b>', styles['cell_bold']),
            Paragraph('<b>Mes Requerimiento</b>', styles['cell_bold']),
        ]]

        if not detalles:
            data.append([Paragraph('Sin requerimientos físicos/financieros registrados para esta actividad.', styles['cell'])] + [''] * 7)
        else:
            for d in detalles:
                data.append([
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.item), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.unidad_medida), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.caracteristicas), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.partida), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.cantidad), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._money(d.costo_unitario), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._money(d.costo_total), styles['cell']),
                    Paragraph(DocumentoPOAPDFGenerator._texto(d.mes_requerimiento), styles['cell']),
                ])

        tabla = Table(
            data,
            colWidths=[154, 42, 95, 36, 44, 40, 44, 120],
            repeatRows=1,
        )
        style = [
            ('ALIGN', (4, 1), (6, -1), 'RIGHT'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e6e6e6')),
        ]
        if len(data) == 2 and not detalles:
            style.append(('SPAN', (0, 1), (-1, 1)))
            style.append(('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f2f2f2')))
        tabla.setStyle(DocumentoPOAPDFGenerator._table_base_style(style))

        elems.extend([tabla, Spacer(1, 8), DocumentoPOAPDFGenerator._responsables_table(documento, styles, orientation='portrait')])
        return elems

    @staticmethod
    def _on_landscape_page(canvas, _doc):
        canvas.setPageSize(landscape(letter))

    @staticmethod
    def _on_portrait_page(canvas, _doc):
        canvas.setPageSize(letter)

    @staticmethod
    def _story_documento(documento, styles):
        story = []
        story.extend(DocumentoPOAPDFGenerator._formulario_1(documento, styles))
        story.append(PageBreak())
        story.extend(DocumentoPOAPDFGenerator._formulario_2(documento, styles))
        story.append(NextPageTemplate('portrait'))

        objetivos = list(documento.objetivos.prefetch_related('actividades__detalles_presupuesto').all())
        actividades_con_presupuesto = []
        for objetivo in objetivos:
            for actividad in objetivo.actividades.all():
                detalles = list(actividad.detalles_presupuesto.all())
                if detalles:
                    actividades_con_presupuesto.append((actividad, detalles))

        for actividad, detalles in actividades_con_presupuesto:
            story.append(PageBreak())
            story.extend(DocumentoPOAPDFGenerator._formulario_3_actividad(documento, actividad, detalles, styles))
        return story

    @staticmethod
    def generar_reporte_individual(documento):
        buffer = BytesIO()
        margin = 18
        l_w, l_h = landscape(letter)
        p_w, p_h = letter

        doc = BaseDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        landscape_frame = Frame(
            margin,
            margin,
            l_w - (margin * 2),
            l_h - (margin * 2),
            id='landscape-frame',
        )
        portrait_frame = Frame(
            margin,
            margin,
            p_w - (margin * 2),
            p_h - (margin * 2),
            id='portrait-frame',
        )

        doc.addPageTemplates([
            PageTemplate(id='landscape', frames=[landscape_frame], onPage=DocumentoPOAPDFGenerator._on_landscape_page),
            PageTemplate(id='portrait', frames=[portrait_frame], onPage=DocumentoPOAPDFGenerator._on_portrait_page),
        ])

        styles = DocumentoPOAPDFGenerator._styles()
        story = DocumentoPOAPDFGenerator._story_documento(documento, styles)

        doc.build(story)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_reporte_general(documentos, gestion=None):
        buffer = BytesIO()
        margin = 18
        l_w, l_h = landscape(letter)
        p_w, p_h = letter

        doc = BaseDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=margin,
            rightMargin=margin,
            topMargin=margin,
            bottomMargin=margin,
        )

        landscape_frame = Frame(
            margin,
            margin,
            l_w - (margin * 2),
            l_h - (margin * 2),
            id='landscape-frame',
        )
        portrait_frame = Frame(
            margin,
            margin,
            p_w - (margin * 2),
            p_h - (margin * 2),
            id='portrait-frame',
        )

        doc.addPageTemplates([
            PageTemplate(id='landscape', frames=[landscape_frame], onPage=DocumentoPOAPDFGenerator._on_landscape_page),
            PageTemplate(id='portrait', frames=[portrait_frame], onPage=DocumentoPOAPDFGenerator._on_portrait_page),
        ])

        styles = DocumentoPOAPDFGenerator._styles()
        documentos = list(documentos or [])

        if not documentos:
            story = [
                Paragraph('PROGRAMACIÓN DE OPERACIONES ANUAL', styles['title']),
                Paragraph(f'No existen documentos POA para la gestión {gestion or "seleccionada"}.', styles['subtitle']),
            ]
            doc.build(story)
            buffer.seek(0)
            return buffer

        story = []
        for index, documento in enumerate(documentos):
            if index > 0:
                story.append(NextPageTemplate('landscape'))
                story.append(PageBreak())
            story.extend(DocumentoPOAPDFGenerator._story_documento(documento, styles))

        doc.build(story)
        buffer.seek(0)
        return buffer
