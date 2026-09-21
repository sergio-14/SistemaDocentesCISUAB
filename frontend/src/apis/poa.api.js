// API centralizado para POA
import axios from 'axios';
import { API_BASE_URL } from './apiConfig';

export const API_BASE = API_BASE_URL;

// Cliente axios centralizado
const api = axios.create({ baseURL: API_BASE, withCredentials: true });

api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('access_token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

// Helper: rechazar como si fuera un error axios con response.status = 400
const badRequest = (data) => Promise.reject({ response: { status: 400, data } });

api.interceptors.response.use(
	(r) => r,
	async (error) => {
		const originalRequest = error?.config;

		if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
			originalRequest._retry = true;

			try {
				const refreshToken = localStorage.getItem('refresh_token');
				if (!refreshToken) {
					sessionStorage.setItem('post_login_redirect', window.location.pathname + window.location.search + window.location.hash);
					localStorage.clear();
					window.location.href = '/login';
					return Promise.reject(error);
				}

				const response = await axios.post(`${API_BASE}/api/token/refresh/`, {
					refresh: refreshToken,
				});

				const newAccessToken = response.data.access;
				localStorage.setItem('access_token', newAccessToken);
				originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
				return api(originalRequest);
			} catch (refreshError) {
				sessionStorage.setItem('post_login_redirect', window.location.pathname + window.location.search + window.location.hash);
				localStorage.clear();
				window.location.href = '/login';
				return Promise.reject(refreshError);
			}
		}

		return Promise.reject(error);
	}
);

// Programas POA (cada usuario solo consulta los de su propia carrera)
export const getProgramasPOA = (params = {}) => api.get('/api/poa/programas/', { params });
export const createProgramaPOA = (payload) => api.post('/api/poa/programas/', payload);
export const updateProgramaPOA = (id, payload) => api.patch(`/api/poa/programas/${id}/`, payload);
export const deleteProgramaPOA = (id) => api.delete(`/api/poa/programas/${id}/`);

// Documentos POA
// Encabezados (solo lectura). Si no envías gestion, el backend devuelve la del año actual.
export const getDocumentosPOAEncabezados = (gestion) => api.get('/api/poa/documentos_poa_encabezados/', { params: { gestion } });

// Lista de documentos filtrados por gestion (gestion obligatorio)
export const getDocumentosPOAPorGestion = (gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/poa/documentos_poa/', { params: { gestion: Number(gestion) } });
};

// Recuperar detalle de un documento (requiere ?gestion=YYYY)
export const getDocumentoPOAPorId = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/`, { params: { gestion: Number(gestion) } });
};

// Obtener árbol (documento + objetivos + actividades + detalle_presupuesto)
export const getDocumentoPOATree = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/tree/`, { params: { gestion: Number(gestion) } });
};

// Compatibilidad: antigua función que listaba encabezados
export const getAllDocumentosPOA = (gestion) => getDocumentosPOAEncabezados(gestion);

// CRUD Documentos
export const createDocumentoPOA = (payload) => {
	// Validaciones mínimas en cliente
	if (!payload || (payload.gestion === undefined || payload.gestion === null || Number.isNaN(Number(payload.gestion)))) {
		return badRequest({ gestion: ['El campo "gestion" es obligatorio y debe ser un entero.'] });
	}
	// payload debe contener al menos unidad_solicitante_id y programa en el servidor; aquí no forzamos todo
	return api.post('/api/poa/documentos_poa/', payload);
};

export const updateDocumentoPOA = (id, payload, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.patch(`/api/poa/documentos_poa/${id}/`, payload, { params: { gestion: Number(gestion) } });
};

export const deleteDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.delete(`/api/poa/documentos_poa/${id}/`, { params: { gestion: Number(gestion) } });
};

export const getHistorialDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion))) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio.'] });
	}
	return api.get(`/api/poa/documentos_poa/${id}/historial/`, { params: { gestion: Number(gestion) } });
};

export const enviarRevisionDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.post(`/api/poa/documentos_poa/${id}/enviar-revision/`, {}, { params: { gestion: Number(gestion) } });
};

export const aprobarDocumentoPOA = (id, gestion, observacion = '') => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	const payload = observacion ? { observacion } : {};
	return api.post(`/api/poa/documentos_poa/${id}/aprobar/`, payload, { params: { gestion: Number(gestion) } });
};

export const observarDocumentoPOA = (id, gestion, observaciones) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parámetro "gestion" es obligatorio y debe ser un entero.'] });
	}
	if (!observaciones || !String(observaciones).trim()) {
		return badRequest({ observaciones: ['Debe registrar observaciones para marcar como observado.'] });
	}
	return api.post(`/api/poa/documentos_poa/${id}/observar/`, { observaciones: String(observaciones).trim() }, { params: { gestion: Number(gestion) } });
};

export const iniciarEjecucionDocumentoPOA = (id, gestion) => {
	if (gestion === undefined || gestion === null || Number.isNaN(Number(gestion)) ) {
		return badRequest({ gestion: ['El parametro "gestion" es obligatorio y debe ser un entero.'] });
	}
	return api.post(`/api/poa/documentos_poa/${id}/iniciar-ejecucion/`, {}, { params: { gestion: Number(gestion) } });
};

export const getSeguimientoPOA = (gestion) =>
	api.get('/api/poa/documentos_poa/seguimiento/', { params: { gestion: Number(gestion) } });

export const actualizarEstadoActividadPOA = (id, payload) =>
	api.post(`/api/poa/actividades/${id}/actualizar-estado/`, payload);

export const getSeguimientoActividadPOA = (id) => api.get(`/api/poa/actividades/${id}/seguimiento/`);
export const getVersionesDocumentoPOA = (id, gestion) => api.get(`/api/poa/documentos_poa/${id}/versiones/`, { params: { gestion: Number(gestion) } });

export const getConsolidadoRequerimientosPOA = (params) => api.get('/api/poa/consolidado-requerimientos/', { params });
export const descargarConsolidadoRequerimientosExcelPOA = (params) =>
	api.get('/api/poa/consolidado-requerimientos/', { params: { ...params, formato: 'excel' }, responseType: 'blob' });
export const getOrdenesCompraPOA = (params = {}) => api.get('/api/poa/ordenes-compra/', { params });
export const crearOrdenCompraPOA = (payload) => api.post('/api/poa/ordenes-compra/', payload);
export const registrarRecepcionMaterialPOA = (payload) => api.post('/api/poa/recepciones-material/', payload);
export const registrarEntregaMaterialPOA = (payload) => api.post('/api/poa/entregas-material/', payload);
export const anularMovimientoMaterialPOA = (tipo, id, motivo) => api.post(`/api/poa/materiales/${tipo}/${id}/anular/`, { motivo });
export const getTableroPOA = (params = {}) => api.get('/api/poa/tablero/', { params });
export const getBandejaSeguimientoPOA = (params = {}) => api.get('/api/poa/seguimiento/bandeja/', { params });
export const getDetalleSeguimientoProgramaPOA = (id) => api.get(`/api/poa/seguimiento/programas/${id}/`);

export const crearSolicitudCambioPOA = (payload) => {
	if (!payload || payload.documento === undefined || payload.documento === null || Number.isNaN(Number(payload.documento))) {
		return badRequest({ documento: ['El campo "documento" es obligatorio.'] });
	}
	return api.post('/api/poa/solicitudes-cambio/', payload);
};

export const aprobarSolicitudCambioPOA = (id, respuesta = '') =>
	api.post(`/api/poa/solicitudes-cambio/${id}/aprobar/`, { respuesta });

export const rechazarSolicitudCambioPOA = (id, respuesta = '') =>
	api.post(`/api/poa/solicitudes-cambio/${id}/rechazar/`, { respuesta });

export const updateObservacionDocumentoPOA = (id, payload) =>
	api.patch(`/api/poa/observaciones-documento/${id}/`, payload);

// Los PDF se cargan mediante FullscreenPDFViewer. Solo Excel se descarga directamente.
export const descargarSeguimientoGeneralExcelPOA = (gestion) =>
	api.get('/api/poa/reportes/seguimiento-institucional/', {
		params: { gestion: Number(gestion), formato: 'excel' },
		responseType: 'blob',
	});

// Objetivos específicos
export const getObjetivosEspecificos = (documento_id) => {
	if (documento_id === undefined || documento_id === null || Number.isNaN(Number(documento_id))) {
		return badRequest({ documento_id: ['El parámetro "documento_id" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/poa/objetivos-especificos/', { params: { documento_id: Number(documento_id) } });
};

export const createObjetivoEspecifico = (payload) => {
	if (!payload || payload.documento_id === undefined || payload.documento_id === null || Number.isNaN(Number(payload.documento_id))) {
		return badRequest({ documento_id: ['El campo "documento_id" es obligatorio y debe ser un entero.'] });
	}
	if (!payload.codigo || !payload.descripcion) {
		return badRequest({ detail: ['Los campos "codigo" y "descripcion" son obligatorios.'] });
	}
	return api.post('/api/poa/objetivos-especificos/', payload);
};
export const getObjetivoPorId = (id) => api.get(`/api/poa/objetivos-especificos/${id}/`);
export const updateObjetivo = (id, payload) => api.patch(`/api/poa/objetivos-especificos/${id}/`, payload);
export const deleteObjetivo = (id) => api.delete(`/api/poa/objetivos-especificos/${id}/`);

// Actividades
export const getActividadesPorObjetivo = (objetivo_id, documento_id) => {
	if (objetivo_id === undefined || objetivo_id === null || Number.isNaN(Number(objetivo_id))) {
		return badRequest({ objetivo_id: ['El parámetro "objetivo_id" es obligatorio y debe ser un entero.'] });
	}
	const params = { objetivo_id: Number(objetivo_id) };
	if (documento_id !== undefined && documento_id !== null) params.documento_id = Number(documento_id);
	return api.get('/api/poa/actividades/', { params });
};

export const createActividad = (payload) => {
	if (!payload || payload.objetivo_id === undefined || payload.objetivo_id === null || Number.isNaN(Number(payload.objetivo_id))) {
		return badRequest({ objetivo_id: ['El campo "objetivo_id" es obligatorio y debe ser un entero.'] });
	}
	if (!payload.codigo || !payload.nombre) {
		return badRequest({ detail: ['Los campos "codigo" y "nombre" son obligatorios.'] });
	}
	return api.post('/api/poa/actividades/', payload);
};
export const getActividadPorId = (id) => api.get(`/api/poa/actividades/${id}/`);
export const updateActividad = (id, payload) => api.patch(`/api/poa/actividades/${id}/`, payload);
export const deleteActividad = (id) => api.delete(`/api/poa/actividades/${id}/`);

// Actions sobre actividades
export const asignarCatalogoActividad = (id, catalogo_id) => api.patch(`/api/poa/actividades/${id}/asignar_catalogo/`, { catalogo_id });
export const asignarIndicadorActividad = (id, indicador_id) => api.patch(`/api/poa/actividades/${id}/asignar_indicador/`, { indicador_id });

// Detalle presupuesto
export const getDetallePresupuestoPorActividad = (actividad_id, documento_id) => {
	if (actividad_id === undefined || actividad_id === null || Number.isNaN(Number(actividad_id))) {
		return badRequest({ actividad_id: ['El parámetro "actividad_id" es obligatorio y debe ser un entero.'] });
	}
	const params = { actividad_id: Number(actividad_id) };
	if (documento_id !== undefined && documento_id !== null) params.documento_id = Number(documento_id);
	return api.get('/api/poa/detalle-presupuesto/', { params });
};

export const createDetallePresupuesto = (payload) => {
	const required = ['actividad_id','partida','item','cantidad','costo_unitario','mes_requerimiento'];
	if (!payload) return badRequest({ detail: ['Payload vacío.'] });
	for (const f of required) {
		if (payload[f] === undefined || payload[f] === null || (typeof payload[f] === 'string' && payload[f].trim() === '')) {
			return badRequest({ [f]: [`El campo "${f}" es obligatorio.`] });
		}
	}

	// cantidad debe ser entero
	const cantidadNum = Number(payload.cantidad);
	if (Number.isNaN(cantidadNum) || !Number.isFinite(cantidadNum) || !Number.isInteger(cantidadNum)) {
		return badRequest({ cantidad: ['El campo "cantidad" debe ser un entero.'] });
	}
	return api.post('/api/poa/detalle-presupuesto/', payload);
};
export const getDetallePorId = (id) => api.get(`/api/poa/detalle-presupuesto/${id}/`);
export const updateDetalle = (id, payload) => api.patch(`/api/poa/detalle-presupuesto/${id}/`, payload);
export const deleteDetalle = (id) => api.delete(`/api/poa/detalle-presupuesto/${id}/`);


// Catálogos internos del módulo POA
// Items
// `params` es opcional; permite filtrar por partida_id, search, etc.
export const getCatalogoItems = (params) => api.get('/api/poa/catalogos/items/', { params });
// Nuevo endpoint específico para autocompletes/consultas de catálogo usado por el modal
// Endpoint: /api/poa/catalogos/items-catalogo/
export const getItemsCatalogo = (params) => api.get('/api/poa/catalogos/items-catalogo/', { params });
export const getCatalogoItemPorId = (id) => api.get(`/api/poa/catalogos/items/${id}/`);
export const createCatalogoItem = (payload) => api.post('/api/poa/catalogos/items/', payload);
export const updateCatalogoItem = (id, payload) => api.patch(`/api/poa/catalogos/items/${id}/`, payload);
export const deleteCatalogoItem = (id) => api.delete(`/api/poa/catalogos/items/${id}/`);
export const importarCatalogoItemsExcel = (formData) =>
	api.post('/api/poa/catalogos/items/importar-excel/', formData);
export const descargarCatalogoItemsExcel = (options = {}) =>
	api.get('/api/poa/catalogos/items-catalogo/exportar-excel/', {
		responseType: 'blob',
		...options,
	});

// Partidas presupuestarias
// Endpoint: GET /api/poa/catalogos/partidas/
export const getCatalogoPartidas = () => api.get('/api/poa/catalogos/partidas/');

// Indicadores planos para POA (catálogo nuevo de una sola columna)
export const getIndicadoresCatalogo = (params) => api.get('/api/poa/catalogos/indicadores/', { params });
export const getIndicadorCatalogoPorId = (id) => api.get(`/api/poa/catalogos/indicadores/${id}/`);
export const createIndicadorCatalogo = (payload) => api.post('/api/poa/catalogos/indicadores/', payload);
export const updateIndicadorCatalogo = (id, payload) => api.patch(`/api/poa/catalogos/indicadores/${id}/`, payload);
export const deleteIndicadorCatalogo = (id) => api.delete(`/api/poa/catalogos/indicadores/${id}/`);
export const importarIndicadoresExcel = (formData) => api.post('/api/poa/catalogos/indicadores/importar-excel/', formData);
export const searchIndicadoresCatalogo = (q) => api.get('/api/poa/catalogos/indicadores-catalogo/', { params: { search: q } });

// ─── Usuarios POA ─────────────────────────────────────────────────────────────
// Gestión de accesos al módulo POA (docentes con roles asignados)

export const getUsuariosPOA = (params) => api.get('/api/poa/usuarios-poa/', { params });
export const getUsuarioPOAPorId = (id) => api.get(`/api/poa/usuarios-poa/${id}/`);
export const createUsuarioPOA = (payload) => api.post('/api/poa/usuarios-poa/', payload);
export const updateUsuarioPOA = (id, payload) => api.patch(`/api/poa/usuarios-poa/${id}/`, payload);
export const deleteUsuarioPOA = (id) => api.delete(`/api/poa/usuarios-poa/${id}/`);

// Buscar usuarios del sistema principal (User) por nombre, username o email
export const buscarUsuariosSistema = (q) => {
	if (!q || String(q).trim().length < 2) return Promise.resolve({ data: [] });
	return api.get('/api/poa/usuarios/buscar/', { params: { q: String(q).trim() } });
};

// Director de carrera de la carrera activa del usuario autenticado
export const getDirectorCarreraActual = () => api.get('/api/poa/director-carrera-actual/');

// Buscar docentes del sistema principal para asignar
export const buscarDocentesPOA = (q) => {
	if (!q || String(q).trim().length < 2) return Promise.resolve({ data: [] });
	return api.get('/api/poa/docentes/buscar/', { params: { q: String(q).trim() } });
};

export const ROL_POA_CHOICES = [
	{ value: 'elaborador',       label: 'Elaborador del POA',    color: 'blue' },
];

// ─── Chat directo independiente (por usuario) ───────────────────────────────

export const getChatContactosPOA = () =>
	api.get('/api/poa/chat-contactos/');

export const buscarUsuariosChatPOA = (q) => {
	if (!q || String(q).trim().length < 2) return Promise.resolve({ data: [] });
	return api.get('/api/poa/usuarios-chat/buscar/', { params: { q: String(q).trim() } });
};

export const getMensajesChatPOA = (peerUserId) =>
	api.get('/api/poa/mensajes-chat/', { params: { peer_user_id: peerUserId } });

export const getCurrentUserPOA = () => api.get('/api/poa/me/');

export const enviarMensajeChatPOA = (destinatarioId, texto) =>
	api.post('/api/poa/mensajes-chat/', {
		receptor: destinatarioId,
		texto,
	});

export const vaciarChatPOA = (peerUserId) =>
	api.delete('/api/poa/mensajes-chat/vaciar/', { data: { peer_user_id: peerUserId } });

export const getEstadoBloqueoChatPOA = (peerUserId) =>
	api.get('/api/poa/mensajes-chat/bloqueo-estado/', { params: { peer_user_id: peerUserId } });

export const bloquearUsuarioChatPOA = (peerUserId) =>
	api.post('/api/poa/mensajes-chat/bloquear/', { peer_user_id: peerUserId });

export const desbloquearUsuarioChatPOA = (peerUserId) =>
	api.post('/api/poa/mensajes-chat/desbloquear/', { peer_user_id: peerUserId });

// Evidencias de actividades
export const getEvidenciasPorActividad = (actividad_id) => {
	if (actividad_id === undefined || actividad_id === null || Number.isNaN(Number(actividad_id))) {
		return badRequest({ actividad_id: ['El parámetro "actividad_id" es obligatorio y debe ser un entero.'] });
	}
	return api.get('/api/poa/evidencias/', { params: { actividad_id: Number(actividad_id) } });
};

export const crearEvidencia = (payload) => {
	// payload puede ser FormData o un JSON simple; preferimos FormData cuando haya archivos
	if (payload instanceof FormData) {
		return api.post('/api/poa/evidencias/', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
	}
	return api.post('/api/poa/evidencias/', payload);
};

export const updateEvidencia = (id, payload) => {
	if (id === undefined || id === null || Number.isNaN(Number(id))) {
		return badRequest({ id: ['El parámetro "id" es obligatorio y debe ser un entero.'] });
	}
	if (payload instanceof FormData) {
		return api.patch(`/api/poa/evidencias/${id}/`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
	}
	return api.patch(`/api/poa/evidencias/${id}/`, payload);
};

export const deleteEvidencia = (id) => {
	if (id === undefined || id === null || Number.isNaN(Number(id))) {
		return badRequest({ id: ['El parámetro "id" es obligatorio y debe ser un entero.'] });
	}
	return api.delete(`/api/poa/evidencias/${id}/`);
};
