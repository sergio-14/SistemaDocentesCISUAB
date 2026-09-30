import { useActiveRole } from '../../contexts/ActiveRoleContext';

// Aviso al propio usuario: tiene rol docente pero todavía no tiene ficha de docente.
// No lo bloquea: sus cargos funcionan y su parte docente (fondo de tiempo, carga
// horaria) queda pendiente hasta que la administración cree la ficha.
const AvisoFichaDocentePendiente = ({ className = '' }) => {
  const { effectiveUser } = useActiveRole();
  if (!effectiveUser?.ficha_docente_pendiente) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-900/30 dark:text-amber-100 ${className}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">📋</span>
      <p>
        <strong>Falta crear la ficha de docente.</strong>{' '}
        Tu parte docente (fondo de tiempo y carga horaria) queda pendiente hasta que la administración la registre.
        Tus demás roles funcionan normal.
      </p>
    </div>
  );
};

export default AvisoFichaDocentePendiente;
