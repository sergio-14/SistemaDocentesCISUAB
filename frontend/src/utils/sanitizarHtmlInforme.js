import DOMPurify from 'dompurify';

/**
 * Limpieza del HTML del Informe de Fondo de Tiempo antes de mostrarlo con
 * innerHTML (editor y detalle del fondo) y de lo que se pega con Ctrl+V.
 * Es la misma lista blanca que aplica el backend al guardar
 * (backend/fondos/utils/informe_html.py): solo lo que produce el editor.
 */

const ETIQUETAS = [
  'p', 'div', 'br', 'span', 'font',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
];

const ATRIBUTOS = [
  'style', 'align', 'data-img-wrap', 'color', 'size',
  'colspan', 'rowspan', 'src', 'alt', 'width', 'height',
];

const PROPIEDADES_CSS = new Set([
  'text-align', 'line-height',
  'font-size', 'font-weight', 'font-style', 'color', 'background-color',
  'text-decoration', 'text-decoration-line',
  'width', 'height', 'min-width', 'max-width',
  'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom',
  'padding', 'padding-left',
  'border', 'border-collapse',
]);

// Las imágenes solo tienen tamaño; la alineación la da el bloque que las
// envuelve (<div data-img-wrap>). Sin margin, float ni position no se pueden
// colocar en otro sitio.
const PROPIEDADES_CSS_IMAGEN = new Set(['width', 'height']);

const VALOR_CSS_PELIGROSO = /url\s*\(|expression\s*\(|javascript:/i;

const filtrarEstilo = (estilo, permitidas) => estilo
  .split(';')
  .map((declaracion) => declaracion.trim())
  .filter((declaracion) => {
    const separador = declaracion.indexOf(':');
    if (separador < 1) return false;
    const propiedad = declaracion.slice(0, separador).trim().toLowerCase();
    const valor = declaracion.slice(separador + 1);
    return permitidas.has(propiedad) && !VALOR_CSS_PELIGROSO.test(valor);
  })
  .join('; ');

// Instancia propia: el hook de estilos no afecta a otros usos de DOMPurify.
const purificador = DOMPurify(window);
purificador.addHook('uponSanitizeAttribute', (nodo, datos) => {
  if (datos.attrName !== 'style') return;
  const permitidas = nodo.nodeName === 'IMG' ? PROPIEDADES_CSS_IMAGEN : PROPIEDADES_CSS;
  datos.attrValue = filtrarEstilo(datos.attrValue || '', permitidas);
  if (!datos.attrValue) datos.keepAttr = false;
});

export function sanitizarHtmlInforme(html) {
  if (!html) return '';
  return purificador.sanitize(html, {
    ALLOWED_TAGS: ETIQUETAS,
    ALLOWED_ATTR: ATRIBUTOS,
    ALLOWED_URI_REGEXP: /^(?:https?:|\/)/i,
  });
}
