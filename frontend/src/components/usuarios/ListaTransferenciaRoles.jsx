import { ERROR_MOTION_CLASS } from '../../utils/formErrors';

// Lista de transferencia de los formularios de usuario (crear y editar): a la
// izquierda todos los roles, a la derecha los asignados. La carrera es una sola para
// todos los roles y se elige aparte. Las reglas (máximo 2, un solo cargo de mando)
// las aplica quien la usa en onMoverDerecha.
const ListaTransferenciaRoles = ({
  roles,
  asignados,
  seleccionIzquierda,
  onSeleccionarIzquierda,
  seleccionDerecha,
  onSeleccionarDerecha,
  onMoverDerecha,
  onMoverIzquierda,
  bloquearAsignar = false,
  bloquearQuitar = false,
  errorIzquierda = false,
  errorDerecha = false,
  pulsoIzquierda = false,
  pulsoDerecha = false,
  etiquetaRol,
}) => {
  const rolesAsignados = new Set(asignados.map((item) => item.rol));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
      {/* Panel izquierdo: roles disponibles */}
      <div className={`rounded-2xl bg-white flex flex-col ring-1 ring-inset ${errorIzquierda ? 'ring-2 ring-red-500' : 'ring-azulado-300'} ${pulsoIzquierda ? ERROR_MOTION_CLASS : ''}`}>
        <p className="px-4 py-2.5 text-xs font-semibold text-blue-800 [border-bottom:1px_solid_#D2DDEE]">Roles disponibles</p>
        <div className="flex-1 overflow-y-auto max-h-72 min-h-[148px] p-1.5">
          {roles.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No hay roles disponibles</p>
          ) : (
            roles.map((rol) => {
              const yaAsignado = rolesAsignados.has(rol.value);
              const elegido = seleccionIzquierda === rol.value;
              return (
                <button
                  key={rol.value}
                  type="button"
                  onClick={() => onSeleccionarIzquierda(rol.value)}
                  onDoubleClick={() => onMoverDerecha(rol.value)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between gap-2 ${
                    elegido ? 'bg-sky-600 text-white font-semibold' : 'text-slate-700 hover:bg-blue-900 hover:text-white'
                  }`}
                >
                  <span>{rol.label}</span>
                  {yaAsignado && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${elegido ? 'bg-white/25 text-white' : 'bg-sky-50 text-sky-700'}`}>
                      Asignado
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Flechas centrales */}
      <div className="flex sm:flex-col items-center justify-center gap-2 px-1">
        <button
          type="button"
          onClick={() => seleccionIzquierda && onMoverDerecha(seleccionIzquierda)}
          disabled={!seleccionIzquierda || bloquearAsignar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900 text-white hover:bg-blue-950 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Asignar rol"
          aria-label="Asignar rol"
        >
          <svg className="w-4 h-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
        <button
          type="button"
          onClick={() => seleccionDerecha !== null && onMoverIzquierda(seleccionDerecha)}
          disabled={seleccionDerecha === null || bloquearQuitar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900 text-white hover:bg-blue-950 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Quitar rol"
          aria-label="Quitar rol"
        >
          <svg className="w-4 h-4 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
      </div>

      {/* Panel derecho: roles asignados */}
      <div className={`rounded-2xl bg-white flex flex-col ring-1 ring-inset ${errorDerecha ? 'ring-2 ring-red-500' : 'ring-azulado-300'} ${pulsoDerecha ? ERROR_MOTION_CLASS : ''}`}>
        <p className="px-4 py-2.5 text-xs font-semibold text-blue-800 [border-bottom:1px_solid_#D2DDEE]">Roles asignados</p>
        <div className="flex-1 overflow-y-auto max-h-72 min-h-[148px] p-1.5">
          {asignados.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Use las flechas para asignar roles</p>
          ) : (
            asignados.map((item, index) => (
              <button
                key={`${item.rol}-${index}`}
                type="button"
                onClick={() => onSeleccionarDerecha(index)}
                onDoubleClick={() => onMoverIzquierda(index)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between gap-2 ${
                  seleccionDerecha === index ? 'bg-sky-600 text-white font-semibold' : 'text-slate-700 hover:bg-blue-900 hover:text-white'
                }`}
              >
                <span>{etiquetaRol(item.rol)}</span>
                {index === 0 && asignados.length > 1 && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${seleccionDerecha === index ? 'bg-white/25 text-white' : 'bg-sky-50 text-sky-700'}`}>
                    Principal
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ListaTransferenciaRoles;
