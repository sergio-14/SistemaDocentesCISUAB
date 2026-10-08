// Piezas comunes de los formularios de usuario (crear y editar), con el estilo del
// dashboard de Fondo de Tiempo: secciones con título y notas bajo los campos.

export const CandadoIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

// Sección del formulario: título corto en mayúsculas y, a su derecha, un aviso que
// vale para toda la sección (p. ej. por qué hay campos bloqueados). El contenedor las
// separa con una línea.
export const SeccionUsuario = ({ titulo, aviso, children }) => (
  <section className="px-5 sm:px-6 py-4 space-y-3">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-700">{titulo}</h3>
      {aviso && (
        <p className="flex items-start gap-1.5 text-xs leading-snug text-slate-600 sm:text-right">
          <CandadoIcon className="w-3.5 h-3.5 mt-px flex-shrink-0" />
          <span>{aviso}</span>
        </p>
      )}
    </div>
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
