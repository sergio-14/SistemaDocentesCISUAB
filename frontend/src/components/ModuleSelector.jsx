import { Link, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import ModalMiCuenta from './cuenta/ModalMiCuenta';
import { useActiveRole } from '../contexts/activeRole';
import { useErrorPulse } from '../utils/formErrors';

// Los mismos videos de parabas del login (se cargan aparte).
const VideosParabas = lazy(() => import('./login/VideosParabas'));

// --- ICONOS ---

const LogoutIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const FondoTiempoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const POAIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

// Recuadro del ícono de cada módulo: azul de Fondo de Tiempo (como "Tiempo en etapa") o celeste.
const TONOS_MODULO = {
    blue: 'from-blue-900 to-blue-950',
    sky: 'from-sky-600 to-sky-700',
};

// --- COMPONENTE PRINCIPAL ---
// Mismo lenguaje que el login: la escena de parabas sigue fuera de la tarjeta, la tarjeta blanca
// lleva la columna del video con la onda y la línea punteada, y el contenido usa la paleta de
// Fondo de Tiempo (azulado, blue-900 y sky-600).
const ModuleSelector = ({ user, onLogout, theme, setTheme, onProfileUpdate }) => {
    const navigate = useNavigate();
    const [roleSelectionError, setRoleSelectionError] = useState('');
    const [roleErrorPulse, setRoleErrorPulse] = useState(0);
    const [cuentaAbierta, setCuentaAbierta] = useState(false);
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
            name: 'POA',
            description: 'Plan Operativo Anual.',
            path: '/poa',
            icon: POAIcon,
            color: 'sky',
            enabled: true,
        },
    ];

    // iiisyp es solo lectura: no puede acceder a herramientas globales de administracion
    const esDirectorCarrera = currentUser?.perfil?.rol === 'director';
    const mostrarHerramientasGestion = currentUser?.is_superuser || esDirectorCarrera;
    const tituloHerramientasGestion = currentUser?.is_superuser ? 'Herramientas globales' : 'Herramientas de carrera';
    const herramientasGlobales = [
        {
            name: 'Usuarios del Sistema',
            description: 'Gestión global de cuentas y permisos.',
            path: '/usuarios',
            icon: UsersIcon,
        },
        {
            name: 'Carreras',
            description: 'Catálogo general de carreras del sistema.',
            path: '/carreras',
            icon: BuildingIcon,
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
        });
    };

    const handleSelectAssignment = (assignment) => {
        setRoleSelectionError('');
        selectAssignment(assignment);
    };

    const conColumnaLateral = mostrarHerramientasGestion || hasMultipleAssignments;

    return (
        <div className="panel-modulos relative isolate min-h-screen w-full overflow-x-hidden bg-azulado-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
            <style>{`
                .panel-tarjeta { animation: panelEntrada 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
                @keyframes panelEntrada {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .panel-tarjeta { animation: none; }
                }
            `}</style>

            {/* Fuera de la tarjeta, como en el login: la escena sigue en una mancha a la derecha con los
                videos desenfocados y tenues, y una palabra enorme y muy suave detrás. */}
            <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
                <defs>
                    <clipPath id="panel-mancha" clipPathUnits="objectBoundingBox">
                        <path d="M0.38,0 L1,0 L1,1 L0.3,1 C0.12,0.94 0.02,0.82 0.1,0.7 C0.2,0.56 0.42,0.6 0.4,0.44 C0.38,0.3 0.14,0.3 0.18,0.16 C0.21,0.07 0.3,0.02 0.38,0 Z" />
                    </clipPath>
                    <clipPath id="panel-onda" clipPathUnits="objectBoundingBox">
                        <path d="M0.62,0 C0.42,0.03 0.18,0.08 0.22,0.2 C0.26,0.31 0.36,0.35 0.33,0.47 C0.3,0.59 0.15,0.62 0.12,0.74 C0.09,0.85 0.05,0.93 0.03,1 L1,1 L1,0 Z" />
                    </clipPath>
                </defs>
            </svg>
            <div className="pointer-events-none fixed inset-y-0 right-0 hidden lg:block w-[58vw] [clip-path:url(#panel-mancha)]" aria-hidden="true">
                <Suspense fallback={null}>
                    <VideosParabas className="absolute inset-0 scale-110 blur-2xl opacity-40 dark:opacity-25" />
                </Suspense>
                <div className="absolute inset-0 bg-gradient-to-l from-sky-200/40 to-azulado-100/60 dark:from-slate-900/40 dark:to-slate-950/60" />
            </div>
            <p className="pointer-events-none fixed left-[3vw] top-[2vh] hidden lg:block text-[8.5vw] font-extrabold leading-none tracking-tight text-blue-900/[0.06] dark:text-white/[0.04]" aria-hidden="true">
                Módulos
            </p>

            {/* Selector de tema: flotante, en la misma posición que en Fondo de Tiempo. */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            <div className="relative z-10 flex min-h-screen items-center justify-center sm:p-6 lg:p-10">
                <div className="w-full max-w-6xl">
                    <div className="panel-tarjeta relative w-full min-h-screen sm:min-h-[min(640px,calc(100vh-5rem))] flex flex-col bg-white dark:bg-slate-900 sm:rounded-3xl overflow-hidden shadow-[0_40px_90px_rgba(15,23,42,0.16)]">
                        {/* Columna del video a la derecha (con la onda y la línea punteada del login); en
                            celular, franja de arriba. */}
                        <div className="relative order-first h-48 sm:h-56 lg:h-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[34%] bg-azulado-100 dark:bg-slate-800 lg:[clip-path:url(#panel-onda)]" aria-hidden="true">
                            <Suspense fallback={null}>
                                <VideosParabas className="absolute inset-0 lg:scale-[1.15] lg:origin-[0%_30%]" />
                            </Suspense>
                            <svg className="absolute bottom-0 left-0 z-10 w-full h-12 lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path className="fill-white dark:fill-slate-900" d="M0,100 L0,40 C8,10 18,62 30,36 C40,14 50,70 64,44 C76,22 88,60 100,30 L100,100 Z" />
                            </svg>
                        </div>
                        <svg className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden lg:block h-full w-[34%] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <path d="M18,0 C9,4 0,9 2,18 C4,27 18,31 19,41 C20,51 10,56 6,64 C2,72 3,81 0,89 C-2,94 -3,97 -5,100" fill="none" stroke="#7d9cc0" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
                        </svg>

                        {/* Contenido, a la izquierda de la columna del video. */}
                        <div className="relative z-10 flex flex-1 flex-col px-5 sm:px-10 lg:pl-12 lg:pr-[38%] pt-6 pb-8 lg:pt-8 lg:pb-10">
                            {/* Encabezado: marca, la persona (abre Mi cuenta) y cerrar sesión. */}
                            <header className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-12 w-auto" />
                                    <div className="leading-tight">
                                        <p className="text-sm font-extrabold text-blue-900 dark:text-sky-200">UABJB</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Universidad Autónoma del Beni</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        title="Mi cuenta"
                                        onClick={() => setCuentaAbierta(true)}
                                        className="flex max-w-[14rem] items-center gap-2 rounded-full bg-azulado-50 dark:bg-slate-800 py-1.5 pl-1.5 pr-3 text-left text-xs ring-1 ring-inset ring-azulado-300 dark:ring-slate-700 transition-colors hover:bg-azulado-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
                                    >
                                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-900 to-blue-950 text-[11px] font-bold text-white">
                                            {displayName.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="truncate">
                                            <span className="text-slate-500 dark:text-slate-400">Hola, </span>
                                            <span className="font-semibold text-blue-900 dark:text-sky-200">{displayName}</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleLogoutClick}
                                        title="Cerrar sesión"
                                        className="flex items-center gap-1.5 rounded-full py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                                    >
                                        <LogoutIcon />
                                        <span className="hidden sm:inline">Cerrar sesión</span>
                                    </button>
                                </div>
                            </header>
                            {cuentaAbierta && <ModalMiCuenta onClose={() => setCuentaAbierta(false)} onProfileUpdate={onProfileUpdate} />}

                            <div className="my-auto pt-8 lg:pt-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Panel de módulos</p>
                                <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    ¿A dónde vamos hoy<span className="text-sky-600">?</span>
                                </h1>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Seleccione el sistema al que desea ingresar.</p>

                                <div className={`mt-7 grid gap-6 ${conColumnaLateral ? 'xl:grid-cols-[1fr_17rem]' : ''}`}>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {modules.filter((m) => m.enabled).map((module) => (
                                            <ModuleCard
                                                key={module.name}
                                                {...module}
                                                onNavigateClick={(event) => handleModuleNavigation(event, module)}
                                            />
                                        ))}
                                    </div>

                                    {conColumnaLateral && (
                                        <aside className="space-y-5">
                                            {mostrarHerramientasGestion && (
                                                <div>
                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{tituloHerramientasGestion}</p>
                                                    <div className="space-y-2">
                                                        {herramientasVisibles.map((tool) => (
                                                            <ToolLink key={tool.name} {...tool} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {hasMultipleAssignments && (
                                                <RoleInlineSelector
                                                    assignments={assignments}
                                                    activeAssignment={activeAssignment}
                                                    onSelect={handleSelectAssignment}
                                                    getRoleLabel={getRoleLabel}
                                                    error={roleSelectionError}
                                                    pulse={roleErrorPulse}
                                                />
                                            )}
                                        </aside>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="mt-5 hidden lg:block pr-8 text-right text-sm font-medium text-white [text-shadow:0_1px_10px_rgba(15,23,42,0.45)]">
                        Universidad Autónoma del Beni "José Ballivián" · Trinidad, Beni
                    </p>
                </div>
            </div>
        </div>
    );
};

// Rol de ingreso (para quien tiene más de una asignación). El elegido va en celeste, como lo
// seleccionado en Fondo de Tiempo; con error, el aviso rojo suave.
const RoleInlineSelector = ({ assignments, activeAssignment, onSelect, getRoleLabel, error = '', pulse = 0 }) => {
    const { motionClass } = useErrorPulse(error, pulse);

    return (
        <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Rol de ingreso</p>
            <div className={`space-y-2 rounded-2xl p-2 transition-colors ${
                error
                    ? `bg-red-50 ring-2 ring-red-400/80 dark:bg-red-950/30 ${motionClass}`
                    : 'bg-azulado-50 ring-1 ring-inset ring-azulado-300 dark:bg-slate-800 dark:ring-slate-700'
            }`}>
                {assignments.map((assignment) => {
                    const selected = String(activeAssignment?.id || '') === String(assignment.id);
                    return (
                        <button
                            key={assignment.id}
                            type="button"
                            onClick={() => onSelect(assignment)}
                            className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40 ${
                                selected
                                    ? 'bg-sky-600 text-white shadow-[0_6px_14px_rgba(2,132,199,0.25)]'
                                    : 'bg-white text-slate-800 hover:bg-azulado-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <span className="block text-sm font-bold">{getRoleLabel(assignment.rol)}</span>
                            <span className={`block truncate text-xs ${selected ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                {assignment.carrera_nombre || 'Sin carrera'}
                            </span>
                        </button>
                    );
                })}
            </div>
            {error && <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
        </div>
    );
};

const ToolLink = ({ name, description, path, icon: Icon }) => (
    <Link
        to={path}
        className="group flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-inset ring-azulado-300 transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:bg-slate-800 dark:ring-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
    >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-azulado-100 text-blue-900 dark:bg-slate-700 dark:text-sky-200">
            <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-blue-900 dark:text-slate-100">{name}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </span>
    </Link>
);

// Tarjeta de módulo con el estilo de Fondo de Tiempo: ícono en un recuadro azul en degradado.
const ModuleCard = ({ name, description, path, icon: Icon, color, onNavigateClick }) => (
    <Link
        to={path}
        onClick={onNavigateClick}
        className="group flex flex-col rounded-3xl bg-azulado-50 p-5 ring-1 ring-inset ring-azulado-300 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_40px_rgba(30,58,138,0.14)] dark:bg-slate-800 dark:ring-slate-700 dark:hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
    >
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${TONOS_MODULO[color] || TONOS_MODULO.blue} text-white shadow-[0_4px_14px_rgba(30,58,138,0.25)]`}>
            <Icon className="h-7 w-7" />
        </span>
        <span className="mt-4 text-xl font-bold text-blue-900 dark:text-white">{name}</span>
        <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</span>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400">
            Ingresar
            <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
    </Link>
);

export default ModuleSelector;
