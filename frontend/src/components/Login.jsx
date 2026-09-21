import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../apis/apiConfig';

function Login({ onLogin }) {
  const LOGIN_EXIT_DURATION = 1400;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
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
    <div className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans text-slate-100 ${isExiting ? 'login-scene-exit' : ''}`}>
      
      {/* Background with Gradient and Shapes */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1735] via-[#12224a] to-[#2a1f52]">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-blue-500/30 blur-[120px] animate-blob"></div>
            <div className="absolute top-[18%] right-[-8%] w-[45%] h-[45%] rounded-full bg-indigo-500/28 blur-[120px] animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-12%] left-[18%] w-[45%] h-[45%] rounded-full bg-violet-500/28 blur-[120px] animate-blob animation-delay-4000"></div>
        </div>
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-[0.3]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.24),transparent_40%)]"></div>

      {/* Login Card */}
      <div className={`login-fixed-theme relative w-full max-w-md p-8 mx-4 bg-white/12 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_32px_95px_rgba(8,15,40,0.62),0_10px_30px_rgba(59,130,246,0.2)] ${isExiting ? 'card-exit-portal' : 'card-stand-up'}`} style={{ perspective: '1200px' }}>
        <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-blue-300/90 to-transparent" />
        <div className="absolute -bottom-8 inset-x-16 h-10 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        
        {/* Header */}
        <div className="text-center mb-10">
          <div className={`relative inline-flex items-center justify-center w-32 h-32 mb-6 rounded-[36px] overflow-hidden bubble-logo ${isExiting ? 'logo-exit-portal' : 'logo-intro'} transition-transform duration-300 hover:scale-105`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.65),transparent_42%),linear-gradient(145deg,#3b82f6_0%,#4338ca_48%,#7c3aed_100%)]" />
            <img src="/images/LOGOUAB.png" alt="Logo UAB" className="relative z-10 w-28 h-28 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.55)]" />
            <div className="absolute top-2 left-3 w-16 h-5 rounded-full bg-white/35 blur-sm" />
            <div className={`pointer-events-none absolute inset-0 rounded-[36px] border border-blue-200/70 ${isExiting ? 'portal-ring-active' : 'portal-ring-idle'}`} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Bienvenido</h1>
          <p className="text-blue-100/80 text-sm font-medium">Sistema de Planificacion y Gestion Institucional - UAB JB</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {loginError && (
            <div className="login-inline-error rounded-xl border border-red-300/80 bg-red-600/28 text-red-100 px-4 py-3 text-sm font-semibold shadow-[0_10px_26px_rgba(127,29,29,0.42)]">
              <div className="flex items-start gap-3">
                <span className="login-warning-icon mt-0.5 text-red-100" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.08 14A2 2 0 003.95 21h16.1a2 2 0 001.74-3.14l-8.08-14a2 2 0 00-3.42 0z" />
                  </svg>
                </span>
                <span className="leading-5">{loginError}</span>
              </div>
            </div>
          )}
          
          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Correo</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="login-fixed-input block w-full pl-11 pr-4 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]"
                placeholder="Ingrese su correo"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-blue-100/85 ml-1 uppercase tracking-wider">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-200/70 group-focus-within:text-blue-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`login-fixed-input ${showPassword ? '' : 'login-password-masked'} block w-full pl-11 pr-14 py-4 bg-blue-500/20 border border-blue-400/40 rounded-xl text-white placeholder-blue-100/70 focus:outline-none focus:ring-4 focus:ring-blue-300/40 focus:border-blue-300/80 transition-all duration-200 hover:border-blue-300/60 hover:bg-blue-500/25 shadow-[0_10px_24px_rgba(8,15,40,0.35),inset_0_2px_4px_rgba(59,130,246,0.2)]`}
                placeholder="Ingrese su contraseña"
                autoComplete="current-password"
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
            <p className="text-[11px] text-blue-100/65 ml-1">Usa el icono para mostrar u ocultar la contraseña.</p>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading || isExiting}
            className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-[0_16px_32px_rgba(79,70,229,0.45),0_8px_20px_rgba(8,15,40,0.35)] transform transition-all duration-200 hover:scale-[1.01] active:scale-[0.985] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Iniciando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-blue-100/65">
            © {new Date().getFullYear()} Universidad Autónoma del Beni "José Ballivián"
          </p>
        </div>
      </div>

      <style>{`
        .login-scene-exit {
          animation: sceneExitZoom 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes sceneExitZoom {
          0% { transform: scale(1); filter: saturate(1); }
          100% { transform: scale(1.04); filter: saturate(1.12); }
        }
        .login-fixed-theme label {
          color: #dbeafe !important;
        }
        .login-inline-error {
          animation: loginInlineErrorIn 220ms ease-out both;
        }
        .login-warning-icon {
          animation: loginWarningWiggle 900ms ease-in-out infinite;
          transform-origin: center;
          filter: drop-shadow(0 0 6px rgba(248, 113, 113, 0.6));
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
        .login-fixed-theme .login-fixed-input,
        .login-fixed-theme .login-fixed-input:focus,
        .login-fixed-theme .login-fixed-input:hover,
        .login-fixed-theme .login-fixed-input:-webkit-autofill,
        .login-fixed-theme .login-fixed-input:-webkit-autofill:hover,
        .login-fixed-theme .login-fixed-input:-webkit-autofill:focus {
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
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 11s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 3s;
        }
        .animation-delay-4000 {
          animation-delay: 6s;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        @keyframes cardStandUp {
          0% {
            opacity: 0;
            transform: rotateX(85deg) translateZ(0) scale(0.9);
            filter: blur(4px);
          }
          60% {
            opacity: 1;
            transform: rotateX(-8deg) translateZ(0) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg) translateZ(0) scale(1);
            filter: blur(0);
          }
        }
        .card-stand-up {
          animation: cardStandUp 3300ms cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: center bottom;
          will-change: transform, opacity, filter;
        }
        .card-exit-portal {
          animation: cardExitPortal 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transform-origin: center center;
          will-change: transform, opacity, filter;
          pointer-events: none;
        }
        @keyframes cardExitPortal {
          0% {
            opacity: 1;
            transform: rotateX(0deg) scale(1) translateY(0);
            filter: blur(0px) brightness(1);
          }
          62% {
            opacity: 1;
            transform: rotateX(0deg) scale(1.25) translateY(16px);
            filter: blur(0px) brightness(1.08);
          }
          100% {
            opacity: 0;
            transform: rotateX(0deg) scale(2.5) translateY(56px);
            filter: blur(6px) brightness(1.18);
          }
        }
        .bubble-logo {
          box-shadow: 0 24px 42px rgba(37, 99, 235, 0.5), 0 10px 22px rgba(8, 15, 40, 0.42), inset 0 1px 2px rgba(255, 255, 255, 0.45);
        }
        .logo-intro {
          animation: logoCardIntro 2600ms cubic-bezier(0.22, 1, 0.36, 1) both, bubbleFloat 7s ease-in-out 2800ms infinite;
          transform-origin: center center;
          will-change: transform, opacity, filter;
        }
        .logo-exit-portal {
          animation: logoPortalOpen 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          transform-origin: center center;
          will-change: transform, filter;
        }
        @keyframes logoPortalOpen {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          55% {
            transform: scale(1.08);
            filter: brightness(1.18);
          }
          100% {
            transform: scale(1.22);
            filter: brightness(1.35);
          }
        }
        .portal-ring-idle {
          opacity: 0;
        }
        .portal-ring-active {
          animation: portalRingExpand 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes portalRingExpand {
          0% {
            opacity: 0;
            transform: scale(1);
            box-shadow: 0 0 0 rgba(96, 165, 250, 0);
          }
          40% {
            opacity: 1;
            transform: scale(1.06);
            box-shadow: 0 0 35px rgba(96, 165, 250, 0.75), inset 0 0 18px rgba(191, 219, 254, 0.45);
          }
          100% {
            opacity: 0;
            transform: scale(1.35);
            box-shadow: 0 0 65px rgba(129, 140, 248, 0.95), inset 0 0 28px rgba(191, 219, 254, 0.5);
          }
        }
        @keyframes logoCardIntro {
          0% {
            transform: scale(3.4);
            opacity: 0.2;
            filter: blur(3px);
          }
          70% {
            transform: scale(0.93);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export default Login;
