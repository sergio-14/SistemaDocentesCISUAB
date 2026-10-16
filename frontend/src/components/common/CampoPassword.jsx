import MensajeErrorCampo from './MensajeErrorCampo';

export const ICONO_CANDADO = 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z';

// Campo de contraseña con el botón de mostrar/ocultar (diseño del módulo de Fondo de Tiempo):
// cambio obligatorio del primer ingreso y Mi cuenta → Seguridad.
function CampoPassword({
  etiqueta, value, onChange, error, pulso, visible, onAlternar,
  id, autoComplete = 'new-password', placeholder = 'Mínimo 8 caracteres',
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-blue-900">{etiqueta}</label>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CANDADO} />
        </svg>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error) || undefined}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`block w-full rounded-2xl bg-white py-3 pl-11 pr-12 text-sm text-slate-900 placeholder-slate-400 ring-1 ring-inset outline-none transition focus:ring-2 ${
            error ? 'ring-red-300 focus:ring-red-400' : 'ring-azulado-300 focus:ring-blue-900'
          }`}
        />
        <button
          type="button"
          onClick={onAlternar}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 hover:bg-azulado-100 hover:text-blue-900"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            {visible ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </>
            )}
          </svg>
        </button>
      </div>
      <MensajeErrorCampo error={error} pulse={pulso} tono="text-red-600" />
    </div>
  );
}

export default CampoPassword;
