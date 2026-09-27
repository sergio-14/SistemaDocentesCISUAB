// Ejecutar con: npm test  (usa el runner integrado de Node, sin dependencias extra)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const almacen = new Map();
globalThis.localStorage = {
  getItem: (clave) => (almacen.has(clave) ? almacen.get(clave) : null),
  setItem: (clave, valor) => almacen.set(clave, String(valor)),
  removeItem: (clave) => almacen.delete(clave),
};

const {
  MENSAJE_CARRERA_INACTIVA,
  bloquearEscrituraSiSoloLectura,
  esCarreraSoloLectura,
  setCarreraSoloLectura,
} = await import('../src/utils/soloLectura.js');

beforeEach(() => almacen.clear());

test('sin modo solo lectura deja pasar las escrituras', () => {
  const config = { method: 'post', url: '/materias/' };
  assert.equal(bloquearEscrituraSiSoloLectura(config), config);
});

test('en modo solo lectura deja pasar las lecturas', () => {
  setCarreraSoloLectura(true);
  const config = { method: 'get', url: '/materias/' };
  assert.equal(bloquearEscrituraSiSoloLectura(config), config);
});

test('en modo solo lectura rechaza escrituras como un 403 del backend', async () => {
  setCarreraSoloLectura(true);
  for (const method of ['post', 'put', 'patch', 'delete']) {
    await assert.rejects(
      bloquearEscrituraSiSoloLectura({ method, url: '/api/poa/programas/' }),
      (error) => error.response.status === 403 && error.response.data.detail === MENSAJE_CARRERA_INACTIVA,
    );
  }
});

test('en modo solo lectura permite sesión, contraseña, foto y chat', () => {
  setCarreraSoloLectura(true);
  for (const url of ['/token/refresh/', '/auth/cambiar-password-inicial/', '/perfil/foto/', '/api/poa/mensajes-chat/']) {
    const config = { method: 'post', url };
    assert.equal(bloquearEscrituraSiSoloLectura(config), config, url);
  }
});

test('desactivar el modo limpia la marca', () => {
  setCarreraSoloLectura(true);
  assert.equal(esCarreraSoloLectura(), true);
  setCarreraSoloLectura(false);
  assert.equal(esCarreraSoloLectura(), false);
});
