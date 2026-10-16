import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../apis/api';
import { MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../../utils/formErrors';
import CampoPassword from '../common/CampoPassword';
import { BLOQUE, BOTON } from '../fondos/estilosFondo';

const VACIO = { password_actual: '', password_nueva: '', password_confirmacion: '' };

// Primer mensaje de un campo en la respuesta 400 del backend.
const errorDe = (datos, campo) => {
  const valor = datos?.[campo];
  return Array.isArray(valor) ? valor.join(' ') : valor || undefined;
};

// Seguridad: cambiar la propia contraseña con la actual. Las reglas de la nueva son los
// validadores de Django (AUTH_PASSWORD_VALIDATORS), los mismos del primer ingreso.
function PestanaSeguridad() {
  const [campos, setCampos] = useState(VACIO);
  const [visibles, setVisibles] = useState({});
  const [errores, setErrores] = useState({});
  const [pulso, setPulso] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const cambiarCampo = (campo) => (evento) => {
    setCampos((previo) => ({ ...previo, [campo]: evento.target.value }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  };
  const alternar = (campo) => () => setVisibles((previo) => ({ ...previo, [campo]: !previo[campo] }));

  const marcar = (nuevos) => {
    setErrores(nuevos);
    setPulso((valor) => valor + 1);
    toast.error(MENSAJE_REVISA_CAMPOS);
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const nuevos = {};
    if (!campos.password_actual) nuevos.password_actual = 'Escriba su contraseña actual.';
    if (!campos.password_nueva) nuevos.password_nueva = 'Escriba la nueva contraseña.';
    else if (campos.password_nueva.length < 8) nuevos.password_nueva = 'La contraseña debe tener al menos 8 caracteres.';
    if (!campos.password_confirmacion) nuevos.password_confirmacion = 'Confirme la nueva contraseña.';
    else if (campos.password_nueva && campos.password_nueva !== campos.password_confirmacion) {
      nuevos.password_confirmacion = 'Las contraseñas no coinciden.';
    }
    if (Object.keys(nuevos).length) {
      marcar(nuevos);
      return;
    }

    setGuardando(true);
    try {
      await api.post('/mi-cuenta/cambiar-password/', campos);
      toast.success('Contraseña actualizada');
      setCampos(VACIO);
      setVisibles({});
      setErrores({});
    } catch (err) {
      const datos = err.response?.status === 400 ? err.response.data : null;
      const delServidor = {
        password_actual: errorDe(datos, 'password_actual'),
        password_nueva: errorDe(datos, 'password_nueva'),
        password_confirmacion: errorDe(datos, 'password_confirmacion'),
      };
      if (Object.values(delServidor).some(Boolean)) marcar(delServidor);
      else toast.error(getApiErrorMessage(err, 'No se pudo cambiar la contraseña.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className={`${BLOQUE} p-5 sm:p-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]`}>
      <div className="space-y-5 max-w-xl">
        <div>
          <h3 className="text-lg font-bold text-blue-900">Cambiar contraseña</h3>
          <p className="text-sm text-slate-600">Escriba su contraseña actual y luego la nueva dos veces.</p>
        </div>
        <CampoPassword
          id="password-actual"
          etiqueta="Contraseña actual"
          autoComplete="current-password"
          placeholder="Su contraseña de ahora"
          value={campos.password_actual}
          onChange={cambiarCampo('password_actual')}
          error={errores.password_actual}
          pulso={pulso}
          visible={visibles.password_actual}
          onAlternar={alternar('password_actual')}
        />
        <CampoPassword
          id="password-nueva"
          etiqueta="Nueva contraseña"
          value={campos.password_nueva}
          onChange={cambiarCampo('password_nueva')}
          error={errores.password_nueva}
          pulso={pulso}
          visible={visibles.password_nueva}
          onAlternar={alternar('password_nueva')}
        />
        <CampoPassword
          id="password-confirmacion"
          etiqueta="Confirmar nueva contraseña"
          placeholder="Repita la nueva contraseña"
          value={campos.password_confirmacion}
          onChange={cambiarCampo('password_confirmacion')}
          error={errores.password_confirmacion}
          pulso={pulso}
          visible={visibles.password_confirmacion}
          onAlternar={alternar('password_confirmacion')}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={guardando}
            className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {guardando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            <span>{guardando ? 'Guardando...' : 'Guardar contraseña'}</span>
          </button>
        </div>
      </div>

      <div className="self-start rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p className="font-semibold">La nueva contraseña debe:</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5">
          <li>tener al menos 8 caracteres;</li>
          <li>no ser solo números;</li>
          <li>no ser una contraseña común (como «12345678» o «password»);</li>
          <li>no parecerse a su usuario, nombre o correo;</li>
          <li>ser distinta de la actual.</li>
        </ul>
        <p className="mt-2">Su sesión sigue abierta después del cambio.</p>
      </div>
    </form>
  );
}

export default PestanaSeguridad;
