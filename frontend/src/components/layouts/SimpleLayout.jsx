import { Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';

const SimpleLayout = ({ theme, setTheme }) => {
    return (
        <div className={`relative min-h-screen bg-slate-50 dark:bg-slate-900${theme === 'dark' ? ' dark' : ''}`}>
            {/* Selector de Tema - Flotante Global */}
            <ThemeToggle theme={theme} setTheme={setTheme} />

            <Link
                to="/"
                className="simple-layout-back-button absolute top-3 left-3 md:top-6 md:left-6 z-10 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm md:text-base rounded-full shadow-md hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700"
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
