import { ClipboardList } from 'lucide-react';
import { useActiveRole } from '../../contexts/activeRole';

// Aviso al propio usuario: tiene rol docente pero todavía no tiene ficha de docente.
// No lo bloquea: sus cargos funcionan y su parte docente (fondo de tiempo, carga
// horaria) queda pendiente hasta que la administración cree la ficha.
const AvisoFichaDocentePendiente = ({ className = '' }) => {
  const { effectiveUser } = useActiveRole();
  if (!effectiveUser?.ficha_docente_pendiente) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100 ${className}`}
    >
      <ClipboardList aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-900" strokeWidth={2} />
      <p>
        <strong>Falta crear la ficha de docente.</strong>{' '}
        Tu parte docente (fondo de tiempo y carga horaria) queda pendiente hasta que la administración la registre.
        Tus demás roles funcionan normal.
      </p>
    </div>
  );
};

export default AvisoFichaDocentePendiente;
