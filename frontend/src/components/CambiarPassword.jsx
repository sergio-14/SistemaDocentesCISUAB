
import React, { useState } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';

const CambiarPassword = ({ onPasswordChanged }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden login-fixed-theme">

      <style>{`
      /* Estilos FEIJOS SOLO para CambiarPassword (copiados/adaptados de Login) */
        .login-fixed-theme {
          --cp-form-border: rgba(255,255,255,0) !important;
        }
        .login-fixed-theme label {
          color: #dbeafe !important;
        }

.login-fixed-theme .login-fixed-input,
        .login-fixed-theme .login-fixed-input:focus,
        .login-fixed-theme .login-fixed-input:hover,
        .login-fixed-theme .login-fixed-input:-webkit-autofill,
        .login-fixed-theme .login-fixed-input:-webkit-autofill:hover,
        .login-fixed-theme .login-fixed-input:-webkit-autofill:focus {
          border-color: rgba(59, 130, 246, 0) !important;
          background-color: rgba(59, 130, 246, 0.2) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          box-shadow: 0 10px 24px rgba(8, 15, 40, 0.35), inset 0 2px 4px rgba(59, 130, 246, 0.2) !important;
        }

        .login-fixed-theme .login-fixed-input::placeholder {
          color: rgba(219, 234, 254, 0.7) !important;
        }

        .login-fixed-theme .login-fixed-input:focus {
          box-shadow: 0 0 0 4px rgba(147, 197, 253, 0.4), 0 10px 24px rgba(8, 15, 40, 0.35), inset 0 2px 4px rgba(59, 130, 246, 0.2) !important;
        }

        .login-fixed-theme .login-password-masked {
          -webkit-text-security: disc;
        }

        .login-fixed-theme .login-fixed-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(59, 130, 246, 0.2) inset, 0 10px 24px rgba(8, 15, 40, 0.35) !important;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
      
      {/* Elementos de fondo animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">

        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px]"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-indigo-600/20 blur-[100px]"></div>
      </div>

      <div className="relative w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 animate-fade-in transform transition-all hover:scale-[1.01] duration-500">
        
        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight drop-shadow-md">
            Cambio de Contraseña
          </h2>
          <p className="text-blue-100 text-sm font-medium">
            Por seguridad, actualiza tu contraseña inicial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Nueva contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`login-fixed-input ${showPassword ? '' : 'login-password-masked'} block w-full pl-11 pr-14 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]`}
                placeholder="***********"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center justify-center text-blue-100 hover:text-blue-50 transition-colors duration-200 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 bg-transparent border-none p-0"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Confirmar contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`login-fixed-input ${showConfirmPassword ? '' : 'login-password-masked'} block w-full pl-11 pr-14 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]`}
                placeholder="***********"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center justify-center text-blue-100 hover:text-blue-50 transition-colors duration-200 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 bg-transparent border-none p-0"
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-blue-100/65 ml-1">Usa el icono para mostrar u ocultar la contraseña.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg shadow-blue-600/30 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Actualizando...
              </span>
            ) : (
              'Actualizar y Continuar'
            )}
          </button>
        </form>
        {/* Copiar estilos del login para que los inputs hereden exactamente el mismo look */}
        
    
      </div>
    </div>
  );
};

export default CambiarPassword;