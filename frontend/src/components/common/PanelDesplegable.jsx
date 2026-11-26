import { useCallback, useLayoutEffect, useRef } from 'react';

const SALIDA_MS = 130;
const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)';

const reducirMovimiento = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Quien abre el panel lo quita del DOM al cerrarlo. Para que no desaparezca de golpe, justo
// antes de que React lo quite se deja en su lugar una copia inerte que se desvanece.
function animarSalida(panel, arriba) {
  const padre = panel?.parentNode;
  if (!padre || !panel.isConnected || typeof panel.animate !== 'function') return;
  const copia = panel.cloneNode(true);
  copia.classList.add('desplegable-saliendo');
  copia.setAttribute('aria-hidden', 'true');
  copia.setAttribute('inert', '');
  copia.removeAttribute('id');
  copia.style.pointerEvents = 'none';
  padre.insertBefore(copia, panel.nextSibling);
  copia.scrollTop = panel.scrollTop;

  const reducir = reducirMovimiento();
  const hasta = reducir
    ? { opacity: 0 }
    : { opacity: 0, transform: `translateY(${arriba ? 4 : -4}px) scale(0.98)` };
  const salida = copia.animate([{ opacity: 1 }, hasta], {
    duration: reducir ? 100 : SALIDA_MS,
    easing: CURVA,
    fill: 'forwards',
  });
  salida.onfinish = () => copia.remove();
  salida.oncancel = () => copia.remove();
}

/**
 * Panel de un desplegable (selector, filtro, menú): entra bajando un poco y creciendo desde
 * el campo, y al cerrarse se desvanece. Recibe las mismas props que el <div> que reemplaza
 * (ref, className, style, role...). Si el panel se abre hacia arriba (style.bottom o
 * lado="arriba"), entra subiendo. Las opciones llevan la clase desplegable-opcion y --i
 * (utils/cascada) para aparecer en cascada.
 */
function PanelDesplegable({ ref, lado, className = '', style, children, ...props }) {
  const propioRef = useRef(null);
  const arriba = lado === 'arriba' || (style?.bottom != null && style?.top == null);

  const asignarRef = useCallback((nodo) => {
    propioRef.current = nodo;
    if (typeof ref === 'function') ref(nodo);
    else if (ref) ref.current = nodo;
  }, [ref]);

  // La limpieza de un layout effect corre antes de que React quite el nodo. En desarrollo
  // (StrictMode) el efecto se monta y desmonta de inmediato: sin un cuadro de por medio no
  // se anima la salida.
  const arribaRef = useRef(arriba);
  useLayoutEffect(() => {
    arribaRef.current = arriba;
  }, [arriba]);
  useLayoutEffect(() => {
    const panel = propioRef.current;
    let listo = false;
    const cuadro = requestAnimationFrame(() => { listo = true; });
    return () => {
      cancelAnimationFrame(cuadro);
      if (listo) animarSalida(panel, arribaRef.current);
    };
  }, []);

  return (
    <div
      ref={asignarRef}
      className={`desplegable-panel ${className}`}
      data-lado={arriba ? 'arriba' : 'abajo'}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export default PanelDesplegable;
