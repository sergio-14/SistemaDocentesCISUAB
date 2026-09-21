const ROLES_CREACION_FONDO_TIEMPO = ['jefe_estudios'];

export const puedeCrearFondoTiempo = (user) => {
  if (!user) return false;
  if (user.is_superuser === true) return true;

  const rol = user?.perfil?.rol;
  return ROLES_CREACION_FONDO_TIEMPO.includes(rol);
};

export default puedeCrearFondoTiempo;
