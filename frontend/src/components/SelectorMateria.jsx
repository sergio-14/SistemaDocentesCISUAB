import React, { useState, useEffect } from 'react';
import api from '../apis/api';

const SelectorMateria = ({ onSeleccion, disabled }) => {
  const [semestre, setSemestre] = useState('');
  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState('');
  const [horas, setHoras] = useState('');
  const [loading, setLoading] = useState(false);

  // Semestres del 1 al 10
  const semestres = Array.from({ length: 10 }, (_, i) => i + 1);

  useEffect(() => {
    if (semestre) {
      cargarMaterias();
    } else {
      setMaterias([]);
    }
  }, [semestre]);

  const cargarMaterias = async () => {
    setLoading(true);
    try {
      // El backend ya filtra por la carrera del usuario (Jefe de Estudios)
      const response = await api.get(`/materias/?semestre=${semestre}`);
      setMaterias(response.data.results || response.data);
    } catch (error) {
      console.error("Error cargando materias:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMateriaChange = (e) => {
    const materiaId = e.target.value;
    setMateriaSeleccionada(materiaId);
    
    const materia = materias.find(m => m.id.toString() === materiaId);
    if (materia) {
      const horasTotales = materia.horas_totales || 0;
      setHoras(horasTotales);
      
      // Comunicar al padre: nombre de actividad (materia), horas y categoría fija
      if (onSeleccion) {
        onSeleccion({
          titulo_actividad: materia.nombre,
          horas: horasTotales,
          categoria: 'academica', // Categoría fija
          materia_id: materia.id
        });
      }
    }
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <h3 className="font-medium text-slate-700 dark:text-slate-300">Selección de Asignatura (Malla Curricular)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Selector de Semestre */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            Semestre
          </label>
          <select
            value={semestre}
            onChange={(e) => setSemestre(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm py-2 px-3"
          >
            <option value="">-- Seleccionar --</option>
            {semestres.map(s => (
              <option key={s} value={s}>{s}° Semestre</option>
            ))}
          </select>
        </div>

        {/* 2. Selector de Materia */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            Materia
          </label>
          <select
            value={materiaSeleccionada}
            onChange={handleMateriaChange}
            disabled={!semestre || disabled || loading}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm py-2 px-3"
          >
            <option value="">
              {loading ? 'Cargando...' : '-- Seleccionar Materia --'}
            </option>
            {materias.map(m => (
              <option key={m.id} value={m.id}>
                {m.sigla} - {m.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Campo de Horas (Automático y Bloqueado) */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
            Horas (Automático)
          </label>
          <input
            type="number"
            value={horas}
            readOnly
            className="w-full rounded-md border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-600 dark:border-slate-500 dark:text-slate-300 sm:text-sm py-2 px-3"
          />
        </div>
      </div>
    </div>
  );
};

export default SelectorMateria;
