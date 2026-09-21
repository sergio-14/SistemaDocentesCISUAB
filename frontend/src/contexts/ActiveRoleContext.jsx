import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ActiveRoleContext = createContext(null);

export const ROLE_LABELS = {
  iiisyp: 'Instituto de investigacion',
  director: 'Director de Carrera',
  jefe_estudios: 'Jefe de Estudios',
  docente: 'Docente',
};

const STORAGE_KEYS = {
  assignment: 'active_assignment_id',
  role: 'active_role',
  career: 'active_carrera_id',
};

const getActiveAssignments = (user) => {
  if (!user || user.is_superuser) return [];
  return (Array.isArray(user.asignaciones) ? user.asignaciones : [])
    .filter((item) => item && item.activo !== false && item.rol && item.carrera);
};

const buildEffectiveUser = (user, assignment) => {
  if (!user || !assignment) return user;

  return {
    ...user,
    active_assignment: assignment,
    perfil: {
      ...user.perfil,
      rol: assignment.rol,
      rol_display: assignment.rol_display || ROLE_LABELS[assignment.rol] || assignment.rol,
      carrera: assignment.carrera,
      carrera_nombre: assignment.carrera_nombre,
      carrera_codigo: assignment.carrera_codigo,
      docente: assignment.docente ?? user.perfil?.docente,
      docente_id: assignment.docente ?? user.perfil?.docente_id,
      docente_nombre: assignment.docente_nombre ?? user.perfil?.docente_nombre,
    },
  };
};

const findStoredAssignment = (assignments) => {
  const storedId = localStorage.getItem(STORAGE_KEYS.assignment);
  if (!storedId) return null;
  return assignments.find((item) => String(item.id) === String(storedId)) || null;
};

const persistAssignment = (assignment) => {
  if (!assignment) {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    return;
  }

  localStorage.setItem(STORAGE_KEYS.assignment, String(assignment.id));
  localStorage.setItem(STORAGE_KEYS.role, assignment.rol);
  localStorage.setItem(STORAGE_KEYS.career, String(assignment.carrera));
  localStorage.setItem('carrera_activa_id', String(assignment.carrera));
};

export const ActiveRoleProvider = ({ user, setUser, children }) => {
  const assignments = useMemo(() => getActiveAssignments(user), [user]);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [forceSelectorOpen, setForceSelectorOpen] = useState(false);

  useEffect(() => {
    if (!user || user.is_superuser) {
      setActiveAssignment(null);
      setForceSelectorOpen(false);
      return;
    }

    if (assignments.length === 0) {
      persistAssignment(null);
      setActiveAssignment(null);
      setForceSelectorOpen(false);
      return;
    }

    const stored = findStoredAssignment(assignments);
    const nextAssignment = stored || (assignments.length === 1 ? assignments[0] : null);
    setActiveAssignment(nextAssignment);

    if (nextAssignment) {
      persistAssignment(nextAssignment);
      const effectiveUser = buildEffectiveUser(user, nextAssignment);
      localStorage.setItem('user', JSON.stringify(effectiveUser));
      if (setUser && user.perfil?.rol !== nextAssignment.rol) {
        setUser(effectiveUser);
      }
    }

    setForceSelectorOpen(assignments.length > 1 && !nextAssignment);
  }, [assignments, setUser, user]);

  const selectAssignment = (assignment) => {
    if (!assignment) return;
    persistAssignment(assignment);
    setActiveAssignment(assignment);
    setForceSelectorOpen(false);

    const effectiveUser = buildEffectiveUser(user, assignment);
    localStorage.setItem('user', JSON.stringify(effectiveUser));
    setUser?.(effectiveUser);
  };

  const openRoleSelector = () => {
    if (assignments.length > 1) {
      setForceSelectorOpen(true);
    }
  };

  const closeRoleSelector = () => {
    if (activeAssignment || assignments.length <= 1) {
      setForceSelectorOpen(false);
    }
  };

  const effectiveUser = useMemo(
    () => buildEffectiveUser(user, activeAssignment),
    [activeAssignment, user]
  );

  const value = {
    assignments,
    activeAssignment,
    activeRole: activeAssignment?.rol || effectiveUser?.perfil?.rol,
    activeCareerId: activeAssignment?.carrera || effectiveUser?.perfil?.carrera,
    effectiveUser,
    hasMultipleAssignments: assignments.length > 1,
    roleSelectionRequired: Boolean(user && !user.is_superuser && assignments.length > 1 && (!activeAssignment || forceSelectorOpen)),
    selectAssignment,
    openRoleSelector,
    closeRoleSelector,
    getRoleLabel: (role) => ROLE_LABELS[role] || role || 'Usuario',
  };

  return (
    <ActiveRoleContext.Provider value={value}>
      {children}
    </ActiveRoleContext.Provider>
  );
};

export const useActiveRole = () => {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error('useActiveRole debe usarse dentro de ActiveRoleProvider');
  }
  return context;
};

