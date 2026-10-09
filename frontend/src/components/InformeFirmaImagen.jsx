import { useRef, useState } from 'react';
import { Crop, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInformeDocumento } from './InformeDocumentoContext';
import RecortarImagenModal from './RecortarImagenModal';
import {
  MAXIMO_IMAGENES_INFORME, MENSAJE_LIMITE_IMAGENES, TAMANO_MAXIMO_IMAGEN_MB,
  contarImagenesInforme, prepararImagenInforme,
} from '../utils/imagenesInforme';

const srcDeHtml = (html) => (html || '').match(/<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2] || '';

const BOTON_FIRMA = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors';

/**
 * Imagen de la firma, sobre el nombre del docente (p. ej. la firma escaneada).
 * Se guarda como un <img> en firma_imagen_html, con las mismas reglas que las
 * imágenes del documento (formato, tamaño y cantidad máxima).
 */
export default function InformeFirmaImagen({ value, onChange }) {
  const { soloLectura } = useInformeDocumento();
  const archivoRef = useRef(null);
  const [recortando, setRecortando] = useState(false);
  const src = srcDeHtml(value);

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!src && contarImagenesInforme() >= MAXIMO_IMAGENES_INFORME) {
      toast.error(MENSAJE_LIMITE_IMAGENES);
      return;
    }
    try {
      onChange(`<img src="${await prepararImagenInforme(archivo)}">`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (soloLectura) {
    return src ? <img src={src} alt="Firma" className="mx-auto max-h-24 max-w-full object-contain" /> : null;
  }

  return (
    <div className="mb-2">
      <input
        ref={archivoRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={elegirArchivo}
      />
      {src ? (
        <div className="group relative informe-campo-rico">
          {/* Con un clic queda marcada; Suprimir (o Retroceso) la quita */}
          <img
            src={src}
            alt="Firma"
            tabIndex={0}
            title="Haz clic y pulsa Suprimir para quitarla"
            onKeyDown={(e) => {
              if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onChange('');
              }
            }}
            className="mx-auto max-h-24 max-w-full object-contain rounded-sm outline-none focus:ring-2 focus:ring-blue-900"
          />
          {/* Acciones al pasar el mouse sobre la firma */}
          <div className="absolute inset-x-0 -bottom-3 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            <button type="button" onClick={() => archivoRef.current?.click()} className={`${BOTON_FIRMA} bg-blue-900 text-white hover:bg-blue-950 shadow`}>
              <RefreshCw className="h-3.5 w-3.5" /> Cambiar
            </button>
            <button type="button" onClick={() => setRecortando(true)} className={`${BOTON_FIRMA} bg-white text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 shadow`}>
              <Crop className="h-3.5 w-3.5" /> Recortar
            </button>
            <button type="button" onClick={() => onChange('')} className={`${BOTON_FIRMA} bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 shadow`}>
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          title={`PNG, JPG o GIF, máx. ${TAMANO_MAXIMO_IMAGEN_MB} MB`}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-azulado-300 bg-azulado-50 px-3 py-4 text-xs text-slate-500 transition-colors hover:border-blue-900 hover:text-blue-900"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <ImagePlus className="h-6 w-6" />
          Agregar imagen de la firma
        </button>
      )}
      {recortando && (
        <RecortarImagenModal
          src={src}
          onAplicar={(dataUrl) => { setRecortando(false); onChange(`<img src="${dataUrl}">`); }}
          onCancelar={() => setRecortando(false)}
        />
      )}
    </div>
  );
}
