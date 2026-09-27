// Asignaciones (rol + carrera) del modal de edición de usuario.
// Regla: el modal NUNCA inventa un rol. Una asignación sin rol no se muestra con
// un rol por defecto ni se envía. (Antes se usaba `rol || 'docente'`, y un
// Director terminó con una asignación de docente que nadie marcó.)

const clave = (rol, carrera) => `${String(rol || '')}::${String(carrera || '')}`;

// Rol y carrera principales, y el segundo rol (máximo uno), a partir del usuario.
export const asignacionesIniciales = ({ asignaciones = [], perfil = null, esDirectorEditor = false, carreraIdsPermitidas = null }) => {
  const lista = Array.isArray(asignaciones) ? asignaciones : [];
  const gestionables = esDirectorEditor
    ? lista.filter((item) => (
        item?.activo !== false
        && item?.carrera
        && (!carreraIdsPermitidas || carreraIdsPermitidas.has(String(item.carrera)))
      ))
    : lista;

  const principal = esDirectorEditor ? gestionables[0] : null;
  const rolPrincipal = String((principal ? principal.rol : perfil?.rol) || '');
  const carreraPrincipal = (principal ? principal.carrera : perfil?.carrera) || '';

  const vistas = new Set([clave(rolPrincipal, carreraPrincipal)]);
  const extras = gestionables
    .filter((item) => {
      if (item?.activo === false || !item?.rol) return false;
      const k = clave(item.rol, item.carrera);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })
    .map((item) => ({ rol: item.rol, carrera: item.carrera || '', docente: item.docente || '' }))
    .slice(0, 1);

  return { rolPrincipal, carreraPrincipal, extras };
};

// Lo que se envía al backend: solo filas con rol y carrera elegidos.
export const asignacionesParaEnviar = (extras = []) => (
  (Array.isArray(extras) ? extras : [])
    .filter((item) => String(item?.rol || '').trim() && String(item?.carrera || '').trim())
    .map((item) => ({
      ...item,
      rol: String(item.rol).trim(),
      carrera: String(item.carrera).trim(),
    }))
);
