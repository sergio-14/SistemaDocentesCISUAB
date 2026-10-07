import { paginasVisibles } from '../../utils/paginacion';

// Paginación de los listados: solo los números de página (con anterior y siguiente), centrados.
function Paginacion({ paginaActual, totalPaginas, onCambiar }) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1 py-1" aria-label="Paginación">
      <button
        type="button"
        onClick={() => onCambiar(paginaActual - 1)}
        disabled={paginaActual === 1}
        aria-label="Página anterior"
        className="flex h-9 w-9 items-center justify-center rounded-full text-blue-900 hover:bg-azulado-200 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      {paginasVisibles(paginaActual, totalPaginas).map((numero, i) => (
        numero === '…' ? (
          <span key={`salto-${i}`} className="w-6 text-center text-sm text-slate-400">…</span>
        ) : (
          <button
            key={numero}
            type="button"
            onClick={() => onCambiar(numero)}
            aria-current={numero === paginaActual ? 'page' : undefined}
            className={`h-9 min-w-9 px-3 rounded-full text-sm font-semibold tabular-nums transition-colors ${
              numero === paginaActual ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-700 hover:bg-azulado-200'
            }`}
          >
            {numero}
          </button>
        )
      ))}
      <button
        type="button"
        onClick={() => onCambiar(paginaActual + 1)}
        disabled={paginaActual === totalPaginas}
        aria-label="Página siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-full text-blue-900 hover:bg-azulado-200 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </nav>
  );
}

export default Paginacion;
