// Ejecutar con: npm test. Misma tabla que backend/fondos/tests_usuarios_ajustes.py:
// la vista previa debe dar exactamente lo mismo que el backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcularAntiguedad, calcularHorasFondo, diasVacacionPorAntiguedad } from './horasFondo.js';

// [horasSemana, diasVacacion, horasFeriadosGestion] -> [contrato, vacacion, feriados, efectivas]
const CASOS_HORAS_FONDO = [
  [[40, 15, 128], [2080, 120, 128, 1832]],
  [[40, 30, 128], [2080, 240, 128, 1712]],
  [[20, 20, 128], [1040, 80, 64, 896]],
  [[10, 20, 128], [520, 40, 32, 448]],
  [[6, 15, 128], [312, 18, 19, 275]],
  [[4, 15, 128], [208, 12, 12, 184]],
  [[12, 30, 100], [624, 72, 100, 452]],
];

test('calcularHorasFondo coincide con el backend', () => {
  for (const [[horasSemana, dias, feriados], esperado] of CASOS_HORAS_FONDO) {
    const r = calcularHorasFondo(horasSemana, dias, feriados);
    assert.deepEqual(
      [r.contrato_horas, r.horas_vacacion, r.horas_feriados, r.horas_efectivas],
      esperado,
      `${horasSemana} h/sem, ${dias} días, ${feriados} h feriados`,
    );
  }
});

test('días de vacación según antigüedad', () => {
  assert.equal(diasVacacionPorAntiguedad(4), 15);
  assert.equal(diasVacacionPorAntiguedad(7), 20);
  assert.equal(diasVacacionPorAntiguedad(12), 30);
});

test('antigüedad por gestión', () => {
  assert.equal(calcularAntiguedad('2014-01-15', 2026), 12);
  assert.equal(calcularAntiguedad('', 2026), null);
});
