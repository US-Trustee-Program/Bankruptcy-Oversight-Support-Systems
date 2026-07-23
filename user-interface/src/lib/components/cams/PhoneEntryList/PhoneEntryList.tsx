import './PhoneEntryList.scss';
import React, { useId } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { PhoneType, PHONE_TYPES, PHONE_TYPE_LABELS, TypedPhoneNumber } from '@common/cams/trustees';

export type PhoneRowErrors = {
  type?: string[];
  number?: string[];
  extension?: string[];
};

export type PhoneEntryListProps = {
  phones: TypedPhoneNumber[];
  onChange: (phones: TypedPhoneNumber[]) => void;
  errors?: Record<number, PhoneRowErrors>;
  typedPhonesEnabled: boolean;
  legacyPhoneErrors?: { phone?: string[]; extension?: string[] };
};

export default function PhoneEntryList(props: Readonly<PhoneEntryListProps>) {
  const { phones, onChange, errors, typedPhonesEnabled, legacyPhoneErrors } = props;
  const baseId = useId();

  function handleTypeChange(index: number, type: PhoneType) {
    onChange(phones.map((p, i) => (i === index ? { ...p, type } : p)));
  }

  function handleNumberChange(index: number, number: string) {
    onChange(phones.map((p, i) => (i === index ? { ...p, number } : p)));
  }

  function handleExtensionChange(index: number, extension: string) {
    onChange(phones.map((p, i) => (i === index ? { ...p, extension: extension || undefined } : p)));
  }

  function handleRemove(index: number) {
    onChange(phones.filter((_, i) => i !== index));
  }

  function handleAdd() {
    onChange([...phones, { type: 'direct', number: '' }]);
  }

  if (!typedPhonesEnabled) {
    const directPhone = phones.find((p) => p.type === 'direct');
    return (
      <>
        <PhoneNumberInput
          id={`${baseId}-legacy-phone`}
          value={directPhone?.number}
          className="phone-entry-list__legacy-phone-input"
          name="phone"
          label="Phone"
          onChange={(e) => {
            const number = e.target.value;
            onChange(phones.map((p) => (p.type === 'direct' ? { ...p, number } : p)));
          }}
          errorMessage={legacyPhoneErrors?.phone?.join(' ')}
          autoComplete="off"
          ariaDescription="Example: 123-456-7890"
        />
        <Input
          id={`${baseId}-legacy-extension`}
          className="phone-entry-list__legacy-extension-input"
          name="extension"
          label="Extension"
          value={directPhone?.extension || ''}
          onChange={(e) => {
            const extension = e.target.value || undefined;
            onChange(phones.map((p) => (p.type === 'direct' ? { ...p, extension } : p)));
          }}
          errorMessage={legacyPhoneErrors?.extension?.join(' ')}
          autoComplete="off"
          ariaDescription="Up to 6 digits"
        />
      </>
    );
  }

  const showRemove = phones.length > 1;

  return (
    <div className="phone-entry-list">
      {phones.map((phone, index) => {
        const rowErrors = errors?.[index];
        const rowId = `${baseId}-phone-${index}`;

        return (
          <div key={index} className="phone-entry-list__entry">
            <div className="phone-entry-list__type-row">
              <div className="usa-form-group">
                <label className="usa-label" htmlFor={`${rowId}-type`}>
                  Phone Type
                </label>
                {rowErrors?.type && (
                  <span className="usa-error-message" id={`${rowId}-type-error`} role="alert">
                    {rowErrors.type.join(' ')}
                  </span>
                )}
                <select
                  id={`${rowId}-type`}
                  className={`usa-select phone-entry-list__type-select${rowErrors?.type ? ' usa-input--error' : ''}`}
                  value={phone.type}
                  onChange={(e) => handleTypeChange(index, e.target.value as PhoneType)}
                  aria-label={`Phone type for entry ${index + 1}`}
                >
                  {PHONE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PHONE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="phone-entry-list__number-row">
              <PhoneNumberInput
                id={`${rowId}-number`}
                className="phone-entry-list__phone-input"
                value={phone.number}
                name={`phone-number-${index}`}
                label="Phone Number"
                onChange={(e) => handleNumberChange(index, e.target.value)}
                errorMessage={rowErrors?.number?.join(' ')}
                autoComplete="off"
                aria-label={`Phone number for entry ${index + 1}`}
              />

              <Input
                id={`${rowId}-extension`}
                className="phone-entry-list__extension-input"
                value={phone.extension ?? ''}
                name={`phone-extension-${index}`}
                label="Extension"
                onChange={(e) => handleExtensionChange(index, e.target.value)}
                errorMessage={rowErrors?.extension?.join(' ')}
                autoComplete="off"
                ariaDescription="Up to 6 digits"
                aria-label={`Extension for entry ${index + 1}`}
              />

              {showRemove && (
                <Button
                  id={`${rowId}-remove`}
                  className="phone-entry-list__remove-button"
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove phone entry ${index + 1}`}
                >
                  <Icon name="close" decorative={true} />
                  Remove
                </Button>
              )}
            </div>

            <hr className="phone-entry-list__divider" />
          </div>
        );
      })}

      <Button
        id={`${baseId}-add-phone`}
        className="phone-entry-list__add-button"
        uswdsStyle={UswdsButtonStyle.Unstyled}
        type="button"
        onClick={handleAdd}
      >
        <Icon name="add" decorative={true} />
        Add Another Phone
      </Button>
    </div>
  );
}
