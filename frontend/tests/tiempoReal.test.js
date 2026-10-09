// Ejecutar con: npm test. Conexión de tiempo real (src/tiempoReal/conexion.js) con un
// WebSocket falso: autenticación, avisos, chats, reconexión y token vencido.
import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const almacen = new Map();
globalThis.localStorage = {
  getItem: (clave) => (almacen.has(clave) ? almacen.get(clave) : null),
  setItem: (clave, valor) => almacen.set(clave, String(valor)),
  removeItem: (clave) => almacen.delete(clave),
};

class SocketFalso {
  static OPEN = 1;
  static abiertos = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.enviados = [];
    SocketFalso.abiertos.push(this);
  }

  send(texto) {
    this.enviados.push(JSON.parse(texto));
  }

  close() {
    this.cerrarDesdeServidor(1000);
  }

  // Ayudas del test
  abrir() {
    this.readyState = SocketFalso.OPEN;
    this.onopen?.();
  }

  recibir(mensaje) {
    this.onmessage?.({ data: JSON.stringify(mensaje) });
  }

  cerrarDesdeServidor(code) {
    this.readyState = 3;
    return this.onclose?.({ code });
  }
}

globalThis.WebSocket = SocketFalso;
mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
globalThis.window = {
  location: { protocol: 'https:', host: 'fondos.uabjb.edu.bo' },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
};

const conexion = await import('../src/tiempoReal/conexion.js');
const ultimo = () => SocketFalso.abiertos.at(-1);
const esperar = () => new Promise((resolver) => globalThis.setImmediate(resolver));

beforeEach(() => {
  conexion.detener();
  SocketFalso.abiertos = [];
  almacen.clear();
  almacen.set('access_token', 'token-1');
  almacen.set('active_assignment_id', '7');
});

test('se conecta a /ws/tiempo-real/ y se autentica con el token y el rol activo', () => {
  conexion.iniciar();
  ultimo().abrir();

  assert.equal(ultimo().url, 'wss://fondos.uabjb.edu.bo/ws/tiempo-real/');
  assert.deepEqual(ultimo().enviados[0], { tipo: 'auth', token: 'token-1', asignacion: 7 });
  assert.equal(conexion.estaConectado(), false);

  ultimo().recibir({ tipo: 'listo' });
  assert.equal(conexion.estaConectado(), true);
});

test('reparte los avisos a quien escucha y avisa los cambios de estado', () => {
  const avisos = [];
  const estados = [];
  const dejar = conexion.escuchar('aviso', (mensaje) => avisos.push(mensaje.aviso.texto));
  const dejarEstado = conexion.escucharEstado((valor) => estados.push(valor));
  conexion.iniciar();
  ultimo().abrir();
  ultimo().recibir({ tipo: 'listo' });
  ultimo().recibir({ tipo: 'aviso', aviso: { id: 3, texto: 'Tu fondo de tiempo fue aprobado.' } });
  dejar();
  ultimo().recibir({ tipo: 'aviso', aviso: { id: 4, texto: 'no llega' } });
  dejarEstado();

  assert.deepEqual(avisos, ['Tu fondo de tiempo fue aprobado.']);
  assert.deepEqual(estados, [true]);
});

test('los chats suscritos se vuelven a pedir al reconectar', () => {
  conexion.iniciar();
  ultimo().abrir();
  ultimo().recibir({ tipo: 'listo' });
  const dejar = conexion.suscribirChat(12);
  assert.deepEqual(ultimo().enviados.at(-1), { tipo: 'suscribir_chat', fondo: 12 });

  ultimo().cerrarDesdeServidor(1006);
  mock.timers.tick(30000);
  ultimo().abrir();
  ultimo().recibir({ tipo: 'listo' });
  assert.deepEqual(ultimo().enviados.at(-1), { tipo: 'suscribir_chat', fondo: 12 });

  dejar();
  assert.deepEqual(ultimo().enviados.at(-1), { tipo: 'desuscribir_chat', fondo: 12 });
});

test('si se corta, reintenta con espera creciente', () => {
  conexion.iniciar();
  ultimo().abrir();
  ultimo().cerrarDesdeServidor(1006);
  assert.equal(SocketFalso.abiertos.length, 1);

  mock.timers.tick(1000);   // primer reintento: entre 0,5 y 1 s
  assert.equal(SocketFalso.abiertos.length, 2);
  ultimo().cerrarDesdeServidor(1006);
  mock.timers.tick(900);    // el segundo espera más (1 a 2 s)
  assert.equal(SocketFalso.abiertos.length, 2);
  mock.timers.tick(1100);
  assert.equal(SocketFalso.abiertos.length, 3);
});

test('con el token vencido lo renueva y se reconecta; si no puede, se detiene', async () => {
  let renovaciones = 0;
  conexion.iniciar({
    renovar: async () => {
      renovaciones += 1;
      almacen.set('access_token', 'token-2');
      return renovaciones === 1;
    },
  });
  ultimo().abrir();
  await ultimo().cerrarDesdeServidor(4401);
  await esperar();
  mock.timers.tick(1000);
  assert.equal(SocketFalso.abiertos.length, 2);
  ultimo().abrir();
  assert.equal(ultimo().enviados[0].token, 'token-2');

  await ultimo().cerrarDesdeServidor(4401);   // la segunda renovación falla
  await esperar();
  mock.timers.tick(60000);
  assert.equal(SocketFalso.abiertos.length, 2);
});

test('con una asignación ajena no reintenta, y detener() no reconecta', () => {
  conexion.iniciar();
  ultimo().abrir();
  ultimo().cerrarDesdeServidor(4403);
  mock.timers.tick(60000);
  assert.equal(SocketFalso.abiertos.length, 1);

  conexion.reiniciar();
  assert.equal(SocketFalso.abiertos.length, 2);
  conexion.detener();
  mock.timers.tick(60000);
  assert.equal(SocketFalso.abiertos.length, 2);
});

test('sin un pong a tiempo da la conexión por muerta y se reconecta', () => {
  conexion.iniciar();
  ultimo().abrir();
  mock.timers.tick(25000);
  assert.deepEqual(ultimo().enviados.at(-1), { tipo: 'ping' });
  mock.timers.tick(10000);   // sin pong: se cierra
  mock.timers.tick(1000);
  assert.equal(SocketFalso.abiertos.length, 2);
});
