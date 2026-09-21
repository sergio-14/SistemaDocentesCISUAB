import { createContext, useContext } from 'react';

/**
 * Estado compartido entre todos los bloques editables del documento del
 * Informe (encabezado, datos del documento, saludo/intro, las 7 categorías,
 * cierre y firma) y la barra de formato flotante: cuál es el campo de texto
 * enriquecido con el foco en este momento (para que la barra sepa sobre qué
 * aplicar negrita/cursiva/etc.) y si el documento está en modo solo lectura.
 */
export const InformeDocumentoContext = createContext({
  campoActivo: null,
  setCampoActivo: () => {},
  soloLectura: false,
});

export const useInformeDocumento = () => useContext(InformeDocumentoContext);
