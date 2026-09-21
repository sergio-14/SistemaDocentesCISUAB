import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';
import { useActiveRole } from '../contexts/ActiveRoleContext';
import {
    ERROR_FIELD_BORDER_CLASS,
    ERROR_MOTION_CLASS,
    useErrorPulse,
} from '../utils/formErrors';

// --- ICONOS ---
// Se mantienen los mismos iconos, pero ahora se pueden personalizar más fácilmente.

// Icono para el botón de logout
const LogoutIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

// Icono para Fondo de Tiempo
const FondoTiempoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// Icono para POA
const POAIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// Icono para Largo Plazo
const LargoPlazoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />
    </svg>
);

// Icono para Seguimiento
const SeguimientoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-1.5l-2.625 2.625a.75.75 0 001.06 1.06L10.5 18.75m0 0h-1.5a2.25 2.25 0 01-2.25-2.25v-1.5a2.25 2.25 0 012.25-2.25H10.5m0 0V6.375c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-1.5Z" />
    </svg>
);

const UsersIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.963A3.426 3.426 0 0012 15.75c1.262 0 2.427-.393 3.379-1.085m-6.758 0a3.426 3.426 0 01-3.379-1.085 3.426 3.426 0 01-3.379 1.085C4.26 15.366 3 16.827 3 18.75V19.5a.75.75 0 00.75.75h12.586a.75.75 0 00.75-.75v-.75c0-1.923-1.26-3.384-3.006-3.963zM12 6a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
    </svg>
);

const BuildingIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
);

// --- COMPONENTE PRINCIPAL ---
const ModuleSelector = ({ user, onLogout, theme, setTheme }) => {
    const navigate = useNavigate();
    const [roleSelectionError, setRoleSelectionError] = useState('');
    const [roleErrorPulse, setRoleErrorPulse] = useState(0);
    const activeRoleContext = useActiveRole();
    const {
        activeAssignment,
        effectiveUser,
        hasMultipleAssignments,
        assignments,
        selectAssignment,
        openRoleSelector,
        getRoleLabel,
    } = activeRoleContext;
    const currentUser = effectiveUser || user;

    // Lógica para obtener el nombre a mostrar (corregida)
    const fullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim();
    const displayName = fullName || currentUser?.username || 'Usuario';

    const handleLogoutClick = () => {
        onLogout();
        navigate('/login');
    };

    const modules = [
        {
            name: 'Fondo de Tiempo',
            description: 'Gestión de carga horaria y proyectos.',
            path: '/fondo-tiempo',
            icon: FondoTiempoIcon,
            color: 'blue',
            enabled: true,
        },
        {
            name: 'Fondo a Largo Plazo',
            description: 'Proyectos de investigación y extensión.',
            path: '/largo-plazo',
            icon: LargoPlazoIcon,
            color: 'teal',
            enabled: true,
        },
        {
            name: 'Seguimiento Global',
            description: 'Actividad reciente de todos los fondos.',
            path: '/seguimiento',
            icon: SeguimientoIcon,
            color: 'indigo',
            enabled: true,
        },
        {
            name: 'POA',
            description: 'Plan Operativo Anual.',
            path: '/poa',
            icon: POAIcon,
            color: 'green',
            enabled: true,
        },
    ];

    // iiisyp es solo lectura: no puede acceder a herramientas globales de administracion
    const esDirectorCarrera = currentUser?.perfil?.rol === 'director';
    const mostrarHerramientasGestion = currentUser?.is_superuser || esDirectorCarrera;
    const tituloHerramientasGestion = currentUser?.is_superuser ? 'Herramientas Globales' : 'Herramientas de Carrera';
    const herramientasGlobales = [
        {
            name: 'Usuarios del Sistema',
            description: 'Gestión global de cuentas y permisos.',
            path: '/usuarios',
            icon: UsersIcon,
            color: 'cyan',
            enabled: true,
        },
        {
            name: 'Carreras',
            description: 'Catálogo general de carreras del sistema.',
            path: '/carreras',
            icon: BuildingIcon,
            color: 'purple',
            enabled: true,
        },
    ];
    const herramientasVisibles = currentUser?.is_superuser
        ? herramientasGlobales
        : herramientasGlobales.map((tool) => ({
            ...tool,
            description: tool.path === '/usuarios'
                ? 'Usuarios y roles de tu carrera.'
                : 'Informacion institucional de tu carrera.',
        }));

    const moduleEntryVectors = [
        { x: -320, y: -220 },
        { x: 320, y: -220 },
        { x: -320, y: 220 },
        { x: 320, y: 220 },
    ];

    const requiereSeleccionRolParaFondo = Boolean(
        currentUser
        && !currentUser.is_superuser
        && hasMultipleAssignments
        && !activeAssignment
    );

    const handleModuleNavigation = (event, module) => {
        if (module.path !== '/fondo-tiempo' || !requiereSeleccionRolParaFondo) return;

        event.preventDefault();
        openRoleSelector();
        setRoleSelectionError('Debe seleccionar un rol antes de ingresar al Fondo de Tiempo.');
        setRoleErrorPulse((pulse) => pulse + 1);
        toast.error('Selecciona un rol antes de ingresar al Fondo de Tiempo.', {
            id: 'role-selection-required',
            className: 'toast-brinco',
        });
    };

    const handleSelectAssignment = (assignment) => {
        setRoleSelectionError('');
        selectAssignment(assignment);
    };

    return (
        <div className="module-selector-root relative isolate min-h-screen w-full bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-500 overflow-hidden">
            <style>{`
                @keyframes module-corner-in {
                    0% {
                        opacity: 0;
                        transform: translate(var(--from-x), var(--from-y)) scale(0.9);
                        filter: blur(4px);
                    }
                    70% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1.02);
                        filter: blur(0);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1);
                        filter: blur(0);
                    }
                }
                .module-corner-enter {
                    animation: module-corner-in 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
                    will-change: transform, opacity, filter;
                }
                @keyframes tools-slide-in {
                    0% {
                        opacity: 0;
                        transform: translateX(140%) translateY(-50%);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0) translateY(-50%);
                    }
                }
                .tools-floating-enter {
                    animation: tools-slide-in 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                @keyframes logo-bg-intro {
                    0% {
                        transform: translateX(44vw) scale(5.6);
                        opacity: 0.18;
                        filter: blur(2px);
                    }
                    100% {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                        filter: blur(0);
                    }
                }
                .logo-bg-enter {
                    animation: logo-bg-intro 1300ms cubic-bezier(0.16, 1, 0.3, 1) both;
                    transform-origin: center center;
                    will-change: transform, opacity, filter;
                }
                @media (max-width: 640px) {
                    .module-selector-root {
                        overflow-y: auto;
                    }
                    .module-selector-content {
                        justify-content: flex-start;
                        min-height: 100dvh;
                        padding: 4.25rem 0.75rem 5rem;
                    }
                    .module-selector-header {
                        padding: 0.65rem;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }
                    .module-selector-welcome {
                        max-width: calc(100vw - 8.25rem);
                        padding: 0.38rem 0.6rem;
                        font-size: 0.68rem;
                        line-height: 1.15;
                    }
                    .module-selector-logout {
                        padding: 0.42rem 0.58rem;
                        font-size: 0.68rem;
                        line-height: 1;
                    }
                    .module-selector-title {
                        margin-bottom: 0.85rem;
                    }
                    .module-selector-heading {
                        font-size: 1.65rem;
                        line-height: 1.05;
                        margin-bottom: 0.2rem;
                    }
                    .module-selector-subtitle {
                        font-size: 0.78rem;
                        line-height: 1.25;
                    }
                    .module-selector-grid {
                        width: 100%;
                        max-width: 22rem;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 0.65rem;
                    }
                    .module-card {
                        min-height: 7.25rem;
                        padding: 0.75rem 0.55rem;
                        border-radius: 0.95rem;
                    }
                    .module-card-icon {
                        margin-bottom: 0.45rem;
                    }
                    .module-card-icon svg {
                        width: 1.7rem;
                        height: 1.7rem;
                    }
                    .module-card-title {
                        font-size: 0.88rem;
                        line-height: 1.1;
                    }
                    .module-card-description {
                        margin-top: 0.25rem;
                        font-size: 0.64rem;
                        line-height: 1.15;
                    }
                    .module-tools-panel {
                        margin-top: 0.75rem;
                        max-width: 22rem;
                    }
                    .module-tools-card {
                        border-radius: 0.95rem;
                        padding: 0.65rem;
                    }
                    .module-tools-title {
                        margin-bottom: 0.5rem;
                        font-size: 0.55rem;
                    }
                    .module-tool-button {
                        gap: 0.55rem;
                        border-radius: 0.8rem;
                        padding: 0.55rem 0.65rem;
                    }
                    .module-tool-icon {
                        width: 2rem;
                        height: 2rem;
                    }
                    .module-tool-icon svg {
                        width: 1rem;
                        height: 1rem;
                    }
                    .module-tool-title {
                        font-size: 0.78rem;
                        line-height: 1.05;
                    }
                    .module-tool-description {
                        font-size: 0.62rem;
                        line-height: 1.15;
                    }
                    .module-corner-enter,
                    .tools-floating-enter {
                        animation: none;
                    }
                }
            `}</style>

            {/* Logo institucional de fondo */}
            <div className="hidden xl:block fixed left-[72px] top-[calc(50%-152px)] -translate-y-1/2 z-0 pointer-events-none">
                <img
                    src="/images/LOGOUAB.png"
                    alt="Logo de la universidad"
                    className="logo-bg-enter w-72 h-72 object-contain"
                />
            </div>

            {/* Círculos decorativos animados (del login) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-[1]">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 dark:opacity-30 animate-pulse bg-uab-blue-400 dark:bg-blue-500"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20 dark:opacity-30 animate-pulse bg-purple-400 dark:bg-purple-500" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Selector de Tema - Flotante Global (misma posición que en Fondo de Tiempo) */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* Contenido Principal */}
            <div className="module-selector-content relative min-h-screen flex flex-col items-center justify-center p-4 z-10">
                {/* Header */}
                <header className="module-selector-header absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
                    {/* Lado Izquierdo: Mensaje de Bienvenida */}
                    <div className="module-selector-welcome text-sm font-medium backdrop-blur-sm bg-black/5 dark:bg-white/5 py-2 px-4 rounded-full">
                        Bienvenido, <span className="font-bold text-uab-blue-800 dark:text-uab-blue-300">{displayName}</span>
                    </div>

                    {/* Lado Derecho: Botones de Acción */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleLogoutClick}
                            className="module-selector-logout flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 backdrop-blur-sm bg-black/5 dark:bg-white/5 py-2 px-4 rounded-full"
                            title="Cerrar Sesión"
                        >
                            <LogoutIcon />
                            <span className="hidden sm:inline">Serrar Secion</span>
                        </button>
                    </div>
                </header>
                
                {/* Título */}
                <div className="module-selector-title text-center mb-12 animate-fade-in">
                    <h1 className="module-selector-heading text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-uab-blue-700 to-blue-800 dark:from-uab-blue-300 dark:to-blue-400">
                        Panel de Módulos
                    </h1>
                    <p className="module-selector-subtitle text-lg text-slate-600 dark:text-slate-400">Seleccione el sistema al que desea ingresar.</p>
                </div>

                {/* Grid de Módulos */}
                <div className="module-selector-grid grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                    {modules.filter(m => m.enabled).map((module, index) => {
                        const vector = moduleEntryVectors[index] || moduleEntryVectors[moduleEntryVectors.length - 1];
                        return (
                            <div
                                key={module.name}
                                className="module-corner-enter"
                                style={{
                                    '--from-x': `${vector.x}px`,
                                    '--from-y': `${vector.y}px`,
                                    animationDelay: `${160 + index * 120}ms`,
                                }}
                            >
                                <ModuleCard
                                    {...module}
                                    onClick={module.action}
                                    onNavigateClick={(event) => handleModuleNavigation(event, module)}
                                />
                            </div>
                        );
                    })}
                </div>

                {(mostrarHerramientasGestion || hasMultipleAssignments) && (
                    <aside className="module-tools-panel tools-floating-enter lg:fixed lg:right-8 lg:top-[calc(50%-152px)] lg:-translate-y-1/2 mt-10 lg:mt-0 w-full max-w-sm lg:w-80">
                        <div className="module-tools-card relative rounded-2xl border border-white/35 dark:border-white/20 bg-white/5 dark:bg-slate-900/10 backdrop-blur-md shadow-2xl p-4">
                            <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                            {mostrarHerramientasGestion && (
                                <>
                                    <p className="module-tools-title text-xs uppercase tracking-[0.22em] text-cyan-200/90 dark:text-cyan-300/80 mb-3 text-center">
                                        {tituloHerramientasGestion}
                                    </p>
                                    <div className="space-y-3">
                                        {herramientasVisibles.map((tool) => (
                                            <FloatingToolButton key={tool.name} {...tool} />
                                        ))}
                                    </div>
                                </>
                            )}
                            {hasMultipleAssignments && (
                                <RoleInlineSelector
                                    assignments={assignments}
                                    activeAssignment={activeAssignment}
                                    onSelect={handleSelectAssignment}
                                    getRoleLabel={getRoleLabel}
                                    compactTop={mostrarHerramientasGestion}
                                    error={roleSelectionError}
                                    pulse={roleErrorPulse}
                                />
                            )}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

const RoleInlineSelector = ({ assignments, activeAssignment, onSelect, getRoleLabel, compactTop, error = '', pulse = 0 }) => {
    const { motionClass } = useErrorPulse(error, pulse);

    return (
    <div className={compactTop ? 'mt-4 pt-4 border-t border-white/20 dark:border-white/10' : ''}>
        <p className="module-tools-title text-xs uppercase tracking-[0.22em] text-cyan-200/90 dark:text-cyan-300/80 mb-3 text-center">
            Rol de Ingreso
        </p>
        <div className={`space-y-2 rounded-2xl border-2 p-3 transition-colors ${
            error
                ? `${ERROR_FIELD_BORDER_CLASS} bg-red-50/75 dark:bg-red-950/25 ${motionClass}`
                : 'border-white/25 bg-white/10 dark:border-white/15 dark:bg-slate-900/10'
        }`}>
            {assignments.map((assignment) => {
                const selected = String(activeAssignment?.id || '') === String(assignment.id);
                return (
                    <button
                        key={assignment.id}
                        type="button"
                        onClick={() => onSelect(assignment)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-300 ${
                            selected
                                ? 'border-blue-300 bg-blue-600/90 text-white shadow-lg shadow-blue-900/20'
                                : 'border-white/30 bg-white/20 text-slate-900 hover:border-blue-300 hover:bg-white/35 dark:border-white/15 dark:bg-slate-800/35 dark:text-slate-100 dark:hover:bg-slate-800/55'
                        }`}
                    >
                        <span className="block text-sm font-bold">{getRoleLabel(assignment.rol)}</span>
                        <span className={`block text-xs truncate ${selected ? 'text-blue-100' : 'text-slate-600 dark:text-slate-300'}`}>
                            {assignment.carrera_nombre || 'Sin carrera'}
                        </span>
                    </button>
                );
            })}
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </div>
    );
};

const FloatingToolButton = ({ name, description, path, icon: Icon, color }) => {
    const colorClasses = {
        cyan: 'from-cyan-500/35 to-sky-500/20 border-cyan-300/50 hover:border-cyan-200/80',
        purple: 'from-purple-500/35 to-fuchsia-500/20 border-purple-300/50 hover:border-purple-200/80',
    };

    const buttonColor = colorClasses[color] || colorClasses.cyan;

    return (
        <Link
            to={path}
            className={`module-tool-button group flex items-center gap-3 w-full rounded-xl border bg-gradient-to-r ${buttonColor} bg-white/10 dark:bg-slate-800/20 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
        >
            <div className="module-tool-icon w-10 h-10 rounded-lg bg-white/20 dark:bg-slate-900/30 flex items-center justify-center text-cyan-700 dark:text-cyan-100">
                <Icon className="h-5 w-5" />
            </div>
            <div className="text-left">
                <p className="module-tool-title font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                <p className="module-tool-description text-xs text-slate-600 dark:text-slate-300">{description}</p>
            </div>
        </Link>
    );
};

// --- TARJETA DE MÓDULO REDISEÑADA ---
const ModuleCard = ({ name, description, path, icon: Icon, color, enabled, onClick, onNavigateClick }) => {
    
    const colorClasses = {
        blue: {
            shadow: 'shadow-blue-500/30 dark:shadow-blue-500/20',
            hoverGlow: 'hover:ring-blue-500/50',
            icon: 'text-blue-600 dark:text-blue-400'
        },
        green: {
            shadow: 'shadow-green-500/30 dark:shadow-green-500/20',
            hoverGlow: 'hover:ring-green-500/50',
            icon: 'text-green-600 dark:text-green-400'
        },
        teal: {
            shadow: 'shadow-teal-500/30 dark:shadow-teal-500/20',
            hoverGlow: 'hover:ring-teal-500/50',
            icon: 'text-teal-600 dark:text-teal-400'
        },
        indigo: {
            shadow: 'shadow-indigo-500/30 dark:shadow-indigo-500/20',
            hoverGlow: 'hover:ring-indigo-500/50',
            icon: 'text-indigo-600 dark:text-indigo-400'
        },
        red: {
            shadow: 'shadow-red-500/30 dark:shadow-red-500/20',
            hoverGlow: 'hover:ring-red-500/50',
            icon: 'text-red-600 dark:text-red-400'
        },
        purple: {
            shadow: 'shadow-purple-500/30 dark:shadow-purple-500/20',
            hoverGlow: 'hover:ring-purple-500/50',
            icon: 'text-purple-600 dark:text-purple-400'
        },
        cyan: {
            shadow: 'shadow-cyan-500/30 dark:shadow-cyan-500/20',
            hoverGlow: 'hover:ring-cyan-500/50',
            icon: 'text-cyan-600 dark:text-cyan-400'
        },
        rose: {
            shadow: 'shadow-rose-500/30 dark:shadow-rose-500/20',
            hoverGlow: 'hover:ring-rose-500/50',
            icon: 'text-rose-600 dark:text-rose-400'
        },
        slate: {
            shadow: 'shadow-slate-500/30 dark:shadow-slate-500/20',
            hoverGlow: 'hover:ring-slate-500/50',
            icon: 'text-slate-600 dark:text-slate-400'
        }
    }

    const currentColors = colorClasses[color] || colorClasses.blue;

    const cardContent = (
        <div className={`
            module-card relative p-8 rounded-2xl w-full h-full max-w-sm text-center flex flex-col items-center justify-center
            backdrop-blur-xl border border-white/20 dark:border-white/10
            bg-white/50 dark:bg-white/5
            shadow-xl ${currentColors.shadow}
            transition-all duration-300 group
            ${enabled 
                ? 'hover:shadow-2xl hover:-translate-y-2' 
                : 'opacity-60 cursor-not-allowed'
            }
        `}>
            {/* Anillo brillante en hover */}
            {enabled && <div className={`absolute inset-0 rounded-2xl ring-4 ring-transparent ${currentColors.hoverGlow} transition-all duration-300`}></div>}
            
            <div className="module-card-icon mb-4 transition-transform duration-300 group-hover:scale-110">
                <Icon className={`h-14 w-14 ${currentColors.icon}`} />
            </div>
            
            <h2 className="module-card-title text-2xl font-bold text-slate-800 dark:text-white">{name}</h2>
            <p className="module-card-description mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            
            {!enabled && (
                <div className="absolute top-3 right-3 bg-uab-gold-500/80 dark:bg-uab-gold-500/50 text-white text-xs font-bold py-1 px-3 rounded-full backdrop-blur-sm">
                    PRÓXIMAMENTE
                </div>
            )}
        </div>
    );

    if (!enabled) {
        return cardContent;
    }

    if (onClick) {
        return (
            <button onClick={onClick} className="w-full focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-red-500/50 rounded-2xl transition-all duration-300 text-left">
                {cardContent}
            </button>
        );
    }

    return (
        <Link to={path} onClick={onNavigateClick} className="focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-blue-500/50 rounded-2xl transition-all duration-300">
            {cardContent}
        </Link>
    );
};

export default ModuleSelector;
