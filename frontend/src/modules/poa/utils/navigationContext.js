const STORAGE_KEY = 'poa.navigationContext.v1';

const NAV_KEYS = [
  'gestion',
  'gestionState',
  'documentoId',
  'documentoEstado',
  'documentoNombre',
  'documentosPath',
  'objetivoId',
  'objetivoEspecificoId',
  'objetivoNombre',
  'actividadId',
  'actividad',
  'actividadNombre',
  'retornoPoaPath',
  'retornoPoaMode',
  'fromPoaFlow',
];

const canUseSessionStorage = () => typeof window !== 'undefined' && Boolean(window.sessionStorage);

export const normalizePoaGestion = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'object'
    ? (value.id ?? value.pk ?? value.gestion ?? value.nombre ?? null)
    : value;
  if (raw === undefined || raw === null || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw;
};

export const readPoaNavigationContext = () => {
  if (!canUseSessionStorage()) return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const pickNavigationValues = (source = {}) => {
  const picked = {};
  NAV_KEYS.forEach((key) => {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') {
      picked[key] = value;
    }
  });
  const gestion = normalizePoaGestion(picked.gestion ?? picked.gestionState);
  if (gestion !== null) {
    picked.gestion = gestion;
    picked.gestionState = gestion;
  }
  if (picked.objetivoEspecificoId && !picked.objetivoId) {
    picked.objetivoId = picked.objetivoEspecificoId;
  }
  if (picked.objetivoId && !picked.objetivoEspecificoId) {
    picked.objetivoEspecificoId = picked.objetivoId;
  }
  return picked;
};

export const savePoaNavigationContext = (patch = {}) => {
  const next = {
    ...readPoaNavigationContext(),
    ...pickNavigationValues(patch),
    fromPoaFlow: true,
  };
  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // El flujo sigue funcionando con location.state si el navegador bloquea storage.
    }
  }
  return next;
};

export const replacePoaNavigationContext = (patch = {}) => {
  const next = {
    ...pickNavigationValues(patch),
    fromPoaFlow: true,
  };
  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // El flujo sigue funcionando con location.state si el navegador bloquea storage.
    }
  }
  return next;
};

export const getPoaNavigationContext = (state = {}) => {
  return pickNavigationValues({
    ...readPoaNavigationContext(),
    ...(state || {}),
  });
};

export const buildPoaNavigationState = (state = {}, patch = {}) => {
  return savePoaNavigationContext({
    ...getPoaNavigationContext(state),
    ...(patch || {}),
  });
};
