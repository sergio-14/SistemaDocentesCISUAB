import { useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../apis/apiConfig';
import { useActiveRole } from '../contexts/activeRole';
import { detener, iniciar, reiniciar } from './conexion';

// Token de acceso vencido: se renueva con el refresh, como hace api.js.
const renovarToken = async () => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return false;
  try {
    const { data } = await axios.post(`${API_URL}/token/refresh/`, { refresh });
    localStorage.setItem('access_token', data.access);
    return true;
  } catch {
    return false;
  }
};

/**
 * Abre la conexión de tiempo real mientras hay sesión (se monta solo con usuario) y
 * la rehace al cambiar de rol activo, para que el servidor use los grupos del nuevo rol.
 */
export default function ConexionTiempoReal() {
  const { activeAssignment, roleSelectionRequired } = useActiveRole();
  const asignacionId = activeAssignment?.id ?? null;
  const asignacionRef = useRef(asignacionId);

  useEffect(() => {
    if (roleSelectionRequired) return undefined;
    iniciar({ renovar: renovarToken });
    return detener;
  }, [roleSelectionRequired]);

  useEffect(() => {
    if (asignacionRef.current === asignacionId) return;
    asignacionRef.current = asignacionId;
    reiniciar();
  }, [asignacionId]);

  return null;
}
