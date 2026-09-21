import React from 'react';

// IconButton: muestra texto si se proporciona `children` (siempre visible).
// Si no hay `children`, muestra solo el `icon` (útil para botones compactos como cerrar).
// Props: icon (element), children (texto), className, onClick, title, type, disabled
const IconButton = ({ icon, children, className = '', onClick, title, type = 'button', disabled = false, ariaLabel, showIcon = false }) => {
  const hasText = Boolean(children);
  const aria = ariaLabel || title || (hasText && typeof children === 'string' ? children : undefined);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title || ariaLabel}
      aria-label={aria}
      className={`btn ${className}`}
    >
      {hasText ? (
        // Si showIcon=true y hay icon, mostrar icono seguido del texto
        showIcon && icon ? (
          <span className="inline-flex items-center gap-2">
            <span className="flex items-center justify-center">{icon}</span>
            {/* El texto se oculta en pantallas pequeñas para mostrar solo el icono */}
            <span className="hidden sm:inline">{children}</span>
          </span>
        ) : (
          // Mostrar solo el texto en todas las resoluciones
          <span>{children}</span>
        )
      ) : (
        // Si no hay texto, renderizar el icono (centrado)
        <span className="flex items-center justify-center">{icon}</span>
      )}
    </button>
  );
};

export default IconButton;
