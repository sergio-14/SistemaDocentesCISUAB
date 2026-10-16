import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, Eye } from 'lucide-react';
import { getFondosArchivados, restaurarFondo } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage } from '../utils/formErrors';
import { paginar } from '../utils/paginacion';
import CampoBusqueda from './common/CampoBusqueda';
import ModalConfirmar from './common/ModalConfirmar';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import SelectorGestion from './fondos/SelectorGestion';
import { BLOQUE, BOTON, ESTADOS_FONDO, estadoVisibleFondo } from './fondos/estilosFondo';
import { Avatar, EstadoPill, Etiqueta } from './fondos/ElementosFondo';

const VISTA_ARCHIVADOS_KEY = 'archivados_vista';

// Misma cuadrícula que la vista de lista del dashboard (sin la columna de progreso).
const COLUMNAS = 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_8rem_11rem_15rem]';

// Del más nuevo al más antiguo por gestión; a igual gestión, por docente.
const ordenArchivados = (a, b) => (
  (Number(b.gestion) || 0) - (Number(a.gestion) || 0)
  || String(a.docente_nombre || '').localeCompare(String(b.docente_nombre || ''))
);

// Solo superusuario, Director y Jefe de Estudios (la ruta y la API lo exigen).
function FondosArchivados() {
  const { effectiveUser, activeAssignment } = useActiveRole();
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const [archivados, setArchivados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [gestionFiltro, setGestionFiltro] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_ARCHIVADOS_KEY) === 'tarjetas' ? 'tarjetas' : 'lista';
    } catch {
      return 'lista';
    }
  });
  // Fondo que se va a restaurar (abre la confirmación).
  const [fondoPorRestaurar, setFondoPorRestaurar] = useState(null);
  const listaRef = useRef(null);

  const cargarArchivados = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFondosArchivados();
      setArchivados(Array.isArray(response.data) ? [...response.data].sort(ordenArchivados) : []);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, 'No se pudieron cargar los fondos archivados.'));
    } finally {
      setLoading(false);
    }
  };

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_ARCHIVADOS_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };

  // Se recarga al cambiar de rol activo.
  useEffect(() => {
    cargarArchivados();
  }, [activeAssignment?.id]);

  // Si el backend lo rechaza (p. ej. el docente ya tiene otro fondo vigente en esa
  // gestión), el motivo queda en el modal.
  const confirmarRestauracion = async () => {
    const fondo = fondoPorRestaurar;
    try {
      await restaurarFondo(fondo.id);
    } catch (err) {
      throw new Error(err.response?.data?.error || getApiErrorMessage(err, 'No se pudo restaurar el fondo.'));
    }
    setArchivados((prev) => prev.filter((item) => item.id !== fondo.id));
    setFondoPorRestaurar(null);
    toast.success(`Fondo ${fondo.gestion} de ${fondo.docente_nombre} restaurado al dashboard.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando fondos archivados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 sm:px-4 md:px-8 py-4 md:py-6">
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const gestiones = [...new Set(archivados.map((fondo) => fondo.gestion).filter(Boolean))].sort((a, b) => b - a);
  const texto = busqueda.trim().toLowerCase();
  const filtrados = archivados.filter((fondo) => {
    if (gestionFiltro !== 'todas' && String(fondo.gestion) !== gestionFiltro) return false;
    if (!texto) return true;
    return (esSuperusuario ? [fondo.docente_nombre, fondo.carrera_nombre] : [fondo.docente_nombre])
      .some((campo) => (campo || '').toLowerCase().includes(texto));
  });
  const { paginaActual, totalPaginas, itemsPagina } = paginar(filtrados, pagina, vista);

  // Entrada suave y escalonada de cada fondo al cambiar de vista o de página.
  const retraso = (indice) => ({ animationDelay: `${Math.min(indice, 8) * 35}ms` });

  const horas = (fondo) => (
    <span className="tabular-nums whitespace-nowrap">
      <span className="font-bold text-slate-800">{Math.round(fondo.total_asignado || 0)}</span>
      <span className="text-sm text-slate-500"> / {Math.round(fondo.horas_efectivas || 0)} hrs</span>
    </span>
  );

  const acciones = (fondo) => (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={`/fondo-tiempo/fondo/${fondo.id}`}
        className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}
      >
        <Eye className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <span>Ver</span>
      </Link>
      <button data-escritura
        type="button"
        onClick={() => setFondoPorRestaurar(fondo)}
        className={`${BOTON} bg-sky-600 hover:bg-sky-700 text-white`}
      >
        <ArchiveRestore className="w-[18px] h-[18px]" strokeWidth={1.5} />
        <span>Restaurar</span>
      </button>
    </div>
  );

  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    // Salto inmediato (no suave) al inicio de la lista: la página nueva entra ya a la vista
    // con su animación; con el desplazamiento suave la animación terminaba antes de llegar.
    listaRef.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
      {/* Encabezado como en el dashboard, con el total en su propio bloque */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
              <Archive className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Gestión del Fondo de Tiempo Docente
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Fondos Archivados</h2>
              <p className="mt-1 text-sm text-slate-600">
                Fondos retirados del dashboard. Se consultan con sus documentos y se pueden restaurar.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Total archivados</p>
            <p className="mt-1 text-sm text-blue-100">
              {archivados.length === 1 ? 'fondo archivado' : 'fondos archivados'}
            </p>
          </div>
          <span className="text-5xl font-bold tabular-nums leading-none">{archivados.length}</span>
        </div>
      </div>

      {/* Búsqueda y gestión */}
      {archivados.length > 0 && (
        <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
          <CampoBusqueda
            value={busqueda}
            onChange={(valor) => {
              setBusqueda(valor);
              setPagina(1);
            }}
            placeholder={esSuperusuario ? 'Buscar docente o carrera' : 'Buscar docente'}
          />
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
      )}

      {/* Lista */}
      <div ref={listaRef} className="scroll-mt-4" />
      {archivados.length === 0 ? (
        <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900">
            <Archive className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No hay fondos archivados</h3>
          <p className="text-slate-600">Los fondos que se archiven desde el dashboard aparecerán aquí.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className={`${BLOQUE} p-10 text-center text-sm text-slate-600`}>
          Ningún fondo archivado coincide con la búsqueda.
        </div>
      ) : vista === 'lista' ? (
        // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
        <div key={`lista-${paginaActual}`} className={`${BLOQUE} p-2 sm:p-3`}>
          <div className={`hidden xl:grid ${COLUMNAS} gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
            <span>Docente</span>
            <span>Descripción</span>
            <span>Horas asignadas</span>
            <span>Estado al archivar</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-azulado-300">
            {itemsPagina.map((fondo, indice) => (
              <div
                key={fondo.id}
                style={retraso(indice)}
                className={`animate-fondo-entrada grid grid-cols-1 ${COLUMNAS} items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl hover:bg-azulado-100/70 transition-colors`}
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
                <div className="hidden xl:block"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
                {acciones(fondo)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div key={`tarjetas-${paginaActual}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {itemsPagina.map((fondo, indice) => (
            <div key={fondo.id} style={retraso(indice)} className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4`}>
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

              <div className="mt-auto pt-3 [border-top:1px_solid_#B8C9E1]">
                {acciones(fondo)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiar={irAPagina} />

      {archivados.length > 0 && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Un fondo archivado no se borra y sus clases no cuentan en los choques de horario, de modo que
          la gestión se puede rehacer con un fondo nuevo. Al restaurarlo vuelve al dashboard con el estado
          que tenía.
        </p>
      )}

      {fondoPorRestaurar && (
        <ModalConfirmar
          etiqueta="Fondos Archivados"
          titulo="Restaurar fondo"
          mensaje={`El fondo ${fondoPorRestaurar.gestion} de ${fondoPorRestaurar.docente_nombre} vuelve al dashboard con el estado "${(ESTADOS_FONDO[estadoVisibleFondo(fondoPorRestaurar)] || ESTADOS_FONDO.borrador).label}".`}
          detalle={['No se puede restaurar si el docente ya tiene otro fondo vigente en esa gestión.']}
          textoAccion="Restaurar"
          textoTrabajando="Restaurando..."
          onConfirmar={confirmarRestauracion}
          onCancelar={() => setFondoPorRestaurar(null)}
        />
      )}
    </div>
  );
}

export default FondosArchivados;
