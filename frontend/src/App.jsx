import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTheme } from './useTheme';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// Vistas y Componentes
import api from './apis/api';
// Importaciones POA - Usar el layout principal que incluye sidebar/header
import POAApp from './modules/poa/poa_App';
import POAHomePage from './modules/poa/pages/POAHomePage';
import AccesosPOAPage from './modules/poa/pages/AccesosPOAPage';
import DocumentosPOAPage from './modules/poa/pages/DocumentosPOAPage';
import DocumentosRevisionPOAPage from './modules/poa/pages/DocumentosRevisionPOAPage';
import ActividadesPage from './modules/poa/pages/ActividadesPage';
import EvidenciaPage from './modules/poa/pages/EvidenciaPage';
import ObjetivosEspecificosPage from './modules/poa/pages/ObjetivosEspecificosPage';
import CatalogoItems from './modules/poa/pages/CatalogoItems';
import CatalogosMenu from './modules/poa/pages/CatalogosMenu';
import IndicadoresPage from './modules/poa/pages/IndicadoresPage';
import Reportes from './modules/poa/pages/Reportes';
import PresupuestosPage from './modules/poa/pages/PresupuestosPage';
import ConsolidadoRequerimientosPage from './modules/poa/pages/ConsolidadoRequerimientosPage';
import SeguimientoProgramaPage from './modules/poa/pages/SeguimientoProgramaPage';
import Login from './components/Login';
import ModuleSelector from './components/ModuleSelector';
import FondoTiempoLayout from './components/FondoTiempoLayout';
import ListaFondos from './components/ListaFondos';
import DetalleFondo from './components/DetalleFondo';
import EditorInformePage from './components/EditorInformePage';
import Comparador from './components/Comparador';
import FormularioFondo from './components/FormularioFondo';
import GestionUsuarios from './components/GestionUsuarios';
import FondosArchivados from './components/FondosArchivados';
import ListaDocentes from './components/ListaDocentes';
import ListaCarreras from './components/ListaCarreras';
import ListaCalendarios from './components/ListaCalendarios';
import MateriaList from './components/materias/MateriaList';
import MateriaForm from './components/materias/MateriaForm';
import VistaCalendarioActivo from './VistaCalendarioActivo';
import Proximamente from './components/Proximamente';
import FondosLargoPlazo from './components/FondosLargoPlazo';
import SeguimientoGlobal from './components/SeguimientoGlobal';
import AdminPanel from './components/AdminPanel';
import SimpleLayout from './components/layouts/SimpleLayout';
import AdminDashboard from './components/AdminDashboard';
import CambiarPassword from './components/CambiarPassword';
import CargaHorariaGeneral from './components/CargaHorariaGeneral';
import FondoTiempoDocente from './components/FondoTiempoDocente';
import ErrorVinculoDocente from './components/common/ErrorVinculoDocente';
import { ActiveRoleProvider } from './contexts/ActiveRoleContext';
import './App.css';

// Componente wrapper para aplicar una animación de entrada a las páginas
const AnimatedRoute = ({ children }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-page-enter">{children}</div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const { theme, setTheme, isDark } = useTheme();

  // Constante de inactividad: 2 horas en milisegundos
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('active_assignment_id');
    localStorage.removeItem('active_role');
    localStorage.removeItem('active_carrera_id');
    localStorage.removeItem('carrera_activa_id');
    sessionStorage.removeItem('last_activity');
    setUser(null);
  };

  const normalizarCarreraActiva = (userData, carreraIdPreferida = null) => {
    if (!userData) return userData;

    const asignaciones = Array.isArray(userData.asignaciones) ? userData.asignaciones : [];
    if (asignaciones.length === 0) return userData;

    const carreraGuardada = carreraIdPreferida || localStorage.getItem('carrera_activa_id');
    const asignacionSeleccionada = asignaciones.find((item) => String(item.carrera) === String(carreraGuardada)) || asignaciones[0];

    return {
      ...userData,
      perfil: {
        ...userData.perfil,
        carrera: asignacionSeleccionada.carrera,
        carrera_nombre: asignacionSeleccionada.carrera_nombre,
      },
    };
  };

  // Recuperar usuario de localStorage al cargar la app
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Sistema de inactividad: detectar cambios de inactividad y logout automático
  useEffect(() => {
    if (!user) return;

    // Guardar timestamp de última actividad
    const updateLastActivity = () => {
      const now = Date.now();
      sessionStorage.setItem('last_activity', String(now));
    };

    // Registrar actividad del usuario en cualquier evento
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, updateLastActivity, { passive: true });
    });

    // Establecer timestamp inicial de actividad
    updateLastActivity();

    // Timer para verificar inactividad cada minuto
    const inactivityCheckInterval = setInterval(() => {
      const lastActivityStr = sessionStorage.getItem('last_activity');
      if (!lastActivityStr) {
        updateLastActivity();
        return;
      }

      const lastActivity = Number(lastActivityStr);
      const now = Date.now();
      const inactiveTime = now - lastActivity;

      // Si han pasado 2 horas sin actividad, hacer logout
      if (inactiveTime > INACTIVITY_TIMEOUT) {
        handleLogout();
        toast.error('Tu sesión expiró por inactividad. Por favor, inicia sesión nuevamente.');
      }
    }, 60 * 1000); // Verificar cada minuto

    // Limpiar listeners y timer al desmontar
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateLastActivity);
      });
      clearInterval(inactivityCheckInterval);
    };
  }, [user]);

  const handleLogin = (userData) => {
    const userNormalizado = normalizarCarreraActiva(userData);
    if (userNormalizado?.perfil?.carrera) {
      localStorage.setItem('carrera_activa_id', String(userNormalizado.perfil.carrera));
    }
    localStorage.setItem('user', JSON.stringify(userNormalizado));
    setUser(userNormalizado);
  };

  const handleProfileUpdate = async () => {
    try {
      const response = await api.get('/usuario/');
      const userNormalizado = normalizarCarreraActiva(response.data);
      setUser(userNormalizado);
      localStorage.setItem('user', JSON.stringify(userNormalizado));
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleCarreraActivaChange = (carreraId) => {
    setUser((prev) => {
      const nextUser = normalizarCarreraActiva(prev, carreraId);
      if (nextUser?.perfil?.carrera) {
        localStorage.setItem('carrera_activa_id', String(nextUser.perfil.carrera));
      }
      localStorage.setItem('user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  // 🔒 GUARDIÁN DE VÍNCULO DOCENTE: Verificar si el usuario tiene error de vínculo
  const hasVinculoError = user && user.perfil?.error_vinculo === true;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto"></div>
          <p className="mt-4 font-medium text-white">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // Lógica de bloqueo: Si el usuario debe cambiar contraseña, solo mostramos esa pantalla
  if (user && user.perfil?.debe_cambiar_password) {
    return (
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/cambiar-password" element={<CambiarPassword onPasswordChanged={handleLogin} />} />
          <Route path="*" element={<Navigate to="/cambiar-password" replace />} />
        </Routes>
      </Router>
    );
  }

  // 🔒 BLOQUEO POR ERROR DE VÍNCULO: Si el usuario no tiene docente vinculado
  if (hasVinculoError) {
    return (
      <Router>
        <Toaster position="top-right" />
        <ErrorVinculoDocente onLogout={handleLogout} />
      </Router>
    );
  }

  return (
    <ActiveRoleProvider user={user} setUser={setUser}>
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1000001,
          },
          success: { 
            style: { 
              background: isDark ? '#064e3b' : '#f0fdf4', 
              color: isDark ? '#a7f3d0' : '#166534',
              border: '2px solid #10b981',
              borderLeft: '4px solid #059669',
            },
            icon: '✅',
            duration: 4000,
          },
          error: { 
            style: { 
              background: isDark ? '#7f1d1d' : '#fef2f2', 
              color: isDark ? '#fecaca' : '#991b1b',
              border: '2px solid #ef4444',
              borderLeft: '4px solid #f59e0b',
            },
            icon: '⚠️',
            duration: 6000,
          },
        }}
      />
      <style>{`
        @keyframes page-enter-animation {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-page-enter {
          animation: page-enter-animation 0.4s ease-out forwards;
        }
      `}</style>
      
      <Routes>
        {!user ? (
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<ModuleSelector user={user} onLogout={handleLogout} theme={theme} setTheme={setTheme} />} />

            {/* Página completa (sin sidebar) para redactar/ver el Informe de Fondo de Tiempo */}
            <Route path="/fondos/:id/informe" element={<EditorInformePage />} />

            {/* AHORA SÍ: Estructura de enrutamiento anidada correctamente */}
            <Route 
              path="/fondo-tiempo" 
              element={
                <FondoTiempoLayout 
                  user={user}
                  onLogout={handleLogout}
                  sidebarCollapsed={sidebarCollapsed}
                  setSidebarCollapsed={setSidebarCollapsed}
                  theme={theme}
                  setTheme={setTheme}
                  onProfileUpdate={handleProfileUpdate}
                  onCarreraActivaChange={handleCarreraActivaChange}
                />
              }
            >
              {/* La ruta 'index' coincide con la ruta padre ('/fondo-tiempo') */}
              <Route index element={<AnimatedRoute><ListaFondos isDark={isDark} /></AnimatedRoute>} />
              
              {/* Las rutas hijas son relativas al padre */}
              <Route path="fondo/:id" element={<AnimatedRoute><DetalleFondo isDark={isDark} /></AnimatedRoute>} />
              <Route path="comparar" element={<AnimatedRoute><Comparador isDark={isDark} /></AnimatedRoute>} />
              <Route path="nuevo-fondo" element={<AnimatedRoute><FormularioFondo isDark={isDark} /></AnimatedRoute>} />
              <Route path="editar-fondo/:id" element={<AnimatedRoute><FormularioFondo isDark={isDark} editar={true} /></AnimatedRoute>} />

              <Route path="cargas-horarias" element={<AnimatedRoute><CargaHorariaGeneral isDark={isDark} /></AnimatedRoute>} />
              <Route path="docentes/:id" element={<AnimatedRoute><FondoTiempoDocente isDark={isDark} /></AnimatedRoute>} />
              {/* Ruta para los fondos archivados dentro del módulo de Fondo de Tiempo */}
              <Route path="archivados" element={<AnimatedRoute><FondosArchivados isDark={isDark} /></AnimatedRoute>} />

              {/* Rutas de Administración (Integradas en el Sidebar) */}
              <Route path="docentes" element={<AnimatedRoute><ListaDocentes isDark={isDark} sidebarCollapsed={sidebarCollapsed} /></AnimatedRoute>} />
              <Route path="calendarios" element={<AnimatedRoute><ListaCalendarios /></AnimatedRoute>} />
              <Route path="materias" element={<MateriaList isDark={isDark} sidebarCollapsed={sidebarCollapsed} />}>
                <Route path="nueva" element={<MateriaForm sidebarCollapsed={sidebarCollapsed} />} />
                <Route path="editar/:id" element={<MateriaForm sidebarCollapsed={sidebarCollapsed} />} />
              </Route>

              <Route path="*" element={<Navigate to="/fondo-tiempo" replace />} />
            </Route>

            {/* Módulo: Fondos a Largo Plazo */}
            <Route path="/largo-plazo" element={<SimpleLayout theme={theme} setTheme={setTheme} />}>
              <Route index element={<Proximamente isDark={isDark} />} />
            </Route>

            {/* Módulo Principal: Gestión Global de Usuarios/Carreras */}
            <Route path="/usuarios" element={<SimpleLayout theme={theme} setTheme={setTheme} />}>
              <Route index element={<AnimatedRoute><GestionUsuarios isDark={isDark} user={user} hasSidebar={false} /></AnimatedRoute>} />
            </Route>

            <Route path="/carreras" element={<SimpleLayout theme={theme} setTheme={setTheme} />}>
              <Route index element={<AnimatedRoute><ListaCarreras isDark={isDark} hasSidebar={false} /></AnimatedRoute>} />
            </Route>

            {/* Módulo: Seguimiento Global */}
            <Route path="/seguimiento" element={<SimpleLayout theme={theme} setTheme={setTheme} />}>
              <Route index element={<Proximamente isDark={isDark} />} />
            </Route>

            {/* Módulo: POA - Usando el layout con sidebar y header propios */}
            <Route path="/poa" element={<POAApp user={user} />}>
              <Route index element={<AnimatedRoute><POAHomePage /></AnimatedRoute>} />
              <Route path="accesos" element={<AnimatedRoute><AccesosPOAPage /></AnimatedRoute>} />
              <Route path="documentos" element={<AnimatedRoute><DocumentosPOAPage /></AnimatedRoute>} />
              <Route path="documentos-revision" element={<AnimatedRoute><DocumentosRevisionPOAPage /></AnimatedRoute>} />
              <Route path="actividades/:objetivoEspecificoId" element={<AnimatedRoute><ActividadesPage /></AnimatedRoute>} />
              <Route path="actividades/:actividadId/evidencias" element={<AnimatedRoute><EvidenciaPage /></AnimatedRoute>} />
              <Route path="objetivos-especificos/:documentId" element={<AnimatedRoute><ObjetivosEspecificosPage /></AnimatedRoute>} />
              <Route path="catalogos" element={<AnimatedRoute><CatalogosMenu /></AnimatedRoute>} />
              <Route path="catalogos/items" element={<AnimatedRoute><CatalogoItems /></AnimatedRoute>} />
              <Route path="catalogos/indicadores" element={<AnimatedRoute><IndicadoresPage /></AnimatedRoute>} />
              <Route path="reportes" element={<AnimatedRoute><Reportes /></AnimatedRoute>} />
              <Route path="presupuestos" element={<AnimatedRoute><PresupuestosPage /></AnimatedRoute>} />
              <Route path="consolidado-requerimientos" element={<AnimatedRoute><ConsolidadoRequerimientosPage /></AnimatedRoute>} />
              <Route path="seguimiento/programa/:documentId" element={<AnimatedRoute><SeguimientoProgramaPage /></AnimatedRoute>} />
            </Route>

            {/* Módulos de Administración y Catálogos (protegidos) */}
            {(user.is_staff || user.is_superuser) && (
              <Route path="/admin" element={<AdminPanel user={user} onLogout={handleLogout} />}>
                <Route index element={<AdminDashboard user={user} />} />
                <Route path="calendarios" element={<AnimatedRoute><ListaCalendarios /></AnimatedRoute>} />
                {/* Redirección por si se entra a /admin/ sin nada más */}
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
            )}

            {/* Ruta para cualquier otra URL no encontrada, redirige al panel de módulos */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Router>
    </ActiveRoleProvider>
  );
}

export default App;
