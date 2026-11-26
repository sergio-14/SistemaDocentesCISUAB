import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOPE_ESPERA_MS = 350;
const QUIETO_MS = 90;
const SALIDA_MS = 180;
const SALIDA_REDUCIDA_MS = 120;
const CURVA_SALIDA = 'cubic-bezier(0.23, 1, 0.32, 1)';

const reducirMovimiento = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Quien abre la ventana la quita del DOM al cerrarla (X, Cancelar, Guardar...). Para que
// no desaparezca de golpe, justo antes de que React la quite se deja una copia inerte
// en <body> que se desvanece y después se borra.
function animarSalida(fondo) {
  if (!fondo?.isConnected || typeof fondo.animate !== 'function') return;
  const copia = fondo.cloneNode(true);
  copia.classList.add('modal-centrado-saliendo');
  copia.setAttribute('aria-hidden', 'true');
  copia.setAttribute('inert', '');
  copia.style.pointerEvents = 'none';
  document.body.appendChild(copia);
  copia.scrollTop = fondo.scrollTop;

  const reducir = reducirMovimiento();
  const duracion = reducir ? SALIDA_REDUCIDA_MS : SALIDA_MS;
  const ventana = copia.firstElementChild;
  if (!reducir && ventana) {
    ventana.animate(
      [{ transform: 'none' }, { transform: 'translateY(6px) scale(0.98)' }],
      { duration: duracion, easing: CURVA_SALIDA, fill: 'forwards' },
    );
  }
  const salida = copia.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: duracion,
    easing: CURVA_SALIDA,
    fill: 'forwards',
  });
  salida.onfinish = () => copia.remove();
  salida.oncancel = () => copia.remove();
}

// Modal del módulo de Fondo de Tiempo: se monta en <body> para que la animación de
// entrada de la página (que usa transform) no lo encierre, y cubre solo el área a la
// derecha del sidebar (--fondo-sidebar-width) con el fondo empañado.
//
// El fondo se oscurece enseguida; la ventana espera invisible a que su contenido deje de
// cambiar de tamaño (tope de 350 ms) y entra una sola vez con su tamaño final. Si después
// cambia de alto, se desliza a su nuevo centro en vez de saltar. Al cerrarse se desvanece.
function ModalCentrado({ children, onClose }) {
  const fondoRef = useRef(null);
  const ventanaRef = useRef(null);
  const visibleRef = useRef(false);
  const [asentada, setAsentada] = useState(() => typeof ResizeObserver === 'undefined');

  useEffect(() => {
    if (asentada) return undefined;
    const ventana = ventanaRef.current;
    let quieto = null;
    const asentar = () => setAsentada(true);
    const tope = window.setTimeout(asentar, TOPE_ESPERA_MS);
    const observador = new ResizeObserver(() => {
      window.clearTimeout(quieto);
      quieto = window.setTimeout(asentar, QUIETO_MS);
    });
    if (ventana) observador.observe(ventana);
    return () => {
      observador.disconnect();
      window.clearTimeout(quieto);
      window.clearTimeout(tope);
    };
  }, [asentada]);

  // Reacomodo después de entrar (FLIP): offsetTop no incluye la animación de entrada,
  // así que mide solo el cambio de lugar por el nuevo alto.
  useEffect(() => {
    const ventana = ventanaRef.current;
    if (!asentada || !ventana || typeof ResizeObserver === 'undefined' || typeof ventana.animate !== 'function') {
      return undefined;
    }
    visibleRef.current = true;
    let arribaPrevio = ventana.offsetTop;
    const observador = new ResizeObserver(() => {
      const arriba = ventana.offsetTop;
      const delta = arribaPrevio - arriba;
      arribaPrevio = arriba;
      if (Math.abs(delta) < 2 || reducirMovimiento()) return;
      ventana.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
        { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', composite: 'add' },
      );
    });
    observador.observe(ventana);
    return () => observador.disconnect();
  }, [asentada]);

  // La limpieza de un layout effect corre antes de que React quite el portal: el nodo
  // todavía está en la página y se puede copiar. Solo si la ventana llegó a verse.
  useLayoutEffect(() => {
    const fondo = fondoRef.current;
    return () => {
      if (visibleRef.current) animarSalida(fondo);
    };
  }, []);

  return createPortal(
    <div
      ref={fondoRef}
      className="modal-centrado-fondo fixed top-0 right-0 bottom-0 z-[60] flex overflow-y-auto bg-blue-950/30 backdrop-blur-sm p-3 sm:p-6"
      style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ventanaRef}
        className="modal-centrado-ventana m-auto w-full flex justify-center"
        data-estado={asentada ? 'abierta' : 'midiendo'}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export default ModalCentrado;
