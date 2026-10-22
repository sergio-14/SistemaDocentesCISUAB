import { Outlet, Link } from 'react-router-dom';
import useSinElevacionPoa from '../../utils/useSinElevacionPoa';

// soloClaro: la página va con el estilo de Fondo de Tiempo (fondo blanco azulado).
const SimpleLayout = ({ soloClaro = false }) => {
    useSinElevacionPoa();

    return (
        <div className={soloClaro
            ? 'relative min-h-screen bg-azulado-100'
            : 'relative min-h-screen bg-slate-50'}
        >
            <Link
                to="/"
                className={soloClaro
                    ? 'simple-layout-back-button absolute top-3 left-3 md:top-5 md:left-8 z-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-azulado-50 text-sm font-medium text-blue-900 ring-1 ring-azulado-300 hover:bg-azulado-200 transition-colors'
                    : 'simple-layout-back-button absolute top-3 left-3 md:top-6 md:left-6 z-10 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white text-slate-700 text-sm md:text-base rounded-full shadow-md hover:shadow-lg transition-all border border-slate-200'}
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
