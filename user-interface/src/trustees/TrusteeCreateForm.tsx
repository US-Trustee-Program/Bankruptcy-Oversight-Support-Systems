import { useState } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button from '@/lib/components/uswds/Button';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { TrusteeInput } from '@common/cams/parties';
import { useTrusteeFormValidation } from '@/lib/hooks/UseTrusteeFormValidation';
import type { TrusteeFormData } from '@/lib/hooks/UseTrusteeFormValidation.types';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

// District options (placeholder - will be replaced with actual data source later)
const DISTRICT_OPTIONS: ComboOption[] = [
  { value: 'district-01', label: 'District 01' },
  { value: 'district-02', label: 'District 02' },
  { value: 'district-03', label: 'District 03' },
  { value: 'district-04', label: 'District 04' },
  { value: 'district-05', label: 'District 05' },
];

// Chapter type options
const CHAPTER_OPTIONS: ComboOption[] = [
  { value: '7', label: 'Chapter 7' },
  { value: '11', label: 'Chapter 11' },
  { value: '12', label: 'Chapter 12' },
  { value: '13', label: 'Chapter 13' },
];

type Props = {
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
};

export default function TrusteeCreateForm(props: Props) {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const { fieldErrors, validateForm, validateFieldAndUpdate, clearErrors } =
    useTrusteeFormValidation();

  const [name, setName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [extension, setExtension] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [chapters, setChapters] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!flags[TRUSTEE_MANAGEMENT]) {
    return <div data-testid="trustee-create-disabled">Trustee management is not enabled.</div>;
  }

  if (!canManage) {
    return (
      <div data-testid="trustee-create-unauthorized">
        You do not have permission to manage trustees.
      </div>
    );
  }

  function getFormData(): TrusteeFormData {
    return {
      name: name.trim(),
      address1: address1.trim(),
      address2: address2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      phone: phone.trim() || undefined,
      extension: extension.trim() || undefined,
      email: email.trim() || undefined,
      district: district.trim() || undefined,
      chapters: chapters.length > 0 ? chapters : undefined,
    };
  }

  function handleFieldChange(field: string, value: string) {
    // Real-time validation
    validateFieldAndUpdate(field, value);
  }

  async function submit() {
    setErrorMessage(null);
    clearErrors();

    // Validate form before submission
    const formData = getFormData();
    const validationResult = validateForm(formData);

    if (!validationResult.isValid) {
      setErrorMessage('Please correct the errors below before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TrusteeInput = {
        name: formData.name,
        address: {
          address1: formData.address1,
          ...(formData.address2 && { address2: formData.address2 }),
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          countryCode: 'US',
        },
        ...(formData.phone && { phone: formData.phone }),
        ...(formData.email && { email: formData.email }),
        ...(formData.district && { districts: [formData.district] }),
        ...(formData.chapters && formData.chapters.length > 0 && { chapters: formData.chapters }),
      } as unknown as TrusteeInput;

      const response = await api.postTrustee(payload);
      const createdId = (response as { data?: { id?: string } })?.data?.id;

      // Show success notification
      globalAlert?.success('Trustee created successfully.');

      if (props.onSuccess) {
        props.onSuccess(createdId);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Could not create trustee.';
      setErrorMessage(errorMsg);

      // Show error notification
      globalAlert?.error(`Failed to create trustee: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    await submit();
  }

  function handleCancel() {
    clearErrors();
    if (props.onCancel) {
      props.onCancel();
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Create Trustee" data-testid="trustee-create-form">
      <Input
        id="trustee-name"
        label="Trustee Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          handleFieldChange('name', e.target.value);
        }}
        errorMessage={fieldErrors.name}
        required
      />
      <Input
        id="trustee-address1"
        label="Address Line 1"
        value={address1}
        onChange={(e) => {
          setAddress1(e.target.value);
          handleFieldChange('address1', e.target.value);
        }}
        errorMessage={fieldErrors.address1}
        required
      />
      <Input
        id="trustee-city"
        label="City"
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          handleFieldChange('city', e.target.value);
        }}
        errorMessage={fieldErrors.city}
        required
      />
      <Input
        id="trustee-state"
        label="State"
        value={state}
        onChange={(e) => {
          setState(e.target.value);
          handleFieldChange('state', e.target.value);
        }}
        errorMessage={fieldErrors.state}
        required
      />
      <Input
        id="trustee-zip"
        label="ZIP Code"
        value={zipCode}
        onChange={(e) => {
          setZipCode(e.target.value);
          handleFieldChange('zipCode', e.target.value);
        }}
        errorMessage={fieldErrors.zipCode}
        required
      />

      {/* Optional Fields */}
      <Input
        id="trustee-address2"
        label="Address Line 2"
        value={address2}
        onChange={(e) => {
          setAddress2(e.target.value);
          handleFieldChange('address2', e.target.value);
        }}
        errorMessage={fieldErrors.address2}
      />

      <Input
        id="trustee-phone"
        label="Phone Number"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          handleFieldChange('phone', e.target.value);
        }}
        errorMessage={fieldErrors.phone}
        type="tel"
      />

      <Input
        id="trustee-extension"
        label="Extension"
        value={extension}
        onChange={(e) => {
          setExtension(e.target.value);
          handleFieldChange('extension', e.target.value);
        }}
        errorMessage={fieldErrors.extension}
      />

      <Input
        id="trustee-email"
        label="Email Address"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          handleFieldChange('email', e.target.value);
        }}
        errorMessage={fieldErrors.email}
        type="email"
      />

      <ComboBox
        id="trustee-district"
        label="District"
        options={DISTRICT_OPTIONS}
        onUpdateSelection={(selectedOptions) => {
          const selectedValue = selectedOptions.length > 0 ? selectedOptions[0].value : '';
          setDistrict(selectedValue);
          handleFieldChange('district', selectedValue);
        }}
        multiSelect={false}
        singularLabel="district"
        pluralLabel="districts"
      />

      <ComboBox
        id="trustee-chapters"
        label="Chapter Types"
        options={CHAPTER_OPTIONS}
        onUpdateSelection={(selectedOptions) => {
          const selectedValues = selectedOptions.map((option) => option.value);
          setChapters(selectedValues);
          handleFieldChange('chapters', selectedValues.join(','));
        }}
        multiSelect={true}
        singularLabel="chapter"
        pluralLabel="chapters"
      />

      {errorMessage && <div role="alert">{errorMessage}</div>}
      <div className="usa-button-group">
        <Button
          onClick={submit}
          disabled={isSubmitting || Object.keys(fieldErrors).length > 0}
          type="submit"
        >
          {isSubmitting ? 'Creating…' : 'Create Trustee'}
        </Button>
        <Button type="button" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
