// Resolución del Consejo de Carrera (PDF) que designa al Jefe de Estudios.
// Obligatoria al asignar ese rol, también para el superusuario; el backend
// comprueba que sea realmente un PDF.
function CampoResolucionJefe({ archivo, onChange, error, className = '' }) {
  const mensajeError = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        Resolución del Consejo de Carrera (PDF) <span className="text-red-500">*</span>
      </label>
      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className={`block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#2C4AAE] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white rounded-xl border-2 ${mensajeError ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 p-1`}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {archivo ? `Archivo: ${archivo.name}` : 'Obligatoria para designar al Jefe de Estudios.'}
      </p>
      {mensajeError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{mensajeError}</p>}
    </div>
  );
}

export default CampoResolucionJefe;
