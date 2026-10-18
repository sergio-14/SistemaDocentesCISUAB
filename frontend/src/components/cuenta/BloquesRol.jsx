import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, BookOpen, CalendarClock, ChartColumn, Clock, Eye, FileText, GraduationCap, Inbox } from 'lucide-react';
import api from '../../apis/api';
import { getApiErrorMessage } from '../../utils/formErrors';
import { BarraProgreso, EstadoPill, Etiqueta } from '../fondos/ElementosFondo';
import { BOTON, BOTON_CHICO, ESTADOS_FONDO, estadoVisibleFondo } from '../fondos/estilosFondo';
import { diasDesdeHoy, fechaCorta } from '../../utils/fechas';
import { Cargando, Datos, FilaLista, Lista, SinDatos, Tarjeta } from './Bloques';

const enDias = (iso) => {
  const dias = diasDesdeHoy(iso);
  if (!dias || dias <= 0) return 'hoy';
  return dias === 1 ? 'mañana' : `en ${dias} días`;
};
const NOMBRE_PLAZO = { 'programas analíticos': 'Programas analíticos', proyectos: 'Presentación de proyectos' };
const MAXIMO_PENDIENTES = 5;

// ---------- Docente ----------

export function MiFicha({ docenteId }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/docentes/${docenteId}/`)
      .then((respuesta) => setFicha(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar su ficha docente.')));
  }, [docenteId]);

  let contenido = <Cargando />;
  if (error) contenido = <SinDatos>{error}</SinDatos>;
  else if (ficha) {
    const vinculos = (ficha.vinculos || []).filter((vinculo) => vinculo.activo !== false);
    const anios = Number(ficha.antiguedad) || 0;
    contenido = (
      <Datos datos={[
        { label: 'Dedicación', valor: vinculos.map((v) => v.tipo_dedicacion).join(', ') || '—' },
        { label: 'Categoría', valor: vinculos.map((v) => v.tipo_categoria).join(', ') || '—' },
        { label: 'Fecha de ingreso', valor: fechaCorta(ficha.fecha_ingreso) },
        { label: 'Antigüedad', valor: `${anios} ${anios === 1 ? 'año' : 'años'}` },
        { label: 'Vacaciones', valor: `${ficha.dias_vacacion ?? 0} días hábiles por gestión`, ancho: true },
      ]}
      />
    );
  }
  return <Tarjeta titulo="Mi ficha" icono={GraduationCap}>{contenido}</Tarjeta>;
}

export function MiFondoActual({ fondo, gestion }) {
  if (!fondo) {
    return <Tarjeta titulo="Mi fondo actual" icono={Clock}><SinDatos>Sin fondo en la gestión {gestion}</SinDatos></Tarjeta>;
  }
  const efectivas = Math.round(fondo.horas_efectivas || 0);
  const asignadas = Math.round(fondo.total_asignado || 0);
  const porcentaje = efectivas > 0 ? Math.min(100, Math.round((asignadas / efectivas) * 100)) : 0;
  return (
    <Tarjeta titulo="Mi fondo actual" icono={Clock} accion={<EstadoPill estado={estadoVisibleFondo(fondo)} />}>
      <Datos datos={[
        { label: 'Gestión', valor: <span className="tabular-nums">{fondo.gestion}</span> },
        { label: 'Carrera', valor: fondo.carrera_nombre || '—' },
        { label: 'Horas asignadas', valor: <span className="tabular-nums">{asignadas} h</span> },
        { label: 'Horas efectivas', valor: <span className="tabular-nums">{efectivas} h</span> },
      ]}
      />
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
          <span>Progreso</span>
          <span className="font-bold text-blue-900 tabular-nums">{porcentaje}%</span>
        </div>
        <BarraProgreso valor={porcentaje} />
      </div>
      <div className="mt-auto pt-4 flex justify-end">
        <Link to={`/fondo-tiempo/fondo/${fondo.id}`} className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}>
          <Eye className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span>Ver mi fondo</span>
        </Link>
      </div>
    </Tarjeta>
  );
}

export function ProximosPlazos({ plazos, gestion }) {
  return (
    <Tarjeta titulo="Próximos plazos" icono={CalendarClock}>
      {plazos.length === 0 ? (
        <SinDatos>Sin plazos pendientes en la gestión {gestion}</SinDatos>
      ) : (
        <Lista>
          {plazos.map((plazo) => (
            <FilaLista key={`${plazo.plazo}-${plazo.calendario}-${plazo.fecha}`}>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{NOMBRE_PLAZO[plazo.plazo] || plazo.plazo}</p>
                <p className="text-xs text-slate-500 truncate">{plazo.calendario}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-900 tabular-nums">{fechaCorta(plazo.fecha)}</p>
                <p className="text-xs text-sky-700">{enDias(plazo.fecha)}</p>
              </div>
            </FilaLista>
          ))}
        </Lista>
      )}
    </Tarjeta>
  );
}

export function CarrerasDondeDicto({ carreras, gestion }) {
  return (
    <Tarjeta titulo="Carreras donde dicto" icono={BookOpen} ancha>
      {carreras.length === 0 ? (
        <SinDatos>Sin materias asignadas en la gestión {gestion}</SinDatos>
      ) : (
        <div className={`grid gap-4 ${carreras.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {carreras.map((carrera) => (
            <div key={carrera.carrera} className="min-w-0">
              <p className="text-xs font-medium text-slate-600">
                {carrera.carrera}{carrera.propia ? '' : ' · otra carrera'}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {carrera.materias.map((materia) => (
                  <Etiqueta key={materia.sigla}>{materia.sigla} · {materia.nombre}</Etiqueta>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

// ---------- Jefe de Estudios y Director ----------

export function MiDesignacion({ designacion }) {
  return (
    <Tarjeta titulo="Mi designación" icono={BadgeCheck}>
      {!designacion ? (
        <SinDatos>Sin designación registrada</SinDatos>
      ) : (
        <>
          <Datos datos={[
            { label: 'Cargo', valor: designacion.rol_display },
            { label: 'Carrera', valor: designacion.carrera_nombre || '—' },
            { label: 'Desde', valor: <span className="tabular-nums">{fechaCorta(designacion.desde)}</span> },
            { label: 'Resolución', valor: designacion.resolucion_consejo ? 'Adjunta' : 'Sin resolución adjunta' },
          ]}
          />
          {designacion.resolucion_consejo && (
            <div className="mt-auto pt-4 flex justify-end">
              <a href={designacion.resolucion_consejo} target="_blank" rel="noreferrer" className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}>
                <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />
                <span>Ver resolución</span>
              </a>
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

// ancho: en escritorio va al final, a lo ancho de las tres columnas, con los estados uno al
// lado del otro (debajo de xl, la lista de siempre).
export function ResumenCarrera({ fondos, gestion, ancho = false }) {
  let contenido = <Cargando />;
  if (fondos) {
    const conteo = {};
    fondos.forEach((fondo) => {
      const estado = estadoVisibleFondo(fondo);
      conteo[estado] = (conteo[estado] || 0) + 1;
    });
    const estados = Object.keys(ESTADOS_FONDO).filter((estado) => conteo[estado]);
    contenido = estados.length === 0 ? (
      <SinDatos>Sin fondos en la gestión {gestion}</SinDatos>
    ) : (
      <>
        <div className={ancho ? 'xl:hidden' : ''}>
          <Lista>
            {estados.map((estado) => (
              <FilaLista key={estado}>
                <EstadoPill estado={estado} />
                <span className="font-bold text-slate-900 tabular-nums">{conteo[estado]}</span>
              </FilaLista>
            ))}
            <FilaLista>
              <span className="font-semibold text-slate-600">Total</span>
              <span className="font-bold text-blue-900 tabular-nums">{fondos.length}</span>
            </FilaLista>
          </Lista>
        </div>
        {ancho && (
          <div className="hidden xl:flex flex-wrap items-stretch divide-x divide-azulado-300 text-sm">
            {estados.map((estado) => (
              <div key={estado} className="flex flex-1 flex-col items-start gap-2 px-4 first:pl-0">
                <EstadoPill estado={estado} />
                <span className="text-2xl font-bold leading-none text-slate-900 tabular-nums">{conteo[estado]}</span>
              </div>
            ))}
            <div className="flex flex-col items-start gap-2 px-4 pr-0">
              <span className="py-0.5 font-semibold text-slate-600">Total</span>
              <span className="text-2xl font-bold leading-none text-blue-900 tabular-nums">{fondos.length}</span>
            </div>
          </div>
        )}
      </>
    );
  }
  return (
    <Tarjeta titulo={`Resumen de mi carrera · ${gestion}`} icono={ChartColumn} clase={ancho ? 'xl:order-last xl:col-span-3' : ''}>
      {contenido}
    </Tarjeta>
  );
}

// Director: fondos presentados por revisar (y los informes presentados) y los evaluados por
// finalizar; Jefe: fondos observados por corregir (y los informes observados).
const PENDIENTES = {
  director: { estados: ['presentado_director', 'informe_presentado', 'informe_evaluado'], vacio: 'No hay fondos por revisar ni por finalizar' },
  jefe_estudios: { estados: ['observado', 'informe_observado'], vacio: 'No hay fondos observados por corregir' },
};

export function Pendientes({ fondos, rol }) {
  const regla = PENDIENTES[rol];
  let contenido = <Cargando />;
  if (fondos) {
    const lista = fondos.filter((fondo) => regla.estados.includes(estadoVisibleFondo(fondo)));
    contenido = lista.length === 0 ? (
      <SinDatos>{regla.vacio}</SinDatos>
    ) : (
      <Lista>
        {lista.slice(0, MAXIMO_PENDIENTES).map((fondo) => (
          <FilaLista key={fondo.id}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate" title={fondo.docente_nombre}>{fondo.docente_nombre}</p>
              <div className="mt-1"><EstadoPill estado={estadoVisibleFondo(fondo)} /></div>
            </div>
            <Link to={`/fondo-tiempo/fondo/${fondo.id}`} className={`${BOTON_CHICO} bg-blue-900 hover:bg-blue-950 text-white flex-shrink-0`}>
              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Ver</span>
            </Link>
          </FilaLista>
        ))}
        {lista.length > MAXIMO_PENDIENTES && (
          <FilaLista>
            <span className="text-slate-600">y {lista.length - MAXIMO_PENDIENTES} más</span>
            <Link to="/fondo-tiempo" className="text-sm font-semibold text-blue-800 hover:underline">Ir al Dashboard</Link>
          </FilaLista>
        )}
      </Lista>
    );
  }
  return <Tarjeta titulo="Pendientes" icono={Inbox}>{contenido}</Tarjeta>;
}
