import { useState, useEffect } from 'react';
import { getHistorial } from '../apis/api';
import { Link } from 'react-router-dom';

// Re-usar los íconos de SeguimientoHistorial
const IconoInfo = () => <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
const IconoCheck = () => <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const IconoAlerta = () => <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

function SeguimientoGlobal({ isDark }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarHistorialGlobal = async () => {
      try {
        setLoading(true);
        const response = await getHistorial();
        setHistorial(response.data.results || response.data || []);
        setError(null);
      } catch (err) {
        console.error("Error al cargar el historial global:", err);
        setError("No se pudo cargar la actividad reciente.");
      } finally {
        setLoading(false);
      }
    };
    cargarHistorialGlobal();
  }, []);

  const getEstiloPorTipo = (tipo) => {
    switch (tipo) {
      case 'creacion': return { icono: <IconoInfo />, color: 'bg-gray-500' };
      case 'presentacion': return { icono: <IconoInfo />, color: 'bg-blue-500' };
      case 'aprobacion': return { icono: <IconoCheck />, color: 'bg-green-500' };
      case 'observacion': return { icono: <IconoAlerta />, color: 'bg-orange-500' };
      case 'rechazo': return { icono: <IconoAlerta />, color: 'bg-red-500' };
      case 'finalizacion': return { icono: <IconoCheck />, color: 'bg-purple-500' };
      case 'inicio_ejecucion': return { icono: <IconoInfo />, color: 'bg-violet-500' };
      case 'informe_presentado': return { icono: <IconoInfo />, color: 'bg-cyan-500' };
      default: return { icono: <IconoInfo />, color: 'bg-gray-400' };
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando actividad reciente...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center p-6">
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-lg">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-200">
          Seguimiento Global
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Línea de tiempo con la actividad reciente de todos los fondos de tiempo.
        </p>
      </div>

      {historial.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Sin Actividad</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">No se han registrado eventos recientemente.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4">
          {historial.map((evento) => {
            const { icono, color } = getEstiloPorTipo(evento.tipo_cambio);
            return (
              <div key={evento.id} className="mb-8 ml-8">
                <span className={`absolute -left-[1.1rem] flex items-center justify-center w-8 h-8 rounded-full ring-8 ring-slate-100 dark:ring-slate-900 ${color}`}>
                  {icono}
                </span>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{evento.tipo_cambio_display}</span>
                    <time className="text-xs font-normal text-slate-500 dark:text-slate-400">{formatearFecha(evento.fecha)}</time>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{evento.descripcion}</p>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                    <p>
                      Fondo: <Link to={`/fondo-tiempo/fondo/${evento.fondo_tiempo}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{evento.fondo_asignatura}</Link>
                    </p>
                    <p>
                      Por: <span className="font-medium text-slate-700 dark:text-slate-300">{evento.usuario_nombre}</span>
                    </p>
                  </div>
                  {evento.estado_anterior && evento.estado_nuevo && (
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Cambio de estado:</span>
                      <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 rounded-full dark:bg-red-900 dark:text-red-300">{evento.estado_anterior.replace(/_/g, ' ')}</span>
                      <span className="mx-1">→</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full dark:bg-green-900 dark:text-green-300">{evento.estado_nuevo.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SeguimientoGlobal;