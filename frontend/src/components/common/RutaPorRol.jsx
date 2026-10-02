import { Navigate } from 'react-router-dom';
import { useActiveRole } from '../../contexts/activeRole';

/**
 * Muestra la ruta solo al superusuario o a quien trabaja con uno de `roles` como
 * rol ACTIVO (no por is_staff ni por el rol base del perfil). Al resto lo devuelve
 * al selector de módulos.
 */
export default function RutaPorRol({ roles, children }) {
  const { effectiveUser, activeRole } = useActiveRole();
  if (effectiveUser?.is_superuser || roles.includes(activeRole)) return children;
  return <Navigate to="/" replace />;
}
