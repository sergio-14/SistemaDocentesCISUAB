import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../apis/apiConfig';
import { MENSAJE_REVISA_CAMPOS, useErrorPulse } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { AlertCircle, ArrowRight, Eye, EyeOff, User } from 'lucide-react';

// El guacamayo en 3D (Three.js) se carga aparte: solo lo descarga quien abre el login.
const ParabaPosada = lazy(() => import('./login/ParabaPosada'));

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
  const [campoActivo, setCampoActivo] = useState(null);
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
  const entrarA = (campo) => () => {
    limpiarErrores();
    setCampoActivo(campo);
  };
  const salirDelCampo = () => setCampoActivo(null);

  // La paraba: mira el campo en que se escribe; cierra los ojos solo si la contraseña está a la vista
  // (con el ojo de "Ocultar contraseña"); sin nada escrito, se acicala.
  let estadoAve = 'atento';
  if (showPassword && (campoActivo === 'contrasena' || password)) estadoAve = 'ojos-cerrados';
  else if (campoActivo) estadoAve = campoActivo === 'contrasena' ? 'mirando-contrasena' : 'mirando-usuario';
  else if (!username && !password) estadoAve = 'reposo';
  const textoMirado = campoActivo === 'contrasena' ? password : username;

  // Mensaje bajo la contraseña: el del campo o, si no hay, el del servidor.
  const avisoContrasena = !errores.password && loginError;

  return (
    <div className={`login-escena min-h-screen w-full flex items-center justify-center overflow-hidden bg-azulado-100 sm:p-6 lg:p-10 font-sans text-slate-800 ${isExiting ? 'login-salida' : ''}`}>
      <div className="relative w-full max-w-5xl">
        <div className="login-tarjeta relative z-10 w-full min-h-screen sm:min-h-0 lg:h-[560px] flex flex-col lg:flex-row bg-white sm:rounded-3xl sm:ring-1 sm:ring-azulado-300 overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
          {/* Panel de las parabas (azulado de Fondo de Tiempo): a la derecha con borde ondulado; en celular,
              arriba. Detrás de las aves, un sol dorado suave y colinas al pie; las aves van encima de la
              onda, así pueden asomarse un poco sobre el borde. */}
          <div className="relative h-60 sm:h-72 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[56%] flex-shrink-0 bg-[linear-gradient(170deg,#EEF3FA_0%,#DFE8F5_48%,#B8C9E1_100%)]" aria-hidden="true">
            <div className="absolute right-[10%] top-[8%] h-[62%] aspect-square rounded-full bg-[radial-gradient(circle,rgba(240,205,54,0.42)_0%,rgba(240,205,54,0.12)_45%,rgba(240,205,54,0)_70%)]" />
            <svg className="absolute bottom-0 left-0 w-full h-[34%]" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,62 C22,30 44,48 62,40 C78,33 90,22 100,30 L100,100 L0,100 Z" fill="#B8C9E1" opacity="0.55" />
              <path d="M0,82 C18,62 40,70 58,64 C76,58 88,66 100,58 L100,100 L0,100 Z" fill="#A9BDDB" opacity="0.6" />
            </svg>
            <svg className="absolute bottom-0 left-0 w-full h-14 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,34 C12,6 26,68 46,38 C64,12 80,64 100,26" fill="none" stroke="#0284c7" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
              <path d="M0,100 L0,58 C12,30 26,92 46,62 C64,36 80,88 100,50 L100,100 Z" fill="#ffffff" />
            </svg>
            {/* Onda como la del modelo: arriba el blanco entra mucho a la derecha y baja en dos curvas. */}
            <svg className="absolute inset-0 hidden lg:block w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L76,0 C62,4 42,9 40,21 C38,33 54,37 52,48 C50,59 31,61 29,73 C27,85 22,93 13,100 L0,100 Z" fill="#ffffff" />
              <path d="M61,0 C48,4 28,9 26,21 C24,33 40,37 38,48 C36,59 17,61 15,73 C13,85 9,93 3,100" fill="none" stroke="#0284c7" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
            </svg>
            <Suspense fallback={null}>
              <ParabaPosada
                estado={estadoAve}
                seguimiento={Math.min(textoMirado.length, 28) / 28}
                className="absolute inset-0"
              />
            </Suspense>
            <p className="absolute bottom-2 right-4 hidden lg:block text-[11px] text-slate-600/80">© {new Date().getFullYear()} UABJB</p>
          </div>

          {/* Formulario: centrado en el alto del modal; los mensajes de error tienen su lugar reservado,
              así que al aparecer no mueven nada. */}
          <div className="relative z-10 flex-1 lg:flex-none lg:w-[52%] flex flex-col sm:justify-center px-6 sm:px-12 lg:px-12 pt-8 pb-10 lg:py-10">
            <div className="w-full max-w-sm mx-auto">
              <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 p-4 text-white shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
                <span className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl bg-white">
                  <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-20 w-auto" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Universidad Autónoma del Beni</p>
                  <h1 className="mt-1 text-2xl font-bold leading-tight">Iniciar sesión</h1>
                  <p className="mt-0.5 text-sm text-blue-100">"José Ballivián"</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-7">
                {/* Usuario */}
                <label htmlFor="login-usuario" className="block mb-1.5 text-sm font-semibold text-blue-900">Usuario o correo</label>
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_4px_#DFE8F5] ${anilloCampo(errorUsuario)} ${reboteUsuario ? 'login-rebote' : ''}`}>
                  <input
                    id="login-usuario"
                    type="text"
                    value={username}
                    onFocus={entrarA('usuario')}
                    onClick={limpiarErrores}
                    onBlur={salirDelCampo}
                    onChange={(e) => { setUsername(e.target.value); setErrores((prev) => ({ ...prev, username: undefined })); }}
                    aria-invalid={Boolean(errorUsuario) || undefined}
                    className="login-input block w-full h-12 bg-transparent pl-4 pr-12 text-base font-medium text-slate-900 focus:outline-none"
                    autoComplete="username"
                  />
                  <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" aria-hidden="true" />
                </div>
                <div className="min-h-[1.75rem]">
                  <MensajeErrorCampo error={errores.username} pulse={pulso} tono={TONO_ERROR} />
                </div>

                {/* Contraseña */}
                <label htmlFor="login-contrasena" className="block mb-1.5 text-sm font-semibold text-blue-900">Contraseña</label>
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_4px_#DFE8F5] ${anilloCampo(errorContrasena)} ${reboteContrasena ? 'login-rebote' : ''}`}>
                  <input
                    id="login-contrasena"
                    type="text"
                    value={password}
                    onFocus={entrarA('contrasena')}
                    onClick={limpiarErrores}
                    onBlur={salirDelCampo}
                    onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
                    aria-invalid={Boolean(errorContrasena) || undefined}
                    className={`login-input ${showPassword ? '' : 'login-password-masked'} block w-full h-12 bg-transparent pl-4 pr-14 text-base font-medium text-slate-900 focus:outline-none`}
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

                {/* Botón centrado y de ancho fijo: "Ingresando..." no mueve nada. */}
                <div className="mt-4 flex justify-center">
                  <button
                    type="submit"
                    disabled={loading || isExiting}
                    className="group inline-flex w-44 items-center justify-between h-11 pl-5 pr-1.5 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold shadow-[0_6px_14px_rgba(30,58,138,0.25)] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/30 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Ingresando...</span>
                      </>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                          <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
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
