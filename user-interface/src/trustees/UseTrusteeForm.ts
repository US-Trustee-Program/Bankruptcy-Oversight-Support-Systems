import { useState } from 'react';
import { TrusteeFormData, TrusteeFormState } from './UseTrusteeFormValidation.types';
import { ContactInformation } from '@common/cams/contact';

interface UseTrusteeFormProps {
  initialState: TrusteeFormState;
}

export function useTrusteeForm({ initialState }: UseTrusteeFormProps) {
  const getInitialFormData = (): TrusteeFormData => {
    let info: ContactInformation | null = null;
    const doEditInternalProfile =
      initialState.action === 'edit' && initialState.contactInformation === 'internal';
    const doEditPublicProfile =
      initialState.action === 'edit' && initialState.contactInformation === 'public';

    if (doEditInternalProfile && initialState.trustee?.internal) {
      info = initialState.trustee.internal;
    } else if (doEditPublicProfile && initialState.trustee?.public) {
      info = initialState.trustee.public;
    }

    return {
      name: initialState.trustee?.name ?? '',
      address1: info?.address?.address1 ?? '',
      address2: info?.address?.address2 ?? '',
      city: info?.address?.city ?? '',
      state: info?.address?.state ?? '',
      zipCode: info?.address?.zipCode ?? '',
      phone: info?.phone?.number ?? '',
      extension: info?.phone?.extension ?? '',
      email: info?.email ?? '',
      districts: initialState.trustee?.districts ?? [],
      chapters: initialState.trustee?.chapters ?? [],
      status: initialState.trustee?.status ?? 'active',
    };
  };

  const [formData, setFormData] = useState<TrusteeFormData>(getInitialFormData());

  const updateField = (field: keyof TrusteeFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateMultipleFields = (fields: Partial<TrusteeFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const resetForm = () => {
    setFormData(getInitialFormData());
  };

  const getFormData = (override?: { name: keyof TrusteeFormData; value: string }) => {
    const trimmedData = {
      ...formData,
      name: formData.name.trim(),
      address1: formData.address1.trim(),
      address2: formData.address2?.trim() || undefined,
      city: formData.city.trim(),
      zipCode: formData.zipCode.trim(),
      phone: formData.phone.trim(),
      extension: formData.extension?.trim() || undefined,
      email: formData.email.trim(),
      districts:
        formData.districts && formData.districts.length > 0 ? formData.districts : undefined,
      chapters: formData.chapters && formData.chapters.length > 0 ? formData.chapters : undefined,
    };

    if (override) {
      return { ...trimmedData, [override.name]: override.value } as TrusteeFormData;
    }
    return trimmedData;
  };

  return {
    formData,
    updateField,
    updateMultipleFields,
    resetForm,
    getFormData,
  };
}
