import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ESTADOS_FONDO, iniciales } from './estilosFondo';

// Piezas visuales comunes del dashboard y del detalle del fondo.

export function EstadoPill({ estado }) {
  const info = ESTADOS_FONDO[estado] || ESTADOS_FONDO.borrador;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${info.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

export function Avatar({ nombre, size = 'w-12 h-12' }) {
  return (
    <div className={`${size} rounded-full bg-blue-900 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {iniciales(nombre)}
    </div>
  );
}

export function BarraProgreso({ valor, color = 'bg-blue-900' }) {
  return (
    <div className="h-2 w-full rounded-full bg-azulado-200 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${valor}%` }} />
    </div>
  );
}

export function Etiqueta({ children }) {
  return (
    <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-azulado-100 text-slate-700 ring-1 ring-inset ring-azulado-300">
      {children}
    </span>
  );
}

const dia = (iso) => {
  const [anio, mes, d] = String(iso || '').split('-');
  return anio && mes && d ? `${d}/${mes}/${anio}` : iso;
};

/**
 * Arts. 15 y 18: etiqueta discreta "Fuera de plazo" junto al estado. Al pasar el mouse,
 * tocarla o enfocarla muestra qué plazo, la fecha límite y la de presentación.
 * `vencidos`: [{ plazo, calendario, fecha_limite, fecha_presentacion }] (fondo.fuera_de_plazo).
 */
export function EtiquetaFueraDePlazo({ vencidos }) {
  const [abierta, setAbierta] = useState(false);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const contenedorRef = useRef(null);
  const detalleRef = useRef(null);
  const idDetalle = useId();

  // Que el detalle no se salga de la pantalla (en el celular la etiqueta queda al medio).
  useLayoutEffect(() => {
    if (!abierta || !contenedorRef.current || !detalleRef.current) return;
    const margen = 16;
    const inicio = contenedorRef.current.getBoundingClientRect().left;
    const ancho = detalleRef.current.offsetWidth;
    const sobrante = inicio + ancho - (window.innerWidth - margen);
    setDesplazamiento(sobrante > 0 ? Math.max(margen - inicio, -sobrante) : 0);
  }, [abierta]);

  // Abierta con un toque: se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!abierta) return undefined;
    const fuera = (e) => {
      if (!contenedorRef.current?.contains(e.target)) setAbierta(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierta]);

  if (!vencidos?.length) return null;
  return (
    // Mouse: se abre al pasar por encima. Toque: se abre al tocar (el navegador también
    // simula mouseenter/mouseleave al tocar; por eso solo cuenta un mouse de verdad).
    // Teclado: se abre al enfocarla.
    <span
      ref={contenedorRef}
      className="relative inline-flex"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setAbierta(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setAbierta(false)}
    >
      <button
        type="button"
        onClick={() => setAbierta(true)}
        onFocus={(e) => e.target.matches(':focus-visible') && setAbierta(true)}
        onBlur={() => setAbierta(false)}
        aria-expanded={abierta}
        aria-describedby={idDetalle}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
        </svg>
        Fuera de plazo
      </button>
      <span
        id={idDetalle}
        role="tooltip"
        ref={detalleRef}
        style={{ left: desplazamiento }}
        className={`absolute top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-3 text-left shadow-xl ring-1 ring-azulado-300 transition ${
          abierta ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <span className="block text-xs font-semibold text-red-700">Presentado fuera de plazo</span>
        <span className="mt-2 block space-y-2">
          {vencidos.map((v) => (
            <span key={`${v.plazo}-${v.calendario}`} className="block rounded-xl bg-azulado-50 px-3 py-2 text-xs text-slate-700">
              <span className="block font-semibold text-slate-800 first-letter:uppercase">{v.plazo} · {v.calendario}</span>
              Límite {dia(v.fecha_limite)} · presentado {dia(v.fecha_presentacion)}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
