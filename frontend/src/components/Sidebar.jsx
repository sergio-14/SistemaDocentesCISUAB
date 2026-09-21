import { Link, useLocation, useNavigate } from 'react-router-dom';
import ProfilePicture from './ProfilePicture';
import { useActiveRole } from '../contexts/ActiveRoleContext';

// --- ICONOS ---
const DashboardIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
);

const CrearFondoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
);

const CompararIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-3.181-3.182l-3.182 3.182m0 0a8.25 8.25 0 01-11.664 0l-3.182-3.182" />
    </svg>
);

const ArchiveIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
    </svg>
);

const BackIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
);

const ClockIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CalendarioIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />
    </svg>
);

const UsersIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);

const AcademicCapIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.24 28.45 28.45 0 01-2.658.813m-15.482 0A28.33 28.33 0 0112 13.489a28.331 28.331 0 01-5.482-3.342z" />
    </svg>
);

const BuildingIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
);

const BookOpenIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

function Sidebar({ user, onLogout, collapsed, setCollapsed, theme, setTheme, onProfileUpdate, onCarreraActivaChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    effectiveUser,
  } = useActiveRole();
  const currentUser = effectiveUser || user;

  const isActive = (path) => {
    if (path === '/fondo-tiempo') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const getRoleName = (user) => {
    if (user?.is_superuser) {
      return 'Super Admin';
    }
    if (!user?.perfil?.rol) {
      return user?.is_staff ? 'Administrador' : 'Usuario';
    }
    const roles = {
      iiisyp: 'Instituto de investigación',
      director: 'Director de Carrera',
      jefe_estudios: 'Jefe de Estudios',
      docente: 'Docente',
    };
    return roles[user.perfil.rol] || 'Usuario';
  };

  // Define los roles que pueden ver cada item.
  // iiisyp es solo lectura: no ve items de administracion
  const menuItems = {
    principal: [
      { path: '/fondo-tiempo', icon: DashboardIcon, label: 'Dashboard', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
      { path: '/fondo-tiempo/comparar', icon: CompararIcon, label: 'Comparar Fondos', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
      { path: '/fondo-tiempo/archivados', icon: ArchiveIcon, label: 'Fondos Archivados', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'] },
    ],
    administracion: [
      { path: '/fondo-tiempo/docentes', icon: AcademicCapIcon, label: 'Docentes', roles: ['iiisyp', 'director', 'jefe_estudios'] },
      { path: '/fondo-tiempo/cargas-horarias', icon: ClockIcon, label: 'Carga Horaria', roles: ['jefe_estudios'] },
      { path: '/fondo-tiempo/calendarios', icon: CalendarioIcon, label: 'Calendario Académico', superuser: true },
      { path: '/fondo-tiempo/materias', icon: BookOpenIcon, label: 'Materias', roles: ['director', 'jefe_estudios'], superuser: true },
    ]
  };

  // Determina el rol del usuario actual.
  const userRole = currentUser?.perfil?.rol;

  // Función helper para filtrar items
  const filterItems = (items) => items.filter(item => (
    (item.roles && userRole && item.roles.includes(userRole))
    || (item.superuser && currentUser?.is_superuser)
  ));

  const visiblePrincipal = filterItems(menuItems.principal);
  const visibleAdmin = filterItems(menuItems.administracion);

  return (
    <>
      {/* --- BARRA LATERAL PRINCIPAL --- */}
      <div
        className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white shadow-2xl z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* --- BOTÓN TOGGLE --- */}
        <div className={`flex mb-1 pt-2 ${collapsed ? 'justify-center' : 'justify-end px-3'}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className="p-2 text-blue-200 hover:text-white transition-all duration-300"
          >
            {collapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        {/* --- 1. CABECERA CON PERFIL DE USUARIO --- */}
        <div className="px-4 pb-4 border-b border-blue-800/50">
          {/* Perfil de usuario */}
          <div className={`flex flex-col items-center gap-3 p-2 rounded-lg transition-all duration-300`}>
            <div className={`transition-all duration-300 ${collapsed ? 'w-12 h-12' : 'w-40 h-40'}`}>
              <ProfilePicture user={currentUser} onUpdate={onProfileUpdate} />
            </div>
            {/* Nombre y Rol (visible solo si no está colapsado) */}
            {!collapsed && (
              <div className="flex-1 min-w-0 text-center">
                <p className="text-sm font-semibold text-white truncate" title={currentUser?.first_name || currentUser?.username}>
                  {currentUser?.first_name || currentUser?.username}
                </p>
                <p className="text-xs text-blue-300 truncate" title={getRoleName(currentUser)}>{getRoleName(currentUser)}</p>
              </div>
            )}
          </div>

        </div>

        {/* --- 2. NAVEGACIÓN PRINCIPAL (CON SCROLL) --- */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Sección Principal */}
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-6 text-xs font-semibold uppercase tracking-wider mb-2 text-blue-400">
                Principal
              </h3>
            )}
            <div className={collapsed ? "space-y-2 px-2" : "space-y-2 px-4"}>
              {visiblePrincipal.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`group flex items-center gap-4 w-full transition-all duration-300 rounded-xl ${
                    collapsed ? 'justify-center h-14' : 'px-4 py-3'
                  } ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[inset_4px_0_0_0_#ffffff,0_10px_24px_rgba(0,0,0,0.22)]'
                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white hover:shadow-[inset_4px_0_0_0_#ffffff]'
                  }`}
                >
                  <item.icon className="w-6 h-6 flex-shrink-0" />
                  {!collapsed && (
                    <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              ))}

              {/* SECCIÓN ADMINISTRACIÓN */}
              {visibleAdmin.length > 0 && (
                <>
                  {!collapsed && (
                    <div className="text-xs font-bold text-blue-400 mt-4 mb-2 px-4 uppercase tracking-wider">
                      Administración
                    </div>
                  )}
                  {visibleAdmin.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      className={`group flex items-center gap-4 w-full transition-all duration-300 rounded-xl ${
                        collapsed ? 'justify-center h-14' : 'px-4 py-3'
                      } ${
                        isActive(item.path)
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[inset_4px_0_0_0_#ffffff,0_10px_24px_rgba(0,0,0,0.22)]'
                          : 'text-blue-200 hover:bg-blue-800/50 hover:text-white hover:shadow-[inset_4px_0_0_0_#ffffff]'
                      }`}
                    >
                      <item.icon className="w-6 h-6 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>
                      )}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>

        </nav>

        {/* --- 3. PIE DE PÁGINA CON BOTÓN "ATRÁS" --- */}
        <div className="mt-auto p-4 border-t border-blue-800/50">
          {/* Botón Atrás */}
          <button
            onClick={() => navigate('..')}
            title="Atrás"
            className={`group flex items-center gap-4 w-full transition-all duration-300 rounded-lg ${collapsed ? 'justify-center h-14' : 'px-4 py-3'} text-blue-200 hover:bg-red-500/80 hover:text-white border border-transparent hover:border-red-300/30`}
          >
            <BackIcon className="w-6 h-6 flex-shrink-0" />
            {!collapsed && (
              <span className="font-medium text-sm whitespace-nowrap">Atrás</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;
