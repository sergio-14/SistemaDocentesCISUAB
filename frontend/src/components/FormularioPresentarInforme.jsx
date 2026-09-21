import { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/formErrors';

const DocumentTextIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

function FormularioPresentarInforme({ fondoId, onInformePresentado, onCancelar }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    actividades_realizadas: '',
    logros: '',
    dificultades: ''
  });
  const [evidencia, setEvidencia] = useState(null);
  const [asignaturas, setAsignaturas] = useState([
    { nombre_materia: '', inscritos: '', aprobados: '', reprobados: '', habilitados: '' }
  ]);
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar error del campo
    if (errores[name]) {
      setErrores(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleAsignaturaChange = (index, field, value) => {
    setAsignaturas(prev => prev.map((item, idx) => (
      idx === index ? { ...item, [field]: value } : item
    )));
  };

  const agregarAsignatura = () => {
    setAsignaturas(prev => [
      ...prev,
      { nombre_materia: '', inscritos: '', aprobados: '', reprobados: '', habilitados: '' }
    ]);
  };

  const quitarAsignatura = (index) => {
    setAsignaturas(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index));
  };

  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.actividades_realizadas || formData.actividades_realizadas.trim().length < 50) {
      nuevosErrores.actividades_realizadas = 'Debe describir las actividades realizadas (mínimo 50 caracteres)';
    }

    if (!formData.logros || formData.logros.trim().length < 30) {
      nuevosErrores.logros = 'Debe describir los logros alcanzados (mínimo 30 caracteres)';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      toast.error('⚠️ Por favor, completa todos los campos requeridos');
      return;
    }

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('actividades_realizadas', formData.actividades_realizadas);
      payload.append('logros', formData.logros);
      payload.append('dificultades', formData.dificultades);
      if (evidencia) {
        payload.append('evidencia', evidencia);
      }
      payload.append('asignaturas', JSON.stringify(
        asignaturas
          .filter(item => item.nombre_materia.trim())
          .map(item => ({
            nombre_materia: item.nombre_materia.trim(),
            inscritos: Number(item.inscritos || 0),
            aprobados: Number(item.aprobados || 0),
            reprobados: Number(item.reprobados || 0),
            habilitados: Number(item.habilitados || 0),
          }))
      ));

      await api.post(`/fondos-tiempo/${fondoId}/presentar-informe/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Informe presentado exitosamente');
      onInformePresentado();
    } catch (err) {
      console.error('Error al presentar informe:', err);
      toast.error(getApiErrorMessage(err, 'Error al presentar el informe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📝</span> Presentar Informe de Cumplimiento
          </h2>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Actividades Realizadas */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-300">
                📋 Actividades Realizadas <span className="text-red-500">*</span>
              </label>
              <textarea
                name="actividades_realizadas"
                value={formData.actividades_realizadas}
                onChange={handleChange}
                disabled={loading}
                rows="6"
                placeholder="Describe detalladamente las actividades que realizaste durante el semestre..."
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  errores.actividades_realizadas 
                    ? 'border-red-500 dark:border-red-500' 
                    : 'border-slate-300 dark:border-slate-600'
                } bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md resize-none`}
              />
              <div className="flex justify-between items-center mt-1">
                {errores.actividades_realizadas ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{errores.actividades_realizadas}</p>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    Mínimo 50 caracteres
                  </p>
                )}
                <p className={`text-xs ${
                  formData.actividades_realizadas.length >= 50 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-slate-500 dark:text-slate-500'
                }`}>
                  {formData.actividades_realizadas.length} / 50
                </p>
              </div>
            </div>

            {/* Logros */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-300">
                🎯 Logros Alcanzados <span className="text-red-500">*</span>
              </label>
              <textarea
                name="logros"
                value={formData.logros}
                onChange={handleChange}
                disabled={loading}
                rows="5"
                placeholder="Describe los logros y resultados obtenidos..."
                className={`w-full px-4 py-3 rounded-xl border-2 ${
                  errores.logros 
                    ? 'border-red-500 dark:border-red-500' 
                    : 'border-slate-300 dark:border-slate-600'
                } bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md resize-none`}
              />
              <div className="flex justify-between items-center mt-1">
                {errores.logros ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{errores.logros}</p>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-500">
                    Mínimo 30 caracteres
                  </p>
                )}
                <p className={`text-xs ${
                  formData.logros.length >= 30 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-slate-500 dark:text-slate-500'
                }`}>
                  {formData.logros.length} / 30
                </p>
              </div>
            </div>

            {/* Dificultades (opcional) */}
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-300">
                ⚠️ Dificultades Encontradas <span className="text-slate-500">(Opcional)</span>
              </label>
              <textarea
                name="dificultades"
                value={formData.dificultades}
                onChange={handleChange}
                disabled={loading}
                rows="4"
                placeholder="Si encontraste dificultades durante la ejecución, descríbelas aquí..."
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md resize-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-300">
                  Asignaturas Ejecutadas
                </label>
                <button
                  type="button"
                  onClick={agregarAsignatura}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
              {asignaturas.map((asignatura, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <input
                    type="text"
                    value={asignatura.nombre_materia}
                    onChange={(e) => handleAsignaturaChange(index, 'nombre_materia', e.target.value)}
                    disabled={loading}
                    placeholder="Materia"
                    className="md:col-span-2 px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
                  />
                  {['inscritos', 'aprobados', 'reprobados', 'habilitados'].map((field) => (
                    <input
                      key={field}
                      type="number"
                      min="0"
                      value={asignatura[field]}
                      onChange={(e) => handleAsignaturaChange(index, field, e.target.value)}
                      disabled={loading}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      className="px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
                    />
                  ))}
                  {asignaturas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarAsignatura(index)}
                      disabled={loading}
                      className="md:col-span-6 text-sm font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Quitar asignatura
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-300">
                Evidencia Digital
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setEvidencia(e.target.files?.[0] || null)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
              />
            </div>

            {/* Nota informativa */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-bold">💡 Nota:</span> Este informe será revisado por el Director de Carrera, quien evaluará tu desempeño y cumplimiento de las actividades planificadas.
              </p>
            </div>
          </form>
        </div>

        {/* Footer con botones */}
        <div className="border-t-2 border-slate-300 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancelar}
              disabled={loading}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-xl flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:scale-105'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>📝</span>
                  <span>Presentar Informe</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FormularioPresentarInforme;
