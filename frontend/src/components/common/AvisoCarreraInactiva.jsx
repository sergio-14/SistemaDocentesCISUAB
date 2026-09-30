import { useEffect, useState } from 'react';
import { useActiveRole } from '../../contexts/ActiveRoleContext';
import api from '../../apis/api';

// Evento que dispara ListaCarreras al activar o desactivar una carrera.
export const EVENTO_CARRERAS_ACTUALIZADAS = 'carreras-actualizadas';

const CLASES = 'flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-100 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-900/30 dark:text-amber-100';

// El superusuario no trabaja en una sola carrera: se le avisa qué carreras
// están desactivadas, porque sus datos también son de solo lectura para él.
const useCarrerasInactivas = (habilitado) => {
  const [inactivas, setInactivas] = useState({ total: 0, nombres: [] });

  useEffect(() => {
    if (!habilitado) return undefined;
    let vigente = true;

    const cargar = async () => {
      try {
        const response = await api.get('/carreras/', { params: { activo: 'false' } });
        const data = response.data || {};
        const lista = Array.isArray(data) ? data : (data.results || []);
        if (vigente) {
          setInactivas({ total: Array.isArray(data) ? lista.length : (data.count ?? lista.length), nombres: lista.map((c) => c.nombre) });
        }
      } catch {
        // Sin el aviso el backend sigue bloqueando las escrituras.
      }
    };

    cargar();
    window.addEventListener(EVENTO_CARRERAS_ACTUALIZADAS, cargar);
    return () => {
      vigente = false;
      window.removeEventListener(EVENTO_CARRERAS_ACTUALIZADAS, cargar);
    };
  }, [habilitado]);

  return inactivas;
};

// Aviso fijo de modo solo lectura. Para un usuario de carrera: su carrera activa
// está desactivada. Para el superusuario: lista las carreras desactivadas.
const AvisoCarreraInactiva = ({ className = '' }) => {
  const { carreraSoloLectura, activeCareerName, effectiveUser } = useActiveRole();
  const esSuperusuario = Boolean(effectiveUser?.is_superuser);
  const inactivas = useCarrerasInactivas(esSuperusuario);

  if (esSuperusuario) {
    if (inactivas.total === 0) return null;
    const restantes = inactivas.total - inactivas.nombres.length;
    return (
      <div role="status" className={`${CLASES} ${className}`}>
        <span aria-hidden="true" className="text-lg leading-none">🔒</span>
        <p>
          <strong>Solo lectura.</strong>{' '}
          {inactivas.total === 1 ? 'La carrera ' : 'Las carreras '}
          <strong>{inactivas.nombres.join(', ')}{restantes > 0 ? ` y ${restantes} más` : ''}</strong>
          {inactivas.total === 1 ? ' está desactivada' : ' están desactivadas'}: sus datos no se pueden crear ni
          modificar, tampoco como superusuario. Para cambiarlos, reactiva la carrera en Carreras.
        </p>
      </div>
    );
  }

  if (!carreraSoloLectura) return null;

  return (
    <div role="status" className={`${CLASES} ${className}`}>
      <span aria-hidden="true" className="text-lg leading-none">🔒</span>
      <p>
        <strong>Modo solo lectura.</strong>{' '}
        La carrera {activeCareerName ? <strong>{activeCareerName}</strong> : 'activa'} está desactivada:
        puedes consultar su histórico, pero no crear ni modificar datos.
      </p>
    </div>
  );
};

export default AvisoCarreraInactiva;
