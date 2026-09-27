// Modo solo lectura cuando la carrera activa del usuario está desactivada.
// El backend es quien bloquea de verdad (fondos/solo_lectura.py); aquí se avisa
// en pantalla y se evita enviar escrituras que igual serían rechazadas.

export const MENSAJE_CARRERA_INACTIVA = 'La carrera está inactiva: sus datos son de solo lectura.';

const CLAVE = 'carrera_solo_lectura';

// Escrituras que no son datos de la carrera: sesión, contraseña, foto y chat.
const RUTAS_PERMITIDAS = [/token/, /\/auth\//, /perfil\/foto/, /cambiar-password/, /mensajes-chat/, /typing-status/];

export const setCarreraSoloLectura = (activo) => {
  try {
    if (activo) localStorage.setItem(CLAVE, '1');
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento el backend sigue bloqueando; solo se pierde el aviso previo.
  }
};

export const esCarreraSoloLectura = () => {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
};

// Interceptor de axios: rechaza la escritura con la misma forma que un 403 del backend.
export const bloquearEscrituraSiSoloLectura = (config) => {
  const metodo = String(config.method || 'get').toLowerCase();
  if (['get', 'head', 'options'].includes(metodo) || !esCarreraSoloLectura()) {
    return config;
  }
  const url = String(config.url || '');
  if (RUTAS_PERMITIDAS.some((ruta) => ruta.test(url))) {
    return config;
  }
  return Promise.reject({
    config,
    message: MENSAJE_CARRERA_INACTIVA,
    response: { status: 403, data: { detail: MENSAJE_CARRERA_INACTIVA } },
  });
};
