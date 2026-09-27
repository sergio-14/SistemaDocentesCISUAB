// Réplica exacta de calcular_horas_fondo (backend/fondos/models.py) para la vista
// previa de horas efectivas. Si cambia una, debe cambiar la otra: los tests de
// ambos lados usan la misma tabla de casos.

export const SEMANAS_POR_ANIO = 52;
export const DIAS_LABORABLES_POR_SEMANA = 5;
export const DIAS_FERIADOS_GESTION = 16;
export const HORAS_FERIADOS_GESTION_POR_DEFECTO = 128;
export const TOPE_HORAS_SEMANALES_FONDO = 40;

// Evita que un 17.999999 de coma flotante se redondee a 17 (el backend usa Decimal).
const piso = (valor) => Math.floor(valor + 1e-9);

// Días hábiles de vacación según antigüedad (DatosLaborales.calcular_dias_vacacion).
export const diasVacacionPorAntiguedad = (antiguedad) => {
  if (antiguedad >= 10) return 30;
  if (antiguedad >= 5) return 20;
  return 15;
};

// Antigüedad para una gestión: gestión menos año de ingreso (DatosLaborales.calcular_antiguedad).
export const calcularAntiguedad = (fechaIngreso, gestion = null) => {
  const fecha = fechaIngreso ? new Date(`${fechaIngreso}T00:00:00`) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return null;
  return Math.max(0, (gestion || new Date().getFullYear()) - fecha.getFullYear());
};

export const calcularHorasFondo = (horasSemana, diasVacacion, horasFeriadosGestion = null) => {
  const horasDiarias = horasSemana / DIAS_LABORABLES_POR_SEMANA;
  const contratoHoras = piso(horasSemana * SEMANAS_POR_ANIO);
  const horasVacacion = piso(diasVacacion * horasDiarias);
  const feriadosGestion = horasFeriadosGestion || HORAS_FERIADOS_GESTION_POR_DEFECTO;
  const horasFeriados = feriadosGestion === HORAS_FERIADOS_GESTION_POR_DEFECTO
    ? piso(DIAS_FERIADOS_GESTION * horasDiarias)
    : piso(feriadosGestion);
  return {
    contrato_horas: contratoHoras,
    horas_vacacion: horasVacacion,
    horas_feriados: horasFeriados,
    horas_efectivas: Math.max(contratoHoras - horasVacacion - horasFeriados, 0),
  };
};
