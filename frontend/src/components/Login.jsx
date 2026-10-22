import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../apis/apiConfig';
import { MENSAJE_REVISA_CAMPOS } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import { AlertCircle, ArrowRight, Eye, EyeOff, User } from 'lucide-react';
import PaisajeBeni from './login/PaisajeBeni';

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
  const anilloCampo = (conError) => (conError ? 'ring-2 ring-red-400/80' : 'ring-1 ring-slate-200');
  // Al entrar a cualquiera de los dos campos se quita el rojo de ambos.
  const limpiarErrores = () => {
    setLoginError('');
    setErrores({});
  };

  return (
    <div className={`login-escena min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-100 sm:p-6 lg:p-10 font-sans text-slate-800 ${isExiting ? 'login-salida' : ''}`}>
      {/* --logo-alto: más alto que el modal pero dentro de la pantalla. El logo mide 722 × 629, así que
          su media anchura es 0,574 × alto: ese espacio se deja a la izquierda para que su mitad entre. */}
      <div
        className="relative w-full max-w-5xl xl:max-w-[calc(64rem+var(--logo-alto)*0.574)] xl:pl-[calc(var(--logo-alto)*0.574)]"
        style={{ '--logo-alto': 'min(88vh, 700px)' }}
      >
        {/* Logo de la UAB fuera del modal: se ve la mitad izquierda, tenue; la otra mitad queda detrás. */}
        <img
          src="/images/LOGOUAB.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute left-0 top-1/2 -translate-y-1/2 w-auto max-w-none opacity-[0.16] hidden xl:block"
          style={{ height: 'var(--logo-alto)' }}
        />

        <div className="login-tarjeta relative z-10 w-full min-h-screen sm:min-h-0 lg:min-h-[620px] flex flex-col lg:flex-row bg-white sm:rounded-[28px] overflow-hidden shadow-[0_30px_80px_rgba(15,23,42,0.12)]">

          {/* Panel de la ilustración: a la derecha con borde ondulado; en celular, arriba y bajo. */}
          <div className="relative h-40 sm:h-52 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[54%] flex-shrink-0" aria-hidden="true">
            <PaisajeBeni className="absolute inset-0 w-full h-full" />
            <svg className="absolute bottom-0 left-0 w-full h-14 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,34 C12,6 26,68 46,38 C64,12 80,64 100,26" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
              <path d="M0,100 L0,58 C12,30 26,92 46,62 C64,36 80,88 100,50 L100,100 Z" fill="#ffffff" />
            </svg>
            {/* Onda como la del modelo: arriba el blanco entra mucho a la derecha y baja en dos curvas. */}
            <svg className="absolute inset-0 hidden lg:block w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L76,0 C62,4 42,9 40,21 C38,33 54,37 52,48 C50,59 31,61 29,73 C27,85 22,93 13,100 L0,100 Z" fill="#ffffff" />
              <path d="M61,0 C48,4 28,9 26,21 C24,33 40,37 38,48 C36,59 17,61 15,73 C13,85 9,93 3,100" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="6 7" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {/* Formulario */}
          <div className="relative z-10 flex-1 lg:flex-none lg:w-[54%] flex flex-col px-6 sm:px-12 lg:px-12 py-6 sm:py-8 lg:py-10">
            <div className="flex-1 flex flex-col sm:justify-center w-full max-w-sm py-6 lg:py-8">
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">Iniciar sesión</h1>
              <p className="mt-3 text-base text-slate-600">Universidad Autónoma del Beni "José Ballivián"</p>

              <form onSubmit={handleSubmit} noValidate className="mt-9 space-y-5">
                {/* Usuario */}
                <div>
                  <label htmlFor="login-usuario" className="block mb-1.5 text-sm font-semibold text-slate-700">Usuario o correo</label>
                  <div className={`login-campo relative rounded-xl bg-azulado-50 ring-inset transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-900 ${anilloCampo(errores.username || credencialesMal)}`}>
                    <input
                      id="login-usuario"
                      type="text"
                      value={username}
                      onFocus={limpiarErrores}
                      onClick={limpiarErrores}
                      onChange={(e) => { setUsername(e.target.value); setErrores((prev) => ({ ...prev, username: undefined })); }}
                      aria-invalid={Boolean(errores.username || credencialesMal) || undefined}
                      className="login-input block w-full h-12 bg-transparent pl-4 pr-12 text-base font-medium text-slate-900 focus:outline-none"
                      autoComplete="username"
                    />
                    <User className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" aria-hidden="true" />
                  </div>
                  <MensajeErrorCampo error={errores.username} pulse={pulso} tono={TONO_ERROR} />
                </div>

                {/* Contraseña */}
                <div>
                  <label htmlFor="login-contrasena" className="block mb-1.5 text-sm font-semibold text-slate-700">Contraseña</label>
                  <div className={`login-campo relative rounded-xl bg-azulado-50 ring-inset transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-900 ${anilloCampo(errores.password || credencialesMal)}`}>
                    <input
                      id="login-contrasena"
                      type="text"
                      value={password}
                      onFocus={limpiarErrores}
                      onClick={limpiarErrores}
                      onChange={(e) => { setPassword(e.target.value); setErrores((prev) => ({ ...prev, password: undefined })); }}
                      aria-invalid={Boolean(errores.password || credencialesMal) || undefined}
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
                  <MensajeErrorCampo error={errores.password} pulse={pulso} tono={TONO_ERROR} />
                  {loginError && (
                    <p className="login-aviso mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700" role="alert">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      {loginError}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-3">
                  <button
                    type="submit"
                    disabled={loading || isExiting}
                    className="group inline-flex items-center justify-center gap-2 h-11 px-7 rounded-full bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold shadow-[0_8px_18px_rgba(30,58,138,0.22)] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/30 disabled:opacity-70 disabled:cursor-not-allowed"
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
                        <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                  <p className="max-w-[14rem] text-sm leading-snug text-slate-600">¿No tienes cuenta? Las cuentas las crea la Dirección de Carrera.</p>
                </div>
              </form>
            </div>

            <p className="text-xs text-slate-500">© {new Date().getFullYear()} UABJB</p>
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
          .login-tarjeta, .login-aviso { animation: none; }
          .login-salida { animation: loginSalidaQuieta 1400ms linear forwards; }
        }
      `}</style>
    </div>
  );
}

export default Login;
