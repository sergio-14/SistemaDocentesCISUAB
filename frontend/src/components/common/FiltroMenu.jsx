import { useEffect, useId, useRef, useState } from 'react';
import PanelDesplegable from './PanelDesplegable';
import { cascada } from '../../utils/cascada';

const ICONO_FILTRO = 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75';

/**
 * Un solo botón "Filtrar" (como en el sistema de modalidades): despliega columnas separadas
 * por una línea y en cada una se marca lo que se quiere ver; se aplica al instante.
 *
 * columnas: [{ clave, titulo, opciones: [{ valor, etiqueta }], multiple?, obligatoria?, nota? }]
 *   En una columna normal se marca una opción y tocarla de nuevo la quita (vuelve a "todas").
 *   Con multiple se marcan varias (casillas) y su valor es un arreglo. Con obligatoria
 *   siempre queda una marcada (tocarla de nuevo no la quita) y no cuenta como filtro activo.
 * valores:  { [clave]: valor } ('' o ausente = sin filtro; [] en las columnas multiple)
 * onCambiar(clave, valor) · onLimpiar(): quita todos (botón con una X, sin texto, si hay filtros).
 */
function FiltroMenu({ columnas, valores, onCambiar, onLimpiar, etiqueta = 'Filtrar' }) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef(null);
  const botonRef = useRef(null);
  const idPanel = `filtros-${useId().replace(/:/g, '')}`;

  // Las columnas obligatorias no cuentan: siempre tienen algo marcado.
  const activos = columnas.reduce((suma, columna) => {
    if (columna.obligatoria) return suma;
    const valor = valores[columna.clave];
    if (Array.isArray(valor)) return suma + valor.length;
    return suma + (valor !== undefined && valor !== null && valor !== '' ? 1 : 0);
  }, 0);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsarFuera = (evento) => {
      if (!raizRef.current?.contains(evento.target)) setAbierto(false);
    };
    const alPulsarTecla = (evento) => {
      if (evento.key !== 'Escape') return;
      setAbierto(false);
      botonRef.current?.focus();
    };
    document.addEventListener('pointerdown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto]);

  const marcada = (columna, valor) => {
    const actual = valores[columna.clave];
    return columna.multiple
      ? (Array.isArray(actual) ? actual : []).map(String).includes(String(valor))
      : String(actual ?? '') === String(valor);
  };

  const alternar = (columna, valor) => {
    if (columna.multiple) {
      const actual = (Array.isArray(valores[columna.clave]) ? valores[columna.clave] : []).map(String);
      const texto = String(valor);
      onCambiar(columna.clave, actual.includes(texto) ? actual.filter((item) => item !== texto) : [...actual, texto]);
    } else if (marcada(columna, valor)) {
      if (!columna.obligatoria) onCambiar(columna.clave, '');
    } else {
      onCambiar(columna.clave, valor);
    }
  };

  return (
    <div ref={raizRef} className="relative flex items-center gap-2">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((previo) => !previo)}
        className={`h-11 pl-4 pr-2.5 rounded-full bg-azulado-100 ring-1 ring-inset text-sm font-semibold text-blue-900 flex items-center gap-2 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40 ${
          abierto ? 'ring-blue-900/40' : 'ring-azulado-300 hover:ring-blue-900/30'
        }`}
      >
        <svg className="h-[18px] w-[18px] text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTRO} />
        </svg>
        <span>{etiqueta}</span>
        {activos > 0 && (
          <span
            key={activos}
            className="animate-filtro-contador grid h-[22px] min-w-[22px] place-items-center rounded-full bg-blue-900 px-1.5 text-xs font-bold text-white tabular-nums"
            aria-label={`${activos} ${activos === 1 ? 'filtro activo' : 'filtros activos'}`}
          >
            {activos}
          </span>
        )}
        <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] flex-shrink-0" aria-hidden="true">
          <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {activos > 0 && onLimpiar && (
        <button
          type="button"
          onClick={onLimpiar}
          title="Quitar todos los filtros"
          aria-label="Quitar todos los filtros"
          className="animate-filtro-contador h-11 w-11 flex-shrink-0 rounded-full bg-white ring-1 ring-inset ring-red-300 text-red-700 grid place-items-center transition-colors hover:bg-red-50 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {abierto && (
        <PanelDesplegable
          id={idPanel}
          role="group"
          aria-label="Filtros"
          style={{ transformOrigin: 'top left', width: `min(${columnas.length * 15 + 1.5}rem, calc(100vw - 2rem))` }}
          className="absolute left-0 top-full z-50 mt-2 rounded-2xl bg-white p-3 ring-1 ring-azulado-300 shadow-xl"
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }}>
            {columnas.map((columna, indiceColumna) => (
              <fieldset
                key={columna.clave}
                className={`min-w-0 m-0 border-0 px-2.5 max-h-[17.5rem] overflow-y-auto overscroll-contain ${
                  indiceColumna > 0 ? '[border-left:1px_solid_#D6E0EE]' : ''
                }`}
              >
                <legend className="float-left w-full pb-2 pl-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {columna.titulo}
                </legend>
                <div className="clear-both space-y-0.5">
                  {columna.opciones.length === 0 ? (
                    <p className="px-2.5 py-1.5 text-xs text-slate-500">{columna.nota || 'Sin opciones'}</p>
                  ) : columna.opciones.map((opcion, indice) => {
                    const activa = marcada(columna, opcion.valor);
                    return (
                      <button
                        key={`${columna.clave}-${opcion.valor}`}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => alternar(columna, opcion.valor)}
                        style={cascada(indiceColumna + indice)}
                        className={`desplegable-opcion w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40 ${
                          activa ? 'text-blue-900 font-semibold' : 'text-slate-700 hover:bg-azulado-100'
                        }`}
                      >
                        <MarcaFiltro activa={activa} casilla={columna.multiple} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{opcion.etiqueta}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </PanelDesplegable>
      )}
    </div>
  );
}

// Círculo (una opción por columna) o casilla (varias), rellenos en azul cuando están marcados.
function MarcaFiltro({ activa, casilla }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ring-1 ring-inset transition-colors ${
        casilla ? 'rounded' : 'rounded-full'
      } ${activa ? 'bg-blue-900 ring-blue-900' : 'bg-white ring-azulado-300'}`}
    >
      {activa && (casilla ? (
        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
      ))}
    </span>
  );
}

export default FiltroMenu;
