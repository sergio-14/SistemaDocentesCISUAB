import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hoyBolivia } from '../../utils/fechas';

// Calendario de los campos de fecha (Fondo de Tiempo, Calendario Académico, Carreras y
// Docentes). Vista de días: "mes de año ▾" con flechas para cambiar de mes, semana desde
// el domingo y "Borrar" / "Hoy". Al pulsar el mes se pasa a la vista de años: cada año
// se despliega con sus 12 meses para saltar directo a uno.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const DIAS = ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sá.'];

const isoAFecha = (iso) => {
  if (!iso || typeof iso !== 'string') return null;
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  if (!y || fecha.getFullYear() !== y || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return fecha;
};

const fechaAIso = (fecha) => (
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
);

const mismoDia = (a, b) => Boolean(a && b && fechaAIso(a) === fechaAIso(b));

/**
 * Panel del calendario.
 * value: fecha elegida (ISO). min / max: límites (ISO, opcionales).
 * onElegir(iso): día permitido elegido. onNoPermitido(iso): día fuera de los límites.
 * onBorrar(): botón "Borrar".
 */
export function PanelCalendario({ value, min, max, onElegir, onNoPermitido, onBorrar }) {
  const hoy = isoAFecha(hoyBolivia());
  const elegida = isoAFecha(value);
  const fechaMin = isoAFecha(min);
  const fechaMax = isoAFecha(max);
  // Abre en el mes elegido; sin fecha, en el de hoy acotado a los límites.
  const base = elegida || (fechaMax && hoy > fechaMax ? fechaMax : fechaMin && hoy < fechaMin ? fechaMin : hoy);
  const [mesVisible, setMesVisible] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [vistaAnios, setVistaAnios] = useState(false);
  const [anioDesplegado, setAnioDesplegado] = useState(base.getFullYear());
  const anioRef = useRef(null);

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const anioMin = fechaMin ? fechaMin.getFullYear() : hoy.getFullYear() - 30;
  const anioMax = fechaMax ? fechaMax.getFullYear() : hoy.getFullYear() + 10;
  const anios = [];
  for (let a = anioMin; a <= anioMax; a += 1) anios.push(a);

  const fueraDeLimites = (fecha) => Boolean((fechaMin && fecha < fechaMin) || (fechaMax && fecha > fechaMax));

  // Seis semanas fijas, desde el domingo anterior al día 1 (con días de los meses vecinos).
  const inicio = new Date(anio, mes, 1 - new Date(anio, mes, 1).getDay());
  const celdas = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));

  const cambiarMes = (delta) => setMesVisible(new Date(anio, mes + delta, 1));
  const puedeIr = (delta) => {
    const destino = new Date(anio, mes + delta, 1);
    return destino.getFullYear() >= anioMin && destino.getFullYear() <= anioMax;
  };

  const elegir = (fecha) => {
    if (fueraDeLimites(fecha)) {
      onNoPermitido?.(fechaAIso(fecha));
      return;
    }
    onElegir(fechaAIso(fecha));
  };

  // En la vista de años, el año desplegado queda a la vista.
  useEffect(() => {
    if (vistaAnios) anioRef.current?.scrollIntoView({ block: 'start' });
  }, [vistaAnios]);

  const botonIcono = 'flex h-8 w-8 items-center justify-center rounded-full text-blue-900 hover:bg-azulado-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="w-[288px] max-w-[calc(100vw-1rem)] rounded-2xl bg-white ring-1 ring-azulado-300 shadow-xl p-3 select-none">
      <div className="flex items-center justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => {
            setAnioDesplegado(anio);
            setVistaAnios((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-blue-900 hover:bg-azulado-100 transition-colors"
          aria-label={vistaAnios ? 'Volver a los días' : 'Elegir mes y año'}
        >
          <span className="font-semibold">{MESES[mes]} de {anio}</span>
          <svg className={`w-3 h-3 transition-transform ${vistaAnios ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 9l6 6 6-6z" />
          </svg>
        </button>
        {!vistaAnios && (
          <div className="flex items-center">
            <button type="button" onClick={() => cambiarMes(-1)} disabled={!puedeIr(-1)} className={botonIcono} aria-label="Mes anterior">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-6 6 6-6 6 6" />
              </svg>
            </button>
            <button type="button" onClick={() => cambiarMes(1)} disabled={!puedeIr(1)} className={botonIcono} aria-label="Mes siguiente">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m6-6-6 6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {vistaAnios ? (
        <div className="h-[17.5rem] overflow-y-auto pr-1 divide-y divide-azulado-200">
          {anios.map((a) => {
            const desplegado = a === anioDesplegado;
            return (
              <div key={a} ref={desplegado ? anioRef : null}>
                <button
                  type="button"
                  onClick={() => setAnioDesplegado(desplegado ? null : a)}
                  className={`w-full text-left px-2 py-2 text-sm rounded-lg transition-colors hover:bg-azulado-100 ${
                    desplegado ? 'font-semibold text-blue-900' : 'text-slate-700'
                  }`}
                >
                  {a}
                </button>
                {desplegado && (
                  <div className="grid grid-cols-4 gap-1 px-1 pb-2">
                    {MESES_CORTOS.map((nombre, m) => {
                      const visible = a === anio && m === mes;
                      const actual = a === hoy.getFullYear() && m === hoy.getMonth();
                      const permitido = !(
                        (fechaMin && new Date(a, m + 1, 0) < fechaMin)
                        || (fechaMax && new Date(a, m, 1) > fechaMax)
                      );
                      return (
                        <button
                          key={nombre}
                          type="button"
                          disabled={!permitido}
                          onClick={() => {
                            setMesVisible(new Date(a, m, 1));
                            setVistaAnios(false);
                          }}
                          className={`py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            visible
                              ? 'bg-blue-900 text-white font-semibold'
                              : actual
                                ? 'bg-sky-600 text-white font-semibold hover:bg-blue-900'
                                : 'text-slate-700 hover:bg-blue-900 hover:text-white'
                          }`}
                        >
                          {nombre}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map((dia) => (
              <div key={dia} className="text-center text-xs font-semibold text-slate-500 py-1">{dia}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {celdas.map((fecha) => {
              const delMes = fecha.getMonth() === mes;
              const seleccionada = mismoDia(fecha, elegida);
              const esHoy = mismoDia(fecha, hoy);
              const bloqueada = fueraDeLimites(fecha);
              return (
                <button
                  key={fechaAIso(fecha)}
                  type="button"
                  onClick={() => elegir(fecha)}
                  aria-disabled={bloqueada || undefined}
                  className={`h-8 rounded-lg text-xs tabular-nums transition-colors ${
                    seleccionada
                      ? 'bg-blue-900 text-white font-semibold'
                      : bloqueada
                        ? 'text-slate-300 cursor-not-allowed'
                        : esHoy
                          ? 'bg-sky-600 text-white font-semibold hover:bg-blue-900'
                          : `${delMes ? 'text-slate-800' : 'text-slate-400'} hover:bg-blue-900 hover:text-white`
                  }`}
                >
                  {fecha.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-2 pt-2 flex items-center justify-between [border-top:1px_solid_#D2DDEE]">
        <button
          type="button"
          onClick={onBorrar}
          className="rounded-full px-3 py-1 text-sm text-blue-900 hover:bg-azulado-100 transition-colors"
        >
          Borrar
        </button>
        <button
          type="button"
          onClick={() => elegir(hoy)}
          className="rounded-full px-3 py-1 text-sm text-blue-900 hover:bg-azulado-100 transition-colors"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}

/**
 * El panel flotando junto al campo, en <body> con posición fija (así ningún modal lo
 * corta). anclaRef: el campo; se cierra al hacer clic fuera, desplazar o cambiar el tamaño.
 */
export function CalendarioFlotante({ abierto, anclaRef, onCerrar, ...panel }) {
  const panelRef = useRef(null);
  const [estilo, setEstilo] = useState(null);

  useLayoutEffect(() => {
    if (!abierto || !anclaRef.current) {
      setEstilo(null);
      return;
    }
    const rect = anclaRef.current.getBoundingClientRect();
    const alto = 380;
    const ancho = Math.min(288, window.innerWidth - 16);
    const abrirArriba = window.innerHeight - rect.bottom - 12 < alto && rect.top > window.innerHeight - rect.bottom;
    setEstilo({
      position: 'fixed',
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - ancho - 8))}px`,
      ...(abrirArriba ? { bottom: `${window.innerHeight - rect.top + 8}px` } : { top: `${rect.bottom + 8}px` }),
      zIndex: 99999,
    });
  }, [abierto, anclaRef]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (event) => {
      if (panelRef.current?.contains(event.target) || anclaRef.current?.contains(event.target)) return;
      onCerrar();
    };
    const alDesplazar = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      onCerrar();
    };
    const conEscape = (event) => {
      if (event.key === 'Escape') onCerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', conEscape);
    window.addEventListener('scroll', alDesplazar, true);
    window.addEventListener('resize', onCerrar);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', conEscape);
      window.removeEventListener('scroll', alDesplazar, true);
      window.removeEventListener('resize', onCerrar);
    };
  }, [abierto, anclaRef, onCerrar]);

  if (!abierto || !estilo) return null;
  return createPortal(
    <div ref={panelRef} style={estilo} className="animate-campo-entrada">
      <PanelCalendario {...panel} />
    </div>,
    document.body
  );
}
