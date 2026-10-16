import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileText } from 'lucide-react';
import { getCarreras, getFondosTiempo } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage, getDownloadErrorMessage } from '../utils/formErrors';
import { descargarInformeGestion } from '../utils/informeGestion';
import FiltroDesplegable from './common/FiltroDesplegable';
import { BLOQUE, BOTON, BOTON_DOCUMENTO } from './fondos/estilosFondo';

const labelCls = 'mb-1.5 pl-1 block text-xs font-semibold text-slate-700';

// Arts. 19 y 28: informe de gestión de la carrera (PDF) para la Decanatura. El Director lo
// descarga de su carrera; el superusuario elige la carrera. La gestión sale de los fondos.
function InformeGestion() {
  const { effectiveUser, activeCareerId, activeCareerName, activeAssignment } = useActiveRole();
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const [carreras, setCarreras] = useState([]);
  const [fondos, setFondos] = useState([]);
  const [carrera, setCarrera] = useState(esSuperusuario ? '' : String(activeCareerId || ''));
  const [gestion, setGestion] = useState('');
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    getFondosTiempo()
      .then((data) => setFondos(Array.isArray(data) ? data : []))
      .catch((err) => toast.error(getApiErrorMessage(err, 'No se pudieron cargar los fondos')));
    if (esSuperusuario) {
      getCarreras()
        .then((data) => setCarreras(Array.isArray(data) ? data : []))
        .catch((err) => toast.error(getApiErrorMessage(err, 'No se pudieron cargar las carreras')));
    }
  }, [esSuperusuario, activeAssignment?.id]);

  // Gestiones con fondos en la carrera elegida (la más reciente primero); sin fondos, el año actual.
  const gestiones = useMemo(() => {
    const deLaCarrera = fondos.filter((fondo) => String(fondo.carrera) === carrera).map((fondo) => fondo.gestion);
    const lista = [...new Set(deLaCarrera)].sort((a, b) => b - a);
    return lista.length ? lista : [new Date().getFullYear()];
  }, [fondos, carrera]);

  useEffect(() => {
    setGestion(String(gestiones[0]));
  }, [gestiones]);

  const carreraElegida = carreras.find((item) => String(item.id) === carrera);
  const nombreCarrera = esSuperusuario ? carreraElegida?.nombre : activeCareerName;
  const codigoCarrera = esSuperusuario ? carreraElegida?.codigo : effectiveUser?.perfil?.carrera_codigo;

  const descargar = async () => {
    setDescargando(true);
    try {
      await descargarInformeGestion(carrera, gestion, codigoCarrera);
      toast.success(`Informe de gestión ${gestion} descargado`);
    } catch (err) {
      toast.error(await getDownloadErrorMessage(err, 'No se pudo descargar el informe de gestión'));
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
      <div className={`${BLOQUE} p-5 sm:p-6`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
            <FileText className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Gestión del Fondo de Tiempo Docente
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Informe de gestión</h2>
            <p className="mt-1 text-sm text-slate-600">
              {nombreCarrera ? `Carrera de ${nombreCarrera}` : 'Elija la carrera y la gestión.'}
            </p>
          </div>
        </div>
      </div>

      <div className={`${BLOQUE} p-5 sm:p-6 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-end`}>
        {esSuperusuario ? (
          <div>
            <label className={labelCls} htmlFor="informe-carrera">Carrera</label>
            <FiltroDesplegable
              id="informe-carrera"
              value={carrera}
              onChange={(valor) => setCarrera(String(valor))}
              options={carreras.map((item) => ({ value: String(item.id), label: item.nombre }))}
              placeholder="Seleccione la carrera"
              ariaLabel="Carrera"
              permitirQuitar={false}
            />
          </div>
        ) : (
          <div>
            <span className={labelCls}>Carrera</span>
            <p className="h-11 flex items-center px-4 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-sm font-semibold text-slate-800">
              {activeCareerName || '—'}
            </p>
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="informe-gestion">Gestión</label>
          <FiltroDesplegable
            id="informe-gestion"
            value={gestion}
            onChange={(valor) => setGestion(String(valor))}
            options={gestiones.map((item) => ({ value: String(item), label: `Gestión ${item}` }))}
            ariaLabel="Gestión"
            permitirQuitar={false}
          />
        </div>
        <button
          type="button"
          onClick={descargar}
          disabled={!carrera || !gestion || descargando}
          className={`${BOTON} h-11 px-5 ${BOTON_DOCUMENTO} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span>{descargando ? 'Descargando...' : 'Descargar PDF'}</span>
        </button>
      </div>

      <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Incluye los fondos ya presentados de la carrera (no los borradores) con su estado, horas y
        cumplimiento evaluado, los docentes de otras carreras con materias de esta, el resumen por
        unidad y la firma del Director de Carrera.
      </p>
    </div>
  );
}

export default InformeGestion;
