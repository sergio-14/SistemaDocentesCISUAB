import { createContext, useContext } from 'react';

/**
 * Rol y carrera con los que trabaja el usuario. El valor lo da
 * ActiveRoleProvider (ActiveRoleContext.jsx); el contexto y el hook viven
 * aparte para que ese archivo solo exporte componentes (fast refresh).
 */
export const ActiveRoleContext = createContext(null);

export const useActiveRole = () => {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error('useActiveRole debe usarse dentro de ActiveRoleProvider');
  }
  return context;
};
