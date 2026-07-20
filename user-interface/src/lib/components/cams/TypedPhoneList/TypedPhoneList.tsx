import React, { useId } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { PhoneType, TypedPhoneNumber } from '@common/cams/trustees';

export type { PhoneType, TypedPhoneNumber };

const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  direct: 'Direct',
  cell: 'Cell',
  home: 'Home',
};

const ALL_PHONE_TYPES: PhoneType[] = ['direct', 'cell', 'home'];

function getFirstUnusedType(phones: TypedPhoneNumber[]): PhoneType {
  const usedTypes = new Set(phones.map((p) => p.type));
  return ALL_PHONE_TYPES.find((t) => !usedTypes.has(t)) ?? 'direct';
}

type PhoneRowErrors = {
  type?: string[];
  number?: string[];
  extension?: string[];
};

export type TypedPhoneListProps = {
  phones: TypedPhoneNumber[];
  onChange: (phones: TypedPhoneNumber[]) => void;
  errors?: Record<number, PhoneRowErrors>;
  duplicateTypeError?: string;
};

export default function TypedPhoneList(props: Readonly<TypedPhoneListProps>) {
  const { phones, onChange, errors, duplicateTypeError } = props;
  const baseId = useId();

  const allTypesUsed = phones.length >= ALL_PHONE_TYPES.length;

  function handleAddPhone() {
    const newType = getFirstUnusedType(phones);
    onChange([...phones, { number: '', type: newType }]);
  }

  function handleRemove(idx: number) {
    onChange(phones.filter((_, i) => i !== idx));
  }

  function handleTypeChange(idx: number, newType: PhoneType) {
    onChange(phones.map((p, i) => (i === idx ? { ...p, type: newType } : p)));
  }

  function handleNumberChange(idx: number, number: string) {
    onChange(phones.map((p, i) => (i === idx ? { ...p, number } : p)));
  }

  function handleExtensionChange(idx: number, extension: string) {
    onChange(phones.map((p, i) => (i === idx ? { ...p, extension: extension || undefined } : p)));
  }

  return (
    <div className="typed-phone-list">
      {phones.map((phone, idx) => {
        const rowErrors = errors?.[idx];
        const rowId = `${baseId}-phone-${idx}`;
        const typeLabel = PHONE_TYPE_LABELS[phone.type];

        return (
          <div key={idx} className="typed-phone-list__row" data-testid={`phone-row-${idx}`}>
            <div className="usa-form-group">
              <label className="usa-label" htmlFor={`${rowId}-type`}>
                Phone Type
              </label>
              <select
                id={`${rowId}-type`}
                className="usa-select"
                value={phone.type}
                onChange={(e) => handleTypeChange(idx, e.target.value as PhoneType)}
                aria-label={`${typeLabel} phone type`}
                data-testid={`${rowId}-type`}
              >
                {ALL_PHONE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PHONE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {rowErrors?.type && rowErrors.type.length > 0 && (
                <div className="usa-input__error-message">{rowErrors.type.join(' ')}</div>
              )}
            </div>

            <PhoneNumberInput
              id={`${rowId}-number`}
              value={phone.number}
              name={`phone-number-${idx}`}
              label="Phone Number"
              onChange={(e) => handleNumberChange(idx, e.target.value)}
              errorMessage={rowErrors?.number?.join(' ')}
              autoComplete="off"
              aria-label={`${typeLabel} phone number`}
            />

            <Input
              id={`${rowId}-extension`}
              value={phone.extension ?? ''}
              name={`phone-extension-${idx}`}
              label="Extension"
              onChange={(e) => handleExtensionChange(idx, e.target.value)}
              errorMessage={rowErrors?.extension?.join(' ')}
              autoComplete="off"
              ariaDescription="Up to 6 digits"
              aria-label={`${typeLabel} extension`}
            />

            {phones.length > 1 && (
              <Button
                id={`${rowId}-remove`}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                onClick={() => handleRemove(idx)}
                aria-label={`Remove ${typeLabel} phone number`}
                data-testid={`${rowId}-remove`}
              >
                Remove
              </Button>
            )}
          </div>
        );
      })}

      {duplicateTypeError && (
        <div
          className="usa-alert usa-alert--error usa-alert--slim"
          role="alert"
          data-testid="duplicate-type-error"
        >
          <div className="usa-alert__body">
            <p className="usa-alert__text">{duplicateTypeError}</p>
          </div>
        </div>
      )}

      <Button
        id={`${baseId}-add-phone`}
        uswdsStyle={UswdsButtonStyle.Outline}
        onClick={handleAddPhone}
        disabled={allTypesUsed}
        data-testid="add-phone-button"
      >
        Add phone
      </Button>
    </div>
  );
}
