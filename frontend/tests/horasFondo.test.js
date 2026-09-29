// Ejecutar con: npm test. Misma tabla que backend/fondos/tests/tests_usuarios_ajustes.py:
// la vista previa debe dar exactamente lo mismo que el backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcularAntiguedad, calcularHorasFondo, diasVacacionPorAntiguedad } from '../src/utils/horasFondo.js';

// [horasSemana, diasVacacion, diasFeriadosHabiles] -> [contrato, vacacion, feriados, efectivas]
const CASOS_HORAS_FONDO = [
  [[40, 15, 16], [2080, 120, 128, 1832]],
  [[40, 30, 16], [2080, 240, 128, 1712]],
  [[20, 20, 16], [1040, 80, 64, 896]],
  [[10, 20, 16], [520, 40, 32, 448]],
  [[6, 15, 16], [312, 18, 19, 275]],
  [[4, 15, 16], [208, 12, 12, 184]],
  [[12, 30, 11], [624, 72, 26, 526]],
  [[12, 30, 0], [624, 72, 0, 552]],
];

test('calcularHorasFondo coincide con el backend', () => {
  for (const [[horasSemana, dias, feriados], esperado] of CASOS_HORAS_FONDO) {
    const r = calcularHorasFondo(horasSemana, dias, feriados);
    assert.deepEqual(
      [r.contrato_horas, r.horas_vacacion, r.horas_feriados, r.horas_efectivas],
      esperado,
      `${horasSemana} h/sem, ${dias} días, ${feriados} días de feriado`,
    );
  }
});

test('días de vacación según antigüedad (igual que el backend)', () => {
  assert.equal(diasVacacionPorAntiguedad(0), 0);
  assert.equal(diasVacacionPorAntiguedad(1), 15);
  assert.equal(diasVacacionPorAntiguedad(4), 15);
  assert.equal(diasVacacionPorAntiguedad(5), 20);
  assert.equal(diasVacacionPorAntiguedad(7), 20);
  assert.equal(diasVacacionPorAntiguedad(10), 30);
  assert.equal(diasVacacionPorAntiguedad(12), 30);
});

test('antigüedad en años completos a la fecha de referencia', () => {
  // Mismos casos que backend/fondos/tests/tests_antiguedad.py
  assert.equal(calcularAntiguedad('2014-03-10', '2026-03-09'), 11);
  assert.equal(calcularAntiguedad('2014-03-10', '2026-03-10'), 12);
  assert.equal(calcularAntiguedad('2014-03-10', '2026-01-01'), 11);
  assert.equal(calcularAntiguedad('2016-03-01', '2026-02-01'), 9);
  assert.equal(calcularAntiguedad('2016-03-01', '2026-03-15'), 10);
  assert.equal(calcularAntiguedad('2025-06-01', '2026-02-01'), 0);
  assert.equal(calcularAntiguedad('', '2026-01-01'), null);
});
