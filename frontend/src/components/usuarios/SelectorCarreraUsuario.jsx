import FiltroDesplegable from '../common/FiltroDesplegable';
import { CandadoIcon, NotaUsuario } from './PiezasFormularioUsuario';

const textoError = (error) => (Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : ''));

// Carrera del usuario (crear y editar): una sola para todos sus roles. Solo el
// superusuario la elige; para el Director aparece fija con la suya.
const SelectorCarreraUsuario = ({ id, value, onChange, carreras = [], error, deshabilitado = false, nota = '' }) => {
  const mensajeError = textoError(error);
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5 pl-1">
        Carrera
        {deshabilitado && <CandadoIcon className="w-3 h-3 text-slate-400" />}
      </label>
      <FiltroDesplegable
        id={id}
        value={value || ''}
        onChange={onChange}
        options={carreras.map((carrera) => ({ value: String(carrera.id), label: carrera.nombre }))}
        placeholder="Seleccione una carrera"
        ariaLabel="Carrera"
        emptyText="No hay carreras que coincidan"
        permitirQuitar={false}
        invalido={Boolean(mensajeError)}
        disabled={deshabilitado}
      />
      {mensajeError
        ? <NotaUsuario tipo="error">{mensajeError}</NotaUsuario>
        : <NotaUsuario>{nota}</NotaUsuario>}
    </div>
  );
};

export default SelectorCarreraUsuario;
