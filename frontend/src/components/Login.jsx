import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../apis/apiConfig';
import { MENSAJE_REVISA_CAMPOS, useErrorPulse } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook, FaInstagram, FaMicrosoft, FaXTwitter } from 'react-icons/fa6';

// Los videos de parabas se cargan aparte: solo los descarga quien abre el login.
const VideosParabas = lazy(() => import('./login/VideosParabas'));

// Botones de redes debajo del formulario: por ahora solo visuales (no conectan con nada).
const REDES = [
  { nombre: 'Google', Icono: FcGoogle, color: '' },
  { nombre: 'Microsoft', Icono: FaMicrosoft, color: 'text-sky-600' },
  { nombre: 'Facebook', Icono: FaFacebook, color: 'text-[#1877F2]' },
  { nombre: 'Instagram', Icono: FaInstagram, color: 'text-[#E1306C]' },
  { nombre: 'X', Icono: FaXTwitter, color: 'text-slate-900' },
];

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
  const anilloCampo = (conError) => (conError ? 'ring-2 ring-red-400/80' : 'ring-0');
  // Al entrar a cualquiera de los dos campos se quita el rojo de ambos.
  const limpiarErrores = () => {
    setLoginError('');
    setErrores({});
  };
  // Mensaje bajo la contraseña: el del campo o, si no hay, el del servidor.
  const avisoContrasena = !errores.password && loginError;

  return (
    <div className={`login-escena relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-azulado-50 sm:p-6 lg:p-10 font-sans text-slate-800 ${isExiting ? 'login-salida' : ''}`}>
      {/* Fuera de la tarjeta (como el modelo): la escena sigue en una mancha grande a la derecha, con los
          mismos videos desenfocados y tenues, un "Bienvenido" enorme y muy suave detrás y el nombre de
          la universidad debajo. Solo en pantallas grandes. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="login-mancha" clipPathUnits="objectBoundingBox">
            <path d="M0.38,0 L1,0 L1,1 L0.3,1 C0.12,0.94 0.02,0.82 0.1,0.7 C0.2,0.56 0.42,0.6 0.4,0.44 C0.38,0.3 0.14,0.3 0.18,0.16 C0.21,0.07 0.3,0.02 0.38,0 Z" />
          </clipPath>
          <clipPath id="login-onda" clipPathUnits="objectBoundingBox">
            <path d="M0.72,0 C0.5,0.03 0.2,0.07 0.24,0.19 C0.28,0.29 0.47,0.33 0.45,0.45 C0.43,0.57 0.17,0.6 0.13,0.72 C0.1,0.83 0.04,0.92 0,1 L1,1 L1,0 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block w-[58vw] [clip-path:url(#login-mancha)]" aria-hidden="true">
        <Suspense fallback={null}>
          <VideosParabas className="absolute inset-0 scale-110 blur-2xl opacity-40" />
        </Suspense>
        <div className="absolute inset-0 bg-gradient-to-l from-sky-200/40 to-azulado-100/60" />
      </div>
      <p className="pointer-events-none absolute left-[3vw] top-[2vh] hidden lg:block text-[8.5vw] font-extrabold leading-none tracking-tight text-blue-900/[0.06]" aria-hidden="true">
        Bienvenido
      </p>

      <div className="relative w-full max-w-5xl">
        <div className="login-tarjeta relative z-10 w-full min-h-screen sm:min-h-0 lg:h-[min(600px,calc(100vh-9rem))] flex flex-col lg:flex-row bg-white sm:rounded-3xl overflow-hidden shadow-[0_40px_90px_rgba(15,23,42,0.16)]">
          {/* Videos de parabas a la derecha, recortados por una mancha (la parte blanca entra arriba y al
              medio, como el modelo). En celular, franja de arriba con el borde ondulado. */}
          <div className="relative order-first lg:order-last h-72 sm:h-80 lg:h-auto lg:w-1/2 flex-shrink-0 bg-azulado-100 lg:[clip-path:url(#login-onda)]">
            <Suspense fallback={null}>
              <VideosParabas className="absolute inset-0" />
            </Suspense>
            <svg className="absolute bottom-0 left-0 z-10 w-full h-14 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0,100 L0,40 C8,10 18,62 30,36 C40,14 50,70 64,44 C76,22 88,60 100,30 L100,100 Z" fill="#ffffff" />
            </svg>
            <p className="absolute bottom-3 right-5 z-20 hidden lg:block text-[11px] text-white/85">© {new Date().getFullYear()} UABJB</p>
          </div>
          {/* Línea punteada suelta en la parte blanca, separada del borde del video y con su propio vaivén. */}
          <svg className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden lg:block h-full w-1/2 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M22,0 C12,3 2,7 3,14 C4,21 25,24 27,31 C29,39 9,43 5,51 C1,59 0,68 -3,78 C-6,88 -8,95 -10,100" fill="none" stroke="#94a3b8" strokeOpacity="0.9" strokeWidth="1.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Formulario: arriba la marca (logo y nombre); al medio, título y campos. Los mensajes de error
              tienen su lugar reservado, así que al aparecer no mueven nada. */}
          <div className="relative z-10 flex-1 lg:flex-none lg:w-1/2 flex flex-col px-6 sm:px-12 lg:px-14 pt-6 pb-6 lg:pt-8 lg:pb-8">
            <div className="flex items-center gap-3">
              <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-14 w-auto" />
              <div className="leading-tight">
                <p className="text-sm font-extrabold text-blue-900">UABJB</p>
                <p className="text-xs text-slate-500">Universidad Autónoma del Beni</p>
              </div>
            </div>

            <div className="my-auto w-full max-w-sm pt-8 lg:pt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Acceso institucional</p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">
                Iniciar sesión<span className="text-sky-600">.</span>
              </h1>
              <p className="mt-2 text-sm text-slate-500">Ingresa con tu usuario o correo institucional.</p>

              <form onSubmit={handleSubmit} noValidate className="mt-7">
                {/* Usuario: la etiqueta va dentro del campo, arriba del texto. */}
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-600/60 ${anilloCampo(errorUsuario)} ${reboteUsuario ? 'login-rebote' : ''}`}>
                  <label htmlFor="login-usuario" className="block px-4 pt-2 text-[11px] font-medium text-slate-500">Usuario o correo</label>
                  <input
                    id="login-usuario"
                    type="text"
                    value={username}
                    onFocus={limpiarErrores}
                    onClick={limpiarErrores}
                    onChange={(e) => { setUsername(e.target.value); setErrores((prev) => ({ ...prev, username: undefined })); }}
                    aria-invalid={Boolean(errorUsuario) || undefined}
                    className="login-input block w-full bg-transparent pl-4 pr-12 pb-2 text-sm font-semibold text-slate-900 focus:outline-none"
                    autoComplete="username"
                  />
                  <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
                <div className="min-h-[1.25rem]">
                  <MensajeErrorCampo error={errores.username} pulse={pulso} tono={TONO_ERROR} />
                </div>

                {/* Contraseña */}
                <div className={`login-campo relative rounded-2xl bg-azulado-50 ring-inset transition-shadow focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-600/60 ${anilloCampo(errorContrasena)} ${reboteContrasena ? 'login-rebote' : ''}`}>
                  <label htmlFor="login-contrasena" className="block px-4 pt-2 text-[11px] font-medium text-slate-500">Contraseña</label>
                  <input
                    id="login-contrasena"
                    type="text"
                    value={password}
                    onFocus={limpiarErrores}
                    onClick={limpiarErrores}
                    onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
                    aria-invalid={Boolean(errorContrasena) || undefined}
                    className={`login-input ${showPassword ? '' : 'login-password-masked'} block w-full bg-transparent pl-4 pr-14 pb-2 text-sm font-semibold text-slate-900 focus:outline-none`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-blue-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                <div className="min-h-[1.25rem]">
                  <MensajeErrorCampo error={errores.password} pulse={pulso} tono={TONO_ERROR} />
                  {avisoContrasena && (
                    <p className="login-aviso mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {loginError}
                    </p>
                  )}
                </div>

                {/* Botón en píldora con brillo, y al lado las redes (solo visuales, no conectan con nada). */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <button
                    type="submit"
                    disabled={loading || isExiting}
                    className="inline-flex h-11 w-36 items-center justify-center gap-2 rounded-full bg-blue-900 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(30,58,138,0.35)] transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/25 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {loading ? 'Ingresando...' : 'Ingresar'}
                  </button>
                  <div className="flex items-center gap-2">
                    {REDES.map(({ nombre, Icono, color }) => (
                      <button
                        key={nombre}
                        type="button"
                        aria-label={nombre}
                        title={nombre}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-azulado-50 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_6px_14px_rgba(15,23,42,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
                      >
                        <Icono className={`h-4 w-4 ${color}`} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <p className="mt-6 text-center text-[11px] text-slate-500 lg:hidden">© {new Date().getFullYear()} UABJB</p>
          </div>
        </div>
        <p className="mt-6 hidden lg:block text-center text-sm text-blue-900/45">Universidad Autónoma del Beni "José Ballivián" · Trinidad, Beni</p>
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
