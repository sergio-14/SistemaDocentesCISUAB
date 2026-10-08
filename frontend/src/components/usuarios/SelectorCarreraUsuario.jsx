import FiltroDesplegable from '../common/FiltroDesplegable';
import { MensajeAnimado } from './CampoUsuario';

const textoError = (error) => (Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : ''));

// Carrera del usuario (crear y editar; solo la elige el superusuario): una sola para
// todos sus roles. Bloqueada, muestra el motivo debajo.
const SelectorCarreraUsuario = ({ id, value, onChange, carreras = [], error, motivoBloqueo = '' }) => {
  const mensajeError = textoError(error);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Carrera</label>
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
        disabled={Boolean(motivoBloqueo)}
      />
      <MensajeAnimado
        show={Boolean(mensajeError)}
        message={mensajeError}
        wrapperClassName="mt-1 pl-1"
        messageClassName="text-xs text-red-600"
      />
      {motivoBloqueo && !mensajeError && <p className="mt-1 pl-1 text-xs text-slate-600">{motivoBloqueo}</p>}
    </div>
  );
};

export default SelectorCarreraUsuario;
