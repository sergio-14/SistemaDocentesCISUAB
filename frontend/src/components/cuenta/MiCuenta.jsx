import { useActiveRole } from '../../contexts/activeRole';
import PerfilCuenta from './PerfilCuenta';

// Mi cuenta, para todos los roles: se entra con el nombre o la foto del usuario (sidebar
// del Fondo de Tiempo o "Bienvenido" del panel de módulos). Una sola columna centrada con
// la foto, los datos de la cuenta y, para el docente, su ficha.
// enPanel: abierta desde el panel de módulos (/mi-cuenta), bajo "Volver al Panel".
function MiCuenta({ onProfileUpdate, enPanel = false }) {
  const { effectiveUser, activeRole, getRoleLabel } = useActiveRole();
  const nombre = `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || effectiveUser?.username;
  const rol = effectiveUser?.is_superuser ? 'Super Admin' : getRoleLabel(activeRole);

  return (
    <div className={`w-full px-3 sm:px-4 md:px-8 text-slate-800 ${enPanel ? 'pt-16 md:pt-20 pb-6' : 'py-4 md:py-6'}`}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Mi cuenta</p>
          <h2 className="text-2xl font-bold text-blue-900 truncate">{nombre}</h2>
          <p className="text-sm text-slate-600 truncate">@{effectiveUser?.username} · {rol}</p>
        </header>
        <PerfilCuenta onProfileUpdate={onProfileUpdate} />
      </div>
    </div>
  );
}

export default MiCuenta;
