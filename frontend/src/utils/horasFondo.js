// Réplica exacta de calcular_horas_fondo (backend/fondos/models.py) para la vista
// previa de horas efectivas. Si cambia una, debe cambiar la otra: los tests de
// ambos lados usan la misma tabla de casos.

export const SEMANAS_POR_ANIO = 52;
export const DIAS_LABORABLES_POR_SEMANA = 5;
export const TOPE_HORAS_SEMANALES_FONDO = 40;

// Evita que un 17.999999 de coma flotante se redondee a 17 (el backend usa Decimal).
const piso = (valor) => Math.floor(valor + 1e-9);

// Días hábiles de vacación según antigüedad (DatosLaborales.calcular_dias_vacacion).
export const diasVacacionPorAntiguedad = (antiguedad) => {
  if (antiguedad >= 10) return 30;
  if (antiguedad >= 5) return 20;
  if (antiguedad >= 1) return 15;
  return 0;
};

const leerFecha = (texto) => {
  const [anio, mes, dia] = String(texto || '').split('-').map(Number);
  return anio && mes && dia ? { anio, mes, dia } : null;
};

// Años COMPLETOS cumplidos a la fecha de referencia ('AAAA-MM-DD'), mirando día y mes
// (DatosLaborales.calcular_antiguedad). Sin referencia se usa el 1 de enero del año actual,
// igual que un fondo sin calendario académico.
export const calcularAntiguedad = (fechaIngreso, fechaReferencia = null) => {
  const ingreso = leerFecha(fechaIngreso);
  if (!ingreso) return null;
  const referencia = leerFecha(fechaReferencia) || { anio: new Date().getFullYear(), mes: 1, dia: 1 };
  const antesDelAniversario = referencia.mes < ingreso.mes || (referencia.mes === ingreso.mes && referencia.dia < ingreso.dia);
  return Math.max(0, referencia.anio - ingreso.anio - (antesDelAniversario ? 1 : 0));
};

// diasFeriados: feriados de la gestión que caen de lunes a viernes
// (GET /feriados/resumen/ -> dias_habiles).
export const calcularHorasFondo = (horasSemana, diasVacacion, diasFeriados) => {
  const horasDiarias = horasSemana / DIAS_LABORABLES_POR_SEMANA;
  const contratoHoras = piso(horasSemana * SEMANAS_POR_ANIO);
  const horasVacacion = piso(diasVacacion * horasDiarias);
  const horasFeriados = piso(diasFeriados * horasDiarias);
  return {
    contrato_horas: contratoHoras,
    horas_vacacion: horasVacacion,
    horas_feriados: horasFeriados,
    horas_efectivas: Math.max(contratoHoras - horasVacacion - horasFeriados, 0),
  };
};
