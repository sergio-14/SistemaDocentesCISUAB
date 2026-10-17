import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { observarFondo } from '../apis/api';
import toast from 'react-hot-toast';
import { ERROR_FIELD_BORDER_CLASS, MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import ModalCentrado from './common/ModalCentrado';
import { BOTON, BOTON_CHICO } from './fondos/estilosFondo';

// El aviso de qué pasa al enviar se oculta solo a los 5 s; un botón pequeño lo vuelve a mostrar.
const AVISO_VISIBLE_MS = 5000;

function FormularioObservar({ fondo, onObservar, onCancelar }) {
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [pulso, setPulso] = useState(0);
  const [avisoVisible, setAvisoVisible] = useState(true);

  useEffect(() => {
    const temporizador = setTimeout(() => setAvisoVisible(false), AVISO_VISIBLE_MS);
    return () => clearTimeout(temporizador);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const texto = observacion.trim();
    const mensaje = !texto
      ? 'Escriba la observación.'
      : texto.length < 10 ? 'La observación debe tener al menos 10 caracteres.' : '';
    if (mensaje) {
      setError(mensaje);
      setPulso((valor) => valor + 1);
      toast.error(MENSAJE_REVISA_CAMPOS);
      return;
    }

    try {
      setEnviando(true);
      await observarFondo(fondo.id, {
        observacion: observacion.trim(),
        accion: 'observar',
      });

      onObservar();
      toast.success('Observación enviada');
    } catch (err) {
      console.error('Error al observar:', err);
      toast.error(getApiErrorMessage(err, 'Error al enviar la observación'));
      setEnviando(false);
    }
  };

  return (
    <ModalCentrado>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-2xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl"
      >
        <div className="px-6 pt-6">
          <h3 className="text-xl font-bold text-blue-900">Observar Fondo de Tiempo</h3>
          <p className="mt-1 text-sm text-slate-600">
            Envíe sus observaciones para que se realicen las correcciones necesarias.
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-azulado-100 px-4 py-3 text-sm">
            {[
              { label: 'Docente', valor: fondo.docente?.nombre_completo || 'N/A' },
              { label: 'Carrera', valor: fondo.carrera?.nombre || 'N/A' },
              { label: 'Fondo', valor: fondo.descripcion },
              { label: 'Gestión', valor: fondo.gestion },
            ].map((dato) => (
              <div key={dato.label} className="min-w-0">
                <span className="text-xs text-slate-500">{dato.label}</span>
                <p className="font-semibold text-slate-800 truncate">{dato.valor}</p>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2 pl-1">Observaciones</label>
            <textarea
              value={observacion}
              onChange={(e) => { setObservacion(e.target.value); setError(''); }}
              rows={7}
              placeholder={'Ejemplo:\n\n1. Falta especificar las horas de tutoría en la función Docente.\n2. El porcentaje de Investigación (5%) está por debajo del mínimo requerido (10%).\n3. Debe adjuntar el programa analítico actualizado.'}
              className={`w-full px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none resize-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100 ${error ? ERROR_FIELD_BORDER_CLASS : ''}`}
              aria-invalid={Boolean(error) || undefined}
            />
            <MensajeErrorCampo error={error} pulse={pulso} />
            <p className="mt-1.5 pl-1 text-xs text-slate-500">
              Sea específico sobre qué se debe corregir.
            </p>
          </div>

          {avisoVisible ? (
            <div className="animate-fade-in rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p className="font-semibold">Al enviar esta observación:</p>
              <ul className="mt-1 space-y-0.5 list-disc pl-5 text-sky-800">
                <li>El fondo volverá a estado <strong>"Con observaciones"</strong></li>
                <li>Se podrá editar y corregir el fondo</li>
                <li>Sus comentarios quedarán en el historial del fondo</li>
                <li>Deberá revisarlo nuevamente cuando se vuelva a presentar</li>
              </ul>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAvisoVisible(true)}
              className={`${BOTON_CHICO} bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200 hover:bg-sky-100`}
            >
              <Info className="w-3.5 h-3.5" strokeWidth={2} />
              <span>¿Qué pasa al enviar?</span>
            </button>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !observacion.trim()}
            className={`${BOTON} px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {enviando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {enviando ? 'Enviando...' : 'Enviar observación'}
          </button>
        </div>
      </form>
    </ModalCentrado>
  );
}

export default FormularioObservar;
