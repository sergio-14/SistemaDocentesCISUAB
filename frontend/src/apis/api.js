import axios from 'axios';
import { API_URL } from './apiConfig';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===================================
// INTERCEPTOR REQUEST - Agregar token
// ===================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeAssignmentId = localStorage.getItem('active_assignment_id');
    const activeRole = localStorage.getItem('active_role');
    const activeCareerId = localStorage.getItem('active_carrera_id');

    if (activeAssignmentId) {
      config.headers['X-Active-Assignment'] = activeAssignmentId;
    }
    if (activeRole) {
      config.headers['X-Active-Role'] = activeRole;
    }
    if (activeCareerId) {
      config.headers['X-Active-Carrera'] = activeCareerId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ===================================
// INTERCEPTOR RESPONSE - Refresh token automático
// ===================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = response.data.access;
        localStorage.setItem('access_token', newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ===================================
// ENDPOINTS - FONDOS DE TIEMPO
export const getFondosTiempo = () => api.get('/fondos-tiempo/');
export const getFondoTiempoDetalle = (id) => api.get(`/fondos-tiempo/${id}/`);
export const crearFondoTiempo = (data) => api.post('/fondos-tiempo/', data);
export const generarFondosTiempoMasivo = () => api.post('/fondos-tiempo/generar-masivo/');
export const distribuirHorasFondoTiempo = (id, data) => api.patch(`/fondos-tiempo/${id}/distribuir-horas/`, data);
export const actualizarFondoTiempo = (id, data) => api.put(`/fondos-tiempo/${id}/`, data);
export const eliminarFondoTiempo = (id) => api.delete(`/fondos-tiempo/${id}/`);
export const getFondosLargoPlazo = () => api.get('/fondos-tiempo/largo-plazo/');

// Acciones de estado
export const presentarFondoADirector = (fondoId) => {
  return api.patch(`/fondos-tiempo/${fondoId}/presentar-a-director/`);
};
export const presentarFondo = (id, observacion = '') => 
  api.post(`/fondos-tiempo/${id}/presentar/`, { observacion });
export const aprobarFondo = (fondoId) => {
  return api.post(`/fondos-tiempo/${fondoId}/aprobar/`);
};
export const observarFondo = (fondoId, data) => api.post(`/fondos-tiempo/${fondoId}/observar/`, data);

// Informe de cumplimiento: borrador / previsualizar / enviar / observar
export const guardarInformeBorrador = (fondoId, secciones) =>
  api.patch(`/fondos-tiempo/${fondoId}/guardar-informe-borrador/`, secciones);
export const observarInforme = (fondoId, comentario) =>
  api.post(`/fondos-tiempo/${fondoId}/observar-informe/`, { comentario });

export const cambiarEstadoFondo = (id, estado, comentarios = '') => 
  api.post(`/fondos-tiempo/${id}/cambiar_estado/`, { estado, comentarios });
export const agregarComentarioFondo = (id, comentario) => 
  api.post(`/fondos-tiempo/${id}/agregar_comentario/`, { comentario });


// Comparación
export const compararFondos = (docente, gestion1, gestion2) =>
  api.get(`/fondos-tiempo/comparar/?docente=${docente}&gestion1=${gestion1}&gestion2=${gestion2}`);

// Archivados
export const getFondosArchivados = () => api.get('/fondos-tiempo/archivados/');
export const restaurarFondo = (id) => api.post(`/fondos-tiempo/${id}/restaurar/`);

// ===================================
// ENDPOINTS - DOCENTES Y CARRERAS
// ===================================
export const getDocentes = (params) => api.get('/docentes/', { params });
export const getCarreras = () => api.get('/carreras/');
export const getMaterias = (params) => api.get('/materias/', { params });
export const getFacultadesCarrera = () => api.get('/carreras/facultades/');
export const addFacultadCarrera = (value) => api.post('/carreras/facultades/agregar/', { value });
export const deleteFacultadCarrera = (value) => api.post('/carreras/facultades/eliminar/', { value });

// ===================================
// ENDPOINTS - USUARIOS
// ===================================
export const getUsuarioActual = () => api.get('/usuario/');
export const uploadProfilePicture = (file) => {
  const formData = new FormData();
  formData.append('foto_perfil', file);
  return api.patch('/perfil/foto/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
export const deleteProfilePicture = () => {
  return api.patch('/perfil/foto/', { foto_perfil: null });
};

// ===================================
// ENDPOINTS - CALENDARIOS ACADÉMICOS
// ===================================
export const getCalendarios = () => api.get('/calendarios/');
export const getCalendarioActivo = () => api.get('/calendarios/activo/');
export const getCalendarioDetalle = (id) => api.get(`/calendarios/${id}/`);
export const crearCalendario = (data) => api.post('/calendarios/', data);
export const actualizarCalendario = (id, data) => api.put(`/calendarios/${id}/`, data);
export const eliminarCalendario = (id) => api.delete(`/calendarios/${id}/`);

// ===================================
// ENDPOINTS - CATEGORÍAS Y ACTIVIDADES
// ===================================
export const getCategorias = () => api.get('/categorias/');
export const getCategoriasPorFondo = (fondoId) => 
  api.get('/categorias/', { params: { fondo_tiempo: fondoId } });
export const crearCategoria = (data) => api.post('/categorias/', data);
export const actualizarCategoria = (id, data) => api.put(`/categorias/${id}/`, data);
export const eliminarCategoria = (id) => api.delete(`/categorias/${id}/`);

export const getActividades = () => api.get('/actividades/');
export const getActividadesPorCategoria = (categoriaId) => 
  api.get('/actividades/', { params: { categoria: categoriaId } });
export const crearActividad = (data) => api.post('/actividades/', data);
export const actualizarActividad = (id, data) => api.put(`/actividades/${id}/`, data);
export const eliminarActividad = (id) => api.delete(`/actividades/${id}/`);

// ===================================
// ENDPOINTS - PROYECTOS
// ===================================
export const getProyectos = () => api.get('/proyectos/');
export const getProyectoDetalle = (id) => api.get(`/proyectos/${id}/`);
export const getProyectosPorFondo = (fondoId) => 
  api.get('/proyectos/', { params: { fondo_tiempo: fondoId } });
export const crearProyecto = (data) => api.post('/proyectos/', data);
export const actualizarProyecto = (id, data) => api.put(`/proyectos/${id}/`, data);
export const eliminarProyecto = (id) => api.delete(`/proyectos/${id}/`);
export const cambiarEstadoProyecto = (id, estado) => 
  api.post(`/proyectos/${id}/cambiar_estado/`, { estado });

// ===================================
// ENDPOINTS - OBSERVACIONES
// ===================================
export const getObservaciones = () => api.get('/observaciones/');
export const getObservacionDetalle = (id) => api.get(`/observaciones/${id}/`);
export const getObservacionesPorFondo = (fondoId, options = {}) => {
  const params = { fondo_tiempo: fondoId };
  if (options.marcarLeido) params.marcar_leido = true;
  return api.get('/observaciones/', { params });
};
export const agregarMensajeObservacion = (observacionId, texto, respondeA = null, esInterno = false) => {
  const payload = { texto };
  if (respondeA) payload.responde_a = respondeA;
  if (esInterno) payload.es_interno = true;
  return api.post(`/observaciones/${observacionId}/agregar-mensaje/`, payload);
};

// ===================================
// ENDPOINTS - EVIDENCIAS DE CARGA HORARIA (actividades en ejecucion)
// ===================================
export const getEvidenciasCargaHoraria = (cargaHorariaId) => {
  return api.get('/evidencias-carga-horaria/', { params: { carga_horaria: cargaHorariaId } });
};

export const subirEvidenciaCargaHoraria = (cargaHorariaId, archivo, descripcion = '') => {
  const formData = new FormData();
  formData.append('carga_horaria', cargaHorariaId);
  formData.append('archivo', archivo);
  if (descripcion) formData.append('descripcion', descripcion);
  return api.post('/evidencias-carga-horaria/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const eliminarEvidenciaCargaHoraria = (evidenciaId) => {
  return api.delete(`/evidencias-carga-horaria/${evidenciaId}/`);
};

export const getTypingObservacionFondo = (fondoId) => {
  return api.get('/observaciones/typing-status/', { params: { fondo_tiempo: fondoId } });
};

export const setTypingObservacionFondo = (fondoId, escribiendo) => {
  return api.post('/observaciones/typing-status/', { fondo_tiempo: fondoId, escribiendo });
};

export const marcarObservacionResuelta = (observacionId) => {
  return api.post(`/observaciones/${observacionId}/marcar-resuelta/`);
};
export const crearObservacion = (data) => api.post('/observaciones/', data);
export const actualizarObservacion = (id, data) => api.put(`/observaciones/${id}/`, data);
export const eliminarObservacion = (id) => api.delete(`/observaciones/${id}/`);
export const resolverObservacion = (id, respuesta) => 
  api.post(`/observaciones/${id}/resolver/`, { respuesta });
export const responderObservacion = (id, respuesta) => 
  api.patch(`/observaciones/${id}/responder/`, { respuesta });

// ===================================
// ENDPOINTS - HISTORIAL (Solo lectura)
// ===================================
export const getHistorial = () => api.get('/historial/');
export const getHistorialDetalle = (id) => api.get(`/historial/${id}/`);
export const getHistorialPorFondo = (fondoId) => 
  api.get('/historial/', { params: { fondo_tiempo: fondoId } });

// ===================================
// ENDPOINTS - INFORMES
// ===================================
export const getInformes = () => api.get('/informes/');
export const getInformeDetalle = (id) => api.get(`/informes/${id}/`);
export const getInformesPorFondo = (fondoId) => 
  api.get('/informes/', { params: { fondo_tiempo: fondoId } });
export const crearInforme = (data) => api.post('/informes/', data);
export const actualizarInforme = (id, data) => api.put(`/informes/${id}/`, data);
export const eliminarInforme = (id) => api.delete(`/informes/${id}/`);
export const evaluarInforme = (id, cumplimiento, evaluacion) => 
  api.post(`/informes/${id}/evaluar/`, { cumplimiento, evaluacion_director: evaluacion });

export default api;
