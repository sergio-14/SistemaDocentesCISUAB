import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../apis/api';
import { getApiErrorMessage } from '../utils/formErrors';
import ModalCentrado from './common/ModalCentrado';
import { BOTON } from './fondos/estilosFondo';

// El Director pide correcciones al informe presentado: vuelve a ser editable para el
// docente, que lo actualiza y lo reenvía.
function ModalCorreccionesInforme({ fondo, onEnviado, onCancelar }) {
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (comentario.trim().length < 10) {
      toast.error('Debes explicar qué debe corregir el docente (mínimo 10 caracteres).');
      return;
    }
    try {
      setEnviando(true);
      await api.post(`/fondos-tiempo/${fondo.id}/observar-informe/`, { comentario: comentario.trim() });
      toast.success('Se solicitaron correcciones al docente.');
      await onEnviado();
    } catch (err) {
      console.error('Error al observar informe:', err);
      toast.error(getApiErrorMessage(err, 'No se pudo enviar la solicitud de corrección'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalCentrado>
      <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
        <div className="px-6 pt-6">
          <h3 className="text-xl font-bold text-blue-900">Solicitar correcciones al informe</h3>
          <p className="mt-1 text-sm text-slate-600">
            Explique qué debe corregir <strong className="text-blue-900">{fondo.docente?.nombre_completo}</strong>. El informe volverá a estado editable para que lo actualice y lo reenvíe.
          </p>
        </div>
        <div className="px-6 py-4">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={5}
            disabled={enviando}
            placeholder="Ej: Falta detallar los resultados por materia en la sección Académica..."
            className="w-full px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none resize-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100"
          />
          <p className="mt-1.5 pl-1 text-xs text-slate-500">Mínimo 10 caracteres.</p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
          <button
            onClick={onCancelar}
            disabled={enviando}
            className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={enviando || comentario.trim().length < 10}
            className={`${BOTON} px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {enviando && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Enviar solicitud
          </button>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default ModalCorreccionesInforme;
