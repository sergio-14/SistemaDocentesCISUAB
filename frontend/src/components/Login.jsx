import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../apis/apiConfig';
import { MENSAJE_REVISA_CAMPOS } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { Eye, EyeOff, User } from 'lucide-react';
import PaisajeBeni from './login/PaisajeBeni';

const TONO_ERROR = 'text-red-700';

function Login({ onLogin }) {
  const LOGIN_EXIT_DURATION = 1400;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [errores, setErrores] = useState({});
  const [pulso, setPulso] = useState(0);
  const [loginError, setLoginError] = useState('');
  const loginErrorTimeoutRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loginError) return undefined;
    if (loginErrorTimeoutRef.current) {
      window.clearTimeout(loginErrorTimeoutRef.current);
    }
    loginErrorTimeoutRef.current = window.setTimeout(() => {
      setLoginError('');
    }, 4500);

    return () => {
      if (loginErrorTimeoutRef.current) {
        window.clearTimeout(loginErrorTimeoutRef.current);
      }
    };
  }, [loginError]);

  const handleSubmit = async (e) => {
  if (isExiting) return;
  e.preventDefault();
  const nuevosErrores = {};
  if (!username.trim()) nuevosErrores.username = 'Ingrese su usuario o correo.';
  if (!password) nuevosErrores.password = 'Ingrese su contraseña.';
  if (Object.keys(nuevosErrores).length > 0) {
    setErrores(nuevosErrores);
    setPulso((valor) => valor + 1);
    toast.error(MENSAJE_REVISA_CAMPOS);
    return;
  }
  setLoading(true);
  setLoginError('');
  let nextRoute = null;
  let authenticatedUser = null;

  try {
    const response = await axios.post(`${API_URL}/token/`, {
      username: username.trim(),
      password,
    });

    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);

    const userResponse = await axios.get(`${API_URL}/usuario/`, {
      headers: {
        Authorization: `Bearer ${response.data.access}`,
      },
    });

    localStorage.setItem('user', JSON.stringify(userResponse.data));
    authenticatedUser = userResponse.data;

    const redirectTo = sessionStorage.getItem('post_login_redirect');
    if (redirectTo) {
      sessionStorage.removeItem('post_login_redirect');
    }
    
    if (userResponse.data.perfil?.debe_cambiar_password) {
      nextRoute = '/cambiar-password';
    } else {
      nextRoute = redirectTo || '/';
    }

    setIsExiting(true);
    window.setTimeout(() => {
      if (authenticatedUser) {
        onLogin(authenticatedUser);
      }
      navigate(nextRoute || '/');
    }, LOGIN_EXIT_DURATION);

  } catch (err) {
    console.error(err);
    if (err.response?.status === 401) {
      setLoginError('Usuario o contraseña incorrectos.');
    } else if (err.response?.status === 500) {
      setLoginError('Error del servidor. Intenta más tarde.');
    } else if (!err.response) {
      setLoginError('No se puede conectar con el servidor.');
    } else {
      setLoginError('Error al iniciar sesión.');
    }
  } finally {
    if (!nextRoute) {
      setLoading(false);
    }
  }
};

  return (
    <div className={`login-escena min-h-screen w-full flex items-center justify-center bg-slate-100 sm:p-6 font-sans text-slate-800 ${isExiting ? 'login-salida' : ''}`}>
      <div className="login-tarjeta relative w-full max-w-6xl min-h-screen sm:min-h-0 lg:min-h-[640px] flex flex-col lg:flex-row bg-white sm:rounded-[28px] overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.12)]">

        {/* Panel de la ilustración: a la derecha con borde ondulado; en celular, arriba y bajo. */}
        <div className="relative h-40 sm:h-52 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[54%] flex-shrink-0" aria-hidden="true">
          <PaisajeBeni className="absolute inset-0 w-full h-full" />
          <svg className="absolute bottom-0 left-0 w-full h-12 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,40 C18,18 34,64 54,44 C72,26 86,56 100,36" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
            <path d="M0,100 L0,64 C18,42 34,88 54,68 C72,50 86,80 100,60 L100,100 Z" fill="#ffffff" />
          </svg>
          <svg className="absolute inset-y-0 left-0 hidden lg:block h-full w-[34%]" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L70,0 C46,10 80,22 62,36 C44,50 30,58 50,72 C68,85 44,93 58,100 L0,100 Z" fill="#ffffff" />
            <path d="M52,0 C28,10 62,22 44,36 C26,50 12,58 32,72 C50,85 26,93 40,100" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        {/* Formulario */}
        <div className="relative z-10 flex-1 lg:flex-none lg:w-1/2 flex flex-col px-6 sm:px-12 lg:px-16 py-6 sm:py-8 lg:py-10">
          <div className="flex items-center gap-3">
            <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="w-10 h-10 object-contain" />
            <span className="text-sm font-bold text-slate-700">UABJB</span>
          </div>

          <div className="flex-1 flex flex-col sm:justify-center w-full max-w-md py-8 lg:py-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Iniciar sesión</p>
            <h1 className="mt-3 text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
              Fondo de Tiempo Docente<span className="text-sky-600" aria-hidden="true">.</span>
            </h1>
            <p className="mt-3 text-sm text-slate-500">Universidad Autónoma del Beni · Ingeniería de Sistemas</p>

            <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
              {loginError && (
                <div className="login-inline-error rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold" role="alert">
                  <div className="flex items-start gap-3">
                    <span className="login-warning-icon mt-0.5" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.08 14A2 2 0 003.95 21h16.1a2 2 0 001.74-3.14l-8.08-14a2 2 0 00-3.42 0z" />
                      </svg>
                    </span>
                    <span className="leading-5">{loginError}</span>
                  </div>
                </div>
              )}

              {/* Usuario */}
              <div>
                <div className={`login-campo group relative rounded-2xl bg-azulado-50 ring-inset transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-900 ${errores.username ? 'ring-2 ring-red-400/80' : 'ring-1 ring-slate-200'}`}>
                  <label htmlFor="login-usuario" className="block px-4 pt-2.5 text-xs font-semibold text-slate-500 group-focus-within:text-blue-900">Usuario</label>
                  <input
                    id="login-usuario"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setErrores((prev) => ({ ...prev, username: undefined })); }}
                    aria-invalid={Boolean(errores.username) || undefined}
                    className="login-input block w-full bg-transparent pl-4 pr-12 pt-0.5 pb-2.5 text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                    placeholder="Usuario o correo"
                    autoComplete="username"
                  />
                  <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <MensajeErrorCampo error={errores.username} pulse={pulso} tono={TONO_ERROR} />
              </div>

              {/* Contraseña */}
              <div>
                <div className={`login-campo group relative rounded-2xl bg-azulado-50 ring-inset transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-900 ${errores.password ? 'ring-2 ring-red-400/80' : 'ring-1 ring-slate-200'}`}>
                  <label htmlFor="login-contrasena" className="block px-4 pt-2.5 text-xs font-semibold text-slate-500 group-focus-within:text-blue-900">Contraseña</label>
                  <input
                    id="login-contrasena"
                    type="text"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
                    aria-invalid={Boolean(errores.password) || undefined}
                    className={`login-input ${showPassword ? '' : 'login-password-masked'} block w-full bg-transparent pl-4 pr-14 pt-0.5 pb-2.5 text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none`}
                    placeholder="Contraseña"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-blue-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
                <MensajeErrorCampo error={errores.password} pulse={pulso} tono={TONO_ERROR} />
              </div>

              <button
                type="submit"
                disabled={loading || isExiting}
                className="!mt-7 w-full h-12 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-bold shadow-[0_12px_24px_rgba(30,58,138,0.25)] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Ingresando...</span>
                  </>
                ) : (
                  <span>Ingresar</span>
                )}
              </button>

              <p className="pt-1 text-sm text-slate-500">¿No tienes cuenta? Las cuentas las crea la Dirección de Carrera.</p>
            </form>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Universidad Autónoma del Beni "José Ballivián"
          </p>
        </div>
      </div>

      <style>{`
        .login-tarjeta {
          animation: loginEntrada 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes loginEntrada {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-salida {
          animation: loginSalida 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes loginSalida {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.02); }
        }
        .login-inline-error {
          animation: loginInlineErrorIn 220ms ease-out both;
        }
        .login-warning-icon {
          display: inline-flex;
          animation: loginWarningWiggle 900ms ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes loginInlineErrorIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginWarningWiggle {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          25% { transform: rotate(-8deg) translateX(-1px); }
          50% { transform: rotate(7deg) translateX(1px); }
          75% { transform: rotate(-5deg) translateX(-1px); }
        }
        .login-escena .login-input:-webkit-autofill,
        .login-escena .login-input:-webkit-autofill:hover,
        .login-escena .login-input:-webkit-autofill:focus {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        .login-escena .login-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #F7F9FD inset !important;
          transition: background-color 9999s ease-out 0s;
        }
        .login-escena .login-campo:focus-within .login-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
        }
        .login-escena .login-password-masked {
          -webkit-text-security: disc;
        }
        @keyframes loginSalidaQuieta {
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-tarjeta, .login-inline-error, .login-warning-icon { animation: none; }
          .login-salida { animation: loginSalidaQuieta 1400ms linear forwards; }
        }
      `}</style>
    </div>
  );
}

export default Login;
