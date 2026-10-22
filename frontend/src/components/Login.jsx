import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../apis/apiConfig';
import { MENSAJE_REVISA_CAMPOS, useErrorPulse } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { AlertCircle, ArrowRight, Eye, EyeOff, User } from 'lucide-react';

// Los videos de parabas se cargan aparte: solo los descarga quien abre el login.
const VideosParabas = lazy(() => import('./login/VideosParabas'));

const TONO_ERROR = 'text-red-700';
const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos.';

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
      setLoginError(MENSAJE_CREDENCIALES);
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

  // Solo el 401 marca los dos campos: los otros errores (servidor, conexión) no son de lo escrito.
  const credencialesMal = loginError === MENSAJE_CREDENCIALES;
  const errorUsuario = errores.username || (credencialesMal ? loginError : '');
  const errorContrasena = errores.password || (credencialesMal ? loginError : '');
  // Rebote de los campos en cada error (el mismo disparo que la sacudida del sistema).
  const { isPulsing: reboteUsuario } = useErrorPulse(errorUsuario, pulso);
  const { isPulsing: reboteContrasena } = useErrorPulse(errorContrasena, pulso);
  const anilloCampo = (conError) => (conError ? 'ring-2 ring-red-400/80' : 'ring-1 ring-azulado-300');
  // Al entrar a cualquiera de los dos campos se quita el rojo de ambos.
  const limpiarErrores = () => {
    setLoginError('');
    setErrores({});
  };
  // Mensaje bajo la contraseña: el del campo o, si no hay, el del servidor.
  const avisoContrasena = !errores.password && loginError;

  return (
    <div className={`login-escena min-h-screen w-full flex items-center justify-center overflow-hidden bg-azulado-100 sm:p-6 lg:p-10 font-sans text-slate-800 ${isExiting ? 'login-salida' : ''}`}>
      <div className="relative w-full max-w-5xl lg:mt-12">
        {/* Logo de la UAB en la esquina de arriba a la izquierda: mitad dentro y mitad fuera de la
            tarjeta, en un círculo blanco con un borde azulado fino (en celular va en el formulario). */}
        <div className="login-tarjeta absolute z-20 -left-6 -top-14 hidden lg:flex h-28 w-28 items-center justify-center rounded-full bg-white ring-2 ring-azulado-300 shadow-[0_10px_26px_rgba(15,23,42,0.14)]">
          <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-20 w-auto" />
        </div>
        <div className="login-tarjeta relative z-10 w-full min-h-screen sm:min-h-0 lg:h-[min(660px,calc(100vh-8rem))] flex flex-col lg:flex-row bg-white sm:rounded-3xl sm:ring-1 sm:ring-azulado-300 overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
          {/* Panel de los videos de parabas: a la derecha, hasta la línea punteada; en celular, arriba. */}
          <div className="relative h-60 sm:h-72 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[56%] flex-shrink-0 bg-[linear-gradient(170deg,#EEF3FA_0%,#DFE8F5_48%,#B8C9E1_100%)]">
            <Suspense fallback={null}>
              <VideosParabas className="absolute inset-0" />
            </Suspense>
            <svg className="absolute bottom-0 left-0 z-10 w-full h-14 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,34 C12,6 26,68 46,38 C64,12 80,64 100,26" fill="none" stroke="#0284c7" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
              <path d="M0,100 L0,34 C12,6 26,68 46,38 C64,12 80,64 100,26 L100,100 Z" fill="#ffffff" />
            </svg>
            {/* Onda: el blanco del formulario llega justo hasta la línea punteada, que es el borde del video. */}
            <svg className="absolute inset-0 z-10 hidden lg:block w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,0 L61,0 C48,4 28,9 26,21 C24,33 40,37 38,48 C36,59 17,61 15,73 C13,85 9,93 3,100 L0,100 Z" fill="#ffffff" />
              <path d="M61,0 C48,4 28,9 26,21 C24,33 40,37 38,48 C36,59 17,61 15,73 C13,85 9,93 3,100" fill="none" stroke="#0284c7" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="absolute bottom-2 right-4 z-20 hidden lg:block text-[11px] text-white/85">© {new Date().getFullYear()} UABJB</p>
          </div>

          {/* Formulario: los mensajes de error tienen su lugar reservado, así que al aparecer no mueven nada. */}
          <div className="relative z-10 flex-1 lg:flex-none lg:w-[52%] flex flex-col px-6 sm:px-12 lg:px-14 pt-8 pb-8 lg:pt-6 lg:pb-12">
            <div className="w-full max-w-sm mx-auto flex flex-1 flex-col">
              {/* Nombre de la universidad arriba, a la derecha del logo de la esquina (en celular, con el
                  logo al lado). */}
              <div className="flex items-center gap-3 lg:pl-12">
                <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-14 w-auto lg:hidden" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Universidad Autónoma del Beni</p>
                  <p className="mt-0.5 text-sm font-bold text-blue-900">"José Ballivián"</p>
                </div>
              </div>

              <div className="my-auto pt-10 lg:pt-4">
              <div className="text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-blue-900">Iniciar sesión</h1>
                <p className="mt-2 text-base text-slate-500">Ingresa con tu usuario o correo institucional.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-8">
                {/* Usuario */}
                <label htmlFor="login-usuario" className="block mb-2 text-sm font-semibold text-blue-900">Usuario o correo</label>
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_4px_#DFE8F5] ${anilloCampo(errorUsuario)} ${reboteUsuario ? 'login-rebote' : ''}`}>
                  <input
                    id="login-usuario"
                    type="text"
                    value={username}
                    onFocus={limpiarErrores}
                    onClick={limpiarErrores}
                    onChange={(e) => { setUsername(e.target.value); setErrores((prev) => ({ ...prev, username: undefined })); }}
                    aria-invalid={Boolean(errorUsuario) || undefined}
                    className="login-input block w-full h-14 bg-transparent pl-5 pr-12 text-base font-medium text-slate-900 focus:outline-none"
                    autoComplete="username"
                  />
                  <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" aria-hidden="true" />
                </div>
                <div className="min-h-[1.75rem]">
                  <MensajeErrorCampo error={errores.username} pulse={pulso} tono={TONO_ERROR} />
                </div>

                {/* Contraseña */}
                <label htmlFor="login-contrasena" className="block mb-2 text-sm font-semibold text-blue-900">Contraseña</label>
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_4px_#DFE8F5] ${anilloCampo(errorContrasena)} ${reboteContrasena ? 'login-rebote' : ''}`}>
                  <input
                    id="login-contrasena"
                    type="text"
                    value={password}
                    onFocus={limpiarErrores}
                    onClick={limpiarErrores}
                    onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
                    aria-invalid={Boolean(errorContrasena) || undefined}
                    className={`login-input ${showPassword ? '' : 'login-password-masked'} block w-full h-14 bg-transparent pl-5 pr-14 text-base font-medium text-slate-900 focus:outline-none`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:text-blue-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
                <div className="min-h-[1.75rem]">
                  <MensajeErrorCampo error={errores.password} pulse={pulso} tono={TONO_ERROR} />
                  {avisoContrasena && (
                    <p className="login-aviso mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {loginError}
                    </p>
                  )}
                </div>

                {/* Botón: la palabra y un círculo azul con la flecha, a la derecha (ancho fijo del texto:
                    "Ingresando..." no mueve nada). */}
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || isExiting}
                    className="group inline-flex items-center gap-3 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/25 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <span className="w-24 whitespace-nowrap text-right text-sm font-bold text-blue-900">{loading ? 'Ingresando...' : 'Ingresar'}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-900 text-white shadow-[0_6px_14px_rgba(30,58,138,0.28)] transition-colors group-hover:bg-blue-800">
                      {loading ? (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <ArrowRight className="h-5 w-5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </div>
              </form>
              </div>
              <p className="mt-8 text-center text-[11px] text-slate-500 lg:hidden">© {new Date().getFullYear()} UABJB</p>
            </div>

          </div>
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
        .login-aviso {
          animation: loginAvisoEntra 220ms ease-out both;
        }
        .login-rebote {
          animation: loginRebote 460ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes loginRebote {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-9px); }
          32% { transform: translateX(8px); }
          50% { transform: translateX(-5px); }
          68% { transform: translateX(3px); }
          84% { transform: translateX(-1px); }
        }
        @keyframes loginAvisoEntra {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
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
          .login-tarjeta, .login-aviso, .login-rebote { animation: none; }
          .login-salida { animation: loginSalidaQuieta 1400ms linear forwards; }
        }
      `}</style>
    </div>
  );
}

export default Login;
