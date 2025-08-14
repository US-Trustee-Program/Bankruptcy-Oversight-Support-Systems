import { useState, useEffect } from 'react';
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
import { CourtDivisionDetails } from '@common/cams/courts';

// Chapter type options - Complete list with Panel/Non-Panel distinctions
const CHAPTER_OPTIONS: ComboOption[] = [
  { value: '7-panel', label: '7 - Panel' },
  { value: '7-non-panel', label: '7 - Non-Panel' },
  { value: '11', label: '11' },
  { value: '11-subchapter-v', label: '11 - Subchapter V' },
  { value: '12', label: '12' },
  { value: '13', label: '13' },
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
  const { fieldErrors, validateForm, validateFieldAndUpdate, clearErrors, isFormValidAndComplete } =
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
  const [districts, setDistricts] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // District options state
  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [districtLoadError, setDistrictLoadError] = useState<string | null>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  // Load district options from API
  useEffect(() => {
    async function loadDistricts() {
      try {
        setDistrictLoadError(null);
        const response = await api.getCourts();

        if (!response?.data) {
          throw new Error('No data received from getCourts API');
        }

        const courts = response.data;

        // Transform court divisions to district options
        const districtMap = new Map<string, ComboOption>();
        courts.forEach((court: CourtDivisionDetails) => {
          // Use courtId as both value and create a readable label
          const label = court.courtName || `District ${court.courtId}`;
          districtMap.set(court.courtId, {
            value: court.courtId,
            label: label,
          });
        });

        const options = Array.from(districtMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );

        setDistrictOptions(options);
      } catch (error) {
        setDistrictLoadError(
          `Failed to load district options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setDistrictOptions([]);
      }
    }

    // Only load if we have the necessary permissions and feature flags
    if (canManage && flags[TRUSTEE_MANAGEMENT]) {
      loadDistricts();
    } else {
      setDistrictOptions([]);
    }
  }, [canManage, flags, api]);

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
      districts: districts.length > 0 ? districts : undefined,
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
        ...(formData.districts &&
          formData.districts.length > 0 && { districts: formData.districts }),
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
        options={districtOptions}
        onUpdateSelection={(selectedOptions) => {
          const selectedValues = selectedOptions.map((option) => option.value);
          setDistricts(selectedValues);
          handleFieldChange('districts', selectedValues.join(','));
        }}
        multiSelect={true}
        singularLabel="district"
        pluralLabel="districts"
        placeholder={districtLoadError ? 'Error loading districts' : 'Select districts'}
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
          disabled={isSubmitting || !isFormValidAndComplete(getFormData())}
          type="submit"
          onClick={submit}
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
