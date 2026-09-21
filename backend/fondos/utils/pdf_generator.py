from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch, cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdfgen_canvas
from reportlab.pdfbase.pdfmetrics import stringWidth, registerFont, registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from django.conf import settings
import os
from datetime import datetime, date
import io
import re
import base64
from html import escape
from html.parser import HTMLParser
from django.db.models import Sum
from fondos.models import CargaHoraria
from fondos.utils.informe_texto import construir_defaults_informe, CAMPOS_TEXTO_INFORME

# Verdana no es una de las 14 fuentes estandar de PDF: hay que registrarla a
# partir de los .ttf reales. Son fuentes propietarias de Microsoft (no se
# versionan en git, ver .gitignore), asi que si faltan en este despliegue el
# informe cae de vuelta a Helvetica en vez de romper la generacion del PDF.
_FONTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'fonts')
FUENTE_INFORME_NORMAL = 'Helvetica'
FUENTE_INFORME_BOLD = 'Helvetica-Bold'
try:
    registerFont(TTFont('Verdana', os.path.join(_FONTS_DIR, 'verdana.ttf')))
    registerFont(TTFont('Verdana-Bold', os.path.join(_FONTS_DIR, 'verdanab.ttf')))
    registerFontFamily('Verdana', normal='Verdana', bold='Verdana-Bold')
    FUENTE_INFORME_NORMAL = 'Verdana'
    FUENTE_INFORME_BOLD = 'Verdana-Bold'
except Exception:
    pass

# Trebuchet MS Cursiva (Italic), solo para el nombre en la firma del informe.
# Mismo criterio que Verdana arriba: si el .ttf no esta disponible, cae de
# vuelta a Times-Italic en vez de romper la generacion del PDF.
FUENTE_FIRMA_NOMBRE = 'Times-Italic'
try:
    registerFont(TTFont('TrebuchetMS-Italic', os.path.join(_FONTS_DIR, 'trebucit.ttf')))
    FUENTE_FIRMA_NOMBRE = 'TrebuchetMS-Italic'
except Exception:
    pass

SEMANAS_CLASES_AULA = 40.0
# Semanas usadas para estimar Hrs/Sem de actividades que NO son clases en aula
# (reuniones, proyectos de investigacion, gestion, etc.), igual que en el
# formulario del frontend (frontend/src/components/CargaHorariaManager.jsx,
# SEMANAS_GESTION) para que el dato mostrado en el PDF sea consistente con lo
# que ve el docente al cargar sus horas.
SEMANAS_GESTION_NO_ACADEMICA = 45.8

_DATA_IMG_RE = re.compile(r'^data:image/(png|jpe?g|gif);base64,(?P<data>.+)$', re.IGNORECASE | re.DOTALL)

# Etiquetas legibles de CargaHoraria.tipo_actividad por categoria, igual a las
# opciones que ve el docente en el formulario del frontend (ver
# SUBACTIVIDADES_POR_CATEGORIA en CargaHorariaManager.jsx). Se usan para
# agrupar y mostrar el nombre de cada tipo de actividad en el PDF, en vez del
# codigo interno (slug).
ETIQUETAS_TIPO_ACTIVIDAD = {
    'academica': {
        'cursos_verano': 'Cursos de verano',
        'preparacion_temas': 'Preparación de temas',
        'elaboracion_trabajos_practicos': 'Elaboración de Trabajos Prácticos',
        'revision_calificacion_trabajos_practicos': 'Revisión y Calificación de Trabajos Prácticos',
        'elaboracion_examenes': 'Elaboración de Exámenes',
        'revision_calificacion_examenes': 'Revisión y Calificación de Exámenes',
        'practica_laboratorios_centro_computo': 'Práctica de Laboratorios (Centro de Cómputo)',
        'practicas_campo': 'Prácticas de Campo',
        'produccion_docente_textos_guias': 'Producción docente (textos guías)',
        'consultas_reclamos_calificaciones': 'Consultas y Reclamos de Calificaciones',
        'clases_aula': 'Clases en aula',
        'elaboracion_planillas_introduccion_notas_moxos': 'Elaboración de planillas e Introducción de notas al sistema moxos',
        'planificacion_gestion_practica_extra_aula': 'Planificación y gestión de práctica extra aula',
        'ejecucion_practica_extra_aula': 'Ejecución de práctica extra aula',
        'informe_descargo_viaje_practicas_extra_aula': 'Informe de descargo de viaje en las prácticas extra aula',
    },
    'investigacion': {
        'participacion_iic_cis': 'Participación IIC-CIS',
        'organizacion_eventos_cientificos': 'Organización eventos científicos',
        'elaboracion_trabajos_investigacion': 'Elaboración trabajos investigación',
    },
    'extension_universitaria': {
        'proyectos_extension': 'Proyectos de extensión',
        'tareas_proyectos_extension_interaccion': 'Tareas en proyectos de extensión e interacción',
        'cursos': 'Cursos',
        'seminarios': 'Seminarios',
        'talleres': 'Talleres',
        'conferencias': 'Conferencias',
        'jornadas': 'Jornadas',
        'videoconferencias': 'Videoconferencias',
        'asistencia_tecnica': 'Asistencia técnica',
        'voluntariado': 'Voluntariado',
    },
    'interaccion_social': {
        'proyectos_interaccion': 'Proyectos de interacción',
        'tareas_proyectos_extension_interaccion': 'Tareas en proyectos de extensión e interacción',
        'participacion_ferias_campanas_jornadas': 'Participación en ferias, campañas, jornadas',
        'proyectos_sociales': 'Proyectos sociales',
        'ferias': 'Ferias',
        'campanas': 'Campañas',
        'jornadas': 'Jornadas',
        'tribunal_externo': 'Tribunal externo',
        'capacitacion_externa': 'Capacitación externa',
    },
    'gestion': {
        'modalidad_graduacion': 'Modalidad de Graduación',
        'reuniones': 'Reuniones',
        'coordinacion': 'Coordinación',
        'convenios': 'Convenios',
        'politicas_academicas': 'Políticas académicas',
    },
    'academica_administrativa': {
        'auxiliares_docencia': 'Auxiliares de docencia',
        'examenes_mesa': 'Exámenes de mesa',
        'otras_comisiones_academicas': 'Otras comisiones académicas',
        'logistica_carrera': 'Logística carrera',
        'difusion_perfil_profesional': 'Difusión perfil profesional',
        'caac': 'CAAC',
        'comision_innovacion_curricular': 'Comisión Innovación Curricular',
        'poa': 'POA',
        'programas_analiticos': 'Programas analíticos',
    },
    'social_cultural_deportiva': {
        'acto_academico_facultativo': 'Acto académico facultativo',
        'acto_academico_universitario': 'Acto académico universitario',
        'participacion_actividades_culturales_sociales_deportivas': 'Participación de actividades culturales, sociales y deportivas',
        'aniversarios': 'Aniversarios',
        'entrada_folclorica': 'Entrada folclórica',
        'campeonatos_deportivos': 'Campeonatos deportivos',
        'concursos': 'Concursos',
        'eventos_culturales': 'Eventos culturales',
        'desfile_6_agosto': 'Desfile 6 agosto',
        'desfile_18_noviembre': 'Desfile 18 noviembre',
        'claustros_universitarios': 'Claustros universitarios',
        'asociacion_docente': 'Asociación Docente',
        'capacitacion_complementaria': 'Capacitación complementaria',
        'orientacion_vocacional': 'Orientación Vocacional',
    },
}


def _etiqueta_tipo_actividad(categoria, carga):
    codigo = (carga.tipo_actividad or '').strip()
    etiqueta = ETIQUETAS_TIPO_ACTIVIDAD.get(categoria, {}).get(codigo)
    if etiqueta:
        return etiqueta
    if (carga.titulo_actividad or '').strip():
        return carga.titulo_actividad.strip()
    return codigo or 'Actividad sin especificar'


def _formato_es(valor, decimales=1):
    """Formatea un numero con coma decimal (formato boliviano/espanol) y sin
    decimales sobrantes cuando el valor es entero, ej. 9.0 -> '9',
    1.5 -> '1,5', 52.1 -> '52,1'."""
    numero = round(float(valor), decimales)
    if numero == int(numero):
        return str(int(numero))
    texto = f"{numero:.{decimales}f}"
    return texto.replace('.', ',')

def _linea_con_leader(texto_izq, texto_der, ancho_pts, font_name='Helvetica-Bold', font_size=8):
    """Arma 'texto_izq ..... texto_der' (estilo indice) con puntos suspensivos
    que rellenan el espacio disponible hasta ancho_pts, midiendo el ancho real
    del texto con la fuente indicada para que texto_der quede pegado al borde
    derecho de la columna. Devuelve texto ya escapado para insertarse en un
    Paragraph."""
    texto_izq = str(texto_izq).strip()
    texto_der = str(texto_der).strip()
    ancho_punto = stringWidth('.', font_name, font_size)
    ancho_espacio = stringWidth(' ', font_name, font_size)
    disponible = (
        ancho_pts
        - stringWidth(texto_izq, font_name, font_size)
        - stringWidth(texto_der, font_name, font_size)
        - (2 * ancho_espacio)
    )
    num_puntos = max(3, int(disponible / ancho_punto)) if ancho_punto > 0 else 3
    return f"{escape(texto_izq)} {'.' * num_puntos} {escape(texto_der)}"


_NOMBRES_COLOR_CSS = {
    'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'green': '#008000',
    'blue': '#0000ff', 'yellow': '#ffff00', 'orange': '#ffa500', 'purple': '#800080',
    'gray': '#808080', 'grey': '#808080',
}

_TAMANOS_LEGADO_PT = {'1': 8, '2': 10, '3': 12, '4': 14, '5': 18, '6': 24, '7': 32}


def _parsear_estilo_css(texto_style):
    """Convierte un atributo style="a: b; c: d" en un dict {a: b, c: d}."""
    resultado = {}
    if not texto_style:
        return resultado
    for declaracion in texto_style.split(';'):
        if ':' not in declaracion:
            continue
        propiedad, _, valor = declaracion.partition(':')
        resultado[propiedad.strip().lower()] = valor.strip().lower()
    return resultado


def _normalizar_color_css(valor):
    """Convierte un color css (nombre, #hex, rgb(...)) a #hex para reportlab."""
    if not valor:
        return None
    valor = valor.strip().lower()
    if valor in _NOMBRES_COLOR_CSS:
        return _NOMBRES_COLOR_CSS[valor]
    if valor.startswith('#'):
        return valor
    match = re.match(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', valor)
    if match:
        r, g, b = (int(match.group(i)) for i in (1, 2, 3))
        return f'#{r:02x}{g:02x}{b:02x}'
    return None


def _tamano_fuente_a_pt(valor_css, atributo_legado):
    """Convierte font-size (css px/pt) o el atributo size="N" legado a puntos."""
    if valor_css:
        match = re.match(r'([\d.]+)\s*(px|pt)?', valor_css)
        if match:
            numero = float(match.group(1))
            unidad = match.group(2) or 'px'
            return round(numero * 0.75, 1) if unidad == 'px' else round(numero, 1)
    if atributo_legado and atributo_legado in _TAMANOS_LEGADO_PT:
        return _TAMANOS_LEGADO_PT[atributo_legado]
    return None


class _InformeHTMLParser(HTMLParser):
    """
    Convierte el HTML que produce el editor de texto enriquecido del informe
    (RichTextEditor.jsx) en una lista de flowables de ReportLab (Paragraph,
    Image, Table), preservando el orden de aparicion. Soporta: negrita,
    cursiva, subrayado, tachado, tamano y color de fuente, alineacion,
    indentacion (blockquote), listas con vinetas y numeradas, tablas simples
    e imagenes incrustadas en base64 (con alineacion heredada del bloque
    contenedor). Pensado para el HTML de nuestro propio editor, no para HTML
    arbitrario.
    """

    _NEGRITA = {'b', 'strong'}
    _CURSIVA = {'i', 'em'}
    _SUBRAYADO = {'u'}
    _TACHADO = {'strike', 's', 'del'}
    _MAPA_CIERRE = {'strong': 'b', 'b': 'b', 'em': 'i', 'i': 'i', 'u': 'u', 'strike': 'strike', 's': 'strike', 'del': 'strike'}
    _MARCA_A_TAG = {'b': 'b', 'i': 'i', 'u': 'u', 'strike': 'strike', 'font': 'font'}
    _CORTES_PARRAFO = {'p', 'div', 'li'}
    _ALINEACION_CSS = {'left': 0, 'center': 1, 'right': 2, 'justify': 4}

    def __init__(self, estilo_normal, ancho_disponible):
        super().__init__(convert_charrefs=True)
        self.estilo_normal = estilo_normal
        self.ancho_disponible = ancho_disponible
        self.flowables = []
        self._buffer = []
        self._marcas_abiertas = []
        self._alineacion_actual = estilo_normal.alignment
        self._interlineado_actual = None
        self._nivel_indent = 0
        self._pila_listas = []  # [(tipo 'ol'|'ul', contador)]
        self._en_tabla = False
        self._tabla_filas = []
        self._fila_actual = None
        self._en_celda = False
        self._celda_encabezado = False

    def _abrir_marca(self, marca):
        tag = self._MARCA_A_TAG[marca]
        self._buffer.append(f'<{tag}>')
        self._marcas_abiertas.append(marca)

    def _cerrar_marcas_pendientes(self):
        while self._marcas_abiertas:
            marca = self._marcas_abiertas.pop()
            self._buffer.append(f'</{self._MARCA_A_TAG[marca]}>')

    def _estilo_bloque_actual(self):
        leading = self.estilo_normal.leading
        if self._interlineado_actual:
            leading = round(self.estilo_normal.fontSize * self._interlineado_actual, 1)
        return ParagraphStyle(
            'BloqueInforme',
            parent=self.estilo_normal,
            alignment=self._alineacion_actual,
            leftIndent=self.estilo_normal.leftIndent + self._nivel_indent * 1 * cm,
            leading=leading,
        )

    def _flush_parrafo(self):
        self._cerrar_marcas_pendientes()
        texto = ''.join(self._buffer).strip()
        self._buffer = []
        estilo = self._estilo_bloque_actual()
        self._alineacion_actual = self.estilo_normal.alignment
        self._interlineado_actual = None
        if not texto:
            return
        try:
            self.flowables.append(Paragraph(texto, estilo))
        except Exception:
            texto_plano = escape(re.sub('<[^<]+?>', '', texto))
            if texto_plano.strip():
                self.flowables.append(Paragraph(texto_plano, estilo))

    def _aplicar_estilo_bloque(self, attrs_dict, style):
        alineacion_css = style.get('text-align') or attrs_dict.get('align')
        if alineacion_css in self._ALINEACION_CSS:
            self._alineacion_actual = self._ALINEACION_CSS[alineacion_css]
        line_height = style.get('line-height')
        if line_height:
            try:
                self._interlineado_actual = float(line_height)
            except ValueError:
                pass

    def _marcador_lista(self):
        if self._pila_listas:
            tipo, contador = self._pila_listas[-1]
            if tipo == 'ol':
                contador += 1
                self._pila_listas[-1] = (tipo, contador)
                return f'{contador}.  '
        return '•  '

    def _insertar_imagen(self, attrs_dict, alineacion):
        match = _DATA_IMG_RE.match(attrs_dict.get('src', '') or '')
        if not match:
            return
        try:
            img_bytes = base64.b64decode(match.group('data'))
            imagen = Image(io.BytesIO(img_bytes))
            max_ancho = self.ancho_disponible

            # Si el docente redimensiono la imagen en el editor (arrastrando
            # los handles de las esquinas o con un tamaño preestablecido
            # S/M/L/100%), el <img> trae style="width:...px" (o "100%") que
            # hay que respetar en vez de usar siempre el tamaño intrínseco
            # del archivo -sin esto, achicar o agrandar la imagen en el
            # editor no tenía ningún efecto en el PDF final-.
            ancho_css = _parsear_estilo_css(attrs_dict.get('style', '')).get('width')
            if ancho_css:
                ancho_css = ancho_css.strip()
                ancho_deseado = None
                if ancho_css.endswith('%'):
                    try:
                        ancho_deseado = max_ancho * (float(ancho_css[:-1]) / 100.0)
                    except ValueError:
                        ancho_deseado = None
                else:
                    # _tamano_fuente_a_pt ya devuelve puntos (convierte
                    # px->pt internamente), lista para usar como ancho.
                    ancho_deseado = _tamano_fuente_a_pt(ancho_css, None)
                if ancho_deseado and imagen.drawWidth:
                    factor = ancho_deseado / float(imagen.drawWidth)
                    imagen.drawWidth *= factor
                    imagen.drawHeight *= factor

            if imagen.drawWidth > max_ancho:
                factor = max_ancho / float(imagen.drawWidth)
                imagen.drawWidth *= factor
                imagen.drawHeight *= factor
            max_alto = 9 * cm
            if imagen.drawHeight > max_alto:
                factor = max_alto / float(imagen.drawHeight)
                imagen.drawWidth *= factor
                imagen.drawHeight *= factor
            mapa_align = {0: 'LEFT', 1: 'CENTER', 2: 'RIGHT', 4: 'LEFT'}
            imagen.hAlign = mapa_align.get(alineacion, 'LEFT')
            self.flowables.append(Spacer(1, 4))
            self.flowables.append(imagen)
            self.flowables.append(Spacer(1, 4))
        except Exception:
            self.flowables.append(Paragraph('[Imagen adjunta no válida]', self.estilo_normal))

    def _iniciar_celda(self, es_encabezado):
        self._cerrar_marcas_pendientes()
        self._buffer = []
        self._en_celda = True
        self._celda_encabezado = es_encabezado

    def _cerrar_celda(self):
        self._cerrar_marcas_pendientes()
        texto = ''.join(self._buffer).strip()
        self._buffer = []
        self._en_celda = False
        if self._celda_encabezado and texto:
            texto = f'<b>{texto}</b>'
        estilo = ParagraphStyle('CeldaTabla', parent=self.estilo_normal, alignment=0)
        try:
            celda = Paragraph(texto, estilo) if texto else ''
        except Exception:
            celda = escape(re.sub('<[^<]+?>', '', texto))
        if self._fila_actual is None:
            self._fila_actual = []
        self._fila_actual.append(celda)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs_dict = dict(attrs)
        style = _parsear_estilo_css(attrs_dict.get('style', ''))

        if tag in self._NEGRITA:
            self._abrir_marca('b')
        elif tag in self._CURSIVA:
            self._abrir_marca('i')
        elif tag in self._SUBRAYADO:
            self._abrir_marca('u')
        elif tag in self._TACHADO:
            self._abrir_marca('strike')
        elif tag in ('span', 'font'):
            if 'line-through' in style.get('text-decoration', ''):
                self._abrir_marca('strike')
            color = _normalizar_color_css(style.get('color')) or (
                _normalizar_color_css(attrs_dict.get('color')) if attrs_dict.get('color') else None
            )
            pt = _tamano_fuente_a_pt(style.get('font-size'), attrs_dict.get('size'))
            partes_font = []
            if color:
                partes_font.append(f'color="{color}"')
            if pt:
                partes_font.append(f'size="{pt}"')
            if partes_font:
                self._buffer.append(f'<font {" ".join(partes_font)}>')
                self._marcas_abiertas.append('font')
        elif tag == 'blockquote':
            self._nivel_indent += 1
        elif tag == 'ol':
            self._pila_listas.append(('ol', 0))
        elif tag == 'ul':
            self._pila_listas.append(('ul', 0))
        elif tag == 'br':
            self._buffer.append('<br/>')
        elif tag == 'table':
            self._flush_parrafo()
            self._en_tabla = True
            self._tabla_filas = []
        elif tag == 'tr' and self._en_tabla:
            self._fila_actual = []
        elif tag in ('td', 'th') and self._en_tabla:
            self._iniciar_celda(es_encabezado=(tag == 'th'))
        elif tag in ('p', 'div', 'li'):
            self._aplicar_estilo_bloque(attrs_dict, style)
            if tag == 'li':
                self._buffer.append(self._marcador_lista())
        elif tag == 'img':
            # _flush_parrafo() reinicia _alineacion_actual al valor por
            # defecto (para el próximo párrafo de texto), así que hay que
            # leer la alineación vigente (la que puso el <div>/<p> que
            # envuelve la imagen, ej. "alinear imagen a la derecha") ANTES
            # de llamarlo, o la imagen siempre queda alineada a la
            # izquierda sin importar lo que el docente eligió en el editor.
            alineacion_imagen = self._alineacion_actual
            self._flush_parrafo()
            self._insertar_imagen(attrs_dict, alineacion_imagen)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('td', 'th') and self._en_tabla:
            self._cerrar_celda()
        elif tag == 'tr' and self._en_tabla:
            if self._fila_actual is not None:
                self._tabla_filas.append(self._fila_actual)
            self._fila_actual = None
        elif tag == 'table' and self._en_tabla:
            self._finalizar_tabla()
        elif self._en_tabla and self._en_celda:
            # Formato dentro de una celda (b/i/u/font sobre texto de la tabla).
            if tag in self._MAPA_CIERRE:
                objetivo = self._MAPA_CIERRE[tag]
                if objetivo in self._marcas_abiertas:
                    self._marcas_abiertas.remove(objetivo)
                    self._buffer.append(f'</{self._MARCA_A_TAG[objetivo]}>')
            elif tag in ('span', 'font') and 'font' in self._marcas_abiertas:
                for i in range(len(self._marcas_abiertas) - 1, -1, -1):
                    if self._marcas_abiertas[i] == 'font':
                        del self._marcas_abiertas[i]
                        self._buffer.append('</font>')
                        break
        elif tag in self._CORTES_PARRAFO:
            self._flush_parrafo()
        elif tag == 'blockquote':
            self._nivel_indent = max(0, self._nivel_indent - 1)
        elif tag in ('ol', 'ul'):
            if self._pila_listas:
                self._pila_listas.pop()
        elif tag in self._MAPA_CIERRE:
            objetivo = self._MAPA_CIERRE[tag]
            if objetivo in self._marcas_abiertas:
                self._marcas_abiertas.remove(objetivo)
                self._buffer.append(f'</{self._MARCA_A_TAG[objetivo]}>')
        elif tag in ('span', 'font') and 'font' in self._marcas_abiertas:
            # Cierra el <font> mas reciente abierto por este span/font.
            for i in range(len(self._marcas_abiertas) - 1, -1, -1):
                if self._marcas_abiertas[i] == 'font':
                    del self._marcas_abiertas[i]
                    self._buffer.append('</font>')
                    break

    def _finalizar_tabla(self):
        self._en_tabla = False
        filas = self._tabla_filas
        self._tabla_filas = []
        if not filas:
            return
        num_cols = max(len(f) for f in filas)
        for fila in filas:
            while len(fila) < num_cols:
                fila.append('')
        try:
            ancho_col = self.ancho_disponible / num_cols
            tabla = Table(filas, colWidths=[ancho_col] * num_cols)
            tabla.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.93, 0.93, 0.93)),
            ]))
            self.flowables.append(Spacer(1, 4))
            self.flowables.append(tabla)
            self.flowables.append(Spacer(1, 4))
        except Exception:
            pass

    def handle_data(self, data):
        if data:
            self._buffer.append(escape(data))

    def obtener_flowables(self):
        self._flush_parrafo()
        return self.flowables

class FondoPDFGenerator:
    def __init__(self, buffer):
        self.buffer = buffer
        self.styles = getSampleStyleSheet()
        self.width, self.height = landscape(LETTER)
        self.margin = 1.5 * cm

    def _get_estilo_titulo(self):
        return ParagraphStyle(
            'TituloInforme',
            parent=self.styles['Heading1'],
            fontSize=10,
            alignment=1, # Centrado
            spaceAfter=6,
            fontName='Helvetica-Bold'
        )

    def _get_estilo_normal(self):
        return ParagraphStyle(
            'TextoNormal',
            parent=self.styles['Normal'],
            fontSize=8,
            leading=10,
            alignment=4 # Justificado
        )
    
    def _get_estilo_celda(self):
        return ParagraphStyle(
            'TextoCelda',
            parent=self.styles['Normal'],
            fontSize=7, 
            leading=8,
            alignment=0 # Izquierda
        )

    def _get_estilo_celda_center(self):
        return ParagraphStyle(
            'TextoCeldaCenter',
            parent=self.styles['Normal'],
            fontSize=7, 
            leading=8,
            alignment=1 # Centrado
        )

    def _limpiar_texto(self, texto):
        if not texto or str(texto) == 'None':
            return "-"
        return str(texto).replace('\n', '<br/>')

    def _duracion_horas(self, hora_inicio, hora_fin):
        if not hora_inicio or not hora_fin:
            return 0.0
        dt_inicio = datetime.combine(date.today(), hora_inicio)
        dt_fin = datetime.combine(date.today(), hora_fin)
        return max((dt_fin - dt_inicio).total_seconds() / 3600.0, 0.0)

    def _agrupar_horarios_contiguos(self, cargas_docencia):
        orden_dias = {
            'lunes': 1,
            'martes': 2,
            'miercoles': 3,
            'jueves': 4,
            'viernes': 5,
            'sabado': 6,
        }

        cargas_ordenadas = sorted(
            cargas_docencia,
            key=lambda c: (
                orden_dias.get(c.dia_semana, 99),
                c.hora_inicio,
                c.materia_id or 0,
                c.paralelo,
                (c.aula or '').strip().lower(),
            ),
        )

        bloques = []
        for carga in cargas_ordenadas:
            materia_nombre = f"{carga.materia.sigla} - {carga.materia.nombre}" if carga.materia else "Sin materia"
            aula_norm = (carga.aula or '').strip()
            paralelo = (carga.paralelo or '').strip()

            if not bloques:
                bloques.append({
                    'dia_semana': carga.dia_semana,
                    'materia_id': carga.materia_id,
                    'materia': materia_nombre,
                    'paralelo': paralelo,
                    'aula': aula_norm,
                    'hora_inicio': carga.hora_inicio,
                    'hora_fin': carga.hora_fin,
                })
                continue

            ultimo = bloques[-1]
            es_contiguo = (
                ultimo['dia_semana'] == carga.dia_semana
                and ultimo['materia_id'] == carga.materia_id
                and ultimo['paralelo'] == paralelo
                and (ultimo['aula'] or '').lower() == aula_norm.lower()
                and ultimo['hora_fin'] == carga.hora_inicio
            )

            if es_contiguo:
                ultimo['hora_fin'] = carga.hora_fin
            else:
                bloques.append({
                    'dia_semana': carga.dia_semana,
                    'materia_id': carga.materia_id,
                    'materia': materia_nombre,
                    'paralelo': paralelo,
                    'aula': aula_norm,
                    'hora_inicio': carga.hora_inicio,
                    'hora_fin': carga.hora_fin,
                })

        for bloque in bloques:
            bloque['horas'] = self._duracion_horas(bloque['hora_inicio'], bloque['hora_fin'])

        return bloques

    def _dedicacion_docente(self, fondo):
        """Devuelve (texto, abreviatura_o_vacio) de la dedicación vigente del
        docente en esta carrera, ej. ('Tiempo Completo', 'T.C.')."""
        if not (fondo.docente and fondo.carrera):
            return ('', '')
        from fondos.models import DocenteCarrera
        vinculo = DocenteCarrera.objects.filter(
            docente=fondo.docente, carrera=fondo.carrera, activo=True,
        ).first()
        if not vinculo:
            return ('', '')
        return (vinculo.get_dedicacion_display(), _ABREVIATURA_DEDICACION.get(vinculo.dedicacion, ''))

    def _crear_clase_canvas_pie(self):
        """
        Fabrica una subclase de Canvas que dibuja, en CADA pagina, una linea
        fina y la numeracion "Pagina X de Y" en el pie. Se dibuja dentro del
        margen inferior existente (1.5cm), sin agrandarlo: la firma del
        docente NO se dibuja aca (ver comentario en generar_pdf) para evitar
        que una posicion fija por canvas se superponga con el contenido de
        la tabla cuando esta ocupa toda la ultima pagina.
        """
        ancho_pagina, alto_pagina = self.width, self.height
        margen_lateral = 1.5 * cm

        class _CanvasPie(pdfgen_canvas.Canvas):
            def __init__(self_c, *args, **kwargs):
                pdfgen_canvas.Canvas.__init__(self_c, *args, **kwargs)
                self_c._paginas_guardadas = []

            def showPage(self_c):
                self_c._paginas_guardadas.append(dict(self_c.__dict__))
                self_c._startPage()

            def save(self_c):
                total_paginas = len(self_c._paginas_guardadas)
                for estado in self_c._paginas_guardadas:
                    self_c.__dict__.update(estado)
                    _CanvasPie._dibujar_pie(self_c, total_paginas)
                    pdfgen_canvas.Canvas.showPage(self_c)
                pdfgen_canvas.Canvas.save(self_c)

            @staticmethod
            def _dibujar_pie(c, total_paginas):
                c.saveState()
                pagina_actual = c.getPageNumber()
                c.setLineWidth(0.6)
                c.setStrokeColor(colors.HexColor('#94a3b8'))
                c.line(margen_lateral, 0.95*cm, ancho_pagina - margen_lateral, 0.95*cm)
                c.setFont('Helvetica', 7)
                c.setFillColor(colors.black)
                c.drawCentredString(ancho_pagina / 2.0, 0.6*cm, f'Página {pagina_actual} de {total_paginas}')
                c.restoreState()

        return _CanvasPie

    def generar_pdf(self, fondo):
        # 1. Configuración de Página
        # Sin membrete ni numeracion de pagina repetidos por pagina: este
        # documento (tabla de horas) ya trae el encabezado institucional
        # completo en su propio título/tabla de cabecera en la pagina 1. El
        # membrete institucional en cada pagina vive en el otro documento
        # (InformePDFGenerator, la carta del Informe de Cumplimiento).
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=landscape(LETTER),
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )
        
        elementos = []

        # --- TÍTULO PRINCIPAL ---
        carrera_titulo = fondo.carrera.nombre.upper() if fondo.carrera else "INGENIERÍA DE SISTEMAS"
        titulo_texto = f"FONDO DE TIEMPO - CARRERA DE {carrera_titulo}"
        elementos.append(Paragraph(titulo_texto, self._get_estilo_titulo()))
        elementos.append(Spacer(1, 0.3*cm))

        estilo_normal = self._get_estilo_normal()
        estilo_celda_center = self._get_estilo_celda_center()
        estilo_celda = self._get_estilo_celda()

        # --- 2. CABECERA ---
        
        # Mismo tamaño de letra en todo el encabezado (Universidad/Facultad/
        # Carrera, Docente/Asignatura/Tiempo de dedicación, y el resumen de
        # horas de la Columna 3), tomando como referencia "Docente: ...".
        estilo_header_bold = ParagraphStyle('HeaderBold', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=8, alignment=1, leading=9)
        estilo_docente_label = ParagraphStyle('DocenteLabel', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=8, alignment=0, leading=9)
        estilo_docente_val_right = ParagraphStyle('DocenteValRight', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=8, alignment=2, leading=9)
        estilo_docente_actividad = ParagraphStyle('DocenteActividad', parent=estilo_docente_label, leftIndent=1.5*cm)
        estilo_tabla_col3 = ParagraphStyle('TablaCol3', parent=estilo_normal, fontSize=8, alignment=1, leading=9)
        # Relleno casi sin alto para la 2da columna de las filas de
        # espaciador de la Columna 2 (ver espacio_fila0_col2/espacio_col2 mas
        # abajo): un '' comun en una celda de tabla se envuelve en un
        # Paragraph con el estilo por defecto de ReportLab (~18pt de alto),
        # que termina fijando el alto de TODA la fila por encima del
        # Spacer(altura chica) puesto en la otra columna.
        estilo_relleno_minimo = ParagraphStyle('RellenoMinimo', fontSize=1, leading=1)

        # Columna 3 (se arma primero: su altura por fila se usa para alinear
        # "Carrera de ..." y "Tiempo de dedicación: ..." con la fila de
        # "Feriados Nacionales y Locales", ver mas abajo).
        # Sincronización de Clases Aula (Total de horas anuales asignadas por Jefatura)
        total_clases_aula = CargaHoraria.objects.filter(
            docente=fondo.docente, 
            calendario=fondo.calendario_academico, 
            categoria='academica'
        ).aggregate(total=Sum('horas'))['total'] or 0
        total_clases_aula = float(total_clases_aula)

        horas_contrato = fondo.contrato_horas
        horas_vacacion = fondo.horas_vacacion
        horas_feriados = fondo.horas_feriados
        horas_efectivas = float(fondo.horas_efectivas)
        
        dias_vacacion = fondo.docente.calcular_dias_vacacion(fondo.gestion) if fondo.docente else 0
        semanas_clase = SEMANAS_CLASES_AULA
        funciones_sustantivas = horas_efectivas - total_clases_aula

        def p_c3(txt, align=1, bold=False):
            font = 'Helvetica-Bold' if bold else 'Helvetica'
            return Paragraph(str(txt), ParagraphStyle('p3', parent=estilo_tabla_col3, alignment=align, fontName=font))

        col3_data = [
            ['', p_c3('Semanas/Año'), p_c3('Hrs/Año')],
            [p_c3('Contrato:', 2, True), p_c3('52'), p_c3(_formato_es(horas_contrato))],
            [p_c3('Clases Aula:', 2, True), p_c3(_formato_es(semanas_clase)), p_c3(_formato_es(total_clases_aula))],
            [p_c3('Funciones Sustantivas:', 2, True), '', p_c3(_formato_es(funciones_sustantivas))],
            [p_c3('Vacación(días):', 2, True), p_c3(_formato_es(dias_vacacion)), p_c3(_formato_es(horas_vacacion))],
            [p_c3('Feriados Nacionales y Locales:', 2, True), '', p_c3(_formato_es(horas_feriados))],
            [p_c3('<font backColor="#9CC2E5">Horas efectivas</font>', 2, True), '', p_c3(_formato_es(horas_efectivas), 1, True)]
        ]
        
        col3_table = Table(col3_data, colWidths=[4.2*cm, 2.0*cm, 2.0*cm])
        col3_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 1),
            ('RIGHTPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#E6B8B7')),
            ('BACKGROUND', (1, 4), (1, 4), colors.HexColor('#C4D79B')),
        ]))

        # Altura real (ya calculada por ReportLab) de las filas de la Columna
        # 3 hasta la fila de "Feriados Nacionales y Locales" (indice 5 de
        # col3_data), sin contarla. Se usa para que "Carrera de ..." (Columna
        # 1) y "Tiempo de dedicación: ..." (Columna 2) arranquen exactamente
        # a esa altura, sin importar cuantas lineas tenga cada columna.
        col3_table.wrap(4.2*cm + 2.0*cm + 2.0*cm, 1000*cm)
        altura_hasta_feriados = sum(col3_table._rowHeights[:5])

        # Columna 1
        facultad_texto = fondo.carrera.facultad.title() if fondo.carrera else "Facultad de Ingeniería y Tecnología"
        carrera_texto = fondo.carrera.nombre.title() if fondo.carrera else "Carrera"
        nombre_docente = fondo.docente.nombre_completo.title() if fondo.docente else "Docente"

        # "Universidad Autónoma del Beni José Ballivián" es larga y puede
        # ocupar 2 líneas dentro del ancho de la Columna 1, mientras que
        # "Docente: ..." (Columna 2) normalmente ocupa 1 sola. Sin corregir
        # esto, "Facultad de..." y "Asignatura: ..." no arrancarían en la
        # misma línea. Se mide la altura real de cada una y se agrega un
        # espaciador a la mas corta para emparejarlas.
        _fila_universidad_medida = Table(
            [[Paragraph("Universidad Autónoma del Beni José Ballivián", estilo_header_bold)]],
            colWidths=[5.5*cm],
        )
        _fila_universidad_medida.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        _, altura_universidad = _fila_universidad_medida.wrap(5.5*cm, 1000*cm)

        _fila_docente_medida = Table(
            [[Paragraph(f"Docente: {nombre_docente}", estilo_docente_label), '']],
            colWidths=[5.5*cm, 4.5*cm],
        )
        _fila_docente_medida.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0.2*cm), ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1), ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        _, altura_docente = _fila_docente_medida.wrap(5.5*cm + 4.5*cm, 1000*cm)

        # Cada espaciador se inserta como su PROPIA fila de tabla, que a su
        # vez tiene su propio TOPPADDING+BOTTOMPADDING (1pt, ver estilos mas
        # abajo): hay que restarlo del alto pedido o el hueco real queda 1pt
        # mas grande que lo calculado.
        _padding_fila_extra = 1
        altura_fila_superior = max(altura_universidad, altura_docente)
        espacio_fila0_col1 = max(0, altura_fila_superior - altura_universidad - _padding_fila_extra)
        espacio_fila0_col2 = max(0, altura_fila_superior - altura_docente - _padding_fila_extra)

        col1_previo = Table(
            [
                [Paragraph("Universidad Autónoma del Beni José Ballivián", estilo_header_bold)],
                [Spacer(1, espacio_fila0_col1)],
                [Paragraph(facultad_texto, estilo_header_bold)],
            ],
            colWidths=[5.5*cm],
        )
        # Mismo padding que col1_table mas abajo: sin esto, Table usa su
        # padding por defecto (mas grande) y la altura medida queda
        # sobreestimada, dejando muy corto el espaciador calculado.
        col1_previo.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        col1_previo.wrap(5.5*cm, 1000*cm)
        espacio_col1 = max(0, altura_hasta_feriados - sum(col1_previo._rowHeights) - _padding_fila_extra)

        col1_data = [
            [Paragraph("Universidad Autónoma del Beni José Ballivián", estilo_header_bold)],
            [Spacer(1, espacio_fila0_col1)],
            [Paragraph(facultad_texto, estilo_header_bold)],
            [Spacer(1, espacio_col1)],
            [Paragraph(f"Carrera de {carrera_texto}", estilo_header_bold)],
        ]
        col1_table = Table(col1_data, colWidths=[5.5*cm])
        col1_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))

        # Columna 2
        rows_docente = []
        rows_docente.append([Paragraph(f"Docente: {nombre_docente}", estilo_docente_label), ''])
        rows_docente.append([Spacer(1, espacio_fila0_col2), Paragraph('', estilo_relleno_minimo)])

        # Asignaturas: solo nombres, en formato normal (no mayusculas) y sin
        # codigos, una por linea. Una misma materia puede tener varios
        # registros de CargaHoraria (un horario por cada dia/bloque de la
        # semana), por eso se deduplica por (materia, paralelo) en vez de
        # listar cada registro. El paralelo solo se muestra cuando no es el
        # unico/por defecto ('A'), igual que en el documento de referencia.
        cargas_docencia = CargaHoraria.objects.filter(
            docente=fondo.docente,
            calendario=fondo.calendario_academico,
            categoria='academica',
        ).select_related('materia')

        materias_vistas = set()
        asignaturas_list = []
        for carga in cargas_docencia:
            clave = (carga.materia_id, carga.paralelo)
            if clave in materias_vistas:
                continue
            materias_vistas.add(clave)
            if not carga.materia:
                asignaturas_list.append(('Sin materia', None))
                continue
            nombre_materia = carga.materia.nombre.title()
            if carga.paralelo and carga.paralelo != 'A':
                nombre_completo = f"{nombre_materia} - {carga.paralelo}"
            else:
                nombre_completo = nombre_materia
            asignaturas_list.append((nombre_completo, carga.materia.horas_totales))

        # Ancho real de la columna de contenido de t_asig (colWidths mas
        # abajo: [1.8*cm, 7.8*cm]), usado para calcular cuantos puntos hacen
        # falta para que "N Hrs/Sem" quede alineado al borde derecho.
        ANCHO_CONTENIDO_ASIGNATURA = 7.8 * cm
        lineas_asignaturas = []
        for nombre, horas_sem in asignaturas_list:
            if horas_sem is None:
                lineas_asignaturas.append(escape(nombre))
            else:
                lineas_asignaturas.append(_linea_con_leader(
                    nombre, f"{_formato_es(horas_sem)} Hrs/Sem", ANCHO_CONTENIDO_ASIGNATURA,
                ))
        if lineas_asignaturas:
            asignatura_texto = "<br/>".join(lineas_asignaturas)
        else:
            asignatura_texto = escape(str(fondo.asignatura or "Sin asignaturas")).replace('\n', '<br/>')

        # Tabla anidada para alineación (Label | Contenido)
        lbl_asig = Paragraph("Asignatura:", estilo_docente_label)
        val_asig = Paragraph(asignatura_texto, estilo_docente_label)
        t_asig = Table([[lbl_asig, val_asig]], colWidths=[1.8*cm, 7.8*cm])
        t_asig.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        rows_docente.append([t_asig, ''])

        # BUGFIX 2026-09-13: 'dedicacion' ya no vive en Docente, se movio a
        # DocenteCarrera (vinculo docente+carrera) en un refactor posterior.
        # `fondo.docente.get_dedicacion_display()` ya no existe y rompia la
        # generacion del PDF con AttributeError para cualquier fondo.
        vinculo_docente_carrera = None
        if fondo.docente and fondo.carrera:
            from fondos.models import DocenteCarrera
            vinculo_docente_carrera = DocenteCarrera.objects.filter(
                docente=fondo.docente, carrera=fondo.carrera, activo=True
            ).first()
        dedicacion_texto = vinculo_docente_carrera.get_dedicacion_display() if vinculo_docente_carrera else "-"
        horas_dedicacion = vinculo_docente_carrera.horas_semanales_maximas if vinculo_docente_carrera else None

        # Altura real ya ocupada por Docente + Asignatura (esta ultima varia
        # segun cuantas materias dicte el docente), para completar el
        # espacio exacto que falta hasta la altura de "Feriados...".
        # list(rows_docente) para no compartir la misma lista interna que
        # luego se le siguen agregando filas (el Spacer y "Tiempo de
        # dedicación..."): Table conserva una referencia a la lista que
        # recibe, no una copia.
        col2_previo = Table(list(rows_docente), colWidths=[5.5*cm, 4.5*cm])
        # Mismo padding y SPAN que col2_table mas abajo, por la misma razon
        # que en col1_previo: si no coincide el padding, la altura medida no
        # sirve para calcular el espaciador.
        col2_previo.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0.2*cm),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('SPAN', (0,2), (1,2)),
        ]))
        col2_previo.wrap(5.5*cm + 4.5*cm, 1000*cm)
        espacio_col2 = max(0, altura_hasta_feriados - sum(col2_previo._rowHeights) - _padding_fila_extra)

        rows_docente.append([Spacer(1, espacio_col2), Paragraph('', estilo_relleno_minimo)])

        # Ancho disponible para "dedicacion_texto ..... N Hrs/Sem": todo el
        # ancho de la fila (SPAN de las 2 columnas, ver TableStyle mas abajo)
        # menos el LEFTPADDING de la fila y el texto fijo de la etiqueta.
        etiqueta_dedicacion = "Tiempo de dedicación: "
        if horas_dedicacion:
            ancho_valor_dedicacion = (
                (5.5 + 4.5) * cm - 0.2 * cm
                - stringWidth(etiqueta_dedicacion, 'Helvetica-Bold', 8)
            )
            valor_dedicacion = _linea_con_leader(
                dedicacion_texto, f"{_formato_es(horas_dedicacion)} Hrs/Sem",
                ancho_valor_dedicacion, font_name='Helvetica', font_size=8,
            )
        else:
            valor_dedicacion = escape(dedicacion_texto)
        rows_docente.append([Paragraph(f'{etiqueta_dedicacion}<font face="Helvetica">{valor_dedicacion}</font>', estilo_docente_label), ''])

        col2_table = Table(rows_docente, colWidths=[5.5*cm, 4.5*cm])
        col2_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0.2*cm),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('SPAN', (0,2), (1,2)),
            ('SPAN', (0,-1), (1,-1)),
        ]))

        tabla_cabecera = Table([[col1_table, col2_table, col3_table]], colWidths=[5.7*cm, 10.0*cm, 8.8*cm])
        tabla_cabecera.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (0,0), (0,-1), 'LEFT'),
            ('ALIGN', (1,0), (1,-1), 'CENTER'),
            ('ALIGN', (2,0), (2,-1), 'RIGHT'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        tabla_cabecera.hAlign = 'CENTER'
        elementos.append(tabla_cabecera)
        elementos.append(Spacer(1, 15))

        # --- 2.1 HORARIO SEMANAL (LUNES A SÁBADO) ---
        # BUGFIX 2026-09-13: la mayoria de CargaHoraria se carga con horas
        # anuales totales por actividad, sin hora_inicio/hora_fin (esos
        # campos solo se usan si alguien arma un horario semanal detallado).
        # Antes se pasaban TODAS las cargas aca, y _agrupar_horarios_contiguos
        # devolvia bloques con hora_inicio/hora_fin en None, que luego
        # tronaban al hacer .strftime(). Ahora solo se arma la grilla con las
        # cargas que sí tienen horario cargado; el resto simplemente no
        # aparece en esta tabla (sus horas anuales igual se cuentan en el
        # resto del documento).
        cargas_horario = [
            c for c in cargas_docencia.select_related('materia')
            if c.hora_inicio and c.hora_fin
        ]
        bloques_horario = self._agrupar_horarios_contiguos(cargas_horario)

        estilo_horario_header = ParagraphStyle(
            'HorarioHeader',
            parent=estilo_celda_center,
            fontSize=7,
            fontName='Helvetica-Bold',
        )
        estilo_horario_celda = ParagraphStyle(
            'HorarioCelda',
            parent=estilo_celda,
            fontSize=7,
            leading=8,
        )

        # Si el docente no tiene ningun bloque con horario detallado (caso
        # frecuente: la mayoria de CargaHoraria solo trae horas anuales, sin
        # hora_inicio/hora_fin), esta tabla no aporta nada y solo estorba con
        # una fila "Sin asignaciones horarias" — se omite por completo.
        if bloques_horario:
            datos_horario = [[
                Paragraph('Día', estilo_horario_header),
                Paragraph('Horario', estilo_horario_header),
                Paragraph('Materia', estilo_horario_header),
                Paragraph('Paralelo', estilo_horario_header),
                Paragraph('Aula', estilo_horario_header),
                Paragraph('Horas', estilo_horario_header),
            ]]
            for bloque in bloques_horario:
                datos_horario.append([
                    Paragraph((bloque['dia_semana'] or '-').capitalize(), estilo_horario_celda),
                    Paragraph(f"{bloque['hora_inicio'].strftime('%H:%M')} - {bloque['hora_fin'].strftime('%H:%M')}", estilo_horario_celda),
                    Paragraph(self._limpiar_texto(bloque['materia']), estilo_horario_celda),
                    Paragraph(self._limpiar_texto(bloque['paralelo'] or '-'), estilo_horario_celda),
                    Paragraph(self._limpiar_texto(bloque['aula'] or '-'), estilo_horario_celda),
                    Paragraph(f"{bloque['horas']:.2f}", estilo_horario_celda),
                ])

            tabla_horario = Table(
                datos_horario,
                colWidths=[2.0*cm, 3.2*cm, 9.0*cm, 2.2*cm, 4.0*cm, 2.0*cm],
                repeatRows=1,
            )
            tabla_horario.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-1), 0.5, colors.black),
                ('BACKGROUND', (0,0), (-1,0), colors.Color(0.9, 0.9, 0.9)),
                ('ALIGN', (0,0), (1,-1), 'CENTER'),
                ('ALIGN', (3,0), (5,-1), 'CENTER'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('LEFTPADDING', (0,0), (-1,-1), 3),
                ('RIGHTPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ]))
            tabla_horario.hAlign = 'CENTER'

            elementos.append(Paragraph('<b>HORARIO SEMANAL (LUNES A SÁBADO)</b>', estilo_celda_center))
            elementos.append(Spacer(1, 0.15*cm))
            elementos.append(tabla_horario)
            elementos.append(Spacer(1, 0.35*cm))

        # --- 3. CUERPO: TABLA DE ACTIVIDADES (agrupada por tipo de actividad) ---
        # Cada tipo_actividad de CargaHoraria puede tener VARIOS registros
        # (p. ej. un bloque semanal por cada dia que se dicta una materia, o
        # varias entradas de la misma sub-actividad). Antes se listaba UN
        # renglon por registro, lo que producia listas de decenas de filas
        # repitiendo la misma asignatura/actividad. Ahora se agrupan por
        # tipo_actividad y se suman sus horas en una sola fila por tipo.

        headers_1 = ['N°', 'INDICADORES', '', 'Hrs/Sem', 'Hrs/Año', 'Total\nHrs/Año', '%', 'Evidencias']
        headers_2 = ['', 'ITEM', 'DETALLE', '', '', '', '', '']
        # Ancho total = 21.3cm, con margen de sobra dentro de los 24.94cm
        # utiles de la pagina (27.94cm de ancho - 1.5cm de margen a cada
        # lado): antes sumaba 24.5cm, dejando solo 0.44cm de holgura, lo que
        # hacia que la columna "Total Hrs/Año" se desbordara del margen en
        # paginas donde el encabezado se repite (repeatRows=1).
        col_widths = [0.7*cm, 2.7*cm, 7.3*cm, 1.1*cm, 1.1*cm, 1.5*cm, 0.9*cm, 6.0*cm]

        datos_tabla = [headers_1, headers_2]

        categorias = fondo.categorias.all().order_by('id')
        # El % de cada categoria se calcula sobre las horas efectivas totales
        # del fondo (su cupo anual, p. ej. 1712), no sobre la suma de lo
        # asignado: asi el reporte muestra cuanto del cupo cubre cada una.
        total_horas_efectivas = float(fondo.horas_efectivas) or 1
        suma_asignada_global = 0.0

        # ESTILOS INICIALES (SIN GRID EN EL CUERPO)
        estilos_tabla = [
            ('BOX', (0,0), (-1,-1), 0.5, colors.black), # Borde exterior
            ('INNERGRID', (0,0), (-1,1), 0.5, colors.black), # Headers internos (evita duplicar BOX)
            ('LINEBELOW', (0,1), (-1,1), 0.5, colors.black), # Línea inferior headers
            ('LINEAFTER', (0,0), (0,1), 0.5, colors.Color(0.9, 0.9, 0.9)), # Ocultar linea entre N e ITEM en header
            ('LINEAFTER', (0,2), (-2,-2), 0.5, colors.black), # Líneas verticales internas (desde col 0, incluye N°)
            ('BACKGROUND', (0,0), (-1,1), colors.Color(0.9, 0.9, 0.9)),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('ALIGN', (2,2), (2,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('FONTNAME', (0,0), (-1,1), 'Helvetica-Bold'),

            # SPANS HEADER
            ('SPAN', (0,0), (0,1)), ('SPAN', (1,0), (2,0)),
            ('SPAN', (3,0), (3,1)), ('SPAN', (4,0), (4,1)),
            ('SPAN', (5,0), (5,1)), ('SPAN', (6,0), (6,1)),
            ('SPAN', (7,0), (7,1)),
        ]

        cat_index = 1
        row_cursor = 2

        for cat in categorias:
            cargas_cat = CargaHoraria.objects.filter(
                docente=fondo.docente, calendario=fondo.calendario_academico, categoria=cat.tipo,
            ).select_related('materia').order_by('id')

            # Agrupar por tipo_actividad: una fila por tipo, con la suma de
            # horas de todos los registros de ese tipo.
            grupos = {}
            orden_claves = []
            for carga in cargas_cat:
                clave = (carga.tipo_actividad or '').strip() or f'sin_tipo_{carga.id}'
                if clave not in grupos:
                    grupos[clave] = {'etiqueta': _etiqueta_tipo_actividad(cat.tipo, carga), 'horas': 0.0, 'evidencia': ''}
                    orden_claves.append(clave)
                grupo = grupos[clave]
                grupo['horas'] += float(carga.horas)
                if not grupo['evidencia']:
                    grupo['evidencia'] = (carga.documento_respaldo or '').strip() or (carga.evidencias or '').strip()

            filas_categoria = [grupos[clave] for clave in orden_claves]
            n_filas = len(filas_categoria)
            total_cat = sum(fila['horas'] for fila in filas_categoria)
            suma_asignada_global += total_cat
            porc_cat = (total_cat / total_horas_efectivas) * 100
            nombre_cat = cat.get_tipo_display().upper()
            semanas_divisor = SEMANAS_CLASES_AULA if cat.tipo == 'academica' else SEMANAS_GESTION_NO_ACADEMICA

            if n_filas > 0:
                start_row = row_cursor
                end_row = row_cursor + n_filas - 1

                for idx, fila in enumerate(filas_categoria):
                    es_primera = (idx == 0)
                    es_ultima = (idx == n_filas - 1)

                    anual = fila['horas']
                    hs = anual / semanas_divisor if semanas_divisor else 0
                    detalle = self._limpiar_texto(fila['etiqueta'])
                    evidencia_texto = self._limpiar_texto(fila['evidencia']) if fila['evidencia'] else "-"

                    curr_row = start_row + idx

                    if es_primera:
                        # Ponemos el TOTAL y % solo en la primera celda
                        row = [
                            f"{cat_index}",
                            Paragraph(f"<b>{nombre_cat}</b>", self._get_estilo_celda_center()),
                            Paragraph(detalle, self._get_estilo_celda()),
                            _formato_es(hs),
                            _formato_es(anual),
                            _formato_es(total_cat), # DATO
                            _formato_es(porc_cat), # DATO
                            Paragraph(evidencia_texto, self._get_estilo_celda())
                        ]
                    else:
                        # Dejamos vacías las celdas de Total y %
                        row = ['', '', Paragraph(detalle, self._get_estilo_celda()), _formato_es(hs), _formato_es(anual), '', '', Paragraph(evidencia_texto, self._get_estilo_celda())]

                    datos_tabla.append(row)

                    # --- LÓGICA DE BORDES HORIZONTALES (CLAVE PARA EL DISEÑO) ---
                    if es_ultima:
                        # Si es la última fila de la categoría, cerramos con línea completa
                        estilos_tabla.append(('LINEBELOW', (0, curr_row), (-1, curr_row), 0.5, colors.black))
                    else:
                        # Si es intermedia, dibujamos línea SALTEANDO las columnas fusionadas
                        # Dibujamos bajo Detalle, Hs, Sem (Cols 2,3,4)
                        estilos_tabla.append(('LINEBELOW', (2, curr_row), (4, curr_row), 0.5, colors.black))
                        # Dibujamos bajo Evidencias (Col 7)
                        estilos_tabla.append(('LINEBELOW', (7, curr_row), (7, curr_row), 0.5, colors.black))
                        # IMPORTANTE: NO dibujamos línea bajo 0 (N), 1 (Item), 5 (Total), 6 (%)
                        # Esto hace que visualmente se vean unidas.

                # --- FUSIÓN VERTICAL (SPAN) ---
                estilos_tabla.append(('SPAN', (0, start_row), (0, end_row))) # N°
                estilos_tabla.append(('SPAN', (1, start_row), (1, end_row))) # ITEM
                estilos_tabla.append(('SPAN', (5, start_row), (5, end_row))) # TOT
                estilos_tabla.append(('SPAN', (6, start_row), (6, end_row))) # %

                # Alineación Vertical
                estilos_tabla.append(('VALIGN', (0, start_row), (1, end_row), 'MIDDLE'))
                estilos_tabla.append(('VALIGN', (5, start_row), (6, end_row), 'MIDDLE'))

                row_cursor += n_filas
            else:
                # Caso vacío
                row = [f"{cat_index}", Paragraph(f"<b>{nombre_cat}</b>", self._get_estilo_celda_center()), Paragraph("Sin actividades", self._get_estilo_celda()), "-", "-", "0", "0%", "-"]
                datos_tabla.append(row)
                estilos_tabla.append(('LINEBELOW', (0, row_cursor), (-1, row_cursor), 0.5, colors.black))
                row_cursor += 1

            cat_index += 1

        # Total General
        row_total = ['TOTAL HORAS', '', '', '', '', f"{int(suma_asignada_global)}", '100', '']
        datos_tabla.append(row_total)
        estilos_tabla.append(('FONTNAME', (0, row_cursor), (-1, row_cursor), 'Helvetica-Bold'))
        estilos_tabla.append(('BACKGROUND', (0, row_cursor), (-1, row_cursor), colors.Color(0.95, 0.95, 0.95)))
        # Fusionar columnas 0 y 1 para eliminar la línea vertical entre ellas
        estilos_tabla.append(('SPAN', (0, row_cursor), (1, row_cursor)))
        estilos_tabla.append(('INNERGRID', (0, row_cursor), (-1, row_cursor), 0.5, colors.black))

        # Sin repeatRows: el encabezado (N°, INDICADORES, Hrs/Sem...) solo va
        # una vez al inicio de la tabla, no se repite al pasar de pagina.
        tabla_actividades = Table(datos_tabla, colWidths=col_widths)
        tabla_actividades.setStyle(TableStyle(estilos_tabla))
        tabla_actividades.hAlign = 'CENTER'
        elementos.append(tabla_actividades)
        
        # --- 4. FIRMA DEL DOCENTE ---
        # Solo el docente firma este documento (ya no el Director). Se
        # agrega como flowable alineado a la derecha -no dibujado por canvas
        # en una posicion fija- para que ReportLab la empuje a una pagina
        # nueva si no entra, en vez de arriesgar que se superponga con la
        # ultima fila de la tabla cuando esta llena toda la pagina.
        nombre_docente_firma = fondo.docente.nombre_completo.title() if fondo.docente else 'Sin docente asignado'
        dedicacion_texto_firma, dedicacion_abrev_firma = self._dedicacion_docente(fondo)
        rotulo_docente = f'DOCENTE {dedicacion_abrev_firma}'.strip() if dedicacion_abrev_firma else 'DOCENTE'

        estilo_firma = ParagraphStyle('FirmaDocente', parent=estilo_celda_center, fontSize=8, leading=10)
        tabla_firma = Table(
            [
                [Paragraph('_______________________________', estilo_firma)],
                [Paragraph(escape(nombre_docente_firma), estilo_firma)],
                [Paragraph(escape(rotulo_docente), estilo_firma)],
            ],
            colWidths=[7.5*cm],
        )
        tabla_firma.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        tabla_firma.hAlign = 'RIGHT'
        elementos.append(Spacer(1, 0.8*cm))
        elementos.append(tabla_firma)

        doc.build(elementos, canvasmaker=self._crear_clase_canvas_pie())

    @staticmethod
    def generar_reporte_individual(fondo):
        buffer = io.BytesIO()
        reporte = FondoPDFGenerator(buffer)
        reporte.generar_pdf(fondo)
        buffer.seek(0)
        return buffer


_ABREVIATURA_DEDICACION = {
    'tiempo_completo': 'T.C.',
    'medio_tiempo': 'M.T.',
    'dedicacion_exclusiva': 'D.E.',
}


class InformePDFGenerator:
    """
    Genera la carta institucional narrativa del Informe de Fondo de Tiempo
    (las 7 secciones que redacta el docente en RichTextEditor), como un
    documento de carta formal en tamaño carta vertical -distinto del reporte
    de horas de FondoPDFGenerator, que es una tabla en tamaño oficio
    horizontal-. Reutiliza _InformeHTMLParser para que negrita, cursiva,
    tachado, alineacion, listas, tablas e imagenes incrustadas en base64 se
    rendericen igual que en el editor.
    """

    def __init__(self, buffer):
        self.buffer = buffer
        self.styles = getSampleStyleSheet()
        self.width, self.height = LETTER
        self.margin_lateral = 2.5 * cm
        self.margin_superior = 3.5 * cm
        self.margin_inferior = 1.8 * cm

    def _estilo_normal(self):
        return ParagraphStyle(
            'CartaNormal', parent=self.styles['Normal'],
            fontName=FUENTE_INFORME_NORMAL, fontSize=10, leading=14, alignment=4,  # justificado
        )

    def _estilo_derecha(self):
        return ParagraphStyle('CartaDerecha', parent=self._estilo_normal(), alignment=2)

    def _estilo_titulo_seccion(self):
        return ParagraphStyle(
            'CartaTituloSeccion', parent=self._estilo_normal(),
            fontName=FUENTE_INFORME_BOLD, alignment=0, spaceBefore=16, spaceAfter=6,
            keepWithNext=1,
        )

    def _estilo_centrado(self):
        return ParagraphStyle('CartaCentrado', parent=self._estilo_normal(), alignment=1)

    def _crear_clase_canvas_carta(self, fondo, encabezado_texto):
        """Dibuja, en CADA pagina, el membrete institucional (lineas
        centradas, editables por el docente vía `encabezado_texto`) + logo
        de la carrera, y la numeracion de paginas en el pie. Igual que en
        FondoPDFGenerator, se dibuja DENTRO de los margenes ya reservados
        (nunca los agranda), para no arriesgar overflow del contenido que
        fluye con Paragraph/Spacer/Image normales."""
        lineas_encabezado = [linea.strip() for linea in (encabezado_texto or '').split('\n') if linea.strip()][:4]
        if not lineas_encabezado:
            lineas_encabezado = [fondo.carrera.nombre.upper() if fondo.carrera else 'CARRERA']

        logo_bytes = None
        if fondo.carrera:
            try:
                data_uri = fondo.carrera.get_logo_carrera_data_uri()
            except Exception:
                data_uri = None
            match = _DATA_IMG_RE.match(data_uri or '')
            if match:
                try:
                    logo_bytes = base64.b64decode(match.group('data'))
                except Exception:
                    logo_bytes = None

        ancho_pagina, alto_pagina = self.width, self.height
        margen_lateral = self.margin_lateral
        franja_superior = self.margin_superior

        class _CanvasCarta(pdfgen_canvas.Canvas):
            def __init__(self_c, *args, **kwargs):
                pdfgen_canvas.Canvas.__init__(self_c, *args, **kwargs)
                self_c._paginas_guardadas = []

            def showPage(self_c):
                self_c._paginas_guardadas.append(dict(self_c.__dict__))
                self_c._startPage()

            def save(self_c):
                total_paginas = len(self_c._paginas_guardadas)
                for estado in self_c._paginas_guardadas:
                    self_c.__dict__.update(estado)
                    _CanvasCarta._dibujar_decoracion(self_c, total_paginas)
                    pdfgen_canvas.Canvas.showPage(self_c)
                pdfgen_canvas.Canvas.save(self_c)

            @staticmethod
            def _dibujar_decoracion(c, total_paginas):
                c.saveState()
                y_franja = alto_pagina - franja_superior
                x_centro = ancho_pagina / 2.0
                pagina_actual = c.getPageNumber()

                if logo_bytes:
                    try:
                        c.drawImage(
                            ImageReader(io.BytesIO(logo_bytes)),
                            margen_lateral, y_franja + 0.55*cm,
                            width=1.8*cm, height=1.8*cm,
                            preserveAspectRatio=True, mask='auto',
                        )
                    except Exception:
                        pass

                y_linea = y_franja + 2.05 * cm
                for indice, linea in enumerate(lineas_encabezado):
                    c.setFont(FUENTE_INFORME_BOLD, 9.5 if indice == 0 else 8.5)
                    c.drawCentredString(x_centro, y_linea, linea)
                    y_linea -= 0.35 * cm

                c.setLineWidth(1.1)
                c.setStrokeColor(colors.HexColor('#3CBECA'))
                c.line(margen_lateral, y_franja + 0.35*cm, ancho_pagina - margen_lateral, y_franja + 0.35*cm)

                c.setFont(FUENTE_INFORME_NORMAL, 9)
                c.setFillColor(colors.black)
                c.drawRightString(ancho_pagina - margen_lateral, 1.0*cm, str(pagina_actual))
                c.restoreState()

        return _CanvasCarta

    def generar_pdf(self, fondo, informe_data):
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=LETTER,
            leftMargin=self.margin_lateral,
            rightMargin=self.margin_lateral,
            topMargin=self.margin_superior,
            bottomMargin=self.margin_inferior,
        )

        estilo_normal = self._estilo_normal()
        estilo_derecha = self._estilo_derecha()
        estilo_titulo_seccion = self._estilo_titulo_seccion()
        ancho_contenido = self.width - 2 * self.margin_lateral

        # El docente puede personalizar cualquiera de estos 12 campos desde
        # el editor tipo Word (frontend/src/components/EditorInformePage.jsx);
        # mientras no lo haga (campo vacio), se usa el mismo texto calculado
        # desde Docente/Carrera/Director que ve precargado en el editor (ver
        # informe_texto.construir_defaults_informe, fuente unica de verdad
        # para ambos).
        defaults = construir_defaults_informe(fondo)
        textos = {}
        for campo in CAMPOS_TEXTO_INFORME:
            valor_guardado = (getattr(informe_data, campo, '') or '').strip() if informe_data else ''
            textos[campo] = valor_guardado or defaults[campo]

        elementos = []

        # --- 1. Fecha ---
        elementos.append(Paragraph(escape(textos['fecha_texto']), estilo_derecha))
        elementos.append(Spacer(1, 1.0*cm))

        # --- 2. Destinatario / Remitente / Referencia ---
        filas_destinatario = [
            ['A         :', escape(textos['destinatario_nombre'])],
            ['', f"<b>{escape(textos['destinatario_cargo'])}</b>"],
            ['DE       :', escape(textos['remitente_nombre'])],
            ['', f"<b>{escape(textos['remitente_cargo'])}</b>"],
            ['REF.      :', f"<b><u>{escape(textos['referencia_texto'])}</u></b>"],
        ]
        estilo_etiqueta = ParagraphStyle('CartaEtiqueta', parent=estilo_normal, alignment=0)
        tabla_destinatario = Table(
            [[Paragraph(etq, estilo_etiqueta), Paragraph(val, estilo_etiqueta)] for etq, val in filas_destinatario],
            colWidths=[2.3*cm, ancho_contenido - 2.3*cm],
        )
        tabla_destinatario.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ]))
        elementos.append(tabla_destinatario)
        elementos.append(Spacer(1, 0.8*cm))

        # --- 3. Saludo + parrafo introductorio ---
        parser_intro = _InformeHTMLParser(estilo_normal, ancho_contenido)
        parser_intro.feed(textos['saludo_intro_html'])
        elementos.extend(parser_intro.obtener_flowables())
        elementos.append(Spacer(1, 0.5*cm))

        # --- 4. Las 7 secciones narrativas ---
        # Las opcionales se omiten por completo si el docente no escribió
        # nada (la carta debe leerse como prosa continua, no como un
        # formulario con campos vacios marcados "No aplica").
        secciones = [
            ('1. ACADÉMICA', getattr(informe_data, 'seccion_academica', ''), True),
            ('2. INVESTIGACIÓN', getattr(informe_data, 'seccion_investigacion', ''), False),
            ('3. EXTENSIÓN UNIVERSITARIA E INTERACCIÓN SOCIAL', getattr(informe_data, 'seccion_extension_interaccion', ''), False),
            ('4. ASESORÍAS Y TUTORÍAS', getattr(informe_data, 'seccion_asesorias_tutorias', ''), False),
            ('5. ACADÉMICA ADMINISTRATIVA', getattr(informe_data, 'seccion_academica_administrativa', ''), False),
            ('6. SOCIAL, CULTURAL Y DEPORTIVA', getattr(informe_data, 'seccion_social_cultural_deportiva', ''), False),
            ('7. CONCLUSIONES GENERALES', getattr(informe_data, 'conclusiones_generales', ''), True),
        ]
        for titulo, contenido_html, obligatoria in secciones:
            contenido_html = (contenido_html or '').strip()
            if not contenido_html and not obligatoria:
                continue
            elementos.append(Paragraph(titulo, estilo_titulo_seccion))
            parser = _InformeHTMLParser(estilo_normal, ancho_contenido)
            if contenido_html:
                parser.feed(contenido_html)
            flowables_seccion = parser.obtener_flowables()
            if not flowables_seccion:
                flowables_seccion = [Paragraph('No aplica / sin actividad en esta categoría.', estilo_normal)]
            elementos.extend(flowables_seccion)

        # --- 5. Cierre y firma ---
        elementos.append(Spacer(1, 0.6*cm))
        parser_cierre = _InformeHTMLParser(estilo_normal, ancho_contenido)
        parser_cierre.feed(textos['cierre_html'])
        elementos.extend(parser_cierre.obtener_flowables())

        estilo_centrado = self._estilo_centrado()
        estilo_firma_nombre = ParagraphStyle(
            'CartaFirmaNombre', parent=estilo_centrado,
            fontName=FUENTE_FIRMA_NOMBRE, fontSize=13, leading=16,
        )
        estilo_firma_cargo = ParagraphStyle(
            'CartaFirmaCargo', parent=estilo_centrado,
            fontName=FUENTE_INFORME_BOLD, fontSize=9, leading=11,
        )
        estilo_firma_email = ParagraphStyle(
            'CartaFirmaEmail', parent=estilo_centrado, fontSize=7, leading=9,
        )

        # Las lineas de la firma van centradas ENTRE SI (nombre/cargo/email
        # de distinto ancho, centrados unos respecto a otros), pero el
        # bloque completo se ubica del lado derecho de la pagina -no
        # centrado en todo el ancho de la hoja-, igual que en la carta de
        # referencia: una columna angosta con hAlign='RIGHT'.
        filas_firma = [
            [Paragraph(escape(textos['firma_nombre']), estilo_firma_nombre)],
            [Paragraph(escape(textos['firma_cargo']), estilo_firma_cargo)],
        ]
        if textos['firma_email']:
            email_esc = escape(textos['firma_email'])
            filas_firma.append([Paragraph(
                f'E-mail: <u><font color="#0563C1">{email_esc}</font></u>', estilo_firma_email,
            )])
        tabla_firma_informe = Table(filas_firma, colWidths=[8.5*cm])
        tabla_firma_informe.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ]))
        tabla_firma_informe.hAlign = 'RIGHT'

        elementos.append(Spacer(1, 1.8*cm))
        elementos.append(tabla_firma_informe)

        elementos.append(Spacer(1, 1.2*cm))
        elementos.append(Paragraph('Cc./Arch.', estilo_normal))

        doc.build(elementos, canvasmaker=self._crear_clase_canvas_carta(fondo, textos['encabezado_texto']))

    @staticmethod
    def generar_informe_individual(fondo):
        buffer = io.BytesIO()
        informe_data = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        generador = InformePDFGenerator(buffer)
        generador.generar_pdf(fondo, informe_data)
        buffer.seek(0)
        return buffer
