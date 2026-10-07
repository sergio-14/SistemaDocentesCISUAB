// Paginación de los listados del Fondo de Tiempo: 15 por página en lista y 9 en tarjetas.
export const POR_PAGINA = { lista: 15, tarjetas: 9 };

/**
 * Corta `items` en la página pedida. Si la lista se achica (filtros, eliminación), la
 * página guardada puede quedar fuera de rango: se usa la última que exista.
 */
export const paginar = (items, pagina, vista) => {
  const porPagina = POR_PAGINA[vista] || POR_PAGINA.lista;
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;
  return {
    paginaActual,
    totalPaginas,
    inicio,
    itemsPagina: items.slice(inicio, inicio + porPagina),
  };
};

// Números a mostrar: la primera, la última y las vecinas de la actual, con "…" en los saltos.
export const paginasVisibles = (actual, total) => {
  const paginas = [...new Set([1, actual - 1, actual, actual + 1, total])]
    .filter((pagina) => pagina >= 1 && pagina <= total)
    .sort((a, b) => a - b);
  return paginas.flatMap((pagina, i) => (
    i > 0 && pagina - paginas[i - 1] > 1 ? ['…', pagina] : [pagina]
  ));
};
