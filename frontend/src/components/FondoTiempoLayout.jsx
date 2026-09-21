import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { useActiveRole } from '../contexts/ActiveRoleContext';

const FondoTiempoLayout = ({ 
    user, 
    onLogout, 
    sidebarCollapsed, 
    setSidebarCollapsed,
    theme,
    setTheme,
    onProfileUpdate, // <-- Recibimos la prop
    onCarreraActivaChange,
}) => {
    const {
        activeAssignment,
        assignments,
        hasMultipleAssignments,
    } = useActiveRole();

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
        document.documentElement.style.setProperty('--fondo-sidebar-width', sidebarCollapsed ? '5rem' : '18rem');
        return () => {
            document.documentElement.style.removeProperty('--fondo-sidebar-width');
        };
    }, [sidebarCollapsed]);

    if (requiereSeleccionRol) {
        return <Navigate to="/" replace />;
    }

    return (
        <div
            className="flex h-screen overflow-hidden bg-blue-50 dark:bg-slate-900"
            style={{ '--fondo-sidebar-width': sidebarCollapsed ? '5rem' : '18rem' }}
        >
            {/* Selector de Tema - Flotante Global */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            {/* Sidebar */}
            <Sidebar 
                user={user} 
                onLogout={onLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
                onProfileUpdate={onProfileUpdate} // <-- La pasamos a Sidebar
                onCarreraActivaChange={onCarreraActivaChange}
            />

            {/* Contenido Principal del Módulo */}
            <main 
                className={`flex-1 h-screen overflow-y-auto transition-all duration-300 ${
                sidebarCollapsed ? 'ml-20' : 'ml-72'
                }`}
            >
                <div className="min-h-full bg-blue-50 dark:bg-slate-900">
                    {/* Las rutas anidadas (ListaFondos, DetalleFondo, etc.) se renderizarán aquí */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default FondoTiempoLayout;
