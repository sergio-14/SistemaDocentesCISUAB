// Bloque que aparece y desaparece plegándose (form-reveal-wrap en index.css): al
// cerrarse, lo de abajo sube con animación en vez de saltar. Cerrado queda fuera del
// teclado (inert). El espacio de abajo va dentro, para que también se pliegue.
const Plegable = ({ abierto, children }) => (
  <div className={`form-reveal-wrap ${abierto ? 'is-open' : ''}`} inert={!abierto}>
    <div>
      <div className="pb-4">{children}</div>
    </div>
  </div>
);

export default Plegable;
