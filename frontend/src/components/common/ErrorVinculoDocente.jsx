import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalCentrado from './ModalCentrado';
import { BOTON } from '../fondos/estilosFondo';

const ICONO_AVISO = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z';

/**
 * Ventana fija cuando el usuario no tiene un docente vinculado: no se cierra; la única
 * salida es cerrar sesión hasta que el administrador vincule la cuenta.
 */
function ErrorVinculoDocente({ onLogout }) {
  const navigate = useNavigate();
  const botonRef = useRef(null);

  useEffect(() => {
    botonRef.current?.focus();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    onLogout?.();
    navigate('/login');
  };

  return (
    <ModalCentrado>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-vinculo-titulo"
        aria-describedby="error-vinculo-mensaje"
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl"
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-blue-900 ring-1 ring-inset ring-azulado-300"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_AVISO} />
            </svg>
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Cuenta sin docente</p>
            <h2 id="error-vinculo-titulo" className="text-xl font-bold leading-tight text-blue-900">
              Tu usuario no tiene un docente vinculado
            </h2>
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 space-y-4 text-sm leading-relaxed text-slate-600">
          <p id="error-vinculo-mensaje">
            No puedes entrar al sistema hasta que el administrador vincule tu cuenta con tu registro de docente.
          </p>
          <div>
            <p className="mb-2 font-semibold text-slate-700">Puede deberse a que:</p>
            <ul className="divide-y divide-azulado-200 rounded-2xl bg-white ring-1 ring-inset ring-azulado-300">
              {[
                'Se eliminó tu registro de docente.',
                'Hubo un error al crear tu cuenta.',
                'Se perdió el vínculo entre tu usuario y tu registro de docente.',
              ].map((motivo) => (
                <li key={motivo} className="flex items-center gap-2.5 px-4 py-2.5 text-slate-700">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-900/60" />
                  {motivo}
                </li>
              ))}
            </ul>
          </div>
          <p>
            Pide al <strong className="text-slate-800">administrador del sistema</strong> que revise tu cuenta y la vincule con tu registro de docente.
          </p>
        </div>

        <div className="flex justify-end bg-azulado-100/60 px-6 py-4 [border-top:1px_solid_#B8C9E1]">
          <button
            ref={botonRef}
            type="button"
            onClick={handleLogout}
            className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900/40`}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default ErrorVinculoDocente;
