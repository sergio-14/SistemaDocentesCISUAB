/**
 * Conexión de tiempo real (WebSocket /ws/tiempo-real/, servicio "realtime"): una sola
 * por pestaña. Protocolo en backend/fondos/consumers.py.
 *
 * - Se autentica con el JWT en el primer mensaje y con la asignación del rol activo.
 * - Reintenta con espera creciente (1 s a 30 s, con algo de azar para que no se
 *   reconecten todos a la vez tras un despliegue) y manda ping cada 25 s.
 * - Si el servidor cierra por token vencido (4401), lo renueva con la función que se
 *   pasa a iniciar() (/token/refresh/) y se reconecta; si no se puede, se detiene (la
 *   API llevará al login).
 * - Los chats suscritos se vuelven a pedir al reconectar.
 * - VITE_TIEMPO_REAL=false lo apaga: no abre el socket y las pantallas consultan
 *   como antes (ver useConsultaConRespaldo).
 */
export const TIEMPO_REAL_HABILITADO = import.meta.env?.VITE_TIEMPO_REAL !== 'false';

const CIERRE_NO_AUTENTICADO = 4401;
const CIERRE_ASIGNACION_AJENA = 4403;
const PING_MS = 25000;
const ESPERA_PONG_MS = 10000;
const REINTENTO_MIN_MS = 1000;
const REINTENTO_MAX_MS = 30000;

const oyentes = new Map(); // tipo de mensaje -> Set(handler)
const oyentesEstado = new Set();
const chatsSuscritos = new Set();

let socket = null;
let conectado = false;
let activa = false; // iniciar() sin detener()
let intentos = 0;
let temporizadorReintento = null;
let temporizadorPing = null;
let temporizadorPong = null;
let renovarToken = async () => false;

const urlSocket = () => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/tiempo-real/`;

const cambiarEstado = (valor) => {
  if (conectado === valor) return;
  conectado = valor;
  oyentesEstado.forEach((oyente) => oyente(valor));
};

const enviar = (datos) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(datos));
};

const limpiarTemporizadores = () => {
  window.clearTimeout(temporizadorReintento);
  window.clearInterval(temporizadorPing);
  window.clearTimeout(temporizadorPong);
  temporizadorReintento = null;
  temporizadorPing = null;
  temporizadorPong = null;
};

const programarReintento = () => {
  if (!activa || temporizadorReintento) return;
  const base = Math.min(REINTENTO_MAX_MS, REINTENTO_MIN_MS * 2 ** intentos);
  intentos += 1;
  temporizadorReintento = window.setTimeout(() => {
    temporizadorReintento = null;
    abrir();
  }, base / 2 + Math.random() * base / 2);
};

const alRecibir = (evento) => {
  let mensaje;
  try {
    mensaje = JSON.parse(evento.data);
  } catch {
    return;
  }
  if (mensaje.tipo === 'pong') {
    window.clearTimeout(temporizadorPong);
    return;
  }
  if (mensaje.tipo === 'listo') {
    intentos = 0;
    cambiarEstado(true);
    chatsSuscritos.forEach((fondo) => enviar({ tipo: 'suscribir_chat', fondo }));
  }
  oyentes.get(mensaje.tipo)?.forEach((oyente) => oyente(mensaje));
};

const alCerrar = async (evento) => {
  limpiarTemporizadores();
  socket = null;
  cambiarEstado(false);
  if (!activa) return;
  if (evento.code === CIERRE_ASIGNACION_AJENA) return; // espera a que cambie el rol activo
  // Sin reiniciar la espera: si el servidor sigue rechazando, los reintentos se espacian.
  if (evento.code === CIERRE_NO_AUTENTICADO && !(await renovarToken())) return;
  programarReintento();
};

function abrir() {
  const token = localStorage.getItem('access_token');
  if (!activa || socket || !token) return;
  try {
    socket = new WebSocket(urlSocket());
  } catch {
    socket = null;
    programarReintento();
    return;
  }
  socket.onopen = () => {
    const asignacion = Number(localStorage.getItem('active_assignment_id')) || null;
    enviar({ tipo: 'auth', token, asignacion });
    temporizadorPing = window.setInterval(() => {
      enviar({ tipo: 'ping' });
      // Sin pong a tiempo, la conexión está muerta aunque el navegador no lo sepa.
      temporizadorPong = window.setTimeout(() => socket?.close(), ESPERA_PONG_MS);
    }, PING_MS);
  };
  socket.onmessage = alRecibir;
  socket.onclose = alCerrar;
}

const cerrar = () => {
  limpiarTemporizadores();
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  cambiarEstado(false);
};

/**
 * Abre la conexión (al haber sesión). `renovar`: async () => true si renovó el token
 * de acceso (lo deja en localStorage), false si no se pudo.
 */
export function iniciar({ renovar } = {}) {
  if (!TIEMPO_REAL_HABILITADO) return;
  if (renovar) renovarToken = renovar;
  activa = true;
  intentos = 0;
  abrir();
}

/** Cierra y no reintenta (al cerrar sesión). */
export function detener() {
  activa = false;
  cerrar();
}

/** Se reconecta con el rol activo actual (al cambiar de rol o carrera). */
export function reiniciar() {
  if (!activa) return;
  cerrar();
  intentos = 0;
  abrir();
}

export const estaConectado = () => conectado;

/** Escucha un tipo de mensaje ('aviso', 'chat', 'listo', ...). Devuelve cómo dejar de escuchar. */
export function escuchar(tipo, oyente) {
  if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
  oyentes.get(tipo).add(oyente);
  return () => oyentes.get(tipo)?.delete(oyente);
}

/** Avisa cada cambio de conectado/desconectado. Devuelve cómo dejar de escuchar. */
export function escucharEstado(oyente) {
  oyentesEstado.add(oyente);
  return () => oyentesEstado.delete(oyente);
}

/** Recibir el chat de un fondo mientras está abierto. */
export function suscribirChat(fondoId) {
  chatsSuscritos.add(fondoId);
  enviar({ tipo: 'suscribir_chat', fondo: fondoId });
  return () => {
    chatsSuscritos.delete(fondoId);
    enviar({ tipo: 'desuscribir_chat', fondo: fondoId });
  };
}
