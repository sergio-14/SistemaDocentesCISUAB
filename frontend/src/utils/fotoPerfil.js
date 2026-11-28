import imagenSinCarrera from '../assets/logoPre.jpg';

// Foto que se muestra cuando el usuario no subió la suya: el logo de su carrera activa (el que
// se cargó al crear la carrera) y, sin carrera o si la carrera no tiene logo, la de Sistemas.
export const fotoPredeterminada = (user) => (
  user?.logos_carrera?.[String(user?.perfil?.carrera)] || imagenSinCarrera
);

export { imagenSinCarrera };
