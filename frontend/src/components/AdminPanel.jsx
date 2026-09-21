import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';

// --- ICONOS ---
const LogoutIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);
const BackIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
);
const DashboardIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
);
const UsersIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.963A3.426 3.426 0 0012 15.75c1.262 0 2.427-.393 3.379-1.085m-6.758 0a3.426 3.426 0 01-3.379-1.085 3.426 3.426 0 01-3.379 1.085C4.26 15.366 3 16.827 3 18.75V19.5a.75.75 0 00.75.75h12.586a.75.75 0 00.75-.75v-.75c0-1.923-1.26-3.384-3.006-3.963zM12 6a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
    </svg>
);
const DocentesIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
    </svg>
);
const CarrerasIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
    </svg>
);
const CalendarioIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />
    </svg>
);
const ArchiveIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" />
    </svg>
);

// --- COMPONENTE PRINCIPAL ---
const AdminPanel = ({ user, onLogout }) => {
    const navigate = useNavigate();

    const adminModules = [
        {
            name: 'Dashboard',
            path: '/admin',
            icon: DashboardIcon,
            exact: true
        },
        {
            name: 'Gestión de Usuarios',
            description: 'Administrar cuentas, roles y permisos.',
            path: '/admin/usuarios',
            icon: UsersIcon,
        },
        {
            name: 'Gestión de Docentes',
            description: 'Catálogo de todo el personal docente.',
            path: '/admin/docentes',
            icon: DocentesIcon,
        },
        {
            name: 'Gestión de Carreras',
            description: 'Catálogo de carreras y facultades.',
            path: '/admin/carreras',
            icon: CarrerasIcon,
        },
        ...(user?.is_superuser ? [{
            name: 'Gestión de Calendarios',
            description: 'Administrar periodos académicos.',
            path: '/admin/calendarios',
            icon: CalendarioIcon,
        }] : []),
    ];

    const handleLogoutClick = () => {
        onLogout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 font-sans">
            {/* --- BARRA LATERAL --- */}
            <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-blue-900 to-blue-950 text-slate-300 flex flex-col shadow-2xl">
                {/* Logo/Header */}
                <div className="h-20 flex items-center justify-center border-b border-blue-800/50">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">UAB</div>
                        <span className="text-white font-bold text-xl">Admin</span>
                    </Link>
                </div>

                {/* Navegación */}
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {adminModules.map(module => (
                        <NavLink
                            key={module.name}
                            to={module.path}
                            end={module.exact}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group ${
                                isActive
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border-l-4 border-white'
                                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white border-l-4 border-transparent'
                                }`
                            }
                        >
                            <module.icon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
                            <span className="font-semibold">{module.name}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer de la barra lateral */}
                <div className="p-4 border-t border-blue-800/50 space-y-2">
                    <Link
                        to="/"
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-blue-200 hover:bg-blue-800/50 transition-colors"
                        title="Volver al Panel de Módulos"
                    >
                        <BackIcon className="h-5 w-5" />
                        <span className="font-semibold text-sm">Panel Módulos</span>
                    </Link>
                    <button
                        onClick={handleLogoutClick}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        title="Cerrar Sesión"
                    >
                        <LogoutIcon className="h-5 w-5" />
                        <span className="font-semibold text-sm">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* --- CONTENIDO PRINCIPAL --- */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 xl:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminPanel;