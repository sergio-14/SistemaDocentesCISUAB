import { useEffect } from 'react';

// El CSS del módulo POA eleva todos los <button> del sistema al pasar el cursor y al
// pulsarlos. Mientras el layout que llama a este hook está montado, <html> lleva la clase
// 'sin-elevacion-poa' y index.css anula ese efecto (también en modales montados en <body>).
export default function useSinElevacionPoa() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sin-elevacion-poa');
    return () => root.classList.remove('sin-elevacion-poa');
  }, []);
}
