import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FotoPerfil from './cuenta/FotoPerfil';
import ModalMiCuenta from './cuenta/ModalMiCuenta';
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useActiveRole } from '../contexts/activeRole';

// Íconos de lucide-react, como en el detalle del fondo y el editor del informe; el
// grosor del trazo se fija una vez para todo el menú.
const TRAZO = 1.75;

function Sidebar({ user, collapsed: collapsedEscritorio, setCollapsed, esMovil = false, menuMovilAbierto = false, onCerrarMenuMovil, onProfileUpdate }) {
  // En el celular el menú se abre siempre completo; el modo contraído es solo de escritorio.
  const collapsed = collapsedEscritorio && !esMovil;
  const location = useLocation();
  const navigate = useNavigate();
  const {
    effectiveUser,
  } = useActiveRole();
  const currentUser = effectiveUser || user;
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  // En el celular el menú se cierra para que Mi cuenta quede sola en pantalla.
  const abrirCuenta = () => {
    if (esMovil) onCerrarMenuMovil?.();
    setCuentaAbierta(true);
  };
  const fullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.username;

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
      return 'Usuario';
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
  // iiisyp es solo lectura: no ve items de administracion.
  // El superusuario no tiene rol de carrera: sus items se habilitan con superuser: true.
  // Determina el rol del usuario actual.
  const userRole = currentUser?.perfil?.rol;
  // El docente solo ve sus fondos: la misma página se llama "Mis fondos".
  const esSoloDocente = userRole === 'docente' && !currentUser?.is_superuser;

  const menuItems = {
    principal: [
      { path: '/fondo-tiempo', icon: LayoutDashboard, label: esSoloDocente ? 'Mis fondos' : 'Dashboard', roles: ['iiisyp', 'director', 'jefe_estudios', 'docente'], superuser: true },
      { path: '/fondo-tiempo/comparar', icon: ArrowLeftRight, label: 'Comparar Fondos', roles: ['director', 'jefe_estudios'], superuser: true },
      { path: '/fondo-tiempo/archivados', icon: Archive, label: 'Fondos Archivados', roles: ['director', 'jefe_estudios'], superuser: true },
      { path: '/fondo-tiempo/informe-gestion', icon: FileText, label: 'Informe de gestión', roles: ['director'], superuser: true },
    ],
    administracion: [
      { path: '/fondo-tiempo/docentes', icon: GraduationCap, label: 'Docentes', roles: ['iiisyp', 'director', 'jefe_estudios'], superuser: true },
      { path: '/fondo-tiempo/cargas-horarias', icon: Clock, label: 'Carga Horaria', roles: ['jefe_estudios'], superuser: true },
      { path: '/fondo-tiempo/calendarios', icon: CalendarDays, label: 'Calendario Académico', roles: ['director', 'jefe_estudios'], superuser: true },
      { path: '/fondo-tiempo/materias', icon: BookOpen, label: 'Materias', roles: ['director', 'jefe_estudios'], superuser: true },
    ]
  };

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
        className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white z-40 transition-all duration-300 flex flex-col ${
          collapsed ? 'w-20' : 'w-72'
        } ${esMovil && !menuMovilAbierto ? '-translate-x-full' : 'translate-x-0'}`}
      >
        {/* --- BOTÓN TOGGLE --- */}
        <div className={`flex mb-1 pt-2 ${collapsed ? 'justify-center' : 'justify-end px-3'}`}>
          <button
            onClick={() => (esMovil ? onCerrarMenuMovil?.() : setCollapsed(!collapsed))}
            title={esMovil ? 'Cerrar menú' : (collapsed ? 'Expandir menú' : 'Contraer menú')}
            className="p-2 text-blue-200 hover:text-white transition-all duration-300"
          >
            {collapsed ? <Menu className="w-5 h-5" strokeWidth={2} /> : <X className="w-5 h-5" strokeWidth={2} />}
          </button>
        </div>

        {/* --- 1. CABECERA CON PERFIL DE USUARIO: abre Mi cuenta (mismo aspecto de siempre) --- */}
        <div className="px-4 pb-2">
          <div
            role="button"
            tabIndex={0}
            title="Mi cuenta"
            aria-label={`Mi cuenta de ${fullName}`}
            onClick={abrirCuenta}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter' || evento.key === ' ') {
                evento.preventDefault();
                abrirCuenta();
              }
            }}
            className="flex flex-col items-center gap-3 p-2 rounded-lg transition-all duration-300 cursor-pointer"
          >
            <div className={`transition-all duration-300 ${collapsed ? 'w-12 h-12' : 'w-40 h-40'}`}>
              <FotoPerfil user={currentUser} />
            </div>
            {/* Nombre y Rol (visible solo si no está colapsado) */}
            {!collapsed && (
              <div className="flex-1 min-w-0 text-center">
                <p className="text-sm font-semibold text-white leading-snug break-words" title={fullName}>
                  {fullName}
                </p>
                <p className="text-xs text-blue-300 truncate" title={getRoleName(currentUser)}>{getRoleName(currentUser)}</p>
              </div>
            )}
          </div>
        </div>

        {/* --- 2. NAVEGACIÓN PRINCIPAL (CON SCROLL) --- */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Sección Principal */}
          <div className="mb-6">
            {!collapsed && (
              <h3 className="px-7 text-xs font-semibold uppercase tracking-wider mb-2 text-blue-400">
                Principal
              </h3>
            )}
            <div className={collapsed ? "space-y-1.5 px-4" : "space-y-1.5 px-3"}>
              {visiblePrincipal.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`group flex items-center gap-3 w-full transition-all duration-300 rounded-2xl ${
                    collapsed ? 'justify-center h-12' : 'px-4 py-2.5'
                  } ${
                    isActive(item.path)
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={TRAZO} />
                  {!collapsed && (
                    <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              ))}

              {/* SECCIÓN ADMINISTRACIÓN */}
              {visibleAdmin.length > 0 && (
                <>
                  {!collapsed && (
                    <div className="text-xs font-semibold text-blue-400 mt-5 mb-2 px-4 uppercase tracking-wider">
                      Administración
                    </div>
                  )}
                  {visibleAdmin.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      className={`group flex items-center gap-3 w-full transition-all duration-300 rounded-2xl ${
                        collapsed ? 'justify-center h-12' : 'px-4 py-2.5'
                      } ${
                        isActive(item.path)
                          ? 'bg-white text-blue-900 shadow-sm'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={TRAZO} />
                      {!collapsed && (
                        <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                      )}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>

        </nav>

        {/* --- 3. PIE DE PÁGINA CON BOTÓN "ATRÁS" --- */}
        <div className={`mt-auto pb-5 pt-3 ${collapsed ? 'px-4' : 'px-3'}`}>
          {/* Botón Atrás */}
          <button
            onClick={() => navigate('..')}
            title="Atrás"
            className={`group flex items-center gap-3 w-full transition-all duration-300 rounded-2xl ${collapsed ? 'justify-center h-12' : 'px-4 py-2.5'} text-blue-200 hover:bg-red-500/80 hover:text-white`}
          >
            <ArrowLeft className="w-5 h-5 flex-shrink-0" strokeWidth={TRAZO} />
            {!collapsed && (
              <span className="font-medium text-sm whitespace-nowrap">Atrás</span>
            )}
          </button>
        </div>
      </div>
      {cuentaAbierta && <ModalMiCuenta onClose={() => setCuentaAbierta(false)} onProfileUpdate={onProfileUpdate} />}
    </>
  );
}

export default Sidebar;
