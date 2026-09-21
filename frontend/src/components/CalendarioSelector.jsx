import React, { useState, useEffect } from 'react';
import { getCalendarioActivo, getCalendarios } from '../apis/api';

const CalendarioSelector = ({ value, onChange, disabled = false }) => {
  const [calendarios, setCalendarios] = useState([]);
  const [calendarioActivo, setCalendarioActivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarCalendarios();
  }, []);

  const cargarCalendarios = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todos los calendarios
      const responseCalendarios = await getCalendarios();
      setCalendarios(responseCalendarios.data);

      // Cargar calendario activo
      try {
        const responseActivo = await getCalendarioActivo();
        setCalendarioActivo(responseActivo.data);
        
        // Si no hay valor seleccionado, usar el calendario activo
        if (!value && responseActivo.data) {
          onChange(responseActivo.data.id);
        }
      } catch (err) {
        console.warn('No hay calendario activo configurado');
      }

    } catch (err) {
      console.error('Error al cargar calendarios:', err);
      setError('Error al cargar calendarios académicos');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodoLabel = (periodo) => {
    const periodos = {
      '1S': 'Primer Semestre',
      '2S': 'Segundo Semestre',
      'A': 'Anual',
      'V': 'Verano'
    };
    return periodos[periodo] || periodo;
  };

  if (loading) {
    return (
      <div className="form-group">
        <label className="form-label">Calendario Académico</label>
        <div className="text-muted">
          <i className="fas fa-spinner fa-spin me-2"></i>
          Cargando calendarios...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-group">
        <label className="form-label">Calendario Académico</label>
        <div className="alert alert-warning mb-0">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
      </div>
    );
  }

  if (calendarios.length === 0) {
    return (
      <div className="form-group">
        <label className="form-label">Calendario Académico</label>
        <div className="alert alert-warning mb-0">
          <i className="fas fa-exclamation-triangle me-2"></i>
          No hay calendarios académicos configurados. Contacte al administrador.
        </div>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label htmlFor="calendario_academico" className="form-label">
        Calendario Académico *
        {calendarioActivo && (
          <span className="badge bg-success ms-2">
            <i className="fas fa-check-circle me-1"></i>
            Activo: {calendarioActivo.gestion} - {getPeriodoLabel(calendarioActivo.periodo)}
          </span>
        )}
      </label>
      
      <select
        id="calendario_academico"
        className="form-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      >
        <option value="">Seleccione un calendario académico</option>
        {calendarios.map((calendario) => (
          <option key={calendario.id} value={calendario.id}>
            {calendario.gestion} - {getPeriodoLabel(calendario.periodo)}
            {calendario.activo && ' (Activo)'}
            {' | '}
            {calendario.semanas_efectivas} semanas
          </option>
        ))}
      </select>

      {calendarioActivo && value == calendarioActivo.id && (
        <div className="form-text">
          <i className="fas fa-info-circle me-1"></i>
          Periodo: {new Date(calendarioActivo.fecha_inicio).toLocaleDateString()} 
          {' al '}
          {new Date(calendarioActivo.fecha_fin).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default CalendarioSelector;