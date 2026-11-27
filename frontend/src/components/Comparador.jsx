import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Eye } from 'lucide-react';
import { compararFondos, getFondosArchivados, getFondosTiempo } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage } from '../utils/formErrors';
import FiltroDesplegable from './common/FiltroDesplegable';
import FiltroMenu from './common/FiltroMenu';
import NumeroAnimado from './common/NumeroAnimado';
import SelectorVista from './common/SelectorVista';
import { BLOQUE, ORDEN_UNIDADES, estadoVisibleFondo } from './fondos/estilosFondo';
import { EstadoPill, Etiqueta } from './fondos/ElementosFondo';

const VISTA_COMPARAR_KEY = 'comparar_fondos_vista';
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

// Diferencia de la gestión más nueva respecto de la anterior, dicha como se habla:
// "160 h más" (celeste), "40 h menos" (rosado) o "Igual" (gris).
const PASTILLA = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap tabular-nums';
const TONO_PASTILLA = {
  mas: 'bg-blue-100 text-blue-900',
  menos: 'bg-red-100 text-red-700',
  igual: 'bg-slate-200 text-slate-600',
};
const BLOQUE_TOTAL = BLOQUE.replace('bg-azulado-50', 'bg-[#EAF0F9]');

function PastillaDiferencia({ valor }) {
  if (!valor) return <span className={`${PASTILLA} ${TONO_PASTILLA.igual}`}>Igual</span>;
  return (
    <span className={`${PASTILLA} ${valor > 0 ? TONO_PASTILLA.mas : TONO_PASTILLA.menos}`}>
      {Math.abs(valor)} h {valor > 0 ? 'más' : 'menos'}
    </span>
  );
}

const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

// Filas de la comparación (una por unidad del Art. 12 y el total de horas asignadas), con la
// escala de cada barra: las unidades entre sí y el total contra las horas efectivas.
function datosComparacion(fondos) {
  const unidades = fondos.map(unidadesDe);
  const filas = ORDEN_UNIDADES.map((tipo) => ({
    clave: tipo,
    etiqueta: unidades.map((porTipo) => porTipo[tipo]?.nombre).find(Boolean),
    valores: unidades.map((porTipo) => porTipo[tipo]?.horas || 0),
  }));
  const asignadas = { clave: 'asignadas', etiqueta: 'Horas asignadas', valores: fondos.map((fondo) => horas(fondo.total_asignado)) };
  return {
    filas,
    asignadas,
    maximoUnidad: Math.max(1, ...filas.flatMap((fila) => fila.valores)),
    maximoTotal: Math.max(1, ...fondos.map((fondo) => horas(fondo.horas_efectivas)), ...asignadas.valores),
  };
}

// Barra de horas de una gestión: la anterior en azul claro y la más nueva en azul oscuro.
// Crece al aparecer como las demás barras del sistema (barra-progreso-relleno).
function BarraHoras({ valor, maximo, nueva, retraso }) {
  const porcentaje = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-azulado-200 overflow-hidden" aria-hidden="true">
      <div
        className={`barra-progreso-relleno h-full w-full rounded-full ${nueva ? 'bg-blue-900' : 'bg-[#8FA9D6]'}`}
        style={{ transform: `translateX(${porcentaje - 100}%)`, animationDelay: `${retraso}ms` }}
      />
    </div>
  );
}

// Año, barra y horas de una gestión. conAnio: el año va al lado de la barra (tarjetas y celular).
function HorasGestion({ fondo, valor, maximo, nueva, retraso, conAnio }) {
  return (
    <div className={`grid items-center gap-3 ${conAnio ? 'grid-cols-[3rem_minmax(0,1fr)_4.75rem]' : 'grid-cols-[3rem_minmax(0,1fr)_4.75rem] md:grid-cols-[minmax(0,1fr)_4.75rem]'}`}>
      <span className={`text-sm font-medium text-slate-600 tabular-nums ${conAnio ? '' : 'md:hidden'}`}>{fondo.gestion}</span>
      <BarraHoras valor={valor} maximo={maximo} nueva={nueva} retraso={retraso} />
      <span className={`text-right text-base tabular-nums ${nueva ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
        {valor} h
      </span>
    </div>
  );
}

// Una gestión: muestra de su color, año, estado y enlace al fondo.
function CabeceraGestion({ fondo, nueva, conMuestra = false }) {
  return (
    <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex items-center gap-2">
        {conMuestra && (
          <span aria-hidden="true" className={`h-2 w-6 rounded-full ${nueva ? 'bg-blue-900' : 'bg-[#8FA9D6]'}`} />
        )}
        <span className="text-base font-bold text-blue-900 tabular-nums">Gestión {fondo.gestion}</span>
      </span>
      <EstadoPill estado={estadoVisibleFondo(fondo)} />
      {fondo.archivado && <Etiqueta>Archivado</Etiqueta>}
      <Link
        to={`/fondo-tiempo/fondo/${fondo.id}`}
        className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-blue-900 underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
      >
        <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Ver fondo
      </Link>
    </div>
  );
}

// Vista de tarjetas: las gestiones arriba y una tarjeta por unidad (3 por fila en escritorio,
// 2 en tableta, 1 en celular) con la diferencia y una barra rotulada por año; la última
// tarjeta, con fondo suave, es el total de horas asignadas.
function TarjetasComparacion({ fondos }) {
  const comparando = fondos.length === 2;
  const { filas, asignadas, maximoUnidad, maximoTotal } = datosComparacion(fondos);
  const tarjetas = [
    ...filas.map((fila) => ({ fila, maximo: maximoUnidad, total: false })),
    { fila: asignadas, maximo: maximoTotal, total: true },
  ];

  return (
    <div className="space-y-4">
      <div className={`${BLOQUE} px-5 py-3.5 sm:px-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-10`}>
        {fondos.map((fondo, posicion) => (
          <CabeceraGestion key={fondo.id} fondo={fondo} nueva={posicion === fondos.length - 1} conMuestra />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map(({ fila, maximo, total }, indice) => {
          const diferencia = comparando ? fila.valores[1] - fila.valores[0] : 0;
          const tenue = comparando && diferencia === 0 && !total;
          return (
            <article
              key={fila.clave}
              style={{ animationDelay: `${indice * 40}ms` }}
              className={`animate-fondo-entrada ${total ? BLOQUE_TOTAL : BLOQUE} p-5 flex flex-col gap-3.5`}
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className={`text-base leading-snug [overflow-wrap:anywhere] ${
                  total ? 'font-bold text-slate-900' : tenue ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'
                }`}>
                  {fila.etiqueta}
                </h4>
                {comparando && <PastillaDiferencia valor={diferencia} />}
              </div>
              {fila.valores.map((valor, posicion) => (
                <HorasGestion
                  key={fondos[posicion].id}
                  fondo={fondos[posicion]}
                  valor={valor}
                  maximo={maximo}
                  nueva={posicion === fondos.length - 1}
                  retraso={150 + indice * 40 + posicion * 60}
                  conAnio
                />
              ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// Una fila de la lista: nombre, barra y horas de cada gestión y la diferencia.
function FilaComparacion({ fila, fondos, columnas, maximo, comparando, total = false, indice = 0 }) {
  const diferencia = comparando ? fila.valores[1] - fila.valores[0] : 0;
  const tenue = comparando && diferencia === 0 && !total;
  return (
    <div
      style={{ animationDelay: `${indice * 35}ms` }}
      className={`animate-fondo-entrada grid grid-cols-1 ${columnas} md:items-center gap-x-6 gap-y-2 py-4 ${
        total ? 'bg-[#EAF0F9] rounded-2xl px-3.5 -mx-3.5 mt-1.5' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <span className={`text-base [overflow-wrap:anywhere] ${
          total ? 'font-bold text-slate-900' : tenue ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'
        }`}>
          {fila.etiqueta}
        </span>
        {comparando && <span className="md:hidden"><PastillaDiferencia valor={diferencia} /></span>}
      </div>
      {fila.valores.map((valor, posicion) => (
        <HorasGestion
          key={fondos[posicion].id}
          fondo={fondos[posicion]}
          valor={valor}
          maximo={maximo}
          nueva={posicion === fondos.length - 1}
          retraso={150 + indice * 35 + posicion * 60}
        />
      ))}
      {comparando && <div className="hidden md:block"><PastillaDiferencia valor={diferencia} /></div>}
    </div>
  );
}

// Vista de lista: una fila por unidad con una barra por gestión (todas en la misma escala) y
// la diferencia; al final, el total de horas asignadas. Con un solo fondo, solo su columna.
function TablaComparacion({ fondos }) {
  const comparando = fondos.length === 2;
  const { filas, asignadas, maximoUnidad, maximoTotal } = datosComparacion(fondos);
  const columnas = comparando
    ? 'md:grid-cols-[minmax(11rem,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_8.5rem]'
    : 'md:grid-cols-[minmax(11rem,1fr)_minmax(0,2fr)]';
  const comunes = { fondos, columnas, comparando };

  return (
    <section className={`${BLOQUE} px-5 sm:px-7 pt-2 pb-5`} aria-label="Horas por unidad del Art. 12">
      {/* Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas. */}
      <div className={`hidden md:grid ${columnas} md:items-end gap-x-6 pt-4 pb-3 [border-bottom:1px_solid_#B8C9E1]`}>
        <span className="text-sm font-semibold text-slate-600">Unidad</span>
        {fondos.map((fondo) => <CabeceraGestion key={fondo.id} fondo={fondo} />)}
        {comparando && <span className="text-sm font-semibold text-slate-600">Diferencia</span>}
      </div>
      {/* En celular, las gestiones (estado y enlace) van arriba de las filas. */}
      <div className="md:hidden flex flex-col gap-3 pt-4 pb-3 [border-bottom:1px_solid_#B8C9E1]">
        {fondos.map((fondo) => <CabeceraGestion key={fondo.id} fondo={fondo} />)}
      </div>
      <div className="divide-y divide-azulado-200">
        {filas.map((fila, indice) => (
          <FilaComparacion key={fila.clave} fila={fila} indice={indice} maximo={maximoUnidad} {...comunes} />
        ))}
      </div>
      <div className="[border-top:3px_double_#B8C9E1]">
        <FilaComparacion fila={asignadas} total indice={filas.length} maximo={maximoTotal} {...comunes} />
      </div>
    </section>
  );
}

// Veredicto, al final y compacto: qué pasó con las horas asignadas, en cuántas unidades subió
// o bajó y el avance de la gestión más nueva con lo que le falta para completar sus horas
// efectivas. Con un solo fondo, solo sus horas y su avance. Los avisos van aquí.
function Veredicto({ fondos, avisos }) {
  const [anterior, posterior] = fondos;
  const nuevo = posterior || anterior;
  const comparando = Boolean(posterior);
  const asignadas = horas(nuevo.total_asignado);
  const efectivas = horas(nuevo.horas_efectivas);
  const falta = efectivas - asignadas;
  const diferencia = comparando ? asignadas - horas(anterior.total_asignado) : 0;
  const avance = avanceDe(nuevo);

  const cambios = { mas: 0, menos: 0, igual: 0 };
  if (comparando) {
    const [antes, ahora] = [unidadesDe(anterior), unidadesDe(posterior)];
    ORDEN_UNIDADES.forEach((tipo) => {
      const resta = (ahora[tipo]?.horas || 0) - (antes[tipo]?.horas || 0);
      cambios[resta > 0 ? 'mas' : resta < 0 ? 'menos' : 'igual'] += 1;
    });
  }
  const pastillas = [
    cambios.mas > 0 && { tono: 'mas', texto: `Subió en ${plural(cambios.mas, 'unidad', 'unidades')}` },
    cambios.menos > 0 && { tono: 'menos', texto: `Bajó en ${plural(cambios.menos, 'unidad', 'unidades')}` },
    cambios.igual > 0 && { tono: 'igual', texto: `Igual en ${plural(cambios.igual, 'unidad', 'unidades')}` },
  ].filter(Boolean);

  return (
    <section
      className={`${BLOQUE} px-5 py-4 sm:px-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-center`}
      aria-label="Resultado de la comparación"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-600">{comparando ? 'Resultado de la comparación' : `Gestión ${nuevo.gestion}`}</p>
        <p className="mt-1 text-lg font-bold leading-snug text-blue-900">
          {!comparando ? (
            <>En {nuevo.gestion} tiene <span className="text-slate-900">{plural(asignadas, 'hora', 'horas')}</span> asignadas.</>
          ) : diferencia === 0 ? (
            <>En {posterior.gestion} tiene <span className="text-slate-900">las mismas horas</span> asignadas que en {anterior.gestion}.</>
          ) : (
            <>
              En {posterior.gestion} tiene{' '}
              <span className="text-slate-900">{plural(Math.abs(diferencia), 'hora', 'horas')} {diferencia > 0 ? 'más' : 'menos'}</span>
              {' '}asignadas que en {anterior.gestion}.
            </>
          )}
        </p>
        {pastillas.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {pastillas.map((pastilla) => (
              <span key={pastilla.tono} className={`${PASTILLA} ${TONO_PASTILLA[pastilla.tono]}`}>{pastilla.texto}</span>
            ))}
          </div>
        )}
        {avisos.length > 0 && (
          <div className="mt-2.5 space-y-0.5">
            {avisos.map((aviso) => <p key={aviso} className="text-sm text-slate-600">{aviso}</p>)}
          </div>
        )}
      </div>

      <div className="pt-3.5 lg:pt-0 lg:pl-6 [border-top:1px_solid_#B8C9E1] lg:[border-top:0] lg:[border-left:1px_solid_#B8C9E1]">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-semibold text-slate-600">
          <span>Avance en {nuevo.gestion}</span>
          <span className="text-xl font-bold text-blue-900 tabular-nums">
            <NumeroAnimado valor={avance} desde={0} duracion={600} /> %
          </span>
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-azulado-200 overflow-hidden">
          <div
            className="barra-progreso-relleno h-full w-full rounded-full bg-blue-900"
            style={{ transform: `translateX(${avance - 100}%)` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-700">
          {efectivas === 0
            ? 'Todavía no tiene horas efectivas calculadas.'
            : falta > 0
              ? <>Le faltan <b className="text-slate-900">{falta} h</b> para completar sus {efectivas} h efectivas.</>
              : falta === 0
                ? <>Completó sus <b className="text-slate-900">{efectivas} h</b> efectivas.</>
                : <>Tiene <b className="text-slate-900">{-falta} h</b> más que sus {efectivas} h efectivas.</>}
          {comparando && <span className="text-slate-500"> En {anterior.gestion} el avance era {avanceDe(anterior)} %.</span>}
        </p>
      </div>
    </section>
  );
}

// Solo superusuario, Director, Jefe de Estudios e Instituto (la ruta y la API lo exigen). El docente
// y las gestiones se eligen entre los fondos que el usuario ve, vigentes y archivados.
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
  // Tarjetas (primero) o lista, como en las demás pantallas; se recuerda en este navegador.
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_COMPARAR_KEY) === 'lista' ? 'lista' : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    try {
      localStorage.setItem(VISTA_COMPARAR_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };
  useEffect(() => {
    let vigente = true;
    setCargandoLista(true);
    Promise.all([getFondosTiempo(), getFondosArchivados()])
      .then(([vigentes, archivados]) => vigente && setFondosVisibles([
        ...(Array.isArray(vigentes) ? vigentes : []),
        ...(Array.isArray(archivados.data) ? archivados.data : []),
      ]))
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
  // La única tarjeta oscura: la diferencia de horas asignadas (o, con un solo fondo, sus horas).
  const diferenciaTotal = posterior ? horas(posterior.total_asignado) - horas(anterior.total_asignado) : 0;
  const tarjeta = posterior
    ? { titulo: 'Diferencia', ayuda: `horas asignadas respecto de ${anterior.gestion}`, valor: Math.abs(diferenciaTotal), signo: diferenciaTotal > 0 ? '+' : diferenciaTotal < 0 ? '−' : '' }
    : anterior
      ? { titulo: 'Horas asignadas', ayuda: `gestión ${anterior.gestion}`, valor: horas(anterior.total_asignado), signo: '' }
      : null;
  const avisos = [
    ...(gestionesDocente.length === 1 ? [`Este docente solo tiene fondo en la gestión ${gestionesDocente[0]}: no hay otra gestión para comparar.`] : []),
    ...sinFondo.map((gestion) => `No hay fondo de la gestión ${gestion}.`),
  ];

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
      {/* Encabezado como en el dashboard y, al lado, la diferencia total */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
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

        <div className="rounded-3xl bg-blue-900 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">{tarjeta?.titulo || 'Diferencia'}</p>
            <p className="mt-1 text-sm text-blue-100">{tarjeta?.ayuda || 'entre las dos gestiones'}</p>
          </div>
          <span className="text-4xl font-bold tabular-nums leading-none whitespace-nowrap">
            {tarjeta ? (
              <>{tarjeta.signo}<NumeroAnimado key={comparacion.clave} valor={tarjeta.valor} desde={0} duracion={600} /> h</>
            ) : '—'}
          </span>
        </div>
      </div>

      {docentes.length === 0 ? (
        <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No hay fondos para comparar</h3>
          <p className="text-slate-600">Cuando los docentes tengan fondos de tiempo, se podrán comparar aquí.</p>
        </div>
      ) : (
        <>
          {/* Docente (el propio campo filtra al escribir) y, en el Filtrar, las dos gestiones:
              "Gestión" siempre tiene una marcada; sin "Comparar con" se ve solo ese fondo. */}
          <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
            <div className="min-w-0 w-full sm:flex-1 sm:max-w-md">
              <FiltroDesplegable
                value={docente}
                onChange={setDocente}
                options={docentes}
                placeholder="Docente"
                ariaLabel="Docente"
                permitirQuitar={false}
              />
            </div>
            <FiltroMenu
              etiqueta="Gestiones"
              columnas={[
                {
                  clave: 'gestion',
                  titulo: 'Gestión',
                  obligatoria: true,
                  opciones: opcionesGestion(gestionA).map((opcion) => ({ valor: opcion.value, etiqueta: opcion.label })),
                },
                {
                  clave: 'comparar',
                  titulo: 'Comparar con',
                  nota: 'El docente no tiene otra gestión',
                  opciones: opcionesGestion(gestionB).map((opcion) => ({ valor: opcion.value, etiqueta: opcion.label })),
                },
              ]}
              valores={{ gestion: gestionB, comparar: gestionA }}
              onCambiar={(clave, valor) => {
                if (clave === 'gestion') setGestionB(valor);
                if (clave === 'comparar') setGestionA(valor);
              }}
            />
            <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
          </div>

          {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {comparando && resultado.length === 0 ? (
            <div className={`${BLOQUE} p-10 text-center`}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-900 mx-auto"></div>
              <p className="mt-3 text-sm text-slate-600">Comparando...</p>
            </div>
          ) : resultado.length > 0 ? (
            <div key={comparacion.clave} className={`space-y-4 transition-opacity ${comparando ? 'opacity-60' : ''}`}>
              {vista === 'lista' ? <TablaComparacion fondos={resultado} /> : <TarjetasComparacion fondos={resultado} />}
              <Veredicto fondos={resultado} avisos={avisos} />
            </div>
          ) : avisos.length > 0 && (
            <div className={`${BLOQUE} p-8 text-center space-y-1`}>
              {avisos.map((aviso) => <p key={aviso} className="text-sm text-slate-600">{aviso}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Comparador;
