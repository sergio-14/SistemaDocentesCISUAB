// Estilo en línea de una opción de desplegable: su lugar en la cascada de entrada
// (clase desplegable-opcion). Las primeras 8 escalonadas; el resto, juntas.
export const cascada = (indice) => ({ '--i': Math.min(indice, 8) });
