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

// Aviso de una sección o bloque en su propio cuadro, con la paleta de Fondo de
// Tiempo: fondo celeste claro, texto azul y el candado en el bloque azulado de sus íconos.
export const AvisoUsuario = ({ children }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-snug text-sky-900">
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900">
      <CandadoIcon className="w-4 h-4" />
    </span>
    <span className="pt-1">{children}</span>
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
