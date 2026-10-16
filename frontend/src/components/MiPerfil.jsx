import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import api from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage } from '../utils/formErrors';
import { BLOQUE } from './fondos/estilosFondo';
import { Avatar } from './fondos/ElementosFondo';

const fecha = (iso) => {
  const [anio, mes, dia] = String(iso || '').split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
};

// Perfil del docente, solo lectura: los datos los registra la Dirección de Carrera en su
// ficha. Antigüedad y vacación se calculan a hoy con la regla de DatosLaborales.
function MiPerfil() {
  const { effectiveUser } = useActiveRole();
  const docenteId = effectiveUser?.perfil?.docente_id || effectiveUser?.perfil?.docente;
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docenteId) {
      setError('Su usuario todavía no tiene ficha de docente: pídala a la Dirección de Carrera.');
      return;
    }
    api.get(`/docentes/${docenteId}/`)
      .then((respuesta) => setFicha(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar su perfil.')));
  }, [docenteId]);

  if (error) {
    return (
      <div className="px-3 sm:px-4 md:px-8 py-4 md:py-6">
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">{error}</div>
      </div>
    );
  }
  if (!ficha) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
      </div>
    );
  }

  const vinculos = (ficha.vinculos || []).filter((vinculo) => vinculo.activo !== false);
  const anios = Number(ficha.antiguedad) || 0;
  const datos = [
    { label: vinculos.length > 1 ? 'Carreras' : 'Carrera', valor: vinculos.map((v) => v.carrera_nombre).join(', ') || '—' },
    { label: 'Dedicación', valor: vinculos.map((v) => v.tipo_dedicacion).join(', ') || '—' },
    { label: 'Categoría', valor: vinculos.map((v) => v.tipo_categoria).join(', ') || '—' },
    { label: 'Fecha de ingreso', valor: fecha(ficha.fecha_ingreso) },
    { label: 'Antigüedad', valor: `${anios} ${anios === 1 ? 'año' : 'años'}` },
    { label: 'Vacación que le corresponde', valor: `${ficha.dias_vacacion ?? 0} días hábiles por gestión` },
  ];

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
      <div className={`${BLOQUE} p-5 sm:p-6`}>
        <div className="flex items-center gap-4 min-w-0">
          <Avatar nombre={ficha.nombre_completo} size="w-14 h-14 text-lg" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <UserRound className="w-3.5 h-3.5" strokeWidth={2} />
              Mi perfil
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 truncate">{ficha.nombre_completo}</h2>
            <p className="mt-1 text-sm text-slate-600">Datos de su ficha docente, registrados por la Dirección de Carrera.</p>
          </div>
        </div>
      </div>

      <div className={`${BLOQUE} p-2 sm:p-3`}>
        <dl className="divide-y divide-azulado-300">
          {datos.map((dato) => (
            <div key={dato.label} className="grid gap-1 px-3 py-3.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold text-blue-800">{dato.label}</dt>
              <dd className="text-sm font-medium text-slate-900">{dato.valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        La vacación sale de la antigüedad en años completos: 15 días desde 1 año, 20 desde 5 y 30 desde
        10. En cada fondo, la antigüedad se mide al inicio de su gestión. Si algún dato no es correcto,
        pídale a la Dirección de Carrera que lo corrija en su ficha.
      </p>
    </div>
  );
}

export default MiPerfil;
