import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { compararFondos, getFondosTiempo } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage } from '../utils/formErrors';
import FiltroDesplegable from './common/FiltroDesplegable';
import SelectorVista from './common/SelectorVista';
import { BLOQUE, BOTON, ORDEN_UNIDADES, colorUnidad, estadoVisibleFondo } from './fondos/estilosFondo';
import { BarraProgreso, EstadoPill, Etiqueta } from './fondos/ElementosFondo';

const VISTA_COMPARADOR_KEY = 'comparador_vista';

const horas = (valor) => Math.round(Number(valor) || 0);
const avanceDe = (fondo) => {
  const efectivas = horas(fondo.horas_efectivas);
  return efectivas > 0 ? Math.min(100, Math.round((horas(fondo.total_asignado) / efectivas) * 100)) : 0;
};

// Unidades del fondo en el orden del Art. 12, con horas y porcentaje como números.
const unidadesDe = (fondo) => Object.fromEntries((fondo?.categorias || []).map((categoria) => [
  categoria.tipo,
  { nombre: categoria.tipo_display, horas: horas(categoria.total_horas), porcentaje: Number(categoria.porcentaje) || 0 },
]));

// Diferencia de la gestión más nueva respecto de la anterior.
function Diferencia({ valor }) {
  if (!valor) return <span className="text-sm text-slate-500">Sin cambio</span>;
  return (
    <span className={`text-sm font-bold tabular-nums ${valor > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
      {valor > 0 ? '+' : '−'}{Math.abs(valor)} h
    </span>
  );
}

function TarjetaFondo({ fondo }) {
  const unidades = unidadesDe(fondo);
  const datos = ORDEN_UNIDADES
    .filter((tipo) => unidades[tipo]?.horas > 0)
    .map((tipo) => ({ tipo, name: unidades[tipo].nombre, value: unidades[tipo].horas }));
  const efectivas = horas(fondo.horas_efectivas);
  const asignadas = horas(fondo.total_asignado);
  const avance = avanceDe(fondo);

  return (
    <div className={`${BLOQUE} p-5 sm:p-6 flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Gestión</p>
          <h3 className="text-3xl font-bold text-blue-900 tabular-nums leading-tight">{fondo.gestion}</h3>
        </div>
        <EstadoPill estado={estadoVisibleFondo(fondo)} />
      </div>
      {fondo.descripcion && <div><Etiqueta>{fondo.descripcion}</Etiqueta></div>}

      <div className="rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-slate-600">Asignadas / efectivas</span>
          <span className="tabular-nums whitespace-nowrap">
            <span className="font-bold text-slate-800">{asignadas}</span>
            <span className="text-slate-500"> / {efectivas} h</span>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <BarraProgreso valor={avance} color={avance === 100 ? 'bg-emerald-500' : 'bg-blue-900'} />
          <span className="text-xs font-bold text-blue-900 tabular-nums w-9 text-right">{avance}%</span>
        </div>
      </div>

      {datos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="#F7F9FD"
                  strokeWidth={2}
                  dataKey="value"
                >
                  {datos.map((entry) => <Cell key={entry.tipo} fill={colorUnidad(entry.tipo)} />)}
                </Pie>
                <Tooltip formatter={(value) => `${Math.round(value)} h`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-600">
            {datos.map((entry) => (
              <li key={entry.tipo} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: colorUnidad(entry.tipo) }} />
                {entry.name}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">Este fondo aún no tiene horas asignadas.</p>
      )}

      <div className="mt-auto pt-3 [border-top:1px_solid_#B8C9E1]">
        <Link to={`/fondo-tiempo/fondo/${fondo.id}`} className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}>
          <Eye className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span>Ver fondo</span>
        </Link>
      </div>
    </div>
  );
}

// Vista de lista: una fila por gestión, con la misma cuadrícula que la lista del dashboard.
// Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
const COLUMNAS_LISTA = 'xl:grid-cols-[7rem_minmax(0,1.5fr)_8rem_10rem_11rem_9rem]';

function ListaGestiones({ fondos }) {
  return (
    <div className={`${BLOQUE} p-2 sm:p-3`}>
      <div className={`hidden xl:grid ${COLUMNAS_LISTA} gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
        <span>Gestión</span>
        <span>Descripción</span>
        <span>Horas asignadas</span>
        <span>Progreso</span>
        <span>Estado</span>
        <span>Acciones</span>
      </div>
      <div className="divide-y divide-azulado-300">
        {fondos.map((fondo, indice) => (
          <div
            key={fondo.id}
            style={{ animationDelay: `${indice * 35}ms` }}
            className={`animate-fondo-entrada grid grid-cols-1 ${COLUMNAS_LISTA} items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl hover:bg-azulado-100/70 transition-colors`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl font-bold text-blue-900 tabular-nums">{fondo.gestion}</span>
              <div className="xl:hidden"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
            </div>
            <div className="min-w-0">
              {fondo.descripcion && <span className="inline-flex max-w-full truncate"><Etiqueta>{fondo.descripcion}</Etiqueta></span>}
            </div>
            <div className="flex items-baseline justify-between xl:block">
              <span className="xl:hidden text-xs font-medium text-slate-600">Horas asignadas</span>
              <span className="tabular-nums whitespace-nowrap">
                <span className="font-bold text-slate-800">{horas(fondo.total_asignado)}</span>
                <span className="text-sm text-slate-500"> / {horas(fondo.horas_efectivas)} hrs</span>
              </span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600">Progreso</span>
                <span className="text-sm font-bold text-blue-900 tabular-nums">{avanceDe(fondo)}%</span>
              </div>
              <BarraProgreso valor={avanceDe(fondo)} />
            </div>
            <div className="hidden xl:block"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
            <div>
              <Link to={`/fondo-tiempo/fondo/${fondo.id}`} className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}>
                <Eye className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span>Ver fondo</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Unidad por unidad: horas y porcentaje de cada gestión, y la diferencia de la más nueva.
function TablaDiferencias({ anterior, posterior }) {
  const unidadesA = unidadesDe(anterior);
  const unidadesB = unidadesDe(posterior);
  const maximo = Math.max(1, ...ORDEN_UNIDADES.flatMap((tipo) => [unidadesA[tipo]?.horas || 0, unidadesB[tipo]?.horas || 0]));
  const columnas = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_7rem]';

  const celda = (unidad, tipo, tenue) => (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-slate-800 tabular-nums">{unidad?.horas || 0} h</span>
        <span className="text-xs text-slate-500 tabular-nums">{(unidad?.porcentaje || 0).toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-azulado-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${((unidad?.horas || 0) / maximo) * 100}%`, backgroundColor: colorUnidad(tipo), opacity: tenue ? 0.45 : 1 }}
        />
      </div>
    </div>
  );

  const totales = [
    { label: 'Horas efectivas', a: horas(anterior.horas_efectivas), b: horas(posterior.horas_efectivas) },
    { label: 'Horas asignadas', a: horas(anterior.total_asignado), b: horas(posterior.total_asignado) },
  ];

  return (
    <div className={`${BLOQUE} p-5 sm:p-6`}>
      <h3 className="text-base font-bold text-blue-900">Diferencias por unidad</h3>
      <p className="mt-1 text-sm text-slate-600">
        Horas por año de cada unidad del Art. 12 y su porcentaje sobre las horas efectivas.
      </p>

      {/* Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas. */}
      <div className={`hidden md:grid ${columnas} gap-4 mt-5 px-3 pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
        <span>Unidad</span>
        <span>Gestión {anterior.gestion}</span>
        <span>Gestión {posterior.gestion}</span>
        <span className="text-right">Diferencia</span>
      </div>
      <div className="mt-3 md:mt-1 divide-y divide-azulado-300">
        {ORDEN_UNIDADES.map((tipo) => {
          const a = unidadesA[tipo];
          const b = unidadesB[tipo];
          return (
            <div key={tipo} className={`grid grid-cols-2 ${columnas} items-center gap-x-4 gap-y-2 px-3 py-3`}>
              <div className="col-span-2 md:col-span-1 flex items-center justify-between gap-3 min-w-0">
                <span className="inline-flex items-center gap-2 min-w-0 text-sm font-semibold text-slate-800">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colorUnidad(tipo) }} />
                  <span className="truncate">{(a || b)?.nombre}</span>
                </span>
                <span className="md:hidden"><Diferencia valor={(b?.horas || 0) - (a?.horas || 0)} /></span>
              </div>
              <div>
                <span className="md:hidden block mb-0.5 text-xs font-medium text-slate-500">{anterior.gestion}</span>
                {celda(a, tipo, true)}
              </div>
              <div>
                <span className="md:hidden block mb-0.5 text-xs font-medium text-slate-500">{posterior.gestion}</span>
                {celda(b, tipo, false)}
              </div>
              <div className="hidden md:block text-right"><Diferencia valor={(b?.horas || 0) - (a?.horas || 0)} /></div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 divide-y divide-azulado-300">
        {totales.map((fila) => (
          <div key={fila.label} className={`grid grid-cols-2 ${columnas} items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm`}>
            <span className="col-span-2 md:col-span-1 font-semibold text-slate-700">{fila.label}</span>
            <span className="font-bold text-slate-800 tabular-nums">{fila.a} h</span>
            <span className="font-bold text-slate-800 tabular-nums">{fila.b} h</span>
            <span className="col-span-2 md:col-span-1 md:text-right"><Diferencia valor={fila.b - fila.a} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Solo superusuario, Director y Jefe de Estudios (la ruta y la API lo exigen). El docente
// y las gestiones se eligen entre los fondos que el usuario ve en el dashboard.
function Comparador() {
  const { effectiveUser, activeAssignment } = useActiveRole();
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const [fondosVisibles, setFondosVisibles] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [docente, setDocente] = useState('');
  const [gestionA, setGestionA] = useState('');
  const [gestionB, setGestionB] = useState('');
  // Fondos de la última comparación y la selección a la que corresponden.
  const [comparacion, setComparacion] = useState({ clave: '', fondos: [] });
  const [comparando, setComparando] = useState(false);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_COMPARADOR_KEY) === 'tarjetas' ? 'tarjetas' : 'lista';
    } catch {
      return 'lista';
    }
  });

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    try {
      localStorage.setItem(VISTA_COMPARADOR_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };

  useEffect(() => {
    let vigente = true;
    setCargandoLista(true);
    getFondosTiempo()
      .then((data) => vigente && setFondosVisibles(Array.isArray(data) ? data : []))
      .catch((err) => vigente && setError(getApiErrorMessage(err, 'No se pudieron cargar los fondos.')))
      .finally(() => vigente && setCargandoLista(false));
    return () => { vigente = false; };
  }, [activeAssignment?.id]);

  // Docentes con fondo (orden alfabético) y, para el elegido, sus gestiones (la más nueva primero).
  const docentes = useMemo(() => {
    const porId = new Map();
    fondosVisibles.forEach((fondo) => {
      if (!porId.has(fondo.docente)) {
        porId.set(fondo.docente, esSuperusuario && fondo.carrera_nombre
          ? `${fondo.docente_nombre} · ${fondo.carrera_nombre}`
          : fondo.docente_nombre);
      }
    });
    return [...porId].map(([value, label]) => ({ value: String(value), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fondosVisibles, esSuperusuario]);

  const gestionesDocente = useMemo(() => (
    [...new Set(fondosVisibles.filter((fondo) => String(fondo.docente) === docente).map((fondo) => fondo.gestion))]
      .sort((a, b) => b - a)
  ), [fondosVisibles, docente]);

  // Al empezar, el primer docente; al cambiar de docente, sus dos gestiones más recientes.
  useEffect(() => {
    if (!docente && docentes.length > 0) setDocente(docentes[0].value);
  }, [docentes, docente]);

  useEffect(() => {
    setGestionB(gestionesDocente[0] ? String(gestionesDocente[0]) : '');
    setGestionA(gestionesDocente[1] ? String(gestionesDocente[1]) : '');
  }, [gestionesDocente]);

  // Compara al cambiar la selección (con una sola gestión, muestra ese fondo).
  const clave = `${docente}|${gestionA}|${gestionB}`;
  useEffect(() => {
    if (!docente || !gestionB) {
      setComparacion({ clave, fondos: [] });
      return undefined;
    }
    let vigente = true;
    setComparando(true);
    setError(null);
    compararFondos(docente, gestionA || gestionB, gestionB)
      .then((response) => vigente && setComparacion({ clave, fondos: Array.isArray(response.data) ? response.data : [] }))
      .catch((err) => {
        if (!vigente) return;
        setComparacion({ clave, fondos: [] });
        setError(err.response?.data?.error || getApiErrorMessage(err, 'No se pudo comparar los fondos.'));
      })
      .finally(() => vigente && setComparando(false));
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clave resume docente y gestiones.
  }, [docente, gestionA, gestionB]);

  const opcionesGestion = (excluir) => gestionesDocente
    .filter((gestion) => String(gestion) !== excluir)
    .map((gestion) => ({ value: String(gestion), label: `Gestión ${gestion}` }));

  const resultado = comparacion.fondos;
  // El aviso solo cuando el resultado es el de la selección actual (no el de la anterior).
  const elegidas = [...new Set([gestionA, gestionB].filter(Boolean).map(Number))];
  const sinFondo = comparacion.clave !== clave
    ? []
    : elegidas.filter((gestion) => !resultado.some((fondo) => fondo.gestion === gestion));
  // El backend las devuelve de la gestión más antigua a la más nueva.
  const [anterior, posterior] = resultado;

  if (cargandoLista) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando fondos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
      {/* Encabezado como en el dashboard, con las gestiones del docente al lado */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
              <ArrowLeftRight className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Gestión del Fondo de Tiempo Docente
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Comparar Fondos</h2>
              <p className="mt-1 text-sm text-slate-600">
                Distribución de horas de un docente en dos gestiones, unidad por unidad.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Gestiones</p>
            <p className="mt-1 text-sm text-blue-100">con fondo del docente</p>
          </div>
          <span className="text-5xl font-bold tabular-nums leading-none">{gestionesDocente.length}</span>
        </div>
      </div>

      {docentes.length === 0 ? (
        <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No hay fondos para comparar</h3>
          <p className="text-slate-600">Cuando los docentes tengan fondos de tiempo, se podrán comparar aquí.</p>
        </div>
      ) : (
        <>
          {/* Docente y gestiones: el propio campo filtra al escribir */}
          <div className={`${BLOQUE} p-3 grid gap-2 sm:gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center`}>
            <FiltroDesplegable
              value={docente}
              onChange={setDocente}
              options={docentes}
              placeholder="Docente"
              ariaLabel="Docente"
              permitirQuitar={false}
            />
            <FiltroDesplegable
              value={gestionA}
              onChange={setGestionA}
              options={opcionesGestion(gestionB)}
              placeholder={gestionesDocente.length > 1 ? 'Gestión a comparar' : 'Sin otra gestión'}
              ariaLabel="Gestión a comparar"
              emptyText="El docente no tiene otra gestión"
              permitirQuitar={false}
              disabled={gestionesDocente.length < 2}
            />
            <FiltroDesplegable
              value={gestionB}
              onChange={setGestionB}
              options={opcionesGestion(gestionA)}
              placeholder="Gestión"
              ariaLabel="Gestión"
              permitirQuitar={false}
            />
            <SelectorVista vista={vista} onCambiar={cambiarVista} className="justify-self-end" />
          </div>

          {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {gestionesDocente.length === 1 && (
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Este docente solo tiene fondo en la gestión {gestionesDocente[0]}: no hay otra gestión para comparar.
            </p>
          )}
          {sinFondo.map((gestion) => (
            <p key={gestion} className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              No hay fondo de la gestión {gestion}.
            </p>
          ))}

          {comparando && resultado.length === 0 ? (
            <div className={`${BLOQUE} p-10 text-center`}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-900 mx-auto"></div>
              <p className="mt-3 text-sm text-slate-600">Comparando...</p>
            </div>
          ) : resultado.length > 0 && (
            <div className={`space-y-4 transition-opacity ${comparando ? 'opacity-60' : ''}`}>
              {vista === 'lista' ? (
                <ListaGestiones fondos={resultado} />
              ) : (
                <div className={`grid gap-4 ${resultado.length > 1 ? 'md:grid-cols-2' : 'md:max-w-xl'}`}>
                  {resultado.map((fondo) => <TarjetaFondo key={fondo.id} fondo={fondo} />)}
                </div>
              )}
              {posterior && <TablaDiferencias anterior={anterior} posterior={posterior} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Comparador;
