import React from 'react';

export const DEFAULT_ERROR_LABELS = {
  codigo: 'Código',
  descripcion: 'Descripción',
  detalle: 'Detalle',
  gestion: 'Gestión',
  actividad_id: 'Actividad',
  documento_id: 'Documento',
  objetivo_id: 'Objetivo',
  nombre: 'Nombre',
  nombre_entidad: 'Entidad',
  indicador: 'Indicador',
  item: 'Ítem',
  partida: 'Partida',
  unidad_medida: 'Unidad de medida',
  caracteristicas: 'Características',
  cantidad: 'Cantidad',
  costo_unitario: 'Costo unitario',
  mes_requerimiento: 'Mes de requerimiento',
  tipo: 'Tipo',
  responsable: 'Responsable',
  productos_esperados: 'Productos esperados',
  mes_inicio: 'Mes inicio',
  mes_fin: 'Mes fin',
  indicador_descripcion: 'Indicador',
  indicador_unidad: 'Unidad del indicador',
  indicador_linea_base: 'Línea base',
  indicador_meta: 'Meta',
  estado: 'Estado',
  unidad_solicitante: 'Unidad solicitante',
  programa: 'Programa',
  objetivo_gestion_institucional: 'Objetivo de gestión institucional',
  observaciones: 'Observaciones',
  elaborado_por_id: 'Elaborado por',
  jefe_unidad_id: 'Jefe de unidad',
  fecha_elaboracion: 'Fecha de elaboración',
  rol: 'Rol POA',
  user: 'Usuario del sistema',
  non_field_errors: 'Validación general',
  detail: 'Detalle',
};

export const formatApiErrors = (errorData, labels = DEFAULT_ERROR_LABELS) => {
  if (!errorData) return ['Ocurrió un error inesperado.'];
  if (typeof errorData === 'string') return [errorData];
  if (Array.isArray(errorData)) {
    return errorData.flatMap((item) => formatApiErrors(item, labels));
  }

  if (typeof errorData === 'object') {
    return Object.entries(errorData).flatMap(([key, value]) => {
      const label = labels[key] || key;
      const messages = Array.isArray(value) ? value : [value];
      return messages.flatMap((message) => {
        if (typeof message === 'object') {
          return formatApiErrors(message, labels).map((nested) => `${label}: ${nested}`);
        }
        return `${label}: ${String(message)}`;
      });
    });
  }

  return [String(errorData)];
};

export const mapApiErrorsToFieldErrors = (errorData) => {
  if (!errorData || typeof errorData !== 'object' || Array.isArray(errorData)) return {};

  return Object.entries(errorData).reduce((acc, [key, value]) => {
    if (key === 'non_field_errors' || key === 'detail') return acc;
    if (Array.isArray(value)) {
      acc[key] = value.map((item) => String(item)).join(' ');
      return acc;
    }
    if (typeof value === 'object') {
      acc[key] = formatApiErrors(value).join(' ');
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
};

export const buildClientErrorMessages = (fieldErrors, labels = DEFAULT_ERROR_LABELS) => {
  return Object.entries(fieldErrors || {}).map(([key, value]) => {
    const label = labels[key] || key;
    return `${label}: ${String(value)}`;
  });
};

export const ModalErrorAlert = ({ title = 'No se pudo guardar:', messages = [] }) => {
  if (!messages || messages.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      <div className="mb-2 font-semibold">{title}</div>
      <ul className="list-disc space-y-1 pl-5">
        {messages.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
};
