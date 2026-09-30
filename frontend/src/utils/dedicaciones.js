// Horas por dedicación. Replica HORAS_SEMANALES_DEDICACION de backend/fondos/models.py.
// Las dedicaciones "horario" figuran en RR.HH. en horas MENSUALES ("24 HRS MES");
// el sistema trabaja en horas semanales, así que se dividen entre las semanas del mes.

export const SEMANAS_POR_MES = 4;

export const HORAS_MENSUALES_DEDICACION_HORARIO = {
  horario_16: 16,
  horario_24: 24,
  horario_40: 40,
  horario_48: 48,
};

export const DEDICACIONES_HORARIO = Object.keys(HORAS_MENSUALES_DEDICACION_HORARIO);

export const HORAS_SEMANALES_DEDICACION = {
  tiempo_completo: 40,
  medio_tiempo: 20,
  ...Object.fromEntries(
    Object.entries(HORAS_MENSUALES_DEDICACION_HORARIO)
      .map(([dedicacion, horasMes]) => [dedicacion, horasMes / SEMANAS_POR_MES])
  ),
};

export const ETIQUETAS_DEDICACION = {
  tiempo_completo: 'Tiempo Completo',
  medio_tiempo: 'Medio Tiempo',
  horario_16: 'Horario 16 hrs/mes',
  horario_24: 'Horario 24 hrs/mes',
  horario_40: 'Horario 40 hrs/mes',
  horario_48: 'Horario 48 hrs/mes',
  dedicacion_exclusiva: 'Dedicacion Exclusiva',
};

export const horasSemanalesDedicacion = (dedicacion) => HORAS_SEMANALES_DEDICACION[String(dedicacion || '')] || 0;

// Texto para el formulario: "Este docente trabaja 24 horas al mes (6 horas por semana)."
export const describirDedicacion = (dedicacion) => {
  const horasMes = HORAS_MENSUALES_DEDICACION_HORARIO[dedicacion];
  if (!horasMes) return '';
  return `Este docente trabaja ${horasMes} horas al mes (${horasMes / SEMANAS_POR_MES} horas por semana).`;
};
