import { useSearchParams } from 'react-router-dom';
import { KeyRound, Palette, UserRound } from 'lucide-react';
import { useActiveRole } from '../../contexts/activeRole';
import { BLOQUE } from '../fondos/estilosFondo';
import PestanaApariencia from './PestanaApariencia';
import PestanaPerfil from './PestanaPerfil';
import PestanaSeguridad from './PestanaSeguridad';

const PESTANAS = [
  { id: 'perfil', etiqueta: 'Perfil', icono: UserRound },
  { id: 'seguridad', etiqueta: 'Seguridad', icono: KeyRound },
  { id: 'apariencia', etiqueta: 'Apariencia', icono: Palette },
];

// Mi cuenta, para todos los roles: se entra con el nombre o la foto del usuario (sidebar
// del Fondo de Tiempo o "Bienvenido" del panel de módulos). La pestaña va en ?pestana=.
// enPanel: abierta desde el panel de módulos (/mi-cuenta), bajo "Volver al Panel".
function MiCuenta({ onProfileUpdate, enPanel = false }) {
  const { effectiveUser } = useActiveRole();
  const [parametros, setParametros] = useSearchParams();
  const pestana = PESTANAS.some((item) => item.id === parametros.get('pestana')) ? parametros.get('pestana') : 'perfil';
  const nombre = `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || effectiveUser?.username;

  const elegir = (id) => setParametros(id === 'perfil' ? {} : { pestana: id }, { replace: true });

  return (
    <div className={enPanel
      ? 'w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 pt-16 md:pt-20 pb-6 space-y-4 text-slate-800'
      : 'min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800'}
    >
      <div className={`${BLOQUE} p-5 sm:p-6`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
            <UserRound className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Cuenta personal</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Mi cuenta</h2>
            <p className="mt-1 text-sm text-slate-600 truncate">{nombre}</p>
          </div>
        </div>
      </div>

      <div className={`${BLOQUE} p-2`}>
        <div role="tablist" aria-label="Secciones de Mi cuenta" className="grid grid-cols-3 gap-1">
          {PESTANAS.map(({ id, etiqueta, icono: Icono }) => {
            const activa = pestana === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`pestana-${id}`}
                aria-selected={activa}
                aria-controls={`panel-${id}`}
                onClick={() => elegir(id)}
                className={`inline-flex items-center justify-center gap-2 h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                  activa ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-600 hover:bg-azulado-100 hover:text-blue-900'
                }`}
              >
                <Icono className="w-4 h-4" strokeWidth={1.75} />
                <span>{etiqueta}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`pestana-${pestana}`} key={pestana} className="animate-fondo-entrada">
        {pestana === 'perfil' && <PestanaPerfil onProfileUpdate={onProfileUpdate} />}
        {pestana === 'seguridad' && <PestanaSeguridad />}
        {pestana === 'apariencia' && <PestanaApariencia onProfileUpdate={onProfileUpdate} />}
      </div>
    </div>
  );
}

export default MiCuenta;
