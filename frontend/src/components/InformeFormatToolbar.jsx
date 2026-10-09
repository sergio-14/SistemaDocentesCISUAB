import { useRef } from 'react';
import {
  Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, Palette, Image as ImageIcon, PenLine, Table,
  PanelLeft, PanelTop, PanelRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useInformeDocumento } from './InformeDocumentoContext';
import {
  MAXIMO_IMAGENES_INFORME, MENSAJE_LIMITE_IMAGENES, TAMANO_MAXIMO_IMAGEN_MB,
  ajustarImagenInsertada, contarImagenesInforme, prepararImagenInforme,
} from '../utils/imagenesInforme';

const TAMANOS_FUENTE = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const POSICIONES_BARRA = [
  { valor: 'izquierda', titulo: 'Barra a la izquierda de la hoja', icono: PanelLeft },
  { valor: 'arriba', titulo: 'Barra arriba', icono: PanelTop },
  { valor: 'derecha', titulo: 'Barra a la derecha de la hoja', icono: PanelRight },
];
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
export default function InformeFormatToolbar({ posicion = 'arriba', onCambiarPosicion = null }) {
  const { campoActivo, soloLectura } = useInformeDocumento();
  // A un costado de la hoja la barra es una columna.
  const vertical = posicion !== 'arriba';
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
        const fondo = esEncabezado ? 'background-color:#f1f5f9;' : '';
        const contenido = esEncabezado ? `Columna ${c + 1}` : '&nbsp;';
        html += `<${tag} style="border:1px solid #94a3b8;padding:6px;min-width:60px;${fondo}">${contenido}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    emitirCambio();
  });

  const handleSeleccionArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || deshabilitado) return;

    if (contarImagenesInforme() >= MAXIMO_IMAGENES_INFORME) {
      toast.error(MENSAJE_LIMITE_IMAGENES);
      return;
    }
    let dataUrl;
    try {
      dataUrl = await prepararImagenInforme(file);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    const editorNode = campoActivo?.node;
    ejecutarComando('insertImage', dataUrl);
    if (editorNode) ajustarImagenInsertada(editorNode, dataUrl, emitirCambio);
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

  // Botón de la barra: ícono o letra, con el hover azulado del módulo.
  const BOTON_BARRA = 'h-8 min-w-8 px-1.5 flex items-center justify-center rounded-lg text-slate-600 hover:bg-azulado-100 hover:text-blue-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';
  const SELECT_BARRA = `h-8 text-xs rounded-lg bg-white ring-1 ring-inset ring-azulado-300 text-slate-700 px-2 outline-none focus:ring-blue-900 disabled:opacity-30 ${vertical ? 'w-full' : ''}`;
  // En horizontal los grupos fluyen en una sola fila; en vertical cada grupo es un bloque.
  const GRUPO = vertical ? 'flex flex-wrap gap-1' : 'contents';
  const separador = vertical
    ? <span className="h-px w-full bg-azulado-300" />
    : <span className="w-px h-6 bg-azulado-300 mx-1" />;

  if (soloLectura) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-500 ring-1 ring-azulado-300 shadow-[0_2px_6px_rgba(30,58,138,0.08)]">
        <PenLine className="w-4 h-4" /> Documento en modo solo lectura
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-azulado-300 shadow-[0_2px_6px_rgba(30,58,138,0.08)]">
      <div className={vertical ? 'flex flex-col gap-2.5 p-3' : 'flex flex-wrap items-center gap-1 px-2 py-2'}>
        {/* Insertar: la imagen es lo que más se usa, va primero y destacada */}
        <div className={vertical ? 'flex flex-col gap-1.5' : 'contents'}>
          <button
            type="button"
            title={`Insertar imagen (PNG, JPG o GIF, máx. ${TAMANO_MAXIMO_IMAGEN_MB} MB)`}
            disabled={deshabilitado}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ImageIcon className="w-5 h-5" />
            Imagen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleSeleccionArchivo}
          />
          <button
            type="button"
            title="Insertar tabla"
            disabled={deshabilitado}
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertarTabla}
            className="h-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-3.5 text-sm font-medium text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Table className="w-4 h-4" />
            Tabla
          </button>
        </div>

        {separador}

        {/* Texto */}
        <div className={GRUPO}>
          {botonesLetra.map(({ letra, estilo, titulo, accion }) => (
            <button
              key={letra}
              type="button"
              title={titulo}
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={accion}
              className={`${BOTON_BARRA} w-8 text-sm ${estilo}`}
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
            className={BOTON_BARRA}
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Color de texto"
            disabled={deshabilitado}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colorInputRef.current?.click()}
            className={BOTON_BARRA}
          >
            <Palette className="w-4 h-4" />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="hidden"
            disabled={deshabilitado}
            onChange={(e) => ejecutarComando('foreColor', e.target.value)}
          />
        </div>
        <div className={vertical ? 'flex flex-col gap-1.5' : 'contents'}>
          <select
            title="Tamaño de fuente"
            disabled={deshabilitado}
            defaultValue=""
            onChange={(e) => {
              const px = Number(e.target.value);
              if (px) aplicarTamanoFuente(px);
              e.target.value = '';
            }}
            className={`${SELECT_BARRA} ${vertical ? '' : 'ml-1'}`}
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
            className={SELECT_BARRA}
          >
            <option value="" disabled>Interlineado</option>
            {INTERLINEADOS.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>

        {separador}

        {/* Párrafo: alineación, listas y sangría */}
        <div className={GRUPO}>
          {[...botonesAlineacion, ...botonesLista].map(({ icono: Icono, titulo, accion }) => (
            <button
              key={titulo}
              type="button"
              title={titulo}
              disabled={deshabilitado}
              onMouseDown={(e) => e.preventDefault()}
              onClick={accion}
              className={BOTON_BARRA}
            >
              <Icono className="w-4 h-4" />
            </button>
          ))}
        </div>

        {!campoActivo && (
          <span className={`text-xs italic text-slate-400 ${vertical ? '' : 'px-2'}`}>
            Haz clic en el documento para editar…
          </span>
        )}

        {/* Dónde va la barra: arriba, a la izquierda o a la derecha de la hoja */}
        {onCambiarPosicion && (
          <div className={`flex items-center gap-0.5 rounded-full bg-azulado-100 p-0.5 ${vertical ? 'self-center mt-1' : 'ml-auto'}`}>
            {POSICIONES_BARRA.map(({ valor, titulo, icono: Icono }) => (
              <button
                key={valor}
                type="button"
                title={titulo}
                aria-pressed={posicion === valor}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onCambiarPosicion(valor)}
                className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${
                  posicion === valor ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-blue-900'
                }`}
              >
                <Icono className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
