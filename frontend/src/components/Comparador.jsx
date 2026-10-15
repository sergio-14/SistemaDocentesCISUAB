import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { compararFondos, getDocentes } from '../apis/api';
import { EstadoPill } from './fondos/ElementosFondo';
import { estadoVisibleFondo } from './fondos/estilosFondo';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// Un color fijo por unidad (Art. 12): la misma unidad se ve igual en las dos gestiones.
const COLOR_UNIDAD = {
  academica: '#3B82F6',
  investigacion: '#10B981',
  extension_universitaria: '#F59E0B',
  interaccion_social: '#EF4444',
  gestion: '#8B5CF6',
  academica_administrativa: '#EC4899',
  social_cultural_deportiva: '#06B6D4',
};

const ANIO_ACTUAL = new Date().getFullYear();

function Comparador() {
  const [docentes, setDocentes] = useState([]);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState('');
  const [gestion1, setGestion1] = useState(String(ANIO_ACTUAL - 1));
  const [gestion2, setGestion2] = useState(String(ANIO_ACTUAL));
  const [fondos, setFondos] = useState([]);
  // Gestiones de la última comparación: las que no tienen fondo se avisan.
  const [gestionesComparadas, setGestionesComparadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDocentes();
  }, []);

  const cargarDocentes = async () => {
    try {
      const lista = await getDocentes();
      setDocentes(lista);
      // El primero de la lista (para el docente, su propia ficha): el que muestra el desplegable.
      setDocenteSeleccionado((actual) => actual || (lista[0] ? String(lista[0].id) : ''));
    } catch (err) {
      console.error('Error al cargar docentes:', err);
    }
  };

  const comparar = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await compararFondos(docenteSeleccionado, gestion1, gestion2);
      setFondos(response.data);
      setGestionesComparadas([...new Set([Number(gestion1), Number(gestion2)])]);
      setLoading(false);
    } catch (err) {
      setFondos([]);
      setGestionesComparadas([]);
      setError(err.response?.data?.error || 'Error al comparar fondos');
      setLoading(false);
      console.error(err);
    }
  };

  const prepararDatosGrafico = (fondo) => {
    return fondo.categorias
      .filter(cat => cat.total_horas > 0)
      .map(cat => ({
        name: cat.tipo_display,
        value: parseFloat(cat.total_horas),
        porcentaje: parseFloat(cat.porcentaje),
        color: COLOR_UNIDAD[cat.tipo],
      }));
  };

  const gestionesSinFondo = gestionesComparadas.filter(
    (gestion) => !fondos.some((fondo) => fondo.gestion === gestion)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Comparador de Fondos
              </h1>
              <p className="text-slate-700 dark:text-slate-300 mt-1">
                Compara la distribución de horas entre dos gestiones
              </p>
            </div>
            <Link 
              to="/fondo-tiempo"
              className="px-5 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-slate-300 dark:border-slate-600"
            >
              ← Volver
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <span>🔍</span> Seleccionar Parámetros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Docente */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                👤 Docente
              </label>
              <select
                value={docenteSeleccionado}
                onChange={(e) => setDocenteSeleccionado(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              >
                {docentes.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nombres} {doc.apellido_paterno}
                  </option>
                ))}
              </select>
            </div>

            {/* Gestión 1 */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                📅 Gestión 1
              </label>
              <input
                type="number"
                value={gestion1}
                onChange={(e) => setGestion1(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              />
            </div>

            {/* Gestión 2 */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                📅 Gestión 2
              </label>
              <input
                type="number"
                value={gestion2}
                onChange={(e) => setGestion2(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md"
              />
            </div>

            {/* Botón */}
            <div className="flex items-end">
              <button
                onClick={comparar}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-xl hover:scale-105"
              >
                🔄 Comparar
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">Cargando comparación...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-xl p-4 shadow-md">
            <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Gestiones sin fondo */}
        {!loading && gestionesSinFondo.map((gestion) => (
          <div key={gestion} className="rounded-2xl bg-sky-50 dark:bg-sky-900/20 px-4 py-3 text-sm text-sky-900 dark:text-sky-300">
            No hay fondo de la gestión {gestion}.
          </div>
        ))}

        {/* Resultados */}
        {fondos.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {fondos.map((fondo) => {
              const datosGrafico = prepararDatosGrafico(fondo);
              
              return (
                <div key={fondo.id} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 border-b-2 border-slate-300 dark:border-slate-600">
                    <h2 className="text-2xl font-bold text-blue-600 dark:text-white">
                      Gestión {fondo.gestion}
                    </h2>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">{fondo.descripcion}</p>
                    <div className="mt-2"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    {/* Estadísticas */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Horas Efectivas</div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{fondo.horas_efectivas}h</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Total Asignado</div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">{fondo.total_asignado}h</div>
                      </div>
                    </div>

                    {/* Gráfico */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 border-2 border-slate-300 dark:border-slate-600 mb-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={datosGrafico}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ porcentaje }) => `${porcentaje}%`}
                          >
                            {datosGrafico.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value}h`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lista de Categorías */}
                    <div className="space-y-2 mb-4">
                      {fondo.categorias.filter(cat => cat.total_horas > 0).map((cat) => (
                        <div key={cat.tipo} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border-2 border-slate-300 dark:border-slate-600">
                          <span className="text-sm font-semibold" style={{ color: COLOR_UNIDAD[cat.tipo] }}>
                            {cat.tipo_display}
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">
                            {cat.total_horas}h ({cat.porcentaje}%)
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Botón Ver Detalle */}
                    <Link 
                      to={`/fondo-tiempo/fondo/${fondo.id}`}
                      className="block text-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                    >
                      👁️ Ver Detalle Completo
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Estado Vacío */}
        {fondos.length === 0 && gestionesComparadas.length === 0 && !loading && !error && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">📊</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Sin Comparación
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Selecciona un docente y dos gestiones para comparar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Comparador;