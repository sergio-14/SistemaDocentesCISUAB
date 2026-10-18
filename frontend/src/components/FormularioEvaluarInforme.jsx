import { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../utils/formErrors';
import ModalCentrado from './common/ModalCentrado';
import { BOTON } from './fondos/estilosFondo';

// Evaluación de cumplimiento del informe (Art. 19): uno de tres resultados y una
// observación opcional para el docente. Evaluar finaliza el fondo.
// requiereDocumentoDecanatura: fondo del Director (lo evalúa el superusuario y, por el
// Art. 28, el informe final se eleva a Decanatura con un PDF obligatorio).
function FormularioEvaluarInforme({ fondoId, onInformeEvaluado, onCancelar, requiereDocumentoDecanatura = false }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cumplimiento: '',
    evaluacion_director: ''
  });
  const [errores, setErrores] = useState({});
  const [documentoDecanatura, setDocumentoDecanatura] = useState(null);

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

    if (requiereDocumentoDecanatura && !documentoDecanatura) {
      nuevosErrores.documento_decanatura = 'Adjunte el documento de la Decanatura (PDF).';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      toast.error(MENSAJE_REVISA_CAMPOS);
      return;
    }

    setLoading(true);

    try {
      if (requiereDocumentoDecanatura) {
        const payload = new FormData();
        Object.entries(formData).forEach(([clave, valor]) => payload.append(clave, valor));
        payload.append('documento_decanatura', documentoDecanatura);
        await api.post(`/fondos-tiempo/${fondoId}/evaluar-y-finalizar/`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/fondos-tiempo/${fondoId}/evaluar-y-finalizar/`, formData);
      }
      toast.success('Informe evaluado y fondo finalizado exitosamente');
      onInformeEvaluado();
    } catch (err) {
      console.error('Error al evaluar informe:', err);
      toast.error(getApiErrorMessage(err, 'Error al evaluar el informe'));
    } finally {
      setLoading(false);
    }
  };

  const opcionesCumplimiento = [
    { value: 'cumplido', label: 'Cumplido', descripcion: 'Actividades completadas satisfactoriamente', activo: 'bg-emerald-50 text-emerald-800', punto: 'bg-emerald-500' },
    { value: 'parcial', label: 'Cumplimiento parcial', descripcion: 'Cumplimiento incompleto de actividades', activo: 'bg-amber-50 text-amber-800', punto: 'bg-amber-500' },
    { value: 'incumplido', label: 'Incumplido', descripcion: 'Actividades no realizadas', activo: 'bg-red-50 text-red-800', punto: 'bg-red-400' },
  ];
  const envioDeshabilitado = loading || !formData.cumplimiento;

  return (
    <ModalCentrado>
      <div className="w-full max-w-4xl max-h-[calc(100vh-3rem)] rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
          <div>
            <h3 className="text-xl font-bold text-blue-900">Evaluación de cumplimiento (Art. 19)</h3>
            <p className="text-sm text-slate-600">Califique el cumplimiento y finalice el fondo.</p>
          </div>
          <button
            onClick={onCancelar}
            disabled={loading}
            className="flex-shrink-0 rounded-full p-2 -mr-2 text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors disabled:opacity-50"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Nivel de cumplimiento */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2 pl-1">Nivel de cumplimiento</p>
              <div className={`space-y-2 rounded-2xl ${errores.cumplimiento ? 'ring-2 ring-red-400/80 p-1' : ''}`}>
                {opcionesCumplimiento.map((opcion) => {
                  const elegido = formData.cumplimiento === opcion.value;
                  return (
                    <label
                      key={opcion.value}
                      className={`flex items-start gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-colors ${
                        elegido ? opcion.activo : 'bg-azulado-100 text-slate-800 hover:bg-azulado-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cumplimiento"
                        value={opcion.value}
                        checked={elegido}
                        onChange={handleChange}
                        disabled={loading}
                        className="sr-only"
                      />
                      <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${elegido ? opcion.punto : 'bg-white ring-1 ring-inset ring-azulado-300'}`}>
                        {elegido && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{opcion.label}</span>
                        <span className="block text-xs opacity-80">{opcion.descripcion}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errores.cumplimiento && (
                <p className="text-xs text-red-600 mt-1.5 pl-1">{errores.cumplimiento}</p>
              )}
            </div>

            {/* Observación opcional: el docente la recibe junto con el resultado */}
            <div className="md:col-span-2 flex flex-col">
              <label htmlFor="evaluacion-observacion" className="block text-sm font-semibold text-slate-800 mb-2 pl-1">
                Observación <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea
                id="evaluacion-observacion"
                name="evaluacion_director"
                value={formData.evaluacion_director}
                onChange={handleChange}
                disabled={loading}
                rows="7"
                placeholder="Observación para el docente sobre el cumplimiento de su fondo de tiempo..."
                className="flex-1 w-full px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none resize-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100"
              />

              {requiereDocumentoDecanatura && (
                <div className={`mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 space-y-2 ${errores.documento_decanatura ? 'ring-2 ring-red-400/80' : ''}`}>
                  <p className="font-semibold">Fondo del Director de la carrera (Art. 28)</p>
                  <p>El informe final se eleva a Decanatura: adjunte su documento (PDF, obligatorio).</p>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={loading}
                    onChange={(e) => {
                      setDocumentoDecanatura(e.target.files?.[0] || null);
                      setErrores((prev) => ({ ...prev, documento_decanatura: '' }));
                    }}
                    className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:font-semibold file:text-amber-800"
                  />
                  {errores.documento_decanatura && (
                    <p className="text-xs text-red-600">{errores.documento_decanatura}</p>
                  )}
                </div>
              )}

              <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
                Al confirmar, el fondo de tiempo quedará finalizado y no podrá modificarse.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-4 [border-top:1px_solid_#B8C9E1]">
          <button
            type="button"
            onClick={onCancelar}
            disabled={loading}
            className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={envioDeshabilitado}
            className={`${BOTON} px-5 py-2.5 ${envioDeshabilitado ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {loading ? 'Procesando...' : 'Evaluar y finalizar fondo'}
          </button>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default FormularioEvaluarInforme;
