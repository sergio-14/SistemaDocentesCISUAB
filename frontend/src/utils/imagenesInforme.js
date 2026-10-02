import { API_BASE_URL } from '../apis/apiConfig';

/**
 * Imágenes del editor del Informe de Fondo de Tiempo. Mismos límites que
 * valida el backend al guardar (backend/fondos/utils/informe_imagenes.py):
 * PNG, JPG o GIF de hasta 3 MB, como mucho 20 por informe y sin direcciones
 * externas. Las WEBP se convierten a PNG al insertarlas.
 */

export const TAMANO_MAXIMO_IMAGEN_MB = 3;
export const MAXIMO_IMAGENES_INFORME = 20;
export const MENSAJE_LIMITE_IMAGENES = `El informe admite como máximo ${MAXIMO_IMAGENES_INFORME} imágenes.`;

const TIPOS_ADMITIDOS = ['image/png', 'image/jpeg', 'image/gif'];
const SRC_BASE64_ADMITIDO = /^data:image\/(?:png|jpe?g|gif);base64,/i;

const leerComoDataUrl = (blob) => new Promise((resolve, reject) => {
  const lector = new FileReader();
  lector.onload = () => resolve(lector.result);
  lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
  lector.readAsDataURL(blob);
});

const convertirWebpAPng = async (archivo) => {
  const mapa = await createImageBitmap(archivo);
  const lienzo = document.createElement('canvas');
  lienzo.width = mapa.width;
  lienzo.height = mapa.height;
  lienzo.getContext('2d').drawImage(mapa, 0, 0);
  mapa.close();
  return new Promise((resolve, reject) => {
    lienzo.toBlob((png) => (png ? resolve(png) : reject(new Error('conversión'))), 'image/png');
  });
};

/** Data URL lista para insertar, o lanza un Error con el mensaje para el docente. */
export async function prepararImagenInforme(archivo) {
  let imagen = archivo;
  if (archivo.type === 'image/webp') {
    try {
      imagen = await convertirWebpAPng(archivo);
    } catch {
      throw new Error('No se pudo convertir la imagen WEBP: guárdala como PNG o JPG e insértala de nuevo.');
    }
  } else if (!TIPOS_ADMITIDOS.includes(archivo.type)) {
    throw new Error('Solo se admiten imágenes PNG, JPG o GIF.');
  }
  if (imagen.size > TAMANO_MAXIMO_IMAGEN_MB * 1024 * 1024) {
    throw new Error(`La imagen supera el tamaño máximo de ${TAMANO_MAXIMO_IMAGEN_MB} MB.`);
  }
  return leerComoDataUrl(imagen);
}

/** Imágenes que ya tiene el documento (todos los bloques de texto enriquecido). */
export const contarImagenesInforme = () => document.querySelectorAll('.informe-campo-rico img').length;

// Propia: recién insertada (base64 PNG/JPG/GIF) o ya guardada en media del sistema.
const esImagenPropia = (src) => {
  if (SRC_BASE64_ADMITIDO.test(src)) return true;
  try {
    const url = new URL(src, window.location.href);
    const origenApi = new URL(API_BASE_URL, window.location.href).origin;
    return url.pathname.startsWith('/media/') && [window.location.origin, origenApi].includes(url.origin);
  } catch {
    return false;
  }
};

/** Quita del HTML pegado las imágenes externas o en formato no admitido. */
export function quitarImagenesNoAdmitidas(html) {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = html;
  let quitadas = 0;
  plantilla.content.querySelectorAll('img').forEach((img) => {
    if (!esImagenPropia(img.getAttribute('src') || '')) {
      img.remove();
      quitadas += 1;
    }
  });
  return { html: plantilla.innerHTML, quitadas };
}

/**
 * Da a la imagen recién insertada un ancho inicial y la envuelve en el
 * contenedor alineable. Sin un ancho inicial, la imagen llena el 100% del
 * ancho del editor (ver [&_img]:max-w-full en InformeCampoRico) y no queda
 * espacio libre para que se note la alineación izquierda/centro/derecha
 * hasta que el docente la achique a mano con los handles.
 */
export function ajustarImagenInsertada(editorNode, dataUrl, alTerminar) {
  const img = Array.from(editorNode.querySelectorAll('img')).find((i) => i.src === dataUrl);
  if (!img) return;
  const aplicarValoresIniciales = () => {
    if (!img.isConnected) return;
    const anchoDisponible = editorNode.clientWidth || 320;
    const anchoInicial = Math.min(img.naturalWidth || 320, 320, anchoDisponible);
    img.style.width = `${anchoInicial}px`;
    img.style.height = 'auto';
    if (!img.parentElement?.hasAttribute('data-img-wrap')) {
      const contenedor = document.createElement('div');
      contenedor.setAttribute('data-img-wrap', '1');
      contenedor.style.textAlign = 'left';
      img.replaceWith(contenedor);
      contenedor.appendChild(img);
    }
    alTerminar();
  };
  if (img.complete && img.naturalWidth > 0) aplicarValoresIniciales();
  else img.onload = aplicarValoresIniciales;
}
