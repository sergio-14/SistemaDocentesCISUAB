const ROLES_CREACION_FONDO_TIEMPO = ['jefe_estudios'];

// Crear y editar fondos es tarea de Jefatura de Estudios: el superusuario no tiene rol de
// carrera y los ve en solo lectura (como lo exige el backend).
export const puedeCrearFondoTiempo = (user) => {
  if (!user || user.is_superuser === true) return false;

  const rol = user?.perfil?.rol;
  return ROLES_CREACION_FONDO_TIEMPO.includes(rol);
};

// Nadie revisa (aprueba, observa, inicia o evalúa) su propio fondo; el fondo del
// Director de la carrera lo revisa el superusuario con el documento de la Decanatura.
export const esRevisorDelFondo = (fondo, { rol, esSuperusuario }) => Boolean(fondo) && !fondo.es_fondo_propio && (
  fondo.es_fondo_de_director ? esSuperusuario : rol === 'director'
);

export default puedeCrearFondoTiempo;
