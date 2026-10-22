import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { getCarreras, getDocentes } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { ETIQUETAS_DEDICACION } from '../utils/dedicaciones';
import { paginar } from '../utils/paginacion';
import AsignarMateriaOtraCarrera from './AsignarMateriaOtraCarrera';
import CampoBusqueda from './common/CampoBusqueda';
import FiltroDesplegable from './common/FiltroDesplegable';
import NumeroAnimado from './common/NumeroAnimado';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import { BLOQUE, BOTON, BOTON_CHICO } from './fondos/estilosFondo';
import { Avatar, Etiqueta } from './fondos/ElementosFondo';

// Carga Horaria (Jefe de Estudios): los docentes de su carrera para entrar a gestionar su
// Fondo de Tiempo y, en la vista "Materias asignadas", las materias de su carrera que dictan
// docentes de otra carrera (se asignan con el botón del encabezado).

const ClockIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ETIQUETAS_CATEGORIA = { catedratico: 'Catedrático', adjunto: 'Adjunto', asistente: 'Asistente' };
const VISTA_CARGA_KEY = 'carga_horaria_vista';
const VISTAS = ['tarjetas', 'lista', 'materias'];

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PildoraInactivo = () => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 ring-1 ring-inset ring-red-200">
    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
    Inactivo
  </span>
);

const CargaHorariaGeneral = () => {
  const [docentes, setDocentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [vista, setVista] = useState(() => {
    try {
      const guardada = localStorage.getItem(VISTA_CARGA_KEY);
      return VISTAS.includes(guardada) ? guardada : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const [pagina, setPagina] = useState(1);
  // Ventana para asignar una materia a un docente de otra carrera.
  const [asignando, setAsignando] = useState(false);
  // El superusuario ve los docentes de todas las carreras y puede elegir una.
  const { effectiveUser } = useActiveRole();
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const [carreras, setCarreras] = useState([]);
  const [carreraFiltro, setCarreraFiltro] = useState('');
  const listaRef = useRef(null);

  useEffect(() => {
    const fetchDocentes = async () => {
      try {
        setDocentes(await getDocentes());
      } catch (err) {
        console.error("Error fetching docentes:", err);
        setError("No se pudieron cargar los docentes.");
      } finally {
        setLoading(false);
      }
    };
    fetchDocentes();
  }, []);

  useEffect(() => {
    if (!esSuperusuario) return;
    getCarreras()
      .then((data) => setCarreras(Array.isArray(data) ? data : []))
      .catch(() => setCarreras([]));
  }, [esSuperusuario]);

  useEffect(() => {
    setPagina(1);
  }, [searchTerm, carreraFiltro]);

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_CARGA_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando docentes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
        <div className={`${BLOQUE} p-6 max-w-md w-full text-center`}>
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  // Búsqueda por nombre o C.I., sin importar mayúsculas ni tildes.
  const texto = normalizar(searchTerm.trim());
  const filteredDocentes = docentes.filter((docente) => {
    if (carreraFiltro && String(docente?.carrera_id || '') !== String(carreraFiltro)) return false;
    if (!texto) return true;
    const nombre = `${docente?.nombres || ''} ${docente?.apellido_paterno || ''} ${docente?.apellido_materno || ''} ${docente?.nombre_completo || ''}`;
    return normalizar(nombre).includes(texto) || String(docente?.ci || '').includes(searchTerm.trim());
  });
  const totalActivos = docentes.filter((docente) => docente.activo).length;
  const verMaterias = vista === 'materias';
  const { paginaActual, totalPaginas, itemsPagina: docentesPagina } = paginar(filteredDocentes, pagina, vista);
  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    // Salto inmediato (no suave) al inicio de la lista: la página nueva entra ya a la vista
    // con su animación; con el desplazamiento suave la animación terminaba antes de llegar.
    listaRef.current?.scrollIntoView({ block: 'start' });
  };

  const infoDocente = (docente) => {
    const vinculo = docente?.vinculos?.[0];
    return {
      nombre: docente?.nombre_completo || `${docente?.nombres || ''} ${docente?.apellido_paterno || ''}`.trim() || 'Sin nombre',
      email: docente.email || docente.usuario_email || docente.usuario?.email || docente.user?.email || null,
      datos: [
        { label: 'Categoría', valor: ETIQUETAS_CATEGORIA[vinculo?.categoria] || vinculo?.categoria || '—' },
        { label: 'Dedicación', valor: ETIQUETAS_DEDICACION[vinculo?.dedicacion] || vinculo?.dedicacion || '—' },
      ],
    };
  };

  const botonGestionar = (docente) => (
    <Link
      to={`/fondo-tiempo/docentes/${docente.id}`}
      className={`${BOTON_CHICO} bg-blue-900 hover:bg-blue-950 text-white`}
    >
      <ClockIcon className="w-3.5 h-3.5" />
      <span>Gestionar fondo</span>
    </Link>
  );

  const claveVista = `${searchTerm}-${paginaActual}`;

  return (
    <div className="min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 text-slate-800">
      <div className="space-y-4">
        {/* Bloque 1: encabezado y, al lado, el total (como el dashboard de fondos) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${BLOQUE} p-5 sm:p-6 flex flex-col gap-4`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                <ClockIcon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Asignación de la carga horaria anual
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                  Carga Horaria
                </h2>
              </div>
            </div>
            {/* Materia de esta carrera para un docente de otra carrera (doble carrera). La
                asigna Jefatura; el superusuario ve la carga horaria en solo lectura. */}
            {!esSuperusuario && (
              <button data-escritura
                type="button"
                onClick={() => setAsignando(true)}
                className={`${BOTON} px-5 py-2.5 w-full sm:w-auto sm:self-end mt-auto bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
              >
                <Plus className="w-5 h-5" strokeWidth={2} />
                <span>Asignar materia</span>
              </button>
            )}
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Docentes</p>
              <span className="text-5xl font-bold tabular-nums leading-none">
                <NumeroAnimado valor={docentes.length} />
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <NumeroAnimado valor={totalActivos} singular="activo" plural="activos" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <NumeroAnimado valor={docentes.length - totalActivos} singular="inactivo" plural="inactivos" />
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: búsqueda y vista (tarjetas, lista o materias asignadas a otra carrera) */}
        <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
          <CampoBusqueda
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={verMaterias ? 'Buscar docente o materia' : 'Buscar por nombre o C.I.'}
          />
          {/* Filtro de carrera: solo el superusuario ve todas las carreras */}
          {esSuperusuario && !verMaterias && (
            <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
              <FiltroDesplegable
                value={carreraFiltro}
                onChange={setCarreraFiltro}
                options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                placeholder="Todas las carreras"
                ariaLabel="Filtrar por carrera"
                emptyText="No hay carreras que coincidan"
              />
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Materias de esta carrera asignadas a docentes de otra carrera: vista aparte. */}
            <div className="flex items-center p-1 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300">
              <button
                type="button"
                title="Materias asignadas"
                onClick={() => cambiarVista('materias')}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 h-9 rounded-full text-sm font-medium transition-colors ${
                  verMaterias ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:text-blue-900'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Materias asignadas</span>
              </button>
            </div>
            <SelectorVista vista={vista} onCambiar={cambiarVista} />
          </div>
        </div>

        {/* Materias asignadas a docentes de otra carrera (vista) y la ventana para asignar. */}
        <AsignarMateriaOtraCarrera
          soloLectura={esSuperusuario}
          mostrarLista={verMaterias}
          filtro={searchTerm}
          modalAbierto={asignando}
          onCerrarModal={() => setAsignando(false)}
        />

        {/* Bloque 3: docentes en tarjetas o en lista (15 por página en lista y 9 en tarjetas) */}
        <div ref={listaRef} className="scroll-mt-4" />
        {verMaterias ? null : filteredDocentes.length > 0 ? (
          vista === 'lista' ? (
            // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
            <div key={`lista-${claveVista}`} className={`${BLOQUE} p-2 sm:p-3`}>
              <div className="hidden xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_8rem_10rem_10rem] gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]">
                <span>Docente</span>
                <span>Contacto</span>
                <span>Categoría</span>
                <span>Dedicación</span>
                <span>Acción</span>
              </div>
              <div className="divide-y divide-azulado-300">
                {docentesPagina.map((docente, indice) => {
                  const info = infoDocente(docente);
                  return (
                    <div
                      key={docente.id}
                      style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                      className={`animate-fondo-entrada grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_8rem_10rem_10rem] items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl transition-colors ${
                        docente.activo ? 'hover:bg-azulado-100/70' : 'bg-red-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nombre={info.nombre} size={`w-10 h-10 text-sm ${docente.activo ? '' : '!bg-red-700'}`} />
                        <div className="min-w-0">
                          <div className="font-bold text-blue-900 truncate" title={info.nombre}>{info.nombre}</div>
                          {!docente.activo && <div className="text-sm font-semibold text-red-700">Inactivo</div>}
                        </div>
                      </div>
                      <div className="min-w-0 text-tabla text-slate-700">
                        <div className="tabular-nums">CI: {docente?.ci || '—'}</div>
                        {info.email && <div className="truncate text-slate-600" title={info.email}>{info.email}</div>}
                      </div>
                      {info.datos.map((dato) => (
                        <div key={dato.label} className="min-w-0 flex items-baseline justify-between gap-3 xl:block">
                          <span className="xl:hidden text-xs font-semibold text-blue-800">{dato.label}</span>
                          <span className="block text-tabla font-semibold text-slate-800 truncate">{dato.valor}</span>
                        </div>
                      ))}
                      <div>{botonGestionar(docente)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div key={`tarjetas-${claveVista}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {docentesPagina.map((docente, indice) => {
                const info = infoDocente(docente);
                return (
                  <div
                    key={docente.id}
                    style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                    className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4 ${docente.activo ? '' : '!bg-red-50/70 !ring-red-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nombre={info.nombre} size={`w-12 h-12 ${docente.activo ? '' : '!bg-red-700'}`} />
                        <h3 className="text-lg font-bold text-blue-900 leading-tight line-clamp-2" title={info.nombre}>{info.nombre}</h3>
                      </div>
                      {!docente.activo && <PildoraInactivo />}
                    </div>

                    <div className="flex flex-wrap gap-2 min-w-0">
                      <Etiqueta>CI: {docente?.ci || '—'}</Etiqueta>
                      {info.email && (
                        <span className="min-w-0 max-w-full truncate"><Etiqueta>{info.email}</Etiqueta></span>
                      )}
                    </div>

                    <dl className="grid grid-cols-2 divide-x divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 py-2.5">
                      {info.datos.map((dato) => (
                        <div key={dato.label} className="min-w-0 px-4">
                          <dt className="text-xs font-semibold text-blue-800">{dato.label}</dt>
                          <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 truncate" title={dato.valor}>{dato.valor}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-auto pt-3 flex justify-end [border-top:1px_solid_#B8C9E1]">
                      {botonGestionar(docente)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {docentes.length > 0 ? 'No se encontraron docentes' : 'No hay docentes en la carrera'}
            </h3>
            <p className="text-slate-600">
              {docentes.length > 0 ? 'Intenta con otro nombre o C.I.' : 'Los docentes se registran en la sección Docentes.'}
            </p>
          </div>
        )}

        {!verMaterias && <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiar={irAPagina} />}
      </div>
    </div>
  );
};

export default CargaHorariaGeneral;
