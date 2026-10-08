import { useEffect, useId, useRef, useState } from 'react';
import ModalCentrado from './ModalCentrado';
import { BOTON } from '../fondos/estilosFondo';

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Confirmación común: título corto, una frase de qué pasará, detalle opcional (lista
 * corta) y el error del backend dentro del modal (el modal queda abierto si falla).
 *
 * - tono 'peligro' (rojo: solo eliminar, archivar o quitar) o 'normal' (azul).
 * - onConfirmar puede ser async: mientras trabaja el botón muestra textoTrabajando;
 *   si lanza un Error, su mensaje se muestra en el modal.
 * - informativo: un solo botón "Entendido" (p. ej. "No se puede eliminar").
 * - Escape o clic fuera cancelan, el foco empieza en Cancelar y no sale del modal,
 *   y Enter confirma.
 */
function ModalConfirmar({
  titulo,
  mensaje,
  detalle = [],
  tono = 'normal',
  textoAccion = 'Confirmar',
  textoTrabajando = 'Procesando...',
  onConfirmar,
  onCancelar,
  informativo = false,
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const dialogoRef = useRef(null);
  const cancelarRef = useRef(null);
  const montadoRef = useRef(true);
  const idTitulo = useId();
  const idMensaje = useId();
  const peligro = tono === 'peligro';

  const cancelar = () => {
    if (!trabajando) onCancelar();
  };

  const confirmar = async () => {
    if (informativo) {
      onCancelar();
      return;
    }
    if (trabajando) return;
    setTrabajando(true);
    setError('');
    try {
      await onConfirmar();
    } catch (err) {
      if (montadoRef.current) setError(err?.message || 'No se pudo completar la acción.');
    } finally {
      if (montadoRef.current) setTrabajando(false);
    }
  };

  // Foco inicial en Cancelar (o en Entendido) y, al cerrar, de vuelta donde estaba.
  useEffect(() => {
    montadoRef.current = true;
    const anterior = document.activeElement;
    cancelarRef.current?.focus();
    return () => {
      montadoRef.current = false;
      if (anterior && typeof anterior.focus === 'function') anterior.focus();
    };
  }, []);

  const alPulsarTecla = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelar();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmar();
      return;
    }
    if (event.key !== 'Tab') return;
    // El foco no sale del modal.
    const elementos = [...(dialogoRef.current?.querySelectorAll(FOCUSABLES) || [])];
    if (elementos.length === 0) return;
    const primero = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  };

  return (
    <ModalCentrado onClose={cancelar}>
      <div
        ref={dialogoRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idMensaje}
        onKeyDown={alPulsarTecla}
        className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
        style={{ animationDuration: '160ms' }}
      >
        <div className="px-6 pt-6">
          <h4 id={idTitulo} className={`text-xl font-bold ${peligro && !informativo ? 'text-red-700' : 'text-blue-900'}`}>{titulo}</h4>
          <div id={idMensaje} className="mt-1 text-sm text-slate-600">{mensaje}</div>
        </div>

        {(detalle.length > 0 || error) && (
          <div className="px-6 pt-4 space-y-3 text-sm">
            {detalle.length > 0 && (
              <ul className="rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3 text-slate-700 list-disc list-inside space-y-0.5">
                {detalle.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</p>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-6">
          {informativo ? (
            <button
              ref={cancelarRef}
              type="button"
              onClick={onCancelar}
              className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
            >
              Entendido
            </button>
          ) : (
            <>
              <button
                ref={cancelarRef}
                type="button"
                onClick={cancelar}
                disabled={trabajando}
                className={`${BOTON} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={trabajando}
                className={`${BOTON} px-5 py-2.5 text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                  peligro ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-900 hover:bg-blue-950'
                }`}
              >
                {trabajando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {trabajando ? textoTrabajando : textoAccion}
              </button>
            </>
          )}
        </div>
      </div>
    </ModalCentrado>
  );
}

export default ModalConfirmar;
