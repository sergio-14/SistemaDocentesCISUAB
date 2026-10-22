import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { useActiveRole } from '../contexts/activeRole';
import AvisoCarreraInactiva from './common/AvisoCarreraInactiva';
import AvisoFichaDocentePendiente from './common/AvisoFichaDocentePendiente';
import useSinElevacionPoa from '../utils/useSinElevacionPoa';

const FondoTiempoLayout = ({ 
    user, 
    onLogout, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    onProfileUpdate, // <-- Recibimos la prop
    onCarreraActivaChange,
}) => {
    const {
        activeAssignment,
        assignments,
        hasMultipleAssignments,
    } = useActiveRole();
    const location = useLocation();
    useSinElevacionPoa();

    // En pantallas menores a lg el sidebar es un menú deslizable que tapa el contenido.
    const [esMovil, setEsMovil] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 1023px)');
        const actualizar = () => setEsMovil(media.matches);
        media.addEventListener('change', actualizar);
        return () => media.removeEventListener('change', actualizar);
    }, []);

    useEffect(() => {
        setMenuMovilAbierto(false);
    }, [location.pathname]);

    const anchoSidebar = esMovil ? '0rem' : (sidebarCollapsed ? '5rem' : '18rem');

    const storedAssignmentId = localStorage.getItem('active_assignment_id');
    const hasValidStoredAssignment = assignments.some(
        (assignment) => String(assignment.id) === String(storedAssignmentId)
    );
    const requiereSeleccionRol = Boolean(
        user
        && !user.is_superuser
        && hasMultipleAssignments
        && !activeAssignment
        && !hasValidStoredAssignment
    );

    useEffect(() => {
        document.documentElement.style.setProperty('--fondo-sidebar-width', anchoSidebar);
        return () => {
            document.documentElement.style.removeProperty('--fondo-sidebar-width');
        };
    }, [anchoSidebar]);

    if (requiereSeleccionRol) {
        return <Navigate to="/" replace />;
    }

    return (
        <div
            className="flex h-screen overflow-hidden bg-azulado-100 lg:bg-gradient-to-b lg:from-blue-900 lg:to-blue-950"
            style={{ '--fondo-sidebar-width': anchoSidebar }}
        >
            {/* Sidebar */}
            <Sidebar 
                user={user} 
                onLogout={onLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                esMovil={esMovil}
                menuMovilAbierto={menuMovilAbierto}
                onCerrarMenuMovil={() => setMenuMovilAbierto(false)}
                onProfileUpdate={onProfileUpdate} // <-- La pasamos a Sidebar
                onCarreraActivaChange={onCarreraActivaChange}
            />

            {/* Velo detrás del menú deslizable en el celular */}
            {esMovil && menuMovilAbierto && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setMenuMovilAbierto(false)}
                    className="fixed inset-0 z-30 bg-blue-950/40"
                />
            )}

            {/* Contenido Principal del Módulo: en escritorio el main lleva el azul del sidebar
                detrás de las esquinas y el panel azulado se redondea solo del lado del sidebar */}
            <main 
                className={`flex-1 min-w-0 h-screen flex flex-col transition-all duration-300 ${
                sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
                }`}
            >
                {/* Barra superior solo en el celular */}
                <div className="lg:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0 bg-gradient-to-r from-blue-900 to-blue-950 text-white">
                    <button
                        type="button"
                        onClick={() => setMenuMovilAbierto(true)}
                        aria-label="Abrir menú"
                        className="p-2 -ml-2 rounded-full hover:bg-white/10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="text-sm font-semibold">Fondo de Tiempo</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto bg-azulado-100 lg:rounded-l-[2rem]">
                    <AvisoCarreraInactiva className="sticky top-0 z-30 mx-4 mt-4 md:mx-8" />
                    <AvisoFichaDocentePendiente className="mx-4 mt-4 md:mx-8" />
                    {/* Las rutas anidadas (ListaFondos, DetalleFondo, etc.) se renderizarán aquí */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default FondoTiempoLayout;
