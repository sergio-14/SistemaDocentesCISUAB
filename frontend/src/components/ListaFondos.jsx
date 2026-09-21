import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { eliminarFondoTiempo, generarFondosTiempoMasivo, getFondosTiempo } from '../apis/api';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';
import { useActiveRole } from '../contexts/ActiveRoleContext';

// --- ICONOS ---
const EyeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639l4.43-4.43a1.012 1.012 0 011.43 0l4.43 4.43a1.012 1.012 0 010 .639l-4.43 4.43a1.012 1.012 0 01-1.43 0l-4.43-4.43z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

const SparklesIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const ESTADOS_FONDO = {
  borrador: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
  presentado_jefe: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  observado: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  presentado_director: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  aprobado_director: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  en_ejecucion: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700',
  informe_presentado: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
  finalizado: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  rechazado: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  archivado: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600',
};

function ListaFondos({ isDark }) {
  const { effectiveUser, activeAssignment } = useActiveRole();
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [showMassiveModal, setShowMassiveModal] = useState(false);
  const [generandoMasivo, setGenerandoMasivo] = useState(false);
  const firmaEstadosRef = useRef(null);
  
  useEffect(() => {
    firmaEstadosRef.current = null;
    cargarFondos();
    setUser(effectiveUser || JSON.parse(localStorage.getItem('user') || 'null'));
  }, [activeAssignment?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      cargarFondos({ silencioso: true }).then((huboCambios) => {
        if (huboCambios) {
          window.clearInterval(intervalId);
        }
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeAssignment?.id]);

  useEffect(() => {
    if (effectiveUser) {
      setUser(effectiveUser);
    }
  }, [effectiveUser]);

  const cargarFondos = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) {
        setLoading(true);
      }
      const response = await getFondosTiempo();
      const data = response.data.results || response.data;
      const fondosData = Array.isArray(data) ? data : [];
      const firmaEstados = fondosData
        .map((fondo) => `${fondo.id}:${fondo.estado}`)
        .sort()
        .join('|');
      const huboCambios = firmaEstadosRef.current !== null && firmaEstadosRef.current !== firmaEstados;

      firmaEstadosRef.current = firmaEstados;
      setFondos(fondosData);
      if (!silencioso) {
        setLoading(false);
      }
      return huboCambios;
    } catch (err) {
      if (!silencioso) {
        setError('Error al cargar los fondos de tiempo');
        setLoading(false);
      }
      console.error(err);
      return false;
    }
  };

  const archivarFondo = async (fondoId) => {
    if (!confirm('¿Está seguro de archivar este fondo? Podrá restaurarlo después.')) {
      return;
    }

    try {
      await eliminarFondoTiempo(fondoId);

      setFondos((prev) => prev.filter((fondo) => fondo.id !== fondoId));
      alert('✅ Fondo archivado correctamente');
    } catch (err) {
      console.error(err);
      alert('❌ Error al archivar: ' + (err.response?.data?.detail || err.message));
    }
  };

  const puedeEditar = (fondo) => {
    return puedeCrearFondoTiempo(user) && ['borrador', 'observado'].includes(fondo.estado);
  };

  // iiisyp es solo lectura: solo superuser puede archivar fondos
  const esAdmin = () => {
    return user?.is_superuser === true;
  };

  const puedeCrear = puedeCrearFondoTiempo(user);
  const esIisyp = user?.perfil?.rol === 'iiisyp' && user?.is_superuser !== true;

  const generarFondosMasivamente = async () => {
    setGenerandoMasivo(true);

    try {
      const response = await generarFondosTiempoMasivo();
      const resumen = response.data || {};
      setShowMassiveModal(false);
      await cargarFondos({ silencioso: true });
      alert(
        `Fondos generados correctamente.\n\nCreados: ${resumen.creados || 0}\n` +
        `Omitidos por Dedicación Exclusiva: ${resumen.omitidos_exclusiva || 0}\n` +
        `Omitidos por ya existentes: ${resumen.omitidos_ya_existentes || 0}`
      );
    } catch (err) {
      console.error(err);
      alert('Error al generar fondos masivamente: ' + (err.response?.data?.error || err.response?.data?.detail || err.message));
    } finally {
      setGenerandoMasivo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-400">
            Cargando fondos de tiempo...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-6 bg-slate-50 dark:bg-slate-900">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header con mejor contraste */}
      <div className="bg-white dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 shadow-md">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Título */}
            <div>
              <h2 className="text-3xl font-bold text-blue-600 dark:text-white">
                Dashboard de Fondos
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión del Fondo de Tiempo Docente
              </p>
              {esIisyp && (
                <span className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg border-2 border-cyan-300 bg-cyan-50 text-xs font-bold text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                  Vista de Investigación - Solo Lectura
                </span>
              )}
            </div>

            {/* Contador y Botón */}
            <div className="flex items-center gap-4">
              {puedeCrear && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowMassiveModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    <span>Generar Fondos Masivamente</span>
                  </button>
                  <Link
                    to="/fondo-tiempo/nuevo-fondo"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span>Nuevo Fondo de Tiempo</span>
                  </Link>
                </>
              )}
              <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-md">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-white">
                    {fondos.length}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-400 font-medium">Total fondos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de fondos */}
      <div className="max-w-7xl mx-auto p-6">
        {fondos.length > 0 ? (
          <div className="space-y-4">
            {fondos.map((fondo) => (
              <div 
                key={fondo.id} 
                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="p-5">
                  {/* Fila superior */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
                    {/* Info del docente */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                        {(fondo.docente_nombre || 'NN').split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-blue-600 dark:text-white truncate">
                          {fondo.docente_nombre}
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-slate-400 truncate">
                          {fondo.carrera_nombre}
                        </p>
                      </div>
                    </div>

                    {/* Horas */}
                    <div className="bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-sm min-w-[140px]">
                      <div className="text-xl font-bold text-slate-800 dark:text-white text-center">
                        {Math.round(fondo.total_asignado || 0)} <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">/ {Math.round(fondo.horas_efectivas || 0)}</span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-400 font-medium text-center">hrs asignadas</div>
                    </div>

                    {/* Estado */}
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 shadow-sm ${ESTADOS_FONDO[fondo.estado] || ESTADOS_FONDO.borrador}`}>
                      {fondo.estado.toUpperCase()}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600">
                      📅 {fondo.gestion}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600">
                      📚 {fondo.asignatura}
                    </span>
                  </div>

                  {/* Progreso + Botones */}
                  <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t-2 border-slate-300 dark:border-slate-700">
                    {/* Progreso */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                          Progreso
                        </span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {Math.round(fondo.porcentaje_completado)}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2.5 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${fondo.porcentaje_completado}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Botones */}
                    <div className="flex flex-wrap gap-2">
                      <Link 
                        to={`/fondo-tiempo/fondo/${fondo.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                      >
                        <EyeIcon className="w-5 h-5" />
                        <span>Ver</span>
                      </Link>

                      {puedeEditar(fondo) && (
                        <Link
                          to={`/fondo-tiempo/editar-fondo/${fondo.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <PencilIcon className="w-5 h-5" />
                          <span>Editar</span>
                        </Link>
                      )}

                      {esAdmin() && ['aprobado_director', 'finalizado', 'rechazado', 'archivado'].includes(fondo.estado) && (
                        <button
                          onClick={() => archivarFondo(fondo.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition duration-300 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <ArchiveBoxIcon className="w-5 h-5" />
                          <span>Archivar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay fondos registrados
            </h3>
            <p className="text-slate-700 dark:text-slate-400 mb-6">
              Comienza creando tu primer fondo de tiempo
            </p>
            {puedeCrear && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMassiveModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  <SparklesIcon className="w-5 h-5" />
                  <span>Generar Fondos Masivamente</span>
                </button>
                <Link
                  to="/fondo-tiempo/nuevo-fondo"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Nuevo Fondo de Tiempo</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {showMassiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl">
            <div className="px-6 py-5 border-b-2 border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                Generar Fondos Masivamente
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                ¿Está seguro que desea generar los Fondos de Tiempo para todos los docentes activos de la gestión actual?
                El sistema omitirá automáticamente a los docentes con Dedicación Exclusiva y a los que ya tengan fondo creado.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t-2 border-slate-200 dark:border-slate-700 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowMassiveModal(false)}
                disabled={generandoMasivo}
                className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={generarFondosMasivamente}
                disabled={generandoMasivo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <SparklesIcon className="w-5 h-5" />
                <span>{generandoMasivo ? 'Generando...' : 'Confirmar generación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaFondos;
