import api from '../apis/api';

// Informe de gestión de la carrera (Arts. 19 y 28): PDF que descargan el Director de la
// carrera y el superusuario. Lo usan el Dashboard del Director y la página del menú.
export const descargarInformeGestion = async (carreraId, gestion, codigoCarrera) => {
  const response = await api.get(`/carreras/${carreraId}/informe-gestion/`, {
    params: { gestion },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `Informe_gestion_${codigoCarrera || carreraId}_${gestion}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
};
