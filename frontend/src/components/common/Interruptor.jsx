// Interruptor de activo / inactivo: encendido en el color secundario (celeste). chico: versión
// compacta para las tarjetas y filas de los listados. disabled: se ve atenuado y no responde.
function Interruptor({ isActive, onChange, etiqueta, chico = false, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(isActive)}
      aria-label={etiqueta}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex ${chico ? 'h-5 w-9' : 'h-6 w-12'} flex-shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isActive ? 'bg-sky-600 focus:ring-sky-400' : 'bg-slate-300 focus:ring-slate-400'
      }`}
    >
      <span
        className={`inline-block ${chico ? 'h-4 w-4' : 'h-5 w-5'} transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
          isActive ? (chico ? 'translate-x-[18px]' : 'translate-x-6') : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default Interruptor;
