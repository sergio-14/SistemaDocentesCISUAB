import { useEffect, useId, useRef, useState } from 'react';
import ModalCentrado from './ModalCentrado';
import { BOTON } from '../fondos/estilosFondo';

// Foco visible con un anillo azul suave en lugar del contorno negro del navegador.
const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900/40';

// Íconos del bloque de la cabecera (como el ícono de la cabecera del dashboard).
const ICONOS = {
  peligro: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  informativo: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
  normal: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z',
};

const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Confirmación común: título corto, una frase de qué pasará, detalle opcional (lista
 * corta) y el error del backend dentro del modal (el modal queda abierto si falla).
 *
 * - tono 'peligro' (rojo: solo eliminar, archivar o quitar) o 'normal' (azul).
 * - onConfirmar puede ser async: mientras trabaja el botón muestra textoTrabajando;
 *   si lanza un Error, su mensaje se muestra en el modal.
 * - informativo: un solo botón "Entendido" (p. ej. "No se puede eliminar").
 * - etiqueta: línea corta en mayúsculas sobre el título (p. ej. "Usuarios"), como en
 *   la cabecera del dashboard.
 * - children: contenido extra bajo el detalle (p. ej. un archivo que hay que adjuntar).
 * - Escape o clic fuera cancelan, el foco empieza en Cancelar y no sale del modal,
 *   y Enter confirma.
 */
function ModalConfirmar({
  titulo,
  etiqueta = '',
  mensaje,
  detalle = [],
  tono = 'normal',
  textoAccion = 'Confirmar',
  textoTrabajando = 'Procesando...',
  onConfirmar,
  onCancelar,
  informativo = false,
  children = null,
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
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
        style={{ animationDuration: '160ms' }}
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${
              peligro && !informativo
                ? 'bg-red-50 ring-red-200 text-red-600'
                : 'bg-gradient-to-br from-sky-50 to-azulado-200 ring-azulado-300 text-blue-900'
            }`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONOS[informativo ? 'informativo' : (peligro ? 'peligro' : 'normal')]} />
            </svg>
          </span>
          <div className="min-w-0 pt-0.5">
            {etiqueta && (
              <p className={`text-xs font-semibold uppercase tracking-wider ${peligro && !informativo ? 'text-red-600' : 'text-blue-700'}`}>{etiqueta}</p>
            )}
            <h4 id={idTitulo} className="text-xl font-bold leading-tight text-blue-900">{titulo}</h4>
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 space-y-4">
          <div id={idMensaje} className="text-sm leading-relaxed text-slate-600">{mensaje}</div>
          {detalle.length > 0 && (
            <ul className="divide-y divide-azulado-200 rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 text-sm">
              {detalle.map((item) => (
                <li key={item} className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-900/60" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {children}
          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 bg-azulado-100/60 px-6 py-4 [border-top:1px_solid_#B8C9E1]">
          {informativo ? (
            <button
              ref={cancelarRef}
              type="button"
              onClick={onCancelar}
              className={`${BOTON} ${FOCO} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
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
                className={`${BOTON} ${FOCO} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={trabajando}
                className={`${BOTON} ${FOCO} px-5 py-2.5 text-white disabled:opacity-60 disabled:cursor-not-allowed ${
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
