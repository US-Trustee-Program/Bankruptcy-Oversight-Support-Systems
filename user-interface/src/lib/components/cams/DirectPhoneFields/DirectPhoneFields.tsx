import React, { useId } from 'react';
import Input from '@/lib/components/uswds/Input';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { TypedPhoneNumber } from '@common/cams/trustees';

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
        id={`${baseId}-legacy-extension`}
        className="phone-entry-list__legacy-extension-input"
        name="extension"
        label="Extension"
        value={directPhone?.extension || ''}
        onChange={(e) => updateDirectPhone({ extension: e.target.value || undefined })}
        errorMessage={errors?.extension?.join(' ')}
        autoComplete="off"
        ariaDescription="Up to 6 digits"
      />
    </>
  );
}
