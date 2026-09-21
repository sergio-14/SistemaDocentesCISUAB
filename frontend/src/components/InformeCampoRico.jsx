import { useEffect, useRef, useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useInformeDocumento } from './InformeDocumentoContext';

const TAMANOS_IMAGEN_PRESET = [
  { etiqueta: 'S', titulo: 'Pequeña (200px)', ancho: 200 },
  { etiqueta: 'M', titulo: 'Mediana (350px)', ancho: 350 },
  { etiqueta: 'L', titulo: 'Grande (500px)', ancho: 500 },
  { etiqueta: '100%', titulo: 'Ancho completo', ancho: null },
];

const ESQUINAS_HANDLE = [
  { id: 'sup-izq', dx: 0, dy: 0, signo: -1, cursor: 'nwse-resize' },
  { id: 'sup-der', dx: 1, dy: 0, signo: 1, cursor: 'nesw-resize' },
  { id: 'inf-izq', dx: 0, dy: 1, signo: -1, cursor: 'nesw-resize' },
  { id: 'inf-der', dx: 1, dy: 1, signo: 1, cursor: 'nwse-resize' },
];

/**
 * Bloque de texto enriquecido del documento (saludo+introducción, cada una
 * de las 7 categorías del Art. 12, cierre): contentEditable "desnudo", sin
 * barra propia -toda la edición de formato pasa por InformeFormatToolbar,
 * compartida por todo el documento-, integrado visualmente en el flujo
 * continuo tipo Word. El HTML que produce es exactamente el mismo que
 * generaba el RichTextEditor anterior, para que backend/fondos/utils/
 * pdf_generator.py (_InformeHTMLParser) lo siga entendiendo sin cambios.
 */
export default function InformeCampoRico({ value, onChange, placeholder = 'Escribe aquí…', className = '' }) {
  const editorRef = useRef(null);
  const enFocoRef = useRef(false);
  // Ultimo rango de seleccion (texto resaltado o solo la posicion del
  // cursor) DENTRO de este campo. La barra de formato es compartida por
  // todo el documento y vive fuera de este componente: al hacer clic en un
  // <select> (tamaño/interlineado) el foco se mueve al select y el
  // navegador pierde la seleccion de texto activa, así que sin guardar y
  // restaurar este rango, aplicar un tamaño de fuente o interlineado no
  // tendría sobre qué texto actuar.
  const ultimoRangoRef = useRef(null);
  const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
  const [medidaImagen, setMedidaImagen] = useState(null);
  const { setCampoActivo, soloLectura } = useInformeDocumento();

  useEffect(() => {
    try {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Algunos navegadores pueden no soportar estos comandos.
    }
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!enFocoRef.current && el.innerHTML !== (value || '')) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const emitirCambio = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const guardarSeleccion = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const rango = sel.getRangeAt(0);
    if (editorRef.current.contains(rango.commonAncestorContainer)) {
      ultimoRangoRef.current = rango.cloneRange();
    }
  };

  const handleFocus = () => {
    enFocoRef.current = true;
    guardarSeleccion();
    setCampoActivo({ node: editorRef.current, onChange, rangoRef: ultimoRangoRef });
  };

  const handleBlur = () => {
    enFocoRef.current = false;
  };

  const medirImagen = (img) => {
    const contenedorEditor = editorRef.current;
    if (!img || !contenedorEditor) return null;
    const rectImg = img.getBoundingClientRect();
    const rectEditor = contenedorEditor.getBoundingClientRect();
    return {
      top: rectImg.top - rectEditor.top + contenedorEditor.scrollTop,
      left: rectImg.left - rectEditor.left,
      width: rectImg.width,
      height: rectImg.height,
    };
  };

  const actualizarSeleccionImagen = (img) => {
    if (!img) {
      setImagenSeleccionada(null);
      setMedidaImagen(null);
      return;
    }
    setImagenSeleccionada(img);
    setMedidaImagen(medirImagen(img));
  };

  const handleClickEditor = (e) => {
    if (e.target.tagName === 'IMG') {
      actualizarSeleccionImagen(e.target);
    } else if (imagenSeleccionada) {
      actualizarSeleccionImagen(null);
    }
  };

  const alinearImagenSeleccionada = (alineacion) => {
    const img = imagenSeleccionada;
    if (!img || !img.isConnected) return;
    let contenedor = img.parentElement;
    if (!contenedor || !contenedor.hasAttribute('data-img-wrap')) {
      contenedor = document.createElement('div');
      contenedor.setAttribute('data-img-wrap', '1');
      img.replaceWith(contenedor);
      contenedor.appendChild(img);
    }
    contenedor.style.textAlign = alineacion;
    emitirCambio();
    actualizarSeleccionImagen(img);
  };

  const aplicarTamanoPreset = (anchoPx) => {
    const img = imagenSeleccionada;
    if (!img || !img.isConnected) return;
    if (anchoPx == null) {
      img.style.width = '100%';
    } else {
      const maxAncho = editorRef.current?.clientWidth || anchoPx;
      img.style.width = `${Math.min(anchoPx, maxAncho)}px`;
    }
    img.style.height = 'auto';
    emitirCambio();
    actualizarSeleccionImagen(img);
  };

  // Arrastrar un handle de esquina redimensiona la imagen manteniendo su
  // proporción original (ancho/alto), igual que en Word/Google Docs.
  const iniciarRedimension = (e, signo) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imagenSeleccionada;
    if (!img) return;
    const rectInicial = img.getBoundingClientRect();
    const anchoInicial = rectInicial.width;
    const proporcion = rectInicial.height / anchoInicial || 1;
    const xInicial = e.clientX;
    const maxAncho = editorRef.current?.clientWidth || anchoInicial;

    const onMove = (ev) => {
      const delta = ev.clientX - xInicial;
      let nuevoAncho = Math.round(anchoInicial + signo * delta);
      nuevoAncho = Math.max(40, Math.min(nuevoAncho, maxAncho));
      img.style.width = `${nuevoAncho}px`;
      img.style.height = `${Math.round(nuevoAncho * proporcion)}px`;
      setMedidaImagen(medirImagen(img));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      emitirCambio();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="relative">
      {imagenSeleccionada && medidaImagen && !soloLectura && (
        <>
          {/* Resalte visual de la imagen seleccionada: es un overlay aparte
              (pointer-events-none) que nunca toca el estilo del <img> real,
              para no arriesgar que el borde de "seleccionado" quede grabado
              por accidente en el HTML que se guarda. */}
          <div
            className="absolute z-[9] pointer-events-none rounded-sm ring-2 ring-blue-600"
            style={{ top: medidaImagen.top, left: medidaImagen.left, width: medidaImagen.width, height: medidaImagen.height }}
          />
          <div
            className="absolute z-10 flex items-center gap-1 bg-slate-800 rounded-lg shadow-lg px-1.5 py-1"
            style={{ top: medidaImagen.top - 36, left: Math.max(0, medidaImagen.left) }}
          >
            {[
              { icono: AlignLeft, titulo: 'Alinear imagen a la izquierda', valor: 'left' },
              { icono: AlignCenter, titulo: 'Centrar imagen', valor: 'center' },
              { icono: AlignRight, titulo: 'Alinear imagen a la derecha', valor: 'right' },
            ].map(({ icono: Icono, titulo, valor }) => (
              <button
                key={valor}
                type="button"
                title={titulo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => alinearImagenSeleccionada(valor)}
                className="p-1.5 rounded text-white hover:bg-slate-600 transition-colors"
              >
                <Icono className="w-3.5 h-3.5" />
              </button>
            ))}
            <span className="w-px h-4 bg-slate-600 mx-0.5" />
            {TAMANOS_IMAGEN_PRESET.map(({ etiqueta, titulo, ancho }) => (
              <button
                key={etiqueta}
                type="button"
                title={titulo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => aplicarTamanoPreset(ancho)}
                className="px-1.5 py-1 rounded text-[10px] font-bold text-white hover:bg-slate-600 transition-colors whitespace-nowrap"
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {ESQUINAS_HANDLE.map(({ id, dx, dy, signo, cursor }) => (
            <div
              key={id}
              title="Arrastra para cambiar el tamaño"
              onMouseDown={(e) => iniciarRedimension(e, signo)}
              className="absolute z-10 w-2.5 h-2.5 bg-blue-600 border border-white rounded-sm shadow"
              style={{
                top: medidaImagen.top + dy * medidaImagen.height - 5,
                left: medidaImagen.left + dx * medidaImagen.width - 5,
                cursor,
              }}
            />
          ))}
        </>
      )}
      <div
        ref={editorRef}
        contentEditable={!soloLectura}
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={emitirCambio}
        onClick={handleClickEditor}
        onMouseUp={guardarSeleccion}
        onKeyUp={guardarSeleccion}
        data-placeholder={placeholder}
        // [&_img]:inline-block: Tailwind Preflight pone `display:block` en
        // TODAS las <img> por defecto. Un elemento block-level no responde
        // a text-align (esa propiedad solo mueve contenido inline dentro de
        // su caja) - por eso "alinear imagen" cambiaba el CSS correctamente
        // (se veía en getComputedStyle) pero la imagen nunca se movía en el
        // editor: hay que devolverle a la imagen un display inline-level
        // para que el text-align del <div data-img-wrap> (ver
        // alinearImagenSeleccionada) tenga algo que alinear.
        className={`informe-campo-editable informe-campo-rico rounded px-1.5 -mx-1.5 focus:outline-none [&_img]:inline-block [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:max-w-full [&_blockquote]:border-none [&_blockquote]:ml-8 [&_blockquote]:my-0 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 ${soloLectura ? '' : 'hover:bg-blue-50/60 dark:hover:bg-blue-900/10 focus:bg-blue-50/80 dark:focus:bg-blue-900/20 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-700'} ${className}`}
      />
    </div>
  );
}
