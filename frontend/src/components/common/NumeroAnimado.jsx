import { useEffect, useRef, useState } from 'react';
import { animacionesReducidas } from '../../utils/preferenciasInterfaz';

// Número que, al cambiar, cuenta desde el valor anterior hasta el nuevo (~0,4 s). Con
// singular/plural, la palabra sigue al número que se está mostrando.
function NumeroAnimado({ valor, singular, plural }) {
  const [mostrado, setMostrado] = useState(valor);
  const anteriorRef = useRef(valor);

  useEffect(() => {
    const desde = anteriorRef.current;
    anteriorRef.current = valor;
    if (desde === valor || animacionesReducidas()) {
      setMostrado(valor);
      return undefined;
    }
    const inicio = performance.now();
    let frame;
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / 400);
      const suave = 1 - (1 - t) ** 3;
      setMostrado(Math.round(desde + (valor - desde) * suave));
      if (t < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor]);

  if (!singular) return mostrado;
  return `${mostrado} ${mostrado === 1 ? singular : plural}`;
}

export default NumeroAnimado;
