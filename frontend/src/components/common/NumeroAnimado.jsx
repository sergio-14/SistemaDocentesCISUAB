import { useEffect, useRef, useState } from 'react';

// Número que, al cambiar, cuenta desde el valor anterior hasta el nuevo (~0,4 s). Con
// singular/plural, la palabra sigue al número que se está mostrando.
// desde: valor con el que aparece (p. ej. 0 para contar al montarse, junto con una barra);
// duracion y retraso (ms) permiten acompasarlo con otra animación.
function NumeroAnimado({ valor, singular, plural, desde, duracion = 400, retraso = 0 }) {
  const inicial = desde ?? valor;
  const [mostrado, setMostrado] = useState(inicial);
  // Parte del número que está en pantalla (no del último valor recibido): si el conteo se
  // corta (StrictMode monta los efectos dos veces, o llega otro valor a mitad), sigue desde ahí.
  const mostradoRef = useRef(inicial);

  useEffect(() => {
    const mostrar = (numero) => {
      mostradoRef.current = numero;
      setMostrado(numero);
    };
    const origen = mostradoRef.current;
    if (origen === valor || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mostrar(valor);
      return undefined;
    }
    const inicio = performance.now() + retraso;
    let frame;
    const paso = (ahora) => {
      const t = Math.min(1, Math.max(0, (ahora - inicio) / duracion));
      const suave = 1 - (1 - t) ** 3;
      mostrar(Math.round(origen + (valor - origen) * suave));
      if (t < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion, retraso]);

  if (!singular) return mostrado;
  return `${mostrado} ${mostrado === 1 ? singular : plural}`;
}

export default NumeroAnimado;
