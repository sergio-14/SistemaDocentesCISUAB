import api from '../api'; // Asegúrate que la ruta a tu cliente de API sea correcta

const API_URL = '/cargas-horarias/';

/**
 * Obtiene los registros de CargaHoraria según los parámetros de consulta.
 * @param {object} params - Parámetros de consulta (ej: { docente, calendario }).
 * @returns {Promise}
 */
export const getCargasHorarias = (params) => {
  return api.get(API_URL, { params });
};

/**
 * Crea un nuevo registro de CargaHoraria.
 * @param {object} data - Los datos para el nuevo registro.
 * @returns {Promise}
 */
export const createCargaHoraria = (data) => {
  return api.post(API_URL, data);
};

/**
 * Actualiza un registro existente de CargaHoraria.
 * @param {number} id - El ID del registro a actualizar.
 * @param {object} data - Los nuevos datos.
 * @returns {Promise}
 */
export const updateCargaHoraria = (id, data) => {
  return api.patch(`${API_URL}${id}/`, data);
};

/**
 * Elimina un registro de CargaHoraria.
 * @param {number} id - El ID del registro a eliminar.
 * @returns {Promise}
 */
export const deleteCargaHoraria = (id) => {
  return api.delete(`${API_URL}${id}/`);
};