import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye } from 'lucide-react';
import api from '../../apis/api';
import { useActiveRole } from '../../contexts/activeRole';
import { getApiErrorMessage } from '../../utils/formErrors';
import {
  OPCIONES_DENSIDAD,
  OPCIONES_ESQUINAS,
  OPCIONES_TEXTO,
  PREFERENCIAS_POR_DEFECTO,
  aplicarPreferencias,
  clavesCambiadas,
  normalizarPreferencias,
} from '../../utils/preferenciasInterfaz';
import Interruptor from '../common/Interruptor';
import { Avatar } from '../fondos/ElementosFondo';
import { BLOQUE, BOTON, BOTON_CHICO, BOTON_DOCUMENTO, ESTADOS_FONDO } from '../fondos/estilosFondo';

// Muestra de cada opción dentro de su botón (en px: no cambia con la propia preferencia).
const MUESTRA_TEXTO = { pequeno: 13, normal: 15, grande: 17, muy_grande: 19 };
const MUESTRA_ESQUINA = { redondeado: '0.875rem', suave: '0.5rem', recto: '0.125rem' };

function Grupo({ titulo, descripcion, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-bold text-blue-900">{titulo}</legend>
      {descripcion && <p className="-mt-2 text-sm text-slate-600">{descripcion}</p>}
      {children}
    </fieldset>
  );
}

function Opciones({ nombre, opciones, valor, onElegir, muestra, columnas }) {
  return (
    <div role="radiogroup" aria-label={nombre} className={`grid gap-2 ${columnas}`}>
      {opciones.map((opcion) => {
        const elegida = valor === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onElegir(opcion.valor)}
            className={`flex flex-col items-center justify-center gap-2 min-h-[5.5rem] px-3 py-3 rounded-2xl text-sm font-medium ring-inset transition-colors ${
              elegida
                ? 'bg-sky-50 text-blue-900 ring-2 ring-blue-900'
                : 'bg-azulado-100 text-slate-700 ring-1 ring-azulado-300 hover:bg-azulado-200'
            }`}
          >
            {muestra(opcion.valor)}
            <span>{opcion.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}

// Vista previa con piezas reales del sistema (tarjeta de fondo, campo y botones). Toda la
// pantalla también cambia en vivo mientras se elige.
function VistaPrevia() {
  const estado = ESTADOS_FONDO.en_ejecucion;
  return (
    <div className={`${BLOQUE} p-5 space-y-4`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700">
        <Eye className="w-3.5 h-3.5" strokeWidth={2} />
        Vista previa
      </p>
      <div className="rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar nombre="Docente de Ejemplo" />
            <div className="min-w-0">
              <p className="text-lg font-bold text-blue-900 leading-tight truncate">Docente de Ejemplo</p>
              <p className="text-sm text-slate-600 truncate">Carrera de Sistemas</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${estado.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />
            {estado.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-sm">
          <span className="text-slate-600">Horas asignadas</span>
          <span className="font-semibold tabular-nums text-slate-800">1200 / 1752 hrs</span>
        </div>
        <div className="h-2 rounded-full bg-azulado-200 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-blue-900" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <span className={`${BOTON_CHICO} ${BOTON_DOCUMENTO}`}>PDF</span>
          <span className={`${BOTON_CHICO} bg-blue-900 text-white`}>Ver fondo</span>
        </div>
      </div>
      <input
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        value="Buscar docente o carrera"
        className="w-full h-11 px-4 rounded-full text-sm text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 !bg-azulado-100"
      />
    </div>
  );
}

// Apariencia: tamaño de texto, esquinas, densidad y animaciones. Lo elegido se ve al instante
// en toda la pantalla; se guarda en el perfil con "Guardar" y, si se sale sin guardar, se
// vuelve a lo guardado. No hay tema oscuro ni cambio de colores, y el POA no cambia.
function PestanaApariencia({ onProfileUpdate }) {
  const { effectiveUser } = useActiveRole();
  const [guardadas, setGuardadas] = useState(() => normalizarPreferencias(effectiveUser?.perfil?.preferencias_interfaz));
  const [borrador, setBorrador] = useState(guardadas);
  const [guardando, setGuardando] = useState(false);
  const guardadasRef = useRef(guardadas);

  // Vista previa en vivo; al salir de la pestaña queda lo guardado.
  useEffect(() => {
    aplicarPreferencias(borrador);
  }, [borrador]);
  useEffect(() => {
    guardadasRef.current = guardadas;
  }, [guardadas]);
  useEffect(() => () => aplicarPreferencias(guardadasRef.current), []);

  const cambios = clavesCambiadas(borrador, guardadas).length;
  const elegir = (clave) => (valor) => setBorrador((previo) => ({ ...previo, [clave]: valor }));
  const esPredeterminado = clavesCambiadas(borrador, PREFERENCIAS_POR_DEFECTO).length === 0;

  const guardar = async () => {
    setGuardando(true);
    try {
      const { data } = await api.patch('/mi-cuenta/preferencias/', borrador);
      const nuevas = normalizarPreferencias(data);
      setGuardadas(nuevas);
      setBorrador(nuevas);
      toast.success('Apariencia guardada');
      onProfileUpdate?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo guardar la apariencia.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className={`${BLOQUE} p-5 sm:p-6 space-y-7`}>
          <Grupo titulo="Tamaño de texto" descripcion="Todos los textos crecen o se achican en la misma proporción; la distribución de la pantalla se mantiene.">
            <Opciones
              nombre="Tamaño de texto"
              opciones={OPCIONES_TEXTO}
              valor={borrador.texto}
              onElegir={elegir('texto')}
              columnas="grid-cols-2 sm:grid-cols-4"
              muestra={(valor) => (
                <span aria-hidden="true" className="font-bold leading-none" style={{ fontSize: `${MUESTRA_TEXTO[valor]}px` }}>Aa</span>
              )}
            />
          </Grupo>

          <Grupo titulo="Esquinas" descripcion="Forma de bloques, botones y campos. Las fotos y los puntos siguen siendo redondos.">
            <Opciones
              nombre="Esquinas"
              opciones={OPCIONES_ESQUINAS}
              valor={borrador.esquinas}
              onElegir={elegir('esquinas')}
              columnas="grid-cols-3"
              muestra={(valor) => (
                <span
                  aria-hidden="true"
                  className="block w-10 h-7 bg-azulado-50 ring-2 ring-inset ring-blue-900/60"
                  style={{ borderRadius: MUESTRA_ESQUINA[valor] }}
                />
              )}
            />
          </Grupo>

          <Grupo titulo="Densidad" descripcion="Compacta reduce los rellenos y las separaciones para ver más en pantalla.">
            <Opciones
              nombre="Densidad"
              opciones={OPCIONES_DENSIDAD}
              valor={borrador.densidad}
              onElegir={elegir('densidad')}
              columnas="grid-cols-2"
              muestra={(valor) => (
                <span aria-hidden="true" className={`flex flex-col w-12 ${valor === 'compacta' ? 'gap-[3px]' : 'gap-[6px]'}`}>
                  {[0, 1, 2].map((linea) => <span key={linea} className="block h-[4px] rounded-full bg-blue-900/60" />)}
                </span>
              )}
            />
          </Grupo>

          <Grupo titulo="Animaciones">
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">Reducir animaciones</p>
                <p className="text-sm text-slate-600">Las entradas, los deslizamientos y los contadores aparecen sin movimiento.</p>
              </div>
              <Interruptor
                etiqueta="Reducir animaciones"
                isActive={borrador.reducir_animaciones}
                onChange={() => setBorrador((previo) => ({ ...previo, reducir_animaciones: !previo.reducir_animaciones }))}
              />
            </div>
          </Grupo>

          {!esPredeterminado && (
            <button
              type="button"
              onClick={() => setBorrador({ ...PREFERENCIAS_POR_DEFECTO })}
              className="text-sm font-medium text-blue-800 underline-offset-4 hover:underline"
            >
              Volver a la apariencia predeterminada
            </button>
          )}
        </div>

        <div className="xl:sticky xl:top-4">
          <VistaPrevia />
        </div>
      </div>

      {cambios > 0 && (
        <div className="sticky bottom-4 z-20 animate-fondo-entrada">
          <div className={`${BLOQUE} flex flex-wrap items-center gap-3 px-4 py-3 shadow-[0_8px_24px_rgba(30,58,138,0.18)]`}>
            <span className="text-sm font-semibold text-blue-900">
              {cambios} {cambios === 1 ? 'cambio' : 'cambios'}
            </span>
            <span className="hidden sm:inline text-sm text-slate-500">· si sale sin guardar, se descartan</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setBorrador(guardadas)}
                disabled={guardando}
                className={`${BOTON} bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-slate-700 hover:bg-azulado-200 disabled:opacity-60`}
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-60`}
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PestanaApariencia;
