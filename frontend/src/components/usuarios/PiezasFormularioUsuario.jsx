// Piezas comunes de los formularios de usuario (crear y editar), con el estilo del
// dashboard de Fondo de Tiempo: secciones con título y notas bajo los campos.

export const CandadoIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

// Candado de un campo bloqueado: círculo oscuro con el candado blanco, bien visible.
export const CandadoCampo = ({ className = '' }) => (
  <span
    title="Bloqueado"
    className={`pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-white shadow-sm ${className}`}
  >
    <CandadoIcon className="w-3.5 h-3.5" />
  </span>
);

// Advertencia de una sección o bloque, en su propio cuadro ámbar bien visible
// (no una línea suelta): por qué algo está bloqueado o no se puede hacer.
export const AvisoUsuario = ({ children }) => (
  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-300 px-3 py-2.5 text-sm font-medium leading-snug text-amber-900 shadow-sm">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
      <CandadoIcon className="w-3.5 h-3.5" />
    </span>
    <span className="pt-0.5">{children}</span>
  </div>
);

// Sección del formulario: título corto en mayúsculas, su aviso (si lo hay) en un
// cuadro propio y el contenido. El contenedor las separa con una línea.
export const SeccionUsuario = ({ titulo, aviso, children }) => (
  <section className="px-5 sm:px-6 py-4 space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-700">{titulo}</h3>
    {aviso && <AvisoUsuario>{aviso}</AvisoUsuario>}
    {children}
  </section>
);

// Línea bajo un campo: ayuda (gris) o error (rojo).
export const NotaUsuario = ({ tipo = 'ayuda', children }) => {
  if (!children) return null;
  const color = tipo === 'error' ? 'text-red-600' : 'text-slate-500';
  return (
    <p className={`mt-1.5 pl-1 flex items-start gap-1.5 text-xs leading-snug ${color}`} role={tipo === 'error' ? 'alert' : undefined}>
      <span>{children}</span>
    </p>
  );
};
