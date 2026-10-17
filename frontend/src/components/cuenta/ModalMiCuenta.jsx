import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import api, { getFondosTiempo } from '../../apis/api';
import { useActiveRole } from '../../contexts/activeRole';
import { fechaBoliviaDe, fechaCorta } from '../../utils/fechas';
import { getApiErrorMessage } from '../../utils/formErrors';
import ModalCentrado from '../common/ModalCentrado';
import { Etiqueta } from '../fondos/ElementosFondo';
import { Cargando, Datos, SinDatos, Tarjeta } from './Bloques';
import {
  CarrerasDondeDicto, MiDesignacion, MiFicha, MiFondoActual, Pendientes, ProximosPlazos, ResumenCarrera,
} from './BloquesRol';
import TarjetaPerfil from './TarjetaPerfil';

const CARGOS_CON_RESUMEN = ['director', 'jefe_estudios'];

// Mi cuenta en una ventana flotante (como el Historial del fondo), para todos los roles y
// solo de lectura salvo la foto. Se abre con la foto o el nombre del sidebar y con
// "Bienvenido" del panel de módulos. Dentro: la tarjeta angosta del perfil y, a la derecha,
// tarjetas del mismo ancho en pares de igual altura; en el celular, una columna.
// Los datos salen de /mi-cuenta/ (solo del usuario) y, para Director y Jefe, de sus fondos.
function ModalMiCuenta({ onClose, onProfileUpdate }) {
  const { effectiveUser, activeRole, activeCareerId, activeAssignment, assignments, getRoleLabel } = useActiveRole();
  const [cuenta, setCuenta] = useState(null);
  const [error, setError] = useState(null);
  const [fondos, setFondos] = useState(null);
  const esSuperusuario = effectiveUser?.is_superuser === true;
  const conResumen = !esSuperusuario && CARGOS_CON_RESUMEN.includes(activeRole);

  useEffect(() => {
    api.get('/mi-cuenta/')
      .then((respuesta) => setCuenta(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar Mi cuenta.')));
  }, [activeAssignment?.id]);

  useEffect(() => {
    if (!conResumen) return;
    getFondosTiempo()
      .then((data) => setFondos(Array.isArray(data) ? data : []))
      .catch(() => setFondos([]));
  }, [conResumen, activeAssignment?.id]);

  // Escape cierra la ventana, como las demás.
  useEffect(() => {
    const alPulsar = (evento) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  const gestion = cuenta?.gestion_actual ?? new Date().getFullYear();
  const rol = esSuperusuario ? 'Super Admin' : getRoleLabel(activeRole);
  const carreras = [...new Set(assignments.map((item) => item.carrera_nombre).filter(Boolean))];
  const fondosDeLaGestion = fondos?.filter((fondo) => (
    fondo.gestion === gestion && !fondo.archivado && String(fondo.carrera) === String(activeCareerId)
  ));
  const designacion = cuenta?.designaciones.find((item) => item.rol === activeRole && String(item.carrera) === String(activeCareerId))
    || cuenta?.designaciones.find((item) => item.rol === activeRole);

  const roles = esSuperusuario
    ? <Etiqueta>Super Admin</Etiqueta>
    : assignments.map((item) => (
      <Etiqueta key={item.id}>{`${item.rol_display || getRoleLabel(item.rol)}${item.carrera_nombre ? ` · ${item.carrera_nombre}` : ''}`}</Etiqueta>
    ));

  const datosCuenta = (ancha) => (
    <Tarjeta titulo="Datos de la cuenta" icono={UserRound} ancha={ancha}>
      <Datos datos={[
        { label: 'Usuario', valor: effectiveUser?.username || '—' },
        { label: 'Cuenta creada', valor: <span className="tabular-nums">{fechaCorta(fechaBoliviaDe(cuenta?.cuenta_creada || effectiveUser?.date_joined))}</span> },
        { label: 'Correo', valor: effectiveUser?.email || 'Sin correo registrado', ancho: true },
        { label: assignments.length > 1 ? 'Roles' : 'Rol', valor: <span className="flex flex-wrap gap-1.5 font-medium">{roles}</span>, ancho: true },
      ]}
      />
      <p className="mt-auto pt-4 text-xs text-slate-500">Para corregir estos datos, pídaselo a la administración del sistema.</p>
    </Tarjeta>
  );

  let bloques;
  if (error) bloques = <Tarjeta titulo="Mi cuenta" icono={UserRound} ancha><SinDatos>{error}</SinDatos></Tarjeta>;
  else if (!cuenta) bloques = <Tarjeta titulo="Mi cuenta" icono={UserRound} ancha><Cargando /></Tarjeta>;
  else if (activeRole === 'docente' && !esSuperusuario) {
    const docente = cuenta.docente;
    bloques = (
      <>
        {datosCuenta(false)}
        {docente ? <MiFicha docenteId={docente.id} /> : <Tarjeta titulo="Mi ficha"><SinDatos>Sin ficha docente registrada</SinDatos></Tarjeta>}
        <MiFondoActual fondo={docente?.fondo_actual} gestion={gestion} />
        <ProximosPlazos plazos={docente?.proximos_plazos || []} gestion={gestion} />
        <CarrerasDondeDicto carreras={docente?.carreras_donde_dicta || []} gestion={gestion} />
      </>
    );
  } else if (conResumen) {
    bloques = (
      <>
        {datosCuenta(false)}
        <MiDesignacion designacion={designacion} />
        <ResumenCarrera fondos={fondosDeLaGestion} gestion={gestion} />
        <Pendientes fondos={fondosDeLaGestion} rol={activeRole} />
      </>
    );
  } else if (!esSuperusuario && activeRole === 'iiisyp') {
    bloques = (
      <>
        {datosCuenta(false)}
        <MiDesignacion designacion={designacion} />
      </>
    );
  } else {
    bloques = datosCuenta(true);
  }

  return (
    <ModalCentrado onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Mi cuenta" className="w-full max-w-5xl overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Cuenta personal</p>
            <h3 className="text-xl font-bold text-slate-800">Mi cuenta</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-azulado-200 hover:text-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto bg-azulado-100 p-4 sm:p-5 [border-top:1px_solid_#B8C9E1]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
            <TarjetaPerfil
              user={effectiveUser}
              rol={rol}
              carreras={carreras}
              ultimoIngresoIso={cuenta?.ultimo_ingreso || effectiveUser?.last_login}
              onProfileUpdate={onProfileUpdate}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{bloques}</div>
          </div>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default ModalMiCuenta;
