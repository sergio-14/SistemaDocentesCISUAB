import { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { MENSAJE_REVISA_CAMPOS } from '../utils/formErrors';
import useModoClaro from '../utils/useModoClaro';
import CampoPassword, { ICONO_CANDADO } from './common/CampoPassword';
import { BOTON } from './fondos/estilosFondo';

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
