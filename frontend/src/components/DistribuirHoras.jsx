import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { distribuirHorasFondoTiempo, getCategoriasPorFondo } from '../apis/api';
import { getApiErrorMessage } from '../utils/formErrors';

const FUNCIONES_SUSTANTIVAS = [
  { tipo: 'academica', nombre: 'Académica', color: '#3B82F6' },
  { tipo: 'investigacion', nombre: 'Investigación', color: '#10B981' },
  { tipo: 'extension_universitaria', nombre: 'Extensión universitaria', color: '#F59E0B' },
  { tipo: 'interaccion_social', nombre: 'Interacción social', color: '#EF4444' },
  { tipo: 'gestion', nombre: 'Gestión', color: '#EC4899' },
  { tipo: 'academica_administrativa', nombre: 'Académica-administrativa', color: '#8B5CF6' },
  { tipo: 'social_cultural_deportiva', nombre: 'Social, cultural, deportiva y Otros', color: '#06B6D4' },
];

function DistribuirHoras({
  fondoId,
  horasEfectivas = 1832,
  horasObjetivo = null,
  editable = false,
  onActualizar,
  onGuardarExitoso,
  onAgregarActividad,
  hideActionButtons = false,
  canAddActivity = false
}) {
  const [categorias, setCategorias] = useState({});
  const [horasEditables, setHorasEditables] = useState({});
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const objetivoDistribucion = Number(horasObjetivo || horasEfectivas || 0);

  useEffect(() => {
    cargarCategorias();
  }, [fondoId]);

  const cargarCategorias = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setLoading(true);
      const response = await getCategoriasPorFondo(fondoId);
      const categoriasArray = response.data.results || response.data;

      if (!Array.isArray(categoriasArray)) {
        setCategorias({});
        setHorasEditables({});
        return;
      }

      const categoriasObj = {};
      categoriasArray.forEach((cat) => {
        categoriasObj[cat.tipo] = {
          id: cat.id,
          horas: parseFloat(cat.total_horas) || 0,
          detalles_carga: cat.detalles_carga || [],
          actividades: cat.actividades || []
        };
      });

      setCategorias(categoriasObj);
      setHorasEditables(Object.fromEntries(
        FUNCIONES_SUSTANTIVAS.map((funcion) => [
          funcion.tipo,
          categoriasObj[funcion.tipo]?.horas || 0
        ])
      ));
    } catch (err) {
      if (err.response?.status === 404) {
        setCategorias({});
        setHorasEditables({});
      } else {
        toast.error('Error al cargar la distribución');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  const valoresDistribucion = editable
    ? Object.values(horasEditables)
    : Object.values(categorias).map((cat) => cat.horas || 0);

  const totalAsignado = valoresDistribucion.reduce(
    (sum, horas) => sum + (Number(horas) || 0),
    0
  );
  const disponible = objetivoDistribucion - totalAsignado;
  const diff = totalAsignado - objetivoDistribucion;
  const distribucionValida = Math.abs(diff) < 0.1;
  const porcentaje = objetivoDistribucion > 0
    ? (totalAsignado / objetivoDistribucion) * 100
    : 0;

  let barColor = 'bg-blue-500';
  let statusMessage = `Faltan ${Math.round(disponible)} hrs para cumplir la dedicación semanal`;

  if (distribucionValida) {
    barColor = 'bg-green-500';
    statusMessage = 'Has completado exactamente las horas semanales requeridas';
  } else if (diff > 0) {
    barColor = 'bg-orange-500';
    statusMessage = `Te has pasado por ${Math.round(diff)} hrs`;
  }

  const handleHorasChange = (tipo, value) => {
    const normalized = value === '' ? '' : Math.max(0, Number(value));
    setHorasEditables(prev => ({
      ...prev,
      [tipo]: normalized
    }));
  };

  const guardarDistribucion = async () => {
    if (!distribucionValida) return;

    try {
      setGuardando(true);
      const categoriasPayload = Object.fromEntries(
        FUNCIONES_SUSTANTIVAS.map((funcion) => [
          funcion.tipo,
          Number(horasEditables[funcion.tipo] || 0)
        ])
      );
      await distribuirHorasFondoTiempo(fondoId, { categorias: categoriasPayload });
      if (onGuardarExitoso) {
        onGuardarExitoso();
      } else {
        toast.success('Distribución de horas guardada correctamente');
      }
      await cargarCategorias({ silencioso: true });
      if (onActualizar) onActualizar();
    } catch (err) {
      console.error('Error al guardar distribución:', err);
      toast.error(getApiErrorMessage(err, 'No se pudo guardar la distribución de horas'));
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600 mx-auto mb-3"></div>
          <p className="text-slate-700 dark:text-slate-300 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 text-center transition-colors duration-300">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-100">
            Distribución de Horas por Función
          </h2>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {FUNCIONES_SUSTANTIVAS.map((funcion) => {
              const cat = categorias[funcion.tipo];
              const horas = editable
                ? Number(horasEditables[funcion.tipo] || 0)
                : (cat?.horas || 0);
              const tieneHoras = horas > 0;

              return (
                <div
                  key={funcion.tipo}
                  className={`relative overflow-hidden rounded-xl border flex flex-col justify-between p-3 transition-all duration-300 ${tieneHoras
                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
                    }`}
                >
                  {tieneHoras && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: funcion.color }}
                    />
                  )}

                  <h3 className={`font-semibold text-xs leading-tight mb-2 ${tieneHoras ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                    {funcion.nombre}
                  </h3>

                  <div className="flex items-baseline gap-1 mt-auto">
                    {editable ? (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={horasEditables[funcion.tipo] ?? 0}
                        onChange={(e) => handleHorasChange(funcion.tipo, e.target.value)}
                        className="w-24 rounded-lg border-2 border-slate-300 bg-white px-2 py-1 text-lg font-black leading-none text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/40"
                      />
                    ) : (
                      <span className={`text-lg sm:text-xl font-black leading-none ${tieneHoras ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                        {Math.round(horas)}
                      </span>
                    )}
                    <span className={`text-xs font-semibold leading-none ${tieneHoras ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}>
                      hrs/sem
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`bg-slate-50/90 dark:bg-slate-900/50 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 transition-colors duration-300 flex flex-col ${onAgregarActividad && !hideActionButtons ? 'justify-between' : 'justify-center min-h-[220px]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Progreso Global del Contrato
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">
                {Math.round(totalAsignado)}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                / {Math.round(objetivoDistribucion)} hrs/sem
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${
              distribucionValida
                ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700'
                : diff > 0
                ? 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                : 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            }`}>
              {distribucionValida ? 'CUMPLIDO' : diff > 0 ? 'EXCESO' : 'DEFICIT'}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium text-right">
              {statusMessage}
            </span>
          </div>
        </div>

        <div className="relative mt-3">
          <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ring-2 ring-slate-300/80 dark:ring-slate-600/80">
            <div
              className={`h-full transition-all duration-700 ease-out ${barColor} relative`}
              style={{ width: `${objetivoDistribucion > 0 ? Math.min(porcentaje, 100) : 0}%` }}
            >
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,rgba(255,255,255,.4) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.4) 50%,rgba(255,255,255,.4) 75%,transparent 75%,transparent)',
                  backgroundSize: '0.75rem 0.75rem'
                }}
              ></div>
            </div>
          </div>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white drop-shadow-md">
            {Math.round(porcentaje)}%
          </span>
        </div>

        {editable && !distribucionValida && (
          <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            La suma de las 7 categorías debe ser igual a {Math.round(objetivoDistribucion)} horas semanales. Total actual: {Math.round(totalAsignado)} horas.
          </div>
        )}

        {editable && (
          <button
            type="button"
            onClick={guardarDistribucion}
            disabled={guardando || !distribucionValida}
            className="mt-4 w-full py-2 px-4 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/30 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {guardando ? 'Guardando...' : 'Guardar distribución de horas'}
          </button>
        )}

        {canAddActivity && onAgregarActividad && !hideActionButtons && (
          <button
            onClick={onAgregarActividad}
            className="mt-4 w-full py-2 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            <span>Agregar Nueva Actividad</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default DistribuirHoras;
