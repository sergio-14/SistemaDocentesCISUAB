import { Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import useSinElevacionPoa from '../../utils/useSinElevacionPoa';
import useModoClaro from '../../utils/useModoClaro';

// soloClaro: la página va con el estilo de Fondo de Tiempo (solo modo claro, sin selector de tema).
const SimpleLayout = ({ theme, setTheme, soloClaro = false }) => {
    useSinElevacionPoa();
    useModoClaro(soloClaro);

    return (
        <div className={soloClaro
            ? 'relative min-h-screen bg-azulado-100'
            : `relative min-h-screen bg-slate-50 dark:bg-slate-900${theme === 'dark' ? ' dark' : ''}`}
        >
            {/* Selector de Tema - Flotante Global */}
            {!soloClaro && <ThemeToggle theme={theme} setTheme={setTheme} />}

            <Link
                to="/"
                className={soloClaro
                    ? 'simple-layout-back-button absolute top-3 left-3 md:top-5 md:left-8 z-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-azulado-50 text-sm font-medium text-blue-900 ring-1 ring-azulado-300 hover:bg-azulado-200 transition-colors'
                    : 'simple-layout-back-button absolute top-3 left-3 md:top-6 md:left-6 z-10 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm md:text-base rounded-full shadow-md hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700'}
            >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                <span>Volver al Panel</span>
            </Link>
            {/* El contenido se renderizará aquí */}
            <Outlet />
        </div>
    );
};

export default SimpleLayout;
