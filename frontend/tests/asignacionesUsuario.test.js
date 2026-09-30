// Ejecutar con: npm test. El modal de edición nunca inventa un rol.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { asignacionesIniciales, asignacionesParaEnviar } from '../src/utils/asignacionesUsuario.js';

test('un director solo no trae segundo rol', () => {
  const r = asignacionesIniciales({
    asignaciones: [{ rol: 'director', carrera: 6, activo: true }],
    perfil: { rol: 'director', carrera: 6 },
  });
  assert.equal(r.rolPrincipal, 'director');
  assert.deepEqual(r.extras, []);
});

test('una asignación sin rol no se convierte en docente', () => {
  const r = asignacionesIniciales({
    asignaciones: [
      { rol: 'director', carrera: 6, activo: true },
      { rol: '', carrera: 6, activo: true },
    ],
    perfil: { rol: 'director', carrera: 6 },
  });
  assert.deepEqual(r.extras, []);
});

test('un perfil sin rol (superusuario) no pasa a docente', () => {
  const r = asignacionesIniciales({ asignaciones: [], perfil: { rol: '', carrera: null } });
  assert.equal(r.rolPrincipal, '');
});

test('conserva el segundo rol real y descarta inactivos', () => {
  const r = asignacionesIniciales({
    asignaciones: [
      { rol: 'jefe_estudios', carrera: 6, activo: true },
      { rol: 'docente', carrera: 6, activo: true, docente: 9 },
      { rol: 'director', carrera: 7, activo: false },
    ],
    perfil: { rol: 'jefe_estudios', carrera: 6 },
  });
  assert.deepEqual(r.extras, [{ rol: 'docente', carrera: 6, docente: 9 }]);
});

test('solo se envían filas con rol y carrera elegidos', () => {
  assert.deepEqual(asignacionesParaEnviar([{ rol: '', carrera: '6' }]), []);
  assert.deepEqual(asignacionesParaEnviar([{ rol: 'docente', carrera: '' }]), []);
  assert.deepEqual(
    asignacionesParaEnviar([{ rol: ' docente ', carrera: ' 6 ', docente: '' }]),
    [{ rol: 'docente', carrera: '6', docente: '' }],
  );
});
