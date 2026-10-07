import { useEffect } from 'react';

// Pantallas que solo se ven en modo claro (fondo blanco azulado): mientras están montadas
// se quita la clase 'dark' aunque el tema global la vuelva a poner, y al salir se
// restaura el tema guardado para el resto del sistema. activo = false no hace nada.
export default function useModoClaro(activo = true) {
  useEffect(() => {
    if (!activo) return undefined;
    const root = document.documentElement;
    const forzarClaro = () => {
      if (root.classList.contains('dark')) root.classList.remove('dark');
      if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light');
    };
    forzarClaro();
    const observer = new MutationObserver(forzarClaro);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => {
      observer.disconnect();
      const saved = localStorage.getItem('theme');
      const oscuro = saved === 'dark'
        || ((!saved || saved === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', oscuro);
      root.setAttribute('data-theme', oscuro ? 'dark' : 'light');
    };
  }, [activo]);
}
