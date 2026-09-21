import { useRef } from 'react';
import {
  Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, Palette, Image as ImageIcon, PenLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useInformeDocumento } from './InformeDocumentoContext';

const TAMANO_MAXIMO_IMAGEN_MB = 3;

const TAMANOS_FUENTE = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const INTERLINEADOS = [
  { valor: '1', etiqueta: '1.0' },
  { valor: '1.15', etiqueta: '1.15' },
  { valor: '1.5', etiqueta: '1.5' },
  { valor: '2', etiqueta: '2.0' },
];

/**
 * Barra de formato única y flotante (sticky, debajo de la barra de acciones)
 * compartida por TODOS los bloques de texto enriquecido del documento: opera
 * siempre sobre el campo que tiene el foco en ese momento (InformeDocumentoContext),
 * igual que la cinta de opciones de Word. Los bloques de texto simple
 * (encabezado, fecha, destinatario, firma...) no activan esta barra: no
 * llevan formato propio, solo el texto que el docente escriba.
 */
export default function InformeFormatToolbar() {
  const { campoActivo, soloLectura } = useInformeDocumento();
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);

  const deshabilitado = soloLectura || !campoActivo;

  // Restaura la selección de texto que había en el campo activo ANTES de
  // que el foco se moviera a un control de la barra (un <select> o el
  // input de color, por ejemplo, siempre mueven el foco del navegador y
  // con él se pierde la selección de texto resaltada dentro del
  // contentEditable), y recién entonces ejecuta el comando. Sin esto,
  // document.execCommand no tiene sobre qué texto aplicar el formato.
  const conFoco = (fn) => (...args) => {
    if (deshabilitado) return;
    const { node, rangoRef } = campoActivo;
    node?.focus();
    const rango = rangoRef?.current;
    if (rango) {
      const seleccion = window.getSelection();
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
    fn(...args);
  };

  const emitirCambio = () => {
    if (campoActivo?.node) campoActivo.onChange(campoActivo.node.innerHTML);
  };

  const ejecutarComando = conFoco((comando, argumento = null) => {
    document.execCommand(comando, false, argumento);
    emitirCambio();
  });

  const aplicarTamanoFuente = conFoco((px) => {
    document.execCommand('fontSize', false, '7');
    campoActivo.node?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    });
    emitirCambio();
  });

  const aplicarInterlineado = conFoco((valor) => {
    const seleccion = window.getSelection();
    let nodo = seleccion && seleccion.rangeCount > 0 ? seleccion.anchorNode : null;
    let bloque = nodo && nodo.nodeType === Node.TEXT_NODE ? nodo.parentElement : nodo;
    const editor = campoActivo.node;
    while (bloque && bloque !== editor && !['P', 'DIV', 'LI'].includes(bloque.tagName)) {
      bloque = bloque.parentElement;
    }
    if (!bloque || bloque === editor) return;
    bloque.style.lineHeight = valor;
    emitirCambio();
  });

  const insertarTabla = conFoco(() => {
    const columnas = 3;
    const filas = 3;
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
    for (let f = 0; f < filas; f += 1) {
      html += '<tr>';
      for (let c = 0; c < columnas; c += 1) {
        const esEncabezado = f === 0;
        const tag = esEncabezado ? 'th' : 'td';
        const fondo = esEncabezado ? 'background:#f1f5f9;' : '';
        const contenido = esEncabezado ? `Columna ${c + 1}` : '&nbsp;';
        html += `<${tag} style="border:1px solid #94a3b8;padding:6px;min-width:60px;${fondo}">${contenido}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    emitirCambio();
  });

  const handleSeleccionArchivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || deshabilitado) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG o PNG.');
      return;
    }
    if (file.size > TAMANO_MAXIMO_IMAGEN_MB * 1024 * 1024) {
      toast.error(`La imagen supera el tamaño máximo de ${TAMANO_MAXIMO_IMAGEN_MB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const editorNode = campoActivo?.node;
      ejecutarComando('insertImage', dataUrl);

      // Sin un ancho inicial, la imagen recién insertada llena el 100% del
      // ancho del editor (ver [&_img]:max-w-full en InformeCampoRico) y no
      // queda espacio libre para que se note la alineación izquierda/centro/
      // derecha hasta que el docente la achique a mano con los handles. Se
      // le da un ancho razonable de entrada, ya envuelta en el mismo
      // contenedor alineable que usa "alinear imagen", para que los botones
      // de alineación tengan un efecto visible desde el primer clic.
      if (editorNode) {
        const img = Array.from(editorNode.querySelectorAll('img')).find((i) => i.src === dataUrl);
        if (img) {
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
            emitirCambio();
          };
          if (img.complete && img.naturalWidth > 0) aplicarValoresIniciales();
          else img.onload = aplicarValoresIniciales;
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // N/K/S: mismas letras que usa Google Docs/Word en español para
  // Negrita/Cursiva/Subrayado, más reconocibles para el docente que un
  // ícono genérico.
  const botonesLetra = [
    { letra: 'N', estilo: 'font-bold', titulo: 'Negrita (Ctrl+B)', accion: () => ejecutarComando('bold') },
    { letra: 'K', estilo: 'italic', titulo: 'Cursiva (Ctrl+I)', accion: () => ejecutarComando('italic') },
    { letra: 'S', estilo: 'underline', titulo: 'Subrayado (Ctrl+U)', accion: () => ejecutarComando('underline') },
  ];

  const botonesAlineacion = [
    { icono: AlignLeft, titulo: 'Alinear a la izquierda', accion: () => ejecutarComando('justifyLeft') },
    { icono: AlignCenter, titulo: 'Centrar', accion: () => ejecutarComando('justifyCenter') },
    { icono: AlignRight, titulo: 'Alinear a la derecha', accion: () => ejecutarComando('justifyRight') },
    { icono: AlignJustify, titulo: 'Justificar', accion: () => ejecutarComando('justifyFull') },
  ];

  const botonesLista = [
    { icono: List, titulo: 'Lista con viñetas', accion: () => ejecutarComando('insertUnorderedList') },
    { icono: ListOrdered, titulo: 'Lista numerada', accion: () => ejecutarComando('insertOrderedList') },
    { icono: Outdent, titulo: 'Disminuir sangría', accion: () => ejecutarComando('outdent') },
    { icono: Indent, titulo: 'Aumentar sangría', accion: () => ejecutarComando('indent') },
  ];

  return (
    <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-[850px] mx-auto px-2 py-1.5 flex flex-wrap items-center gap-1">
        {!campoActivo && !soloLectura && (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
            Haz clic en cualquier parte del documento para editar…
          </span>
        )}
        {soloLectura && (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1 flex items-center gap-1">
            <PenLine className="w-3.5 h-3.5" /> Documento en modo solo lectura
          </span>
        )}
        {!soloLectura && (
          <>
            {botonesLetra.map(({ letra, estilo, titulo, accion }) => (
              <button
                key={letra}
                type="button"
                title={titulo}
                disabled={deshabilitado}
                onMouseDown={(e) => e.preventDefault()}
                onClick={accion}
                className={`w-7 h-7 flex items-center justify-center rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${estilo}`}
              >
                {letra}
              </button>
            ))}
            <button
              type="button"
              title="Tachado"
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ejecutarComando('strikeThrough')}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-500 mx-0.5" />

            <select
              title="Tamaño de fuente"
              disabled={deshabilitado}
              defaultValue=""
              onChange={(e) => {
                const px = Number(e.target.value);
                if (px) aplicarTamanoFuente(px);
                e.target.value = '';
              }}
              className="text-xs rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-1 py-1 disabled:opacity-30"
            >
              <option value="" disabled>Tamaño</option>
              {TAMANOS_FUENTE.map((px) => (
                <option key={px} value={px}>{px}px</option>
              ))}
            </select>

            <select
              title="Interlineado"
              disabled={deshabilitado}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) aplicarInterlineado(e.target.value);
                e.target.value = '';
              }}
              className="text-xs rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-1 py-1 disabled:opacity-30"
            >
              <option value="" disabled>Interlineado</option>
              {INTERLINEADOS.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>

            <button
              type="button"
              title="Color de texto"
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => colorInputRef.current?.click()}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              className="hidden"
              disabled={deshabilitado}
              onChange={(e) => ejecutarComando('foreColor', e.target.value)}
            />

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-500 mx-0.5" />

            {botonesAlineacion.map(({ icono: Icono, titulo, accion }) => (
              <button
                key={titulo}
                type="button"
                title={titulo}
                disabled={deshabilitado}
                onMouseDown={(e) => e.preventDefault()}
                onClick={accion}
                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icono className="w-3.5 h-3.5" />
              </button>
            ))}

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-500 mx-0.5" />

            {botonesLista.map(({ icono: Icono, titulo, accion }) => (
              <button
                key={titulo}
                type="button"
                title={titulo}
                disabled={deshabilitado}
                onMouseDown={(e) => e.preventDefault()}
                onClick={accion}
                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Icono className="w-3.5 h-3.5" />
              </button>
            ))}

            <span className="w-px h-5 bg-slate-300 dark:bg-slate-500 mx-0.5" />

            <button
              type="button"
              title="Insertar tabla"
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertarTabla}
              className="px-2 py-1.5 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Tabla
            </button>
            <button
              type="button"
              title="Insertar imagen (JPG/PNG, máx. 3MB)"
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleSeleccionArchivo}
            />
          </>
        )}
      </div>
    </div>
  );
}
