import { useActiveRole } from '../../contexts/ActiveRoleContext';

// Aviso fijo cuando la carrera activa está desactivada: se puede consultar el
// histórico, pero no crear ni modificar datos.
const AvisoCarreraInactiva = ({ className = '' }) => {
  const { carreraSoloLectura, activeCareerName } = useActiveRole();
  if (!carreraSoloLectura) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-900/30 dark:text-amber-100 ${className}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">🔒</span>
      <p>
        <strong>Modo solo lectura.</strong>{' '}
        La carrera {activeCareerName ? <strong>{activeCareerName}</strong> : 'activa'} está desactivada:
        puedes consultar su histórico, pero no crear ni modificar datos.
      </p>
    </div>
  );
};

export default AvisoCarreraInactiva;
