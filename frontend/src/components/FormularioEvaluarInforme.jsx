import { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/formErrors';

function FormularioEvaluarInforme({ fondoId, onInformeEvaluado, onCancelar }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cumplimiento: '',
    evaluacion_director: ''
  });
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errores[name]) {
      setErrores(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.cumplimiento) {
      nuevosErrores.cumplimiento = 'Debe seleccionar un nivel de cumplimiento';
    }

    if (!formData.evaluacion_director || formData.evaluacion_director.trim().length < 30) {
      nuevosErrores.evaluacion_director = 'Debe proporcionar una evaluación detallada (mínimo 30 caracteres)';
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
      await api.post(`/fondos-tiempo/${fondoId}/evaluar-y-finalizar/`, formData);
      toast.success('Informe evaluado y fondo finalizado exitosamente');
      onInformeEvaluado();
    } catch (err) {
      console.error('Error al evaluar informe:', err);
      toast.error(getApiErrorMessage(err, 'Error al evaluar el informe'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header con gradiente azul */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Evaluación de Informe
                </h2>
                <p className="text-xs text-blue-100">
                  Universidad Autónoma del Beni "José Ballivián"
                </p>
              </div>
            </div>
            <button
              onClick={onCancelar}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-all hover:scale-110 disabled:opacity-50"
              title="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
            
            {/* Panel izquierdo - Nivel de cumplimiento */}
            <div className="col-span-1 p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900/50 dark:to-blue-900/10">
              <label className="block text-sm font-bold mb-4 text-slate-800 dark:text-slate-200">
                Nivel de Cumplimiento <span className="text-red-500">*</span>
              </label>
              
              <div className="space-y-3">
                {/* Cumplido */}
                <label className={`relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  formData.cumplimiento === 'cumplido'
                    ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-md scale-[1.02]'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-green-400 dark:hover:border-green-600'
                }`}>
                  <input
                    type="radio"
                    name="cumplimiento"
                    value="cumplido"
                    checked={formData.cumplimiento === 'cumplido'}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 text-green-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Cumplido
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 pl-9">
                      Actividades completadas satisfactoriamente
                    </p>
                  </div>
                </label>

                {/* Parcial */}
                <label className={`relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  formData.cumplimiento === 'parcial'
                    ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 shadow-md scale-[1.02]'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-yellow-400 dark:hover:border-yellow-600'
                }`}>
                  <input
                    type="radio"
                    name="cumplimiento"
                    value="parcial"
                    checked={formData.cumplimiento === 'parcial'}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Parcial
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 pl-9">
                      Cumplimiento incompleto de actividades
                    </p>
                  </div>
                </label>

                {/* Incumplido */}
                <label className={`relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  formData.cumplimiento === 'incumplido'
                    ? 'border-red-500 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 shadow-md scale-[1.02]'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-red-400 dark:hover:border-red-600'
                }`}>
                  <input
                    type="radio"
                    name="cumplimiento"
                    value="incumplido"
                    checked={formData.cumplimiento === 'incumplido'}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 text-red-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Incumplido
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 pl-9">
                      Actividades no realizadas
                    </p>
                  </div>
                </label>
              </div>

              {errores.cumplimiento && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-3">
                  {errores.cumplimiento}
                </p>
              )}

              {/* Indicador visual */}
              {formData.cumplimiento && (
                <div className="mt-6 p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Calificación seleccionada:
                  </p>
                  <p className={`text-sm font-bold ${
                    formData.cumplimiento === 'cumplido' ? 'text-green-600 dark:text-green-400' :
                    formData.cumplimiento === 'parcial' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {formData.cumplimiento === 'cumplido' ? '✓ Cumplido' :
                     formData.cumplimiento === 'parcial' ? '⚠ Cumplimiento Parcial' :
                     '✕ Incumplido'}
                  </p>
                </div>
              )}
            </div>

            {/* Panel derecho - Evaluación detallada */}
            <div className="col-span-2 p-6 bg-white dark:bg-slate-800 flex flex-col">
              <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">
                Evaluación del Director <span className="text-red-500">*</span>
              </label>
              
              <textarea
                name="evaluacion_director"
                value={formData.evaluacion_director}
                onChange={handleChange}
                disabled={loading}
                rows="10"
                placeholder="Proporcione una evaluación objetiva y detallada del desempeño del docente. Incluya:&#10;&#10;• Análisis del cumplimiento de las actividades planificadas&#10;• Calidad del trabajo realizado&#10;• Fortalezas identificadas&#10;• Áreas de mejora&#10;• Recomendaciones para futuras gestiones"
                className={`flex-1 px-4 py-3 rounded-xl border-2 ${
                  errores.evaluacion_director 
                    ? 'border-red-500 dark:border-red-500' 
                    : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-500'
                } bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none text-sm shadow-sm`}
              />
              
              <div className="flex justify-between items-center mt-2">
                {errores.evaluacion_director ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errores.evaluacion_director}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Mínimo 30 caracteres
                  </p>
                )}
                <p className={`text-xs font-medium ${
                  formData.evaluacion_director.length >= 30 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-slate-500 dark:text-slate-500'
                }`}>
                  {formData.evaluacion_director.length} caracteres
                </p>
              </div>

              {/* Nota informativa */}
              <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-l-4 border-yellow-500 shadow-sm">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-yellow-800 dark:text-yellow-300">
                    <span className="font-semibold">Nota:</span> Esta evaluación será permanente y el fondo se marcará como finalizado. La acción no puede revertirse.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancelar}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !formData.cumplimiento || formData.evaluacion_director.length < 30}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl flex items-center gap-2 ${
                loading || !formData.cumplimiento || formData.evaluacion_director.length < 30
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Evaluar y Finalizar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FormularioEvaluarInforme;
