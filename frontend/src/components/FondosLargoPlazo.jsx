import { useState, useEffect } from 'react';
import { getFondosLargoPlazo } from '../apis/api';
import { Link } from 'react-router-dom';

function FondosLargoPlazo({ isDark }) {
  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarFondos = async () => {
      try {
        setLoading(true);
        const response = await getFondosLargoPlazo();
        setFondos(response.data.results || response.data);
        setError(null);
      } catch (error) {
        console.error("Error al cargar fondos a largo plazo:", error);
        setError("No se pudieron cargar los fondos a largo plazo. Intente de nuevo más tarde.");
      } finally {
        setLoading(false);
      }
    };
    cargarFondos();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando fondos a largo plazo...
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
          Fondos de Tiempo a Largo Plazo
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Proyectos de investigación, extensión y otros que no se enmarcan en un único semestre.
        </p>
      </div>
      
      {fondos.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No se encontraron fondos</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Actualmente no hay fondos de tiempo catalogados como "Largo Plazo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fondos.map(fondo => (
            <div key={fondo.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2 pr-4">
                  {fondo.asignatura || 'Proyecto a Largo Plazo'}
                </h2>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                  fondo.estado === 'finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 
                  fondo.estado === 'en_ejecucion' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                }`}>
                  {fondo.estado.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{fondo.docente_nombre}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Gestión: {fondo.gestion}</p>
              
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-end">
                <Link to={`/fondo-tiempo/fondo/${fondo.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                  Ver Detalles →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FondosLargoPlazo;