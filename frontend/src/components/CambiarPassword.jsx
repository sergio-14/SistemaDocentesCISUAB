import { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { MENSAJE_REVISA_CAMPOS } from '../utils/formErrors';
import useModoClaro from '../utils/useModoClaro';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { BOTON } from './fondos/estilosFondo';

const ICONO_CANDADO = 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z';

// Campo de contraseña con el botón de mostrar/ocultar (diseño del módulo de Fondo de Tiempo).
function CampoPassword({ etiqueta, value, onChange, error, pulso, visible, onAlternar }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-blue-900">{etiqueta}</label>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CANDADO} />
        </svg>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error) || undefined}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
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

const CambiarPassword = ({ onPasswordChanged }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errores, setErrores] = useState({});
  const [pulso, setPulso] = useState(0);

  // Como el módulo de Fondo de Tiempo, esta pantalla solo se ve en modo claro.
  useModoClaro();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nuevosErrores = {};
    if (!password) nuevosErrores.password = 'Ingrese la nueva contraseña.';
    else if (password.length < 8) nuevosErrores.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (!confirmPassword) nuevosErrores.confirmar = 'Confirme la contraseña.';
    else if (password && password !== confirmPassword) nuevosErrores.confirmar = 'Las contraseñas no coinciden.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      setPulso((valor) => valor + 1);
      toast.error(MENSAJE_REVISA_CAMPOS);
      return;
    }

    try {
      setLoading(true);
      // 1. Enviar petición al backend
      await api.post('/auth/cambiar-password-inicial/', { password });
      toast.success('Contraseña actualizada correctamente');

      // 2. Obtener perfil actualizado (donde debe_cambiar_password ya será false)
      const response = await api.get('/usuario/');

      // 3. Notificar a App.jsx para desbloquear la pantalla
      if (onPasswordChanged) {
        onPasswordChanged(response.data);
      }
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      toast.error(error.response?.data?.error || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-950 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-[0_24px_64px_rgba(2,6,23,0.45)] animate-fade-in">
        {/* Cabecera: igual a la de los modales del sistema */}
        <div className="flex items-start gap-4 px-6 pt-7 sm:px-8">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 text-blue-900 ring-1 ring-inset ring-azulado-300">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CANDADO} />
            </svg>
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Primer ingreso</p>
            <h1 className="text-xl font-bold leading-tight text-blue-900">Cambio de contraseña</h1>
          </div>
        </div>
        <p className="px-6 pt-4 text-sm leading-relaxed text-slate-600 sm:px-8">
          Por seguridad, reemplaza la contraseña inicial que te asignaron por una propia de al menos 8 caracteres.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 pt-6 pb-7 sm:px-8">
            <CampoPassword
              etiqueta="Nueva contraseña"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
              error={errores.password}
              pulso={pulso}
              visible={showPassword}
              onAlternar={() => setShowPassword((prev) => !prev)}
            />
            <CampoPassword
              etiqueta="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrores((prev) => ({ ...prev, confirmar: undefined })); }}
              error={errores.confirmar}
              pulso={pulso}
              visible={showConfirmPassword}
              onAlternar={() => setShowConfirmPassword((prev) => !prev)}
            />
          </div>

          <div className="bg-azulado-100/60 px-6 py-4 sm:px-8 [border-top:1px_solid_#B8C9E1]">
            <button
              type="submit"
              disabled={loading}
              className={`${BOTON} w-full py-3 bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {loading ? 'Actualizando...' : 'Actualizar y continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CambiarPassword;
