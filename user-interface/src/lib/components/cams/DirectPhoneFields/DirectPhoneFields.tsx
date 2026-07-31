import { useId, useRef } from 'react';
import Input from '@/lib/components/uswds/Input';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { TypedPhoneNumber } from '@common/cams/contact';
import { InputRef } from '@/lib/type-declarations/input-fields';

export type DirectPhoneErrors = {
  phone?: string[];
  extension?: string[];
};

export type DirectPhoneFieldsProps = {
  phones: TypedPhoneNumber[];
  onChange: (phones: TypedPhoneNumber[]) => void;
  errors?: DirectPhoneErrors;
};

export default function DirectPhoneFields(props: Readonly<DirectPhoneFieldsProps>) {
  const { phones, onChange, errors } = props;
  const baseId = useId();
  const extensionRef = useRef<InputRef>(null);
  const directPhone = phones.find((p) => p.type === 'direct');

  function updateDirectPhone(updates: Partial<TypedPhoneNumber>) {
    const hasDirect = phones.some((p) => p.type === 'direct');
    onChange(
      hasDirect
        ? phones.map((p) => (p.type === 'direct' ? { ...p, ...updates } : p))
        : [...phones, { type: 'direct', number: '', ...updates }],
    );
  }

  return (
    <>
      <PhoneNumberInput
        id={`${baseId}-legacy-phone`}
        value={directPhone?.number}
        className="phone-entry-list__legacy-phone-input"
        name="phone"
        label="Phone"
        onChange={(e) => updateDirectPhone({ number: e.target.value })}
        errorMessage={errors?.phone?.join(' ')}
        autoComplete="off"
        ariaDescription="Example: 123-456-7890"
      />
      <Input
        ref={extensionRef}
        id={`${baseId}-legacy-extension`}
        className="phone-entry-list__legacy-extension-input"
        name="extension"
        label="Extension"
        value={directPhone?.extension || ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          extensionRef.current?.setValue(digits);
          updateDirectPhone({ extension: digits || undefined });
        }}
        errorMessage={errors?.extension?.join(' ')}
        autoComplete="off"
        ariaDescription="Up to 6 digits"
        inputMode="numeric"
        maxLength={6}
      />
    </>
  );
}
