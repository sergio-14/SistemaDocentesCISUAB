import { useEffect, useRef, useState } from 'react';

// Desplegable de "Actividades planificadas": una casilla por unidad para mostrarla u
// ocultarla. Las unidades sin carga se listan sin casilla activa (no tienen actividades).
// unidades: [{ tipo, nombre, conCarga }]; ocultas: Set con los tipos ocultos.

function Casilla({ marcada }) {
  return (
    <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded ring-1 ring-inset transition-colors ${
      marcada ? 'bg-blue-900 ring-blue-900 text-white' : 'bg-white ring-azulado-300'
    }`}>
      {marcada && (
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}

function FiltroUnidades({ unidades, ocultas, onCambiar }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarSiEsFuera = (event) => {
      if (!contenedorRef.current?.contains(event.target)) setAbierto(false);
    };
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', cerrarSiEsFuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarSiEsFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierto]);

  const conCarga = unidades.filter((unidad) => unidad.conCarga);
  const mostradas = conCarga.filter((unidad) => !ocultas.has(unidad.tipo)).length;
  const todasMarcadas = mostradas === conCarga.length;

  const alternar = (tipo) => {
    const siguiente = new Set(ocultas);
    if (siguiente.has(tipo)) siguiente.delete(tipo);
    else siguiente.add(tipo);
    onCambiar(siguiente);
  };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`h-8 pl-3 pr-1.5 rounded-full bg-azulado-50 text-xs text-slate-800 flex items-center gap-2 ring-inset transition-colors ${
          abierto ? 'ring-2 ring-blue-900/40' : 'ring-1 ring-azulado-300 hover:ring-blue-900/30'
        }`}
      >
        <span>
          Unidades <span className="font-semibold text-blue-900 tabular-nums">{mostradas} de {conCarga.length}</span>
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#2C4AAE]">
          <svg className={`h-3 w-3 text-white transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {abierto && (
        <div
          role="menu"
          className="animate-campo-entrada absolute right-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-1.5 ring-1 ring-azulado-300 shadow-lg"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={todasMarcadas}
            onClick={() => onCambiar(todasMarcadas ? new Set(conCarga.map((unidad) => unidad.tipo)) : new Set())}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs text-left font-semibold text-blue-900 hover:bg-azulado-100 transition-colors"
          >
            Todas las unidades
            <Casilla marcada={todasMarcadas} />
          </button>
          <div className="my-1 h-px bg-azulado-200" />
          {unidades.map((unidad) => (
            <button
              key={unidad.tipo}
              type="button"
              role="menuitemcheckbox"
              aria-checked={unidad.conCarga && !ocultas.has(unidad.tipo)}
              disabled={!unidad.conCarga}
              onClick={() => alternar(unidad.tipo)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left text-slate-800 hover:bg-azulado-100 transition-colors disabled:cursor-default disabled:hover:bg-transparent disabled:text-slate-400"
            >
              <span className="flex-1 min-w-0 truncate" title={unidad.nombre}>{unidad.nombre}</span>
              {!unidad.conCarga && <span className="text-xs text-slate-400">Sin carga</span>}
              <Casilla marcada={unidad.conCarga && !ocultas.has(unidad.tipo)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FiltroUnidades;
