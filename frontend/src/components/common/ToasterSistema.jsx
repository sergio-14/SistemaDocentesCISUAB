import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast, { Toaster, resolveValue } from 'react-hot-toast';

// Color, título e icono (relleno) de cada tipo de toast del sistema (diseño del dashboard de Fondo de Tiempo).
// Sin bordes: el aviso se distingue por su color de fondo y su sombra.
const TIPOS = {
  success: {
    titulo: 'Listo',
    fondo: 'bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-[0_10px_28px_rgba(5,150,105,0.35)]',
    icono: (
      <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" />
    ),
  },
  error: {
    titulo: 'Atención',
    fondo: 'bg-gradient-to-br from-red-400 to-rose-400 shadow-[0_10px_28px_rgba(248,113,113,0.3)]',
    icono: (
      <path fillRule="evenodd" clipRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    ),
  },
  blank: {
    titulo: 'Aviso',
    fondo: 'bg-gradient-to-br from-sky-600 to-sky-500 shadow-[0_10px_28px_rgba(2,132,199,0.35)]',
    icono: (
      <path fillRule="evenodd" clipRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    ),
  },
};
TIPOS.loading = { ...TIPOS.blank, titulo: 'Procesando' };

const DURACION_MS = 4000;

function ToastFondo({ t }) {
  const tipo = TIPOS[t.type] || TIPOS.blank;

  // Todos los avisos duran 4 s, aunque quien lo lanzó haya pedido más tiempo.
  useEffect(() => {
    if (t.type === 'loading' || !t.visible) return undefined;
    const temporizador = setTimeout(() => toast.dismiss(t.id), DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [t.id, t.type, t.visible]);

  return (
    <div
      className={`pointer-events-auto relative flex w-[min(23rem,calc(100vw-1.5rem))] items-center gap-3 overflow-hidden rounded-2xl p-3.5 pr-2.5 text-white ${tipo.fondo} ${
        t.visible ? 'animate-toast-fondo-entrada' : 'animate-toast-fondo-salida'
      }`}
      {...t.ariaProps}
    >
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ${t.visible ? 'animate-toast-fondo-icono' : ''}`}>
        {t.type === 'loading' ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg className="h-7 w-7 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
            {tipo.icono}
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{t.titulo || tipo.titulo}</p>
        <p className="mt-0.5 text-sm leading-snug text-white/90 break-words">
          {resolveValue(t.message, t)}
        </p>
      </div>
      {/* Acción opcional del aviso (p. ej. "Ver" abre el fondo): toast(texto, { accion: { etiqueta, alHacerClic } }) */}
      {t.accion && (
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            t.accion.alHacerClic();
          }}
          className="flex-shrink-0 self-center rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-white/90"
        >
          {t.accion.etiqueta}
        </button>
      )}
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Cerrar aviso"
        className="flex-shrink-0 self-start rounded-full p-1.5 text-white/75 hover:bg-white/20 hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Estilo anterior: solo lo conserva el módulo POA, que es de otro equipo.
const estiloPoa = (isDark) => ({
  style: {
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '14px',
    fontWeight: '500',
    zIndex: 1000001,
  },
  success: {
    style: {
      background: isDark ? '#064e3b' : '#f0fdf4',
      color: isDark ? '#a7f3d0' : '#166534',
      border: '2px solid #10b981',
      borderLeft: '4px solid #059669',
    },
    icon: '✅',
    duration: 4000,
  },
  error: {
    style: {
      background: isDark ? '#7f1d1d' : '#fef2f2',
      color: isDark ? '#fecaca' : '#991b1b',
      border: '2px solid #ef4444',
      borderLeft: '4px solid #f59e0b',
    },
    icon: '⚠️',
    duration: 6000,
  },
});

// Toaster global: el aviso del dashboard de Fondo de Tiempo en todo el sistema
// (Usuarios, Carreras, el selector de módulos…). Aparece arriba a la derecha (clase
// toaster-fondo en index.css) y un clic fuera del aviso lo cierra.
function ToasterSistema({ isDark }) {
  const { pathname } = useLocation();
  const enPoa = pathname.startsWith('/poa');

  useEffect(() => {
    if (enPoa) return undefined;
    const cerrarAvisos = (event) => {
      if (event.target.closest?.('.toaster-fondo')) return;
      toast.dismiss();
    };
    document.addEventListener('pointerdown', cerrarAvisos, true);
    return () => document.removeEventListener('pointerdown', cerrarAvisos, true);
  }, [enPoa]);

  if (enPoa) {
    return <Toaster position="top-right" toastOptions={estiloPoa(isDark)} />;
  }

  return (
    <Toaster
      position="top-right"
      containerClassName="toaster-fondo"
      gutter={10}
      toastOptions={{
        duration: DURACION_MS,
      }}
    >
      {(t) => <ToastFondo t={t} />}
    </Toaster>
  );
}

export default ToasterSistema;
