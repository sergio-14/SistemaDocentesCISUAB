import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';
import ModalMiCuenta from './cuenta/ModalMiCuenta';
import { useActiveRole } from '../contexts/activeRole';
import { useErrorPulse } from '../utils/formErrors';
import loroSilueta from '../assets/loro-silueta.png';

// La silueta del loro se pinta con el color de fondo a través de esta máscara.
const MASCARA_LORO = {
    WebkitMaskImage: `url(${loroSilueta})`,
    maskImage: `url(${loroSilueta})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
};

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

const ProximamenteIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
// Toda la pantalla en dos zonas: a la izquierda la marca, el título y los módulos; a la derecha una
// división azulada (con la línea punteada del login) con las herramientas y el rol de ingreso.
// Paleta de Fondo de Tiempo: azulado, blue-900 y sky-600.
const ModuleSelector = ({ user, onLogout, onProfileUpdate }) => {
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
        // Lugares para los módulos que vienen: se ven, pero no se puede entrar.
        {
            name: 'Próximamente',
            description: 'Nuevo módulo en preparación.',
            icon: ProximamenteIcon,
            enabled: false,
        },
        {
            name: 'Próximamente',
            description: 'Nuevo módulo en preparación.',
            icon: ProximamenteIcon,
            enabled: false,
        },
    ].map((modulo, i) => ({ ...modulo, clave: `${modulo.name}-${i}` }));

    // iiisyp es solo lectura: no puede acceder a herramientas globales de administracion
    const esDirectorCarrera = currentUser?.perfil?.rol === 'director';
    const mostrarHerramientasGestion = currentUser?.is_superuser || esDirectorCarrera;
    const tituloHerramientasGestion = 'Administración';
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

    // La persona (abre Mi cuenta) y cerrar sesión: en celular, en la barra de arriba junto al logo;
    // en escritorio, en la esquina de arriba de la división.
    const cuenta = (
        <div className="flex items-center gap-2">
            <button
                type="button"
                title="Mi cuenta"
                onClick={() => setCuentaAbierta(true)}
                className="flex max-w-[11rem] sm:max-w-[16rem] items-center gap-2 rounded-full bg-white dark:bg-slate-800 py-1.5 pl-1.5 pr-3 text-left text-xs shadow-sm ring-1 ring-inset ring-azulado-300 dark:ring-slate-700 transition-colors hover:bg-azulado-50 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
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
                aria-label="Cerrar sesión"
                className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-slate-800/70 py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-azulado-300 dark:ring-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
            >
                <LogoutIcon />
                <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
        </div>
    );

    // Administración (solo superusuario y Director de Carrera) y rol de ingreso.
    const columnaLateral = conColumnaLateral && (
        <div className="space-y-6">
            {mostrarHerramientasGestion && (
                <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-900/60 dark:text-slate-400">{tituloHerramientasGestion}</p>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
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
        </div>
    );

    return (
        <div className="panel-modulos relative isolate min-h-screen w-full overflow-x-hidden bg-azulado-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 lg:grid lg:grid-cols-[minmax(0,1fr)_40vw]">
            <style>{`
                .panel-entrada { animation: panelEntrada 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
                @keyframes panelEntrada {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .panel-entrada { animation: none; }
                }
            `}</style>
            {cuentaAbierta && <ModalMiCuenta onClose={() => setCuentaAbierta(false)} onProfileUpdate={onProfileUpdate} />}

            {/* Zona izquierda: la marca en la esquina, el título y los módulos. */}
            <section className="relative flex lg:min-h-screen flex-col px-5 sm:px-10 lg:pl-[4vw] lg:pr-10 pt-5 pb-10 lg:pt-8">
                <div className="relative">
                {/* En celular, mancha azulada detrás del encabezado y el título, con la línea punteada en su
                    borde; sigue el alto del bloque (en escritorio está la división). */}
                <svg className="pointer-events-none absolute -inset-x-5 sm:-inset-x-10 -top-5 -bottom-10 -z-10 h-[calc(100%+3.75rem)] w-[calc(100%+2.5rem)] sm:w-[calc(100%+5rem)] lg:hidden" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path className="fill-azulado-100 dark:fill-slate-900" d="M0,0 L100,0 L100,84 C82,96 66,78 48,88 C32,97 16,80 0,90 Z" />
                    <path d="M0,97 C16,87 32,100 48,94 C66,85 82,100 100,91" fill="none" stroke="#7d9cc0" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <img src="/images/LOGOUAB.png" alt="Logo de la UABJB" className="h-11 lg:h-12 w-auto" />
                        <div className="leading-tight">
                            <p className="text-sm font-extrabold text-blue-900 dark:text-sky-200">UABJB</p>
                            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">Universidad Autónoma del Beni</p>
                        </div>
                    </div>
                    <div className="lg:hidden">{cuenta}</div>
                </div>

                <div className="panel-entrada relative w-full max-w-3xl lg:mx-auto pt-8 pr-20 sm:pr-28 lg:pr-0 lg:pt-[9vh]">
                    {/* En celular, el loro a la derecha del título, mirando hacia las letras. */}
                    <div
                        className="pointer-events-none absolute right-0 bottom-0 h-[7.5rem] sm:h-36 aspect-[1/1.75] -scale-x-100 bg-[#8fa8cd] dark:bg-slate-700 lg:hidden"
                        style={MASCARA_LORO}
                        aria-hidden="true"
                    />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Panel de módulos</p>
                    <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        ¿A dónde vamos hoy<span className="text-sky-600">?</span>
                    </h1>
                    <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400">Seleccione el sistema al que desea ingresar.</p>
                </div>
                </div>

                <main className="panel-entrada w-full max-w-3xl lg:mx-auto">

                    {/* En celular, la administración y el rol van antes de los módulos. */}
                    {conColumnaLateral && <div className="mt-12 lg:hidden">{columnaLateral}</div>}

                    <div className={`${conColumnaLateral ? 'mt-7' : 'mt-12'} lg:mt-9 grid grid-cols-2 gap-3 sm:gap-4`}>
                        {modules.map((module) => (
                            <ModuleCard
                                key={module.clave}
                                {...module}
                                onNavigateClick={(event) => handleModuleNavigation(event, module)}
                            />
                        ))}
                    </div>
                </main>

                <p className="mt-10 text-right text-[11px] text-slate-500 dark:text-slate-400 lg:hidden">
                    Universidad Autónoma del Beni "José Ballivián" · Trinidad, Beni
                </p>
            </section>

            {/* Zona derecha (solo escritorio): la división azulada con la línea punteada; arriba la persona,
                luego la administración y el rol, "Módulos" grande abajo y el nombre de la universidad. */}
            <section className="relative hidden lg:flex min-h-screen flex-col pl-[9vw] pr-10 py-8">
                <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="panel-division" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#DFE8F5" />
                            <stop offset="1" stopColor="#B8C9E1" />
                        </linearGradient>
                    </defs>
                    <path className="dark:opacity-10" d="M30,0 C16,5 9,12 13,24 C17,35 27,39 23,51 C19,63 8,66 10,79 C11,89 15,95 18,100 L100,100 L100,0 Z" fill="url(#panel-division)" />
                    <path d="M19,0 C7,6 2,13 5,24 C8,35 18,39 14,51 C10,63 1,67 2,79 C3,89 6,95 8,100" fill="none" stroke="#7d9cc0" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
                </svg>
                <p className="pointer-events-none absolute right-8 bottom-[9%] -z-10 text-[7vw] font-extrabold leading-none tracking-tight text-blue-900/[0.13] dark:text-white/[0.07]" aria-hidden="true">
                    Módulos
                </p>

                <div className="flex justify-end">{cuenta}</div>

                {/* Administración un poco arriba del centro, con la silueta del loro pegada a su izquierda
                    (entre los módulos y la administración), mirando hacia los módulos, en el azulado de la
                    división pero más intenso. */}
                <div className={`relative mx-auto w-full max-w-xs ${conColumnaLateral ? 'my-auto -translate-y-[9vh]' : 'mt-[22vh]'}`}>
                    <div
                        className="pointer-events-none absolute right-full top-1/2 mr-5 h-[24vh] max-h-[230px] aspect-[1/1.75] -translate-y-1/2 -scale-x-100 bg-[#8fa8cd] dark:bg-slate-700"
                        style={MASCARA_LORO}
                        aria-hidden="true"
                    />
                    {conColumnaLateral && <aside className="panel-entrada">{columnaLateral}</aside>}
                </div>

                <p className="mt-auto pt-8 text-right text-xs font-medium text-blue-900/70 dark:text-slate-400">
                    Universidad Autónoma del Beni "José Ballivián" · Trinidad, Beni
                </p>
            </section>
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
        className="group flex items-center gap-3 rounded-2xl bg-white/85 px-3 py-3 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_22px_rgba(30,58,138,0.12)] dark:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900/40"
    >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-950 text-white">
            <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-blue-900 dark:text-slate-100">{name}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </span>
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-blue-900/40 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
);

// Tarjeta de módulo: bloque en azul en degradado (como "Tiempo en etapa" de Fondo de Tiempo), texto
// blanco, el ícono grande y tenue de fondo y un botón blanco "Ingresar". Las de "Próximamente" van
// apagadas, con borde punteado y sin enlace.
const ModuleCard = ({ name, description, path, icon: Icon, color, enabled, onNavigateClick }) => {
    if (!enabled) {
        return (
            <div className="relative flex min-h-[9.5rem] sm:min-h-[11rem] flex-col justify-between overflow-hidden rounded-3xl border-2 border-dashed border-azulado-300 bg-white/60 p-4 sm:p-5 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40" aria-disabled="true">
                <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-azulado-100 text-blue-900/40 dark:bg-slate-800 dark:text-slate-500">
                    <Icon className="h-5 w-5" />
                </span>
                <span className="block">
                    <span className="block text-base sm:text-lg font-bold text-blue-900/50 dark:text-slate-400">{name}</span>
                    <span className="mt-0.5 block text-xs sm:text-sm">{description}</span>
                </span>
            </div>
        );
    }
    return (
        <Link
            to={path}
            onClick={onNavigateClick}
            className={`group relative flex min-h-[9.5rem] sm:min-h-[11rem] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${TONOS_MODULO[color] || TONOS_MODULO.blue} p-4 sm:p-5 text-white shadow-[0_14px_30px_rgba(30,58,138,0.22)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(30,58,138,0.3)] focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/60`}
        >
            <Icon className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 sm:h-32 sm:w-32 text-white/10 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:rotate-12" aria-hidden="true" />
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
                <Icon className="h-5 w-5" />
            </span>
            <span className="relative block">
                <span className="block text-base sm:text-lg font-bold leading-tight">{name}</span>
                <span className="mt-0.5 block text-xs sm:text-sm text-white/75">{description}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs sm:text-sm font-semibold text-blue-900 shadow-sm">
                    Ingresar
                    <ArrowRight className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
            </span>
        </Link>
    );
};

export default ModuleSelector;
