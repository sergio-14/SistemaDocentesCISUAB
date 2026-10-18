const ROLES_CREACION_FONDO_TIEMPO = ['jefe_estudios'];

export const puedeCrearFondoTiempo = (user) => {
  if (!user) return false;
  if (user.is_superuser === true) return true;

  const rol = user?.perfil?.rol;
  return ROLES_CREACION_FONDO_TIEMPO.includes(rol);
};

// Nadie revisa (aprueba, observa, inicia o evalúa) su propio fondo; el fondo del
// Director de la carrera lo revisa el superusuario con el documento de la Decanatura.
export const esRevisorDelFondo = (fondo, { rol, esSuperusuario }) => Boolean(fondo) && !fondo.es_fondo_propio && (
  fondo.es_fondo_de_director ? esSuperusuario : rol === 'director'
);

export default puedeCrearFondoTiempo;
