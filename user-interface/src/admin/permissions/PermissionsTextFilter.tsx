import './PermissionsTextFilter.scss';
import { useRef } from 'react';

type PermissionsTextFilterProps = Readonly<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>;

/**
 * A search-as-you-type text filter for the Permissions tabs (CAMS Users, Change History). It holds
 * no text of its own: the screen keeps the value, and decides when and how it applies.
 */
export function PermissionsTextFilter({
  id,
  label,
  placeholder,
  value,
  onChange,
}: PermissionsTextFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="permissions-filter">
      <div className="permissions-filter__header">
        <label className="usa-label" htmlFor={id}>
          {label}
        </label>
        {value.length > 0 && (
          <button
            id={`${id}-clear`}
            type="button"
            className="usa-button usa-button--unstyled permissions-filter__clear"
            aria-label={`Clear ${label} filter`}
            onClick={() => {
              onChange('');
              // The button unmounts once the filter is empty, so keep focus in the filter.
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="usa-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
