"""Limpieza del HTML del Informe de Fondo de Tiempo (protección contra XSS).

El editor del informe (InformeCampoRico.jsx + InformeFormatToolbar.jsx) guarda
HTML que luego se muestra con innerHTML al Director y en el detalle del fondo.
Antes de guardarlo (InformeFondo.save) y al entregarlo (InformeFondoSerializer)
se deja solo lo que el editor produce: etiquetas, atributos y propiedades CSS
de la lista blanca. Se descartan <script>, <iframe>, los atributos on*, las
URLs javascript: y cualquier estilo fuera de la lista (p. ej. url(...)).

El generador del PDF (pdf_generator._InformeHTMLParser) entiende las mismas
etiquetas y estilos.
"""
import nh3

# Campos del informe que el editor llena con HTML. Los demás campos del
# documento (encabezado, fecha, destinatario, firma...) son texto plano.
CAMPOS_HTML_RICO_INFORME = [
    'seccion_academica', 'seccion_investigacion', 'seccion_extension_interaccion',
    'seccion_asesorias_tutorias', 'seccion_academica_administrativa',
    'seccion_social_cultural_deportiva', 'conclusiones_generales',
    'saludo_intro_html', 'cierre_html',
]

_ETIQUETAS = {
    'p', 'div', 'br', 'span', 'font',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote',
    'h1', 'h2', 'h3', 'h4',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
}

_ATRIBUTOS = {
    '*': {'style'},
    'p': {'align'},
    'div': {'align', 'data-img-wrap'},
    'font': {'color', 'size'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
    'img': {'src', 'alt', 'width', 'height'},
}

# Formato que aplica el editor: alineación, interlineado, tamaño y color de
# letra, sangría (margin), tablas y tamaño de las imágenes.
_PROPIEDADES_CSS = {
    'text-align', 'line-height',
    'font-size', 'font-weight', 'font-style', 'color', 'background-color',
    'text-decoration', 'text-decoration-line',
    'width', 'height', 'min-width', 'max-width',
    'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom',
    'padding', 'padding-left',
    'border', 'border-collapse',
}

# data: para las imágenes recién insertadas (base64); http(s) para las URL
# firmadas de media que el editor reenvía. Las rutas relativas (/media/...)
# se aceptan siempre.
_ESQUEMAS_URL = {'http', 'https', 'data'}


def sanitizar_html_informe(html):
    """HTML del informe limitado a la lista blanca del editor."""
    if not html:
        return html
    return nh3.clean(
        html,
        tags=_ETIQUETAS,
        attributes=_ATRIBUTOS,
        filter_style_properties=_PROPIEDADES_CSS,
        url_schemes=_ESQUEMAS_URL,
        strip_comments=True,
    )


def sanitizar_campos_informe(informe):
    """Aplica sanitizar_html_informe a los campos HTML del informe. Devuelve los campos cambiados."""
    cambiados = []
    for campo in CAMPOS_HTML_RICO_INFORME:
        valor = getattr(informe, campo, None)
        limpio = sanitizar_html_informe(valor)
        if limpio != valor:
            setattr(informe, campo, limpio)
            cambiados.append(campo)
    return cambiados
