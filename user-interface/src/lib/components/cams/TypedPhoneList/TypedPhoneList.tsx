import './TypedPhoneList.scss';
import React, { useId } from 'react';
import Input from '@/lib/components/uswds/Input';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { PhoneType, PHONE_TYPES, PHONE_TYPE_LABELS, TypedPhoneNumber } from '@common/cams/trustees';

export type { PhoneType, TypedPhoneNumber };

export type PhoneRowErrors = {
  number?: string[];
  extension?: string[];
};

export type TypedPhoneListProps = {
  phones: TypedPhoneNumber[];
  onChange: (phones: TypedPhoneNumber[]) => void;
  errors?: Record<number, PhoneRowErrors>;
};

export default function TypedPhoneList(props: Readonly<TypedPhoneListProps>) {
  const { phones, onChange, errors } = props;
  const baseId = useId();

  function phoneForType(type: PhoneType): TypedPhoneNumber {
    return phones.find((p) => p.type === type) ?? { type, number: '' };
  }

  function handleNumberChange(type: PhoneType, number: string) {
    const next = PHONE_TYPES.map((t) => ({
      ...phoneForType(t),
      number: t === type ? number : phoneForType(t).number,
    }));
    onChange(next);
  }

  function handleExtensionChange(type: PhoneType, extension: string) {
    const next = PHONE_TYPES.map((t) => ({
      ...phoneForType(t),
      extension: t === type ? extension || undefined : phoneForType(t).extension,
    }));
    onChange(next);
  }

  return (
    <div className="typed-phone-list">
      {PHONE_TYPES.map((type, idx) => {
        const phone = phoneForType(type);
        const rowErrors = errors?.[idx];
        const rowId = `${baseId}-phone-${type}`;
        const typeLabel = PHONE_TYPE_LABELS[type];

        return (
          <div key={type} className="typed-phone-list__row" data-testid={`phone-row-${type}`}>
            <div className="typed-phone-list__number-row">
              <PhoneNumberInput
                id={`${rowId}-number`}
                className="typed-phone-list__phone-input"
                value={phone.number}
                name={`phone-number-${type}`}
                label={`${typeLabel} Phone`}
                onChange={(e) => handleNumberChange(type, e.target.value)}
                errorMessage={rowErrors?.number?.join(' ')}
                autoComplete="off"
                aria-label={`${typeLabel} phone number`}
              />

              <Input
                id={`${rowId}-extension`}
                className="typed-phone-list__extension-input"
                value={phone.extension ?? ''}
                name={`phone-extension-${type}`}
                label="Extension"
                onChange={(e) => handleExtensionChange(type, e.target.value)}
                errorMessage={rowErrors?.extension?.join(' ')}
                autoComplete="off"
                ariaDescription="Up to 6 digits"
                aria-label={`${typeLabel} extension`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
