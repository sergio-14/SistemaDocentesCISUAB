import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Upload } from 'lucide-react';
import api from '../../apis/api';
import { getApiErrorMessage } from '../../utils/formErrors';

/**
 * PDF de un ítem del fondo (programa analítico, documento de proyecto o curso). Muestra
 * el enlace al PDF y, si `puedeSubir`, el botón para subirlo o reemplazarlo: envía
 * `campos` + `archivo` a `endpoint`.
 */
const ArchivoPdfAccion = ({ endpoint, campos, nombre, url, puedeSubir, onSubido }) => {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    const payload = new FormData();
    Object.entries(campos).forEach(([campo, valor]) => payload.append(campo, valor));
    payload.append('archivo', archivo);
    setSubiendo(true);
    try {
      await api.post(endpoint, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(url ? `${nombre} reemplazado` : `${nombre} subido`);
      onSubido?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, `No se pudo subir el ${nombre.toLowerCase()}`));
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-normal">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-azulado-100 px-2.5 py-1 font-semibold text-blue-900 hover:bg-azulado-200 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          {nombre} (PDF)
        </a>
      ) : (
        !puedeSubir && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            Sin {nombre.toLowerCase()}
          </span>
        )
      )}
      {puedeSubir && (
        <>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={subir} />
          <button
            type="button"
            data-escritura
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold transition-colors disabled:opacity-60 ${
              url
                ? 'text-slate-600 hover:bg-azulado-200'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {subiendo ? 'Subiendo...' : url ? 'Reemplazar' : `Subir ${nombre.toLowerCase()} (PDF)`}
          </button>
        </>
      )}
    </div>
  );
};

export default ArchivoPdfAccion;
