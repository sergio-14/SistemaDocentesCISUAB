// Asignaciones (rol + carrera) del modal de edición de usuario.
// Regla: el modal NUNCA inventa un rol. Una asignación sin rol no se muestra con
// un rol por defecto ni se envía. (Antes se usaba `rol || 'docente'`, y un
// Director terminó con una asignación de docente que nadie marcó.)

// Un usuario pertenece a UNA sola carrera (la de su contrato): hasta 2 roles
// (cargo + docente), siempre en esa carrera. El backend aplica la misma regla.
export const MENSAJE_UNA_SOLA_CARRERA = 'Un usuario pertenece a una sola carrera (la de su contrato): todos sus roles deben ser de esa carrera.';

// Reglas de la lista de roles (crear y editar usuario). Todos los roles van en la
// única carrera del usuario, así que basta con no repetir un rol.
export const MENSAJE_DUPLICADO = 'Este rol ya está asignado al usuario.';
export const MENSAJE_LIMITE_ASIGNACIONES = 'Un usuario no puede tener más de 2 asignaciones en el sistema (Normativa de Fondo de Tiempo).';
export const MENSAJE_AUTORIDAD_UNICA = 'Un usuario no puede tener más de un cargo de mando (Director, Jefe de Estudios o Instituto) en el sistema (Normativa UABJB).';
const MAX_ASIGNACIONES_TOTAL = 2;
// Cargos de mando: un solo cargo por usuario, y solo pueden ser docentes de su misma carrera.
export const ROLES_MANDO_UABJB = ['director', 'jefe_estudios', 'iiisyp'];

// Motivo para no agregar `rol` a los roles ya asignados, o '' si se puede.
export const motivoNoAsignarRol = (rol, asignados = []) => {
  const roles = asignados.map((item) => String(item?.rol || '').trim()).filter(Boolean);
  if (roles.includes(rol)) return MENSAJE_DUPLICADO;
  if (ROLES_MANDO_UABJB.includes(rol) && roles.some((item) => ROLES_MANDO_UABJB.includes(item))) return MENSAJE_AUTORIDAD_UNICA;
  if (roles.length >= MAX_ASIGNACIONES_TOTAL) return MENSAJE_LIMITE_ASIGNACIONES;
  return '';
};

// Nombre legible de cada campo del usuario en los mensajes de error (nunca "ci:" o "username:").
const ETIQUETAS_CAMPOS_USUARIO = {
  username: 'Usuario',
  first_name: 'Nombre',
  last_name: 'Nombre',
  nombre_completo: 'Nombre',
  ci: 'C.I.',
  email: 'Correo',
  carrera: 'Carrera',
  rol: 'Rol',
  asignaciones: 'Roles',
  docente: 'Docente',
  resolucion_jefe: 'Resolución del Jefe de Estudios',
  is_active: 'Estado',
  password: 'Contraseña',
  password_confirm: 'Contraseña',
};

// Hasta dos errores del backend con el nombre legible de su campo, p. ej.
// "C.I.: El CI ya está registrado…". Los campos sin nombre conocido van sin prefijo.
export const textoErroresUsuario = (apiErrors, fallback = 'Revisa los campos marcados en rojo.') => {
  if (!apiErrors || typeof apiErrors !== 'object') return fallback;
  if (typeof apiErrors.detail === 'string' && apiErrors.detail.trim()) return apiErrors.detail.trim();
  if (typeof apiErrors.error === 'string' && apiErrors.error.trim()) return apiErrors.error.trim();
  const partes = [];
  const vistos = new Set();
  Object.entries(apiErrors).forEach(([campo, mensajes]) => {
    (Array.isArray(mensajes) ? mensajes : [mensajes]).forEach((mensaje) => {
      const texto = typeof mensaje === 'string' ? mensaje.trim() : String(mensaje?.message || '').trim();
      if (!texto || vistos.has(texto)) return;
      vistos.add(texto);
      const etiqueta = ETIQUETAS_CAMPOS_USUARIO[campo];
      partes.push(etiqueta ? `${etiqueta}: ${texto}` : texto);
    });
  });
  return partes.slice(0, 2).join(' · ') || fallback;
};

// Designar un Jefe de Estudios exige la resolución del Consejo de Carrera en PDF.
export const MENSAJE_RESOLUCION_JEFE = 'Adjunte la resolución del Consejo de Carrera (PDF) que designa al Jefe de Estudios.';
export const esArchivoPdf = (archivo) => Boolean(archivo) && /\.pdf$/i.test(archivo.name || '');

// Con un archivo el envío va en multipart: las listas viajan como JSON y los
// valores vacíos (null/undefined) no se envían. Sin archivo, el payload no cambia.
export const cuerpoConArchivo = (payload, campo, archivo) => {
  if (!archivo) return { cuerpo: payload, config: undefined };
  const datos = new FormData();
  Object.entries(payload).forEach(([clave, valor]) => {
    if (valor === null || valor === undefined) return;
    datos.append(clave, typeof valor === 'object' ? JSON.stringify(valor) : valor);
  });
  datos.append(campo, archivo);
  return { cuerpo: datos, config: { headers: { 'Content-Type': 'multipart/form-data' } } };
};

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
const CARGOS = ['director', 'jefe_estudios', 'iiisyp'];

/**
 * Cargos (Director, Jefe de Estudios, Instituto) de un usuario, con la misma regla que
 * el backend (UsuarioViewSet._cargos_del_usuario): desactivar libera sus asignaciones,
 * así que de un usuario inactivo cuentan también las inactivas.
 */
export const cargosDelUsuario = (usuario) => {
  if (!usuario) return [];
  const roles = new Set(
    (Array.isArray(usuario.asignaciones) ? usuario.asignaciones : [])
      .filter((item) => item?.rol && (usuario.is_active === false || item.activo !== false))
      .map((item) => String(item.rol).trim())
  );
  if (usuario.perfil?.rol) roles.add(String(usuario.perfil.rol).trim());
  return CARGOS.filter((cargo) => roles.has(cargo));
};

export const asignacionesParaEnviar = (extras = []) => (
  (Array.isArray(extras) ? extras : [])
    .filter((item) => String(item?.rol || '').trim() && String(item?.carrera || '').trim())
    .map((item) => ({
      ...item,
      rol: String(item.rol).trim(),
      carrera: String(item.carrera).trim(),
    }))
);
