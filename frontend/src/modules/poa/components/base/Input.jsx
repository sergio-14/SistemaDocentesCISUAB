import React from 'react';

const Input = React.forwardRef(({
  label,
  error,
  helperText,
  id,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  inputClassName = '',
  'aria-describedby': describedBy,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const helperId = helperText && !error ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy = [describedBy, helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`poa-input-wrapper ${wrapperClassName}`}>
      {label && (
        <label htmlFor={fieldId} className={`poa-input-label ${labelClassName}`}>
          {label}
        </label>
      )}
      <input
        {...props}
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        className={`poa-input ${className} ${inputClassName}`.trim()}
      />
      {helperId && <p id={helperId} className="poa-input-helper">{helperText}</p>}
      {errorId && <p id={errorId} role="alert" className="poa-input-error">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
