import { useEffect, useRef, useState } from 'react';
import { ERROR_MOTION_CLASS } from '../../utils/formErrors';
import { CandadoIcon } from './PiezasFormularioUsuario';

// Lista de transferencia de los formularios de usuario (crear y editar): a la
// izquierda todos los roles, a la derecha los asignados (siempre en celeste, el color
// de "Generar Fondos Masivamente"), cada uno con la carrera del usuario.
//
// La carrera es UNA para todos los roles (la del contrato): el superusuario la elige
// en la fila de cualquier rol asignado y se aplica a todos. Al pasar el primer rol sin
// carrera, su lista de carreras se abre sola. Los avisos de los roles (errores, bloqueo
// de la carrera) van en el pie del panel de asignados, y debajo de cada fila puede ir
// contenido propio del rol (p. ej. la ficha de docente).
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
  maximo = 2,
  etiquetaRol,
  // Carrera del usuario
  carrera = '',
  carreras = [],
  elegirCarrera = false,
  carreraBloqueada = false,
  onCambiarCarrera,
  // Avisos y contenido extra
  error = '',
  aviso = '',
  pulso = false,
  contenidoFila,
}) => {
  const rolesAsignados = new Set(asignados.map((item) => item.rol));
  const nombreCarrera = carreras.find((item) => String(item.id) === String(carrera))?.nombre || '';
  const [carreraAbierta, setCarreraAbierta] = useState(null);
  const cantidadAnterior = useRef(asignados.length);

  // Primer rol (o uno nuevo) sin carrera: se abre su lista de carreras.
  useEffect(() => {
    if (asignados.length > cantidadAnterior.current && elegirCarrera && !carrera && !carreraBloqueada) {
      setCarreraAbierta(asignados.length - 1);
    }
    if (asignados.length < cantidadAnterior.current) setCarreraAbierta(null);
    cantidadAnterior.current = asignados.length;
  }, [asignados.length, elegirCarrera, carrera, carreraBloqueada]);

  const elegir = (id) => {
    onCambiarCarrera(String(id));
    setCarreraAbierta(null);
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-stretch ${pulso ? ERROR_MOTION_CLASS : ''}`}>
      {/* Panel izquierdo: roles disponibles */}
      <div className="rounded-2xl bg-white flex flex-col ring-1 ring-inset ring-azulado-300">
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
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${elegido ? 'bg-white/25 text-white' : 'bg-sky-600 text-white'}`}>
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

      {/* Panel derecho: roles asignados, con su carrera y sus avisos al pie */}
      {/* Borde por fuera (no inset): el pie con fondo no lo tapa. */}
      <div className={`rounded-2xl bg-white flex flex-col overflow-hidden ${error ? 'ring-2 ring-red-500' : 'ring-1 ring-azulado-300'}`}>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 [border-bottom:1px_solid_#D2DDEE]">
          <p className="text-xs font-semibold text-blue-800">Roles asignados</p>
          <span className="text-xs font-medium text-slate-500 tabular-nums">{asignados.length} de {maximo}</span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-72 min-h-[148px] p-1.5 space-y-1">
          {asignados.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 px-4">
              Elija un rol a la izquierda y páselo con la flecha o con doble clic.
            </p>
          ) : (
            asignados.map((item, index) => (
              <div key={`${item.rol}-${index}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSeleccionarDerecha(index)}
                  onDoubleClick={() => onMoverIzquierda(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSeleccionarDerecha(index);
                    }
                  }}
                  className={`w-full cursor-pointer px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between gap-2 bg-sky-600 text-white hover:bg-sky-700 ${
                    seleccionDerecha === index ? 'ring-2 ring-blue-900 ring-offset-1' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{etiquetaRol(item.rol)}</span>
                    {index === 0 && asignados.length > 1 && (
                      <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/25">Principal</span>
                    )}
                  </span>
                  {elegirCarrera ? (
                    <button
                      type="button"
                      disabled={carreraBloqueada}
                      onClick={(event) => {
                        event.stopPropagation();
                        setCarreraAbierta((abierta) => (abierta === index ? null : index));
                      }}
                      onDoubleClick={(event) => event.stopPropagation()}
                      aria-expanded={carreraAbierta === index}
                      className={`flex-shrink-0 max-w-[60%] inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold truncate ${
                        nombreCarrera ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-red-600'
                      } disabled:cursor-not-allowed disabled:hover:bg-white/20`}
                    >
                      {carreraBloqueada ? <CandadoIcon className="w-3 h-3 flex-shrink-0" /> : <span aria-hidden="true">{carreraAbierta === index ? '▾' : '▸'}</span>}
                      <span className="truncate">{nombreCarrera || 'Elegir carrera'}</span>
                    </button>
                  ) : (
                    nombreCarrera && <span className="flex-shrink-0 max-w-[60%] truncate px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20">{nombreCarrera}</span>
                  )}
                </div>
                {elegirCarrera && carreraAbierta === index && (
                  <div className="px-1 pt-1.5 pb-1">
                    <div role="listbox" aria-label="Carrera del usuario" className="ml-auto w-full sm:w-[75%] rounded-2xl bg-white ring-1 ring-azulado-300 shadow-lg max-h-40 overflow-y-auto p-1.5">
                      {carreras.map((opcion) => (
                        <button
                          key={opcion.id}
                          type="button"
                          role="option"
                          aria-selected={String(opcion.id) === String(carrera)}
                          onClick={() => elegir(opcion.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs ${
                            String(opcion.id) === String(carrera) ? 'bg-sky-600 text-white font-semibold' : 'text-slate-700 hover:bg-blue-900 hover:text-white'
                          }`}
                        >
                          {opcion.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {contenidoFila?.(item, index)}
              </div>
            ))
          )}
        </div>
        {(error || aviso) && (
          <p
            role={error ? 'alert' : undefined}
            className={`flex items-start gap-1.5 px-4 py-2 text-xs leading-snug [border-top:1px_solid_#D2DDEE] ${error ? 'bg-red-50 text-red-700' : 'bg-azulado-50 text-slate-600'}`}
          >
            {!error && <CandadoIcon className="w-3.5 h-3.5 mt-px flex-shrink-0" />}
            <span>{error || aviso}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default ListaTransferenciaRoles;
