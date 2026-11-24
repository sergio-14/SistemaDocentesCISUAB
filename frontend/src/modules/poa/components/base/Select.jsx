import React from 'react';

const Select = React.forwardRef(({
  label,
  error,
  helperText,
  children,
  id,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  selectClassName = '',
  'aria-describedby': describedBy,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const helperId = helperText && !error ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy = [describedBy, helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`poa-select-wrapper ${wrapperClassName}`}>
      {label && (
        <label htmlFor={fieldId} className={`poa-select-label ${labelClassName}`}>
          {label}
        </label>
      )}
      <select
        {...props}
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        className={`poa-select ${className} ${selectClassName}`.trim()}
      >
        {children}
      </select>
      {helperId && <p id={helperId} className="poa-select-helper">{helperText}</p>}
      {errorId && <p id={errorId} role="alert" className="poa-select-error">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
