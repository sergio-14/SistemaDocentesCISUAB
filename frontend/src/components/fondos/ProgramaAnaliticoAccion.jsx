import ArchivoPdfAccion from './ArchivoPdfAccion';

/**
 * Programa analítico (Art. 15 y 18) de una materia en un calendario del fondo: un PDF
 * que comparten todos sus paralelos.
 */
const ProgramaAnaliticoAccion = ({ fondoId, materiaId, calendarioId, url, puedeSubir, onSubido }) => (
  <ArchivoPdfAccion
    endpoint="/programas-analiticos/"
    campos={{ fondo: fondoId, materia: materiaId, calendario: calendarioId }}
    nombre="Programa analítico"
    url={url}
    puedeSubir={puedeSubir}
    onSubido={onSubido}
  />
);

export default ProgramaAnaliticoAccion;
