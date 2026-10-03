import ArchivoPdfAccion from './ArchivoPdfAccion';

/**
 * Documento del proyecto (Arts. 14 y 16) o del curso (Arts. 17 y 20) de un ítem del fondo.
 * `clase` es 'proyecto' o 'curso' (requiere_documento del detalle).
 */
const DocumentoActividadAccion = ({ cargaId, clase, url, puedeSubir, onSubido }) => (
  <ArchivoPdfAccion
    endpoint="/documentos-actividad/"
    campos={{ carga: cargaId }}
    nombre={`Documento del ${clase}`}
    url={url}
    puedeSubir={puedeSubir}
    onSubido={onSubido}
  />
);

export default DocumentoActividadAccion;
