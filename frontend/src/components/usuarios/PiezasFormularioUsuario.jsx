// Piezas comunes de los formularios de usuario (crear y editar), con el estilo del
// dashboard de Fondo de Tiempo: secciones con título, notas bajo los campos y los
// roles como botones que, elegidos, toman el celeste de "Generar Fondos Masivamente".

export const CandadoIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

// Sección del formulario: título corto en mayúsculas y su contenido (el contenedor
// las separa con una línea).
export const SeccionUsuario = ({ titulo, children }) => (
  <section className="px-5 sm:px-6 py-5 space-y-4">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-700">{titulo}</h3>
    {children}
  </section>
);

// Línea bajo un campo o grupo: ayuda (gris), bloqueo (gris con candado) o error (rojo).
export const NotaUsuario = ({ tipo = 'ayuda', children }) => {
  if (!children) return null;
  const color = tipo === 'error' ? 'text-red-600' : 'text-slate-500';
  return (
    <p className={`mt-1.5 pl-1 flex items-start gap-1.5 text-xs leading-snug ${color}`} role={tipo === 'error' ? 'alert' : undefined}>
      {tipo === 'bloqueo' && <CandadoIcon className="w-3.5 h-3.5 mt-px flex-shrink-0" />}
      <span>{children}</span>
    </p>
  );
};

// Roles del usuario: un botón por rol; elegido queda en celeste con un check. El orden
// en que se eligen importa: el primero es el rol principal y, con dos, se marca.
export const SelectorRoles = ({ roles, asignados, onAlternar, invalido = false, deshabilitado = false }) => (
  <div role="group" aria-label="Roles" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {roles.map((rol) => {
      const elegido = asignados.includes(rol.value);
      const esPrincipal = asignados.length > 1 && asignados[0] === rol.value;
      return (
        <button
          key={rol.value}
          type="button"
          aria-pressed={elegido}
          disabled={deshabilitado}
          onClick={() => onAlternar(rol.value)}
          className={`h-11 px-4 rounded-full text-sm text-left flex items-center justify-between gap-3 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            elegido
              ? 'bg-sky-600 text-white font-semibold ring-1 ring-sky-600 hover:bg-sky-700'
              : `bg-azulado-100 text-slate-700 hover:bg-azulado-200 ${invalido ? 'ring-2 ring-red-500' : 'ring-1 ring-azulado-300'}`
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{rol.label}</span>
            {esPrincipal && <span className="flex-shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Principal</span>}
          </span>
          <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${elegido ? 'bg-white text-sky-600' : 'ring-1 ring-inset ring-azulado-300 bg-white'}`}>
            {elegido && <CheckIcon className="w-3.5 h-3.5" />}
          </span>
        </button>
      );
    })}
  </div>
);
