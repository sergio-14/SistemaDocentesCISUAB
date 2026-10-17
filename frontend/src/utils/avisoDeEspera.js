import toast from 'react-hot-toast';

// Aviso de "procesando" (Generando PDF..., Activando calendario...): solo aparece si la
// operación tarda más de ESPERA_AVISO_MS; si termina antes, no se muestra nada. Devuelve
// la función que lo quita (y cancela el que todavía no apareció).
export const ESPERA_AVISO_MS = 400;

export function avisoDeEspera(texto, id) {
  let mostrado = false;
  const temporizador = setTimeout(() => {
    mostrado = true;
    toast.loading(texto, { id });
  }, ESPERA_AVISO_MS);
  return () => {
    clearTimeout(temporizador);
    if (mostrado) toast.dismiss(id);
  };
}
