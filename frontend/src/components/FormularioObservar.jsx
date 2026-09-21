import { useState } from 'react';
import { observarFondo } from '../apis/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/formErrors';

const PaperAirplaneIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const InfoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M12 8.25h.008v.008H12V8.25z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function FormularioObservar({ fondo, onObservar, onCancelar }) {
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!observacion.trim()) {
      toast.error('Debes escribir una observacion');
      return;
    }

    if (observacion.trim().length < 10) {
      toast.error('La observacion debe tener al menos 10 caracteres');
      return;
    }

    try {
      setEnviando(true);
      await observarFondo(fondo.id, {
        observacion: observacion.trim(),
        accion: 'observar',
      });

      onObservar();
      toast.success('Observacion enviada al docente');

      setTimeout(() => {}, 500);
    } catch (err) {
      console.error('Error al observar:', err);
      toast.error(getApiErrorMessage(err, 'Error al enviar la observacion'));
      setEnviando(false);
    }
  };

  return (
    <div className="observacion-modal-overlay">
      <div className="observacion-modal-card">
        <div className="observacion-modal-header">
          <h2 className="observacion-modal-title">
            <span className="observacion-modal-title-icon">
              <PaperAirplaneIcon className="h-4 w-4" />
            </span>
            Observar Fondo de Tiempo
          </h2>
          <p className="observacion-modal-subtitle">
            Envia tus observaciones al docente para que realice las correcciones necesarias
          </p>
        </div>

        <form onSubmit={handleSubmit} className="observacion-modal-form">
          <div className="observacion-modal-info">
            <div className="observacion-modal-info-grid">
              <div>
                <span>Docente:</span>
                <p>
                  {fondo.docente?.nombre_completo || 'N/A'}
                </p>
              </div>
              <div>
                <span>Carrera:</span>
                <p>
                  {fondo.carrera?.nombre || 'N/A'}
                </p>
              </div>
              <div>
                <span>Asignatura:</span>
                <p>
                  {fondo.asignatura || 'N/A'}
                </p>
              </div>
              <div>
                <span>Gestion:</span>
                <p>
                  {fondo.gestion} - {fondo.periodo}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="observacion-modal-label">
              Observaciones *
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={8}
              placeholder={'Ejemplo:\n\n1. Falta especificar las horas de tutoria en la funcion Docente.\n2. El porcentaje de Investigacion (5%) esta por debajo del minimo requerido (10%).\n3. Debe adjuntar el programa analitico actualizado.'}
              className="observacion-modal-textarea"
              required
            />
            <p className="observacion-modal-help">
              Se especifico sobre que debe corregir el docente
            </p>
          </div>

          <div className="observacion-modal-note">
            <div className="observacion-modal-note-inner">
              <span className="observacion-modal-note-icon">
                <InfoIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="observacion-modal-note-title">
                  Al enviar esta observacion:
                </p>
                <ul className="observacion-modal-note-list">
                  <li>El fondo volvera a estado <strong>"Observado"</strong></li>
                  <li>El docente podra editar y corregir el fondo</li>
                  <li>El docente vera tus comentarios en el timeline</li>
                  <li>Deberas revisar nuevamente cuando lo vuelva a presentar</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="observacion-modal-actions">
            <button
              type="button"
              onClick={onCancelar}
              disabled={enviando}
              className="observacion-modal-button observacion-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !observacion.trim()}
              className="observacion-modal-button observacion-modal-button-primary"
            >
              {enviando ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-5 w-5" />
                  <span>Enviar Observacion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioObservar;
