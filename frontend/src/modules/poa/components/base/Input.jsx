import React from 'react';

/**
 * Componente Input base para el módulo POA
 */
const Input = React.forwardRef(({
  label,
  error,
  helperText,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  inputClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`poa-input-wrapper ${wrapperClassName}`}>
      {label && (
        <label className={`poa-input-label block text-sm font-medium ${labelClassName}`}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        className={`
          poa-input
          mt-1 block w-full rounded px-3 py-2
          border border-gray-300
          bg-white
          text-gray-900
          placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500
          focus:border-blue-500
          disabled:bg-gray-100
          disabled:text-gray-500
          disabled:cursor-not-allowed
          transition-colors duration-200
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${inputClassName}
        `}
        {...props}
      />
      {helperText && !error && (
        <p className="poa-input-helper mt-1 text-xs text-gray-500">
          {helperText}
        </p>
      )}
      {error && (
        <p role="alert" className="poa-input-error mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
