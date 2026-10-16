import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { eliminarFondoTiempo, generarFondosTiempoMasivo, getFondosTiempo } from '../apis/api';
import { descargarInformeGestion } from '../utils/informeGestion';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage, getDownloadErrorMessage } from '../utils/formErrors';
import useConsultaConRespaldo, { useFondoActualizado } from '../tiempoReal/useTiempoReal';
import ModalCentrado from './common/ModalCentrado';
import ModalConfirmar from './common/ModalConfirmar';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import SelectorGestion from './fondos/SelectorGestion';
import { paginar } from '../utils/paginacion';
import { BLOQUE, BOTON, BOTON_DOCUMENTO, ESTADOS_FONDO, estadoVisibleFondo } from './fondos/estilosFondo';
import { Avatar, BarraProgreso, EstadoPill, Etiqueta } from './fondos/ElementosFondo';

const CONSULTA_FONDOS_MS = 30000;

// --- ICONOS ---
const EyeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const PencilIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
  </svg>
);

const ArchiveBoxIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
  </svg>
);

const PlusIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ClockIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DownloadIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const SearchIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const ESTADOS_ARCHIVABLES = ['aprobado_director', 'finalizado', 'rechazado'];

const VISTA_STORAGE_KEY = 'fondos_vista_dashboard';

const porcentaje = (fondo) => Math.min(100, Math.max(0, Math.round(fondo.porcentaje_completado || 0)));

// Orden del dashboard: primero los que tienen el informe presentado (esperan la
// revisión del Director); después, por fecha de creación, el más nuevo primero (a igual
// fecha, el id mayor).
const informePorRevisar = (fondo) => (fondo.estado === 'informe_presentado' ? 0 : 1);
const ordenDashboard = (a, b) => (
  informePorRevisar(a) - informePorRevisar(b)
  || String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || ''))
  || (Number(b.id) || 0) - (Number(a.id) || 0)
);

function ListaFondos() {
  const { effectiveUser, activeAssignment, activeRole, activeCareerId } = useActiveRole();
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [showMassiveModal, setShowMassiveModal] = useState(false);
  const [generandoMasivo, setGenerandoMasivo] = useState(false);
  // Resultado de la generación masiva que se muestra en pantalla: { creados, ... } o { error }.
  const [resultadoMasivo, setResultadoMasivo] = useState(null);
  // Fondo que se va a archivar (abre la confirmación).
  const [fondoPorArchivar, setFondoPorArchivar] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [gestionFiltro, setGestionFiltro] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const listaRef = useRef(null);
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_STORAGE_KEY) === 'tarjetas' ? 'tarjetas' : 'lista';
    } catch {
      return 'lista';
    }
  });

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_STORAGE_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };

  useEffect(() => {
    cargarFondos();
    setUser(effectiveUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recarga al cambiar de rol activo.
  }, [activeAssignment?.id]);

  useEffect(() => {
    if (effectiveUser) {
      setUser(effectiveUser);
    }
  }, [effectiveUser]);

  // El formulario de nuevo/editar fondo se abre encima de esta lista; al cerrarlo
  // se vuelve a consultar para mostrar el fondo creado o actualizado.
  const location = useLocation();
  const rutaAnterior = useRef(location.pathname);
  useEffect(() => {
    const volvioDelFormulario = rutaAnterior.current !== location.pathname && location.pathname === '/fondo-tiempo';
    rutaAnterior.current = location.pathname;
    if (volvioDelFormulario) cargarFondos({ silencioso: true });
  }, [location.pathname]);

  const cargarFondos = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) {
        setLoading(true);
      }
      const data = await getFondosTiempo();
      // Arriba los informes por revisar; luego del más nuevo al más antiguo.
      setFondos(Array.isArray(data) ? [...data].sort(ordenDashboard) : []);
      if (!silencioso) {
        setLoading(false);
      }
    } catch (err) {
      if (!silencioso) {
        setError('Error al cargar los fondos de tiempo');
        setLoading(false);
      }
      console.error(err);
    }
  };

  // Mantiene la lista al día con lo que cambian otros usuarios: se vuelve a pedir
  // cuando el socket avisa que un fondo cambió. La consulta queda como respaldo si el
  // socket se corta (cada 30 s con VITE_TIEMPO_REAL=false, como antes).
  useFondoActualizado(() => cargarFondos({ silencioso: true }));
  useConsultaConRespaldo(() => cargarFondos({ silencioso: true }), CONSULTA_FONDOS_MS);

  // Si el backend lo rechaza, el motivo queda en el modal (ModalConfirmar).
  const archivarFondo = async () => {
    const fondo = fondoPorArchivar;
    try {
      await eliminarFondoTiempo(fondo.id);
    } catch (err) {
      throw new Error(err.response?.data?.error || getApiErrorMessage(err, 'No se pudo archivar el fondo.'));
    }
    setFondos((prev) => prev.filter((item) => item.id !== fondo.id));
    setFondoPorArchivar(null);
    toast.success(`Fondo ${fondo.gestion} de ${fondo.docente_nombre} archivado.`);
  };

  const puedeEditar = (fondo) => {
    return puedeCrearFondoTiempo(user) && ['borrador', 'observado'].includes(fondo.estado);
  };

  // Archivar: superusuario, Director y Jefe de Estudios (de su carrera; lo exige el backend).
  const puedeArchivar = user?.is_superuser === true || ['director', 'jefe_estudios'].includes(user?.perfil?.rol);

  const puedeCrear = puedeCrearFondoTiempo(user);
  const esIisyp = user?.perfil?.rol === 'iiisyp' && user?.is_superuser !== true;

  const generarFondosMasivamente = async () => {
    setGenerandoMasivo(true);

    try {
      const response = await generarFondosTiempoMasivo();
      const resumen = response.data || {};
      const creados = resumen.creados || 0;
      setShowMassiveModal(false);
      await cargarFondos({ silencioso: true });
      setResultadoMasivo({
        creados,
        omitidosExclusiva: resumen.omitidos_exclusiva || 0,
        omitidosExistentes: resumen.omitidos_ya_existentes || 0,
      });
      if (creados > 0) {
        toast.success(creados === 1 ? 'Se creó 1 fondo de tiempo.' : `Se crearon ${creados} fondos de tiempo.`);
      } else {
        toast('No se creó ningún fondo nuevo.');
      }
    } catch (err) {
      console.error(err);
      const mensaje = err.response?.data?.error || getApiErrorMessage(err, 'No se pudieron generar los fondos de tiempo.');
      setShowMassiveModal(false);
      setResultadoMasivo({ error: mensaje });
      toast.error('No se pudieron generar los fondos de tiempo.');
    } finally {
      setGenerandoMasivo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">
            Cargando fondos de tiempo...
          </p>
        </div>
        <Outlet />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700">{error}</p>
        </div>
        <Outlet />
      </div>
    );
  }

  const gestiones = [...new Set(fondos.map((fondo) => fondo.gestion).filter(Boolean))].sort((a, b) => b - a);

  // Arts. 19 y 28: informe de gestión de la carrera (PDF), para el Director de la carrera.
  // Gestión: la del filtro o, sin filtro, la más reciente de los fondos.
  const esDirectorCarrera = activeRole === 'director' && !esSuperusuario && Boolean(activeCareerId);
  const gestionInforme = gestionFiltro !== 'todas' ? Number(gestionFiltro) : (gestiones[0] || new Date().getFullYear());
  const bajarInformeGestion = async () => {
    try {
      await descargarInformeGestion(activeCareerId, gestionInforme, effectiveUser?.perfil?.carrera_codigo);
      toast.success(`Informe de gestión ${gestionInforme} descargado`);
    } catch (err) {
      console.error(err);
      toast.error(await getDownloadErrorMessage(err, 'No se pudo descargar el informe de gestión'));
    }
  };
  const texto = busqueda.trim().toLowerCase();
  const fondosFiltrados = fondos.filter((fondo) => {
    if (gestionFiltro !== 'todas' && String(fondo.gestion) !== gestionFiltro) return false;
    if (!texto) return true;
    // Los demás roles solo ven su carrera: buscan por docente.
    return (esSuperusuario ? [fondo.docente_nombre, fondo.carrera_nombre] : [fondo.docente_nombre])
      .some((campo) => (campo || '').toLowerCase().includes(texto));
  });

  const { paginaActual, totalPaginas, itemsPagina: fondosPagina } = paginar(fondosFiltrados, pagina, vista);

  // Lo pendiente según el rol: el Director lo que tiene por revisar, el Jefe lo
  // observado y el docente el estado de su fondo (el de la gestión más reciente).
  const plural = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`;
  const ajenos = fondos.filter((fondo) => String(fondo.docente) !== String(effectiveUser?.perfil?.docente));
  const contar = (lista, condicion) => lista.filter(condicion).length;
  let resumenRol = null;
  if (activeRole === 'director' && !esSuperusuario) {
    const porRevisar = contar(ajenos, (f) => f.estado === 'presentado_director');
    const informes = contar(ajenos, (f) => f.estado === 'informe_presentado');
    resumenRol = {
      texto: `Por revisar: ${plural(porRevisar, 'fondo')} · ${plural(informes, 'informe')}`,
      punto: porRevisar + informes > 0 ? ESTADOS_FONDO.presentado_director.dot : 'bg-slate-300',
    };
  } else if (activeRole === 'jefe_estudios') {
    const observados = contar(fondos, (f) => f.estado === 'observado');
    const informes = contar(fondos, (f) => estadoVisibleFondo(f) === 'informe_observado');
    resumenRol = {
      texto: `Observados: ${plural(observados, 'fondo')} · ${plural(informes, 'informe')}`,
      punto: observados + informes > 0 ? ESTADOS_FONDO.observado.dot : 'bg-slate-300',
    };
  } else if (activeRole === 'docente' && fondos.length > 0) {
    const propio = [...fondos].sort((a, b) => (b.gestion || 0) - (a.gestion || 0))[0];
    const estado = ESTADOS_FONDO[estadoVisibleFondo(propio)] || ESTADOS_FONDO.borrador;
    resumenRol = { texto: `Tu fondo ${propio.gestion}: ${estado.label}`, punto: estado.dot };
  }

  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Entrada suave y escalonada de cada fondo al cambiar de vista o de página.
  const entrada = (indice) => ({
    className: 'animate-fondo-entrada',
    style: { animationDelay: `${Math.min(indice, 8) * 35}ms` },
  });

  const horas = (fondo) => (
    <span className="tabular-nums whitespace-nowrap">
      <span className="font-bold text-slate-800">{Math.round(fondo.total_asignado || 0)}</span>
      <span className="text-sm text-slate-500"> / {Math.round(fondo.horas_efectivas || 0)} hrs</span>
    </span>
  );

  const progreso = (fondo) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600">Progreso</span>
        <span className="text-sm font-bold text-blue-900 tabular-nums">{porcentaje(fondo)}%</span>
      </div>
      <BarraProgreso valor={porcentaje(fondo)} />
    </div>
  );

  const acciones = (fondo) => (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={`/fondo-tiempo/fondo/${fondo.id}`}
        className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}
      >
        <EyeIcon className="w-[18px] h-[18px]" />
        <span>Ver</span>
      </Link>
      {puedeEditar(fondo) && (
        <Link
          to={`/fondo-tiempo/editar-fondo/${fondo.id}`}
          className={`${BOTON} bg-emerald-500 hover:bg-emerald-600 text-white`}
        >
          <PencilIcon className="w-[18px] h-[18px]" />
          <span>Editar</span>
        </Link>
      )}
      {puedeArchivar && ESTADOS_ARCHIVABLES.includes(fondo.estado) && (
        <button data-escritura
          type="button"
          onClick={() => setFondoPorArchivar(fondo)}
          className={`${BOTON} bg-red-400 hover:bg-red-500 text-white`}
        >
          <ArchiveBoxIcon className="w-[18px] h-[18px]" />
          <span>Archivar</span>
        </button>
      )}
    </div>
  );

  const botonesCrear = (
    <>
      <button data-escritura
        type="button"
        onClick={() => setShowMassiveModal(true)}
        className={`${BOTON} px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm`}
      >
        Generar Fondos Masivamente
      </button>
      <Link data-escritura
        to="/fondo-tiempo/nuevo-fondo"
        className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
      >
        <PlusIcon className="w-5 h-5" />
        <span>Nuevo Fondo de Tiempo</span>
      </Link>
    </>
  );

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
      {/* Bloque 1: encabezado con acciones, y al lado el total en su propio bloque (misma altura) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                <ClockIcon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Gestión del Fondo de Tiempo Docente
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                  Dashboard de Fondos
                </h2>
                {resumenRol && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-700 ring-1 ring-inset ring-azulado-300">
                    <span className={`h-2 w-2 rounded-full ${resumenRol.punto}`} />
                    {resumenRol.texto}
                  </p>
                )}
                {esIisyp && (
                  <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-300">
                    Vista de Investigación - Solo Lectura
                  </span>
                )}
              </div>
            </div>

            {puedeCrear && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {botonesCrear}
              </div>
            )}
            {esDirectorCarrera && (
              <button
                type="button"
                onClick={bajarInformeGestion}
                className={`${BOTON} px-5 py-2.5 w-full sm:w-auto ${BOTON_DOCUMENTO}`}
              >
                <DownloadIcon className="w-5 h-5" />
                <span>Informe de gestión {gestionInforme}</span>
              </button>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Total fondos</p>
            <p className="mt-1 text-sm text-blue-100">
              {fondos.length === 1 ? 'fondo registrado' : 'fondos registrados'}
            </p>
          </div>
          <span className="text-5xl font-bold tabular-nums leading-none">{fondos.length}</span>
        </div>
      </div>

      {/* Bloque 2: búsqueda, gestión y tipo de vista */}
      <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
        <label className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-md h-11 px-4 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 focus-within:ring-blue-900/40">
          <SearchIcon className="w-[18px] h-[18px] text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder={esSuperusuario ? 'Buscar docente o carrera' : 'Buscar docente'}
            className="w-full text-sm text-slate-800 placeholder:text-slate-500 outline-none"
            style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
          />
        </label>

        <SelectorGestion
          value={gestionFiltro}
          onChange={(gestion) => {
            setGestionFiltro(gestion ?? 'todas');
            setPagina(1);
          }}
          placeholder="Todas las gestiones"
          options={gestiones.map((gestion) => ({ value: String(gestion), label: `Gestión ${gestion}` }))}
        />

        <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
      </div>

      {/* Bloque 3: fondos */}
      <div ref={listaRef} className="scroll-mt-4" />
      {fondos.length === 0 ? (
        <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            No hay fondos registrados
          </h3>
          <p className="text-slate-600">
            Comienza creando tu primer fondo de tiempo
          </p>
        </div>
      ) : fondosFiltrados.length === 0 ? (
        <div className={`${BLOQUE} p-10 text-center text-sm text-slate-600`}>
          Ningún fondo coincide con la búsqueda.
        </div>
      ) : vista === 'lista' ? (
        // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
        // En escritorio se ve como tabla; en el celular cada fondo es un bloque apilado.
        <div key={`lista-${paginaActual}`} className={`${BLOQUE} p-2 sm:p-3`}>
          <div className="hidden xl:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_10rem_11rem_15rem] gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]">
            <span>Docente</span>
            <span>Descripción</span>
            <span>Horas asignadas</span>
            <span>Progreso</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-azulado-300">
            {fondosPagina.map((fondo, indice) => (
              <div
                key={fondo.id}
                style={entrada(indice).style}
                className="animate-fondo-entrada grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_10rem_11rem_15rem] items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl hover:bg-azulado-100/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nombre={fondo.docente_nombre} size="w-10 h-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-blue-900 truncate">{fondo.docente_nombre}</div>
                    {esSuperusuario && <div className="text-sm text-slate-600 truncate">{fondo.carrera_nombre}</div>}
                  </div>
                  <div className="xl:hidden"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
                </div>
                <div className="flex flex-wrap gap-2 min-w-0">
                  <Etiqueta>{fondo.gestion}</Etiqueta>
                  <span className="min-w-0 max-w-full truncate"><Etiqueta>{fondo.descripcion}</Etiqueta></span>
                </div>
                <div className="flex items-baseline justify-between xl:block">
                  <span className="xl:hidden text-xs font-medium text-slate-600">Horas asignadas</span>
                  {horas(fondo)}
                </div>
                {progreso(fondo)}
                <div className="hidden xl:block"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
                {acciones(fondo)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div key={`tarjetas-${paginaActual}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {fondosPagina.map((fondo, indice) => (
            <div key={fondo.id} style={entrada(indice).style} className={`${BLOQUE} ${entrada(indice).className} p-5 flex flex-col gap-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nombre={fondo.docente_nombre} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-blue-900 truncate">{fondo.docente_nombre}</h3>
                    {esSuperusuario && <p className="text-sm text-slate-600 truncate">{fondo.carrera_nombre}</p>}
                  </div>
                </div>
                <EstadoPill estado={estadoVisibleFondo(fondo)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Etiqueta>{fondo.gestion}</Etiqueta>
                <Etiqueta>{fondo.descripcion}</Etiqueta>
              </div>

              <div className="flex items-baseline justify-between px-4 py-2 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300">
                <span className="text-xs font-medium text-slate-600">Horas asignadas</span>
                {horas(fondo)}
              </div>

              {progreso(fondo)}

              <div className="pt-3 [border-top:1px_solid_#B8C9E1]">
                {acciones(fondo)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación: 15 fondos por página en lista y 9 en tarjetas */}
      <Paginacion
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        onCambiar={irAPagina}
      />

      {showMassiveModal && (
        <ModalCentrado onClose={generandoMasivo ? undefined : () => setShowMassiveModal(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
            <div className="px-6 pt-6">
              <h3 className="text-xl font-bold text-slate-800">
                Generar Fondos Masivamente
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm leading-6 text-slate-700">
                ¿Está seguro que desea generar los Fondos de Tiempo para todos los docentes activos de la gestión actual?
                El sistema omitirá automáticamente a los docentes con Dedicación Exclusiva y a los que ya tengan fondo creado.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setShowMassiveModal(false)}
                disabled={generandoMasivo}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={generarFondosMasivamente}
                disabled={generandoMasivo}
                className={`${BOTON} px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50`}
              >
                {generandoMasivo ? 'Generando...' : 'Confirmar generación'}
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Aviso en pantalla con el resultado de la generación masiva */}
      {resultadoMasivo && (
        <ModalCentrado onClose={() => setResultadoMasivo(null)}>
          <div className="w-full max-w-md rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl p-6 text-center">
            {resultadoMasivo.error ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-200">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800">No se generaron los fondos</h3>
                <p className="mt-2 text-sm text-slate-600">{resultadoMasivo.error}</p>
              </>
            ) : (
              <>
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-inset ${
                  resultadoMasivo.creados > 0
                    ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                    : 'bg-sky-50 text-sky-600 ring-sky-200'
                }`}>
                  {resultadoMasivo.creados > 0 ? (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  {resultadoMasivo.creados > 0 ? 'Fondos generados' : 'No había fondos por generar'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {resultadoMasivo.creados > 0
                    ? 'Los nuevos fondos ya aparecen en el dashboard en estado borrador.'
                    : 'Los docentes activos ya tienen fondo, están exentos o su carrera no tiene calendario activo.'}
                </p>
                <div className="mt-5 divide-y divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-left text-sm">
                  {[
                    { label: 'Creados', valor: resultadoMasivo.creados, color: 'text-emerald-700' },
                    { label: 'Omitidos por Dedicación Exclusiva', valor: resultadoMasivo.omitidosExclusiva, color: 'text-slate-800' },
                    { label: 'Omitidos: ya tienen fondo o sin calendario activo', valor: resultadoMasivo.omitidosExistentes, color: 'text-slate-800' },
                  ].map((fila) => (
                    <div key={fila.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-slate-600">{fila.label}</span>
                      <span className={`font-bold tabular-nums ${fila.color}`}>{fila.valor}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setResultadoMasivo(null)}
              className={`${BOTON} mt-6 w-full sm:w-auto px-8 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
            >
              Aceptar
            </button>
          </div>
        </ModalCentrado>
      )}

      {fondoPorArchivar && (
        <ModalConfirmar
          tono="peligro"
          etiqueta="Fondo de Tiempo"
          titulo="Archivar fondo"
          mensaje={`El fondo ${fondoPorArchivar.gestion} de ${fondoPorArchivar.docente_nombre} sale del dashboard y pasa a Fondos Archivados.`}
          detalle={[
            'No se borra: se puede consultar y restaurar desde Fondos Archivados.',
            'Sus clases dejan de contar en los choques de horario.',
          ]}
          textoAccion="Archivar"
          textoTrabajando="Archivando..."
          onConfirmar={archivarFondo}
          onCancelar={() => setFondoPorArchivar(null)}
        />
      )}

      {/* Formulario de nuevo/editar fondo (rutas hijas), abierto como modal */}
      <Outlet />
    </div>
  );
}

export default ListaFondos;
