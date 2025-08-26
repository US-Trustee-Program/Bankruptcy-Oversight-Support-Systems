import './TrusteeCreateForm.scss';
import React, { useState, useEffect } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { ChapterType, TrusteeInput } from '@common/cams/parties';
import { useTrusteeFormValidation } from '@/trustees/UseTrusteeFormValidation';
import type { TrusteeFormData } from '@/trustees/UseTrusteeFormValidation.types';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { CourtDivisionDetails } from '@common/cams/courts';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Stop } from '@/lib/components/Stop';

// Chapter type options - Complete list with Panel/Non-Panel distinctions
const CHAPTER_OPTIONS: ComboOption<ChapterType>[] = [
  { value: '7-panel', label: '7 - Panel' },
  { value: '7-non-panel', label: '7 - Non-Panel' },
  { value: '11', label: '11' },
  { value: '11-subchapter-v', label: '11 - Subchapter V' },
  { value: '12', label: '12' },
  { value: '13', label: '13' },
];

export default function TrusteeCreateForm() {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const { fieldErrors, validateFieldAndUpdate, clearErrors, isFormValidAndComplete } =
    useTrusteeFormValidation();
  const debounce = useDebounce();

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
  const [chapters, setChapters] = useState<ChapterType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // District options state
  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [districtLoadError, setDistrictLoadError] = useState<string | null>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  // Load district options from API
  useEffect(() => {
    setDistrictLoadError(null);
    api
      .getCourts()
      .then((response) => {
        if (!response?.data) {
          throw new Error('No data received from getCourts API');
        }

        const courts = response.data;

        // Transform court divisions to district options
        const districtMap = new Map<string, ComboOption>();
        courts.forEach((court: CourtDivisionDetails) => {
          // Use courtId as both value and create a readable label
          const label = `${court.courtName} (${court.courtDivisionName})`;
          districtMap.set(court.courtDivisionCode, {
            value: court.courtDivisionCode,
            label: label,
          });
        });

        const options = Array.from(districtMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );

        setDistrictOptions(options);
      })
      .catch((error) => {
        setDistrictLoadError(
          `Failed to load district options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setDistrictOptions([]);
      });
  }, [api]);

  if (!flags[TRUSTEE_MANAGEMENT]) {
    return <div data-testid="trustee-create-disabled">Trustee management is not enabled.</div>;
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustees"
        asError
      />
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

  function handleFieldChange(
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) {
    const { value, name } = event.target;
    // Update state immediately for responsive UI
    setter(value);

    // Debounce only the validation to avoid excessive API calls
    debounce(() => {
      validateFieldAndUpdate(name, value);
    }, 300);
  }

  async function submit() {
    setErrorMessage(null);
    clearErrors();

    // Validate form before submission
    const formData = getFormData();

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
      };

      const response = await api.postTrustee(payload);
      const createdId = (response as { data?: { id?: string } })?.data?.id;

      navigate.navigateTo(`/trustees/${createdId}`);
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
    navigate.navigateTo('/trustees');
  }

  return (
    <div className="create-trustee-screen">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-12">
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-12">
              <h1 className="text-no-wrap display-inline-block margin-right-1">
                Add Trustee Profile
              </h1>
              {districtLoadError && (
                <Stop id="trustee-stop" title="Error" message={districtLoadError} asError />
              )}
            </div>
          </div>
        </div>
      </div>
      <form aria-label="Create Trustee" data-testid="trustee-create-form">
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-12">
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-12">
                <span>
                  A red asterisk (<span className="text-secondary-dark">*</span>) indicates a
                  required field.
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-6">
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-8">
                <Input
                  id="trustee-name"
                  name="name"
                  label="Trustee Name"
                  value={name}
                  onChange={(e) => handleFieldChange(e, setName)}
                  errorMessage={fieldErrors['name']}
                  autoComplete="off"
                  required
                />
                <Input
                  id="trustee-address1"
                  name="address1"
                  label="Address Line 1"
                  value={address1}
                  onChange={(e) => handleFieldChange(e, setAddress1)}
                  errorMessage={fieldErrors['address1']}
                  autoComplete="off"
                  required
                />
                <Input
                  id="trustee-address2"
                  name="address2"
                  label="Address Line 2"
                  value={address2}
                  onChange={(e) => handleFieldChange(e, setAddress2)}
                  errorMessage={fieldErrors['address2']}
                  autoComplete="off"
                />
                <Input
                  id="trustee-city"
                  name="city"
                  label="City"
                  value={city}
                  onChange={(e) => handleFieldChange(e, setCity)}
                  errorMessage={fieldErrors['city']}
                  autoComplete="off"
                  required
                />
              </div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-8">
                <UsStatesComboBox
                  id="trustee-state"
                  name="state"
                  label="State"
                  onUpdateSelection={(selectedOptions) => {
                    const selectedValue = selectedOptions[0] ? selectedOptions[0].value : '';
                    // Update state immediately for responsive UI
                    setState(selectedValue);

                    // Debounce only the validation
                    debounce(() => {
                      validateFieldAndUpdate('state', selectedValue);
                    }, 300);
                  }}
                  autoComplete="off"
                  required
                ></UsStatesComboBox>
              </div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-4">
                <Input
                  id="trustee-zip"
                  name="zip"
                  label="ZIP Code"
                  value={zipCode}
                  onChange={(e) => {
                    const { value } = e.target;
                    // Update state immediately for responsive UI
                    setZipCode(value);

                    // Debounce only the validation
                    debounce(() => {
                      validateFieldAndUpdate('zipCode', value);
                    }, 300);
                  }}
                  errorMessage={fieldErrors['zipCode']}
                  autoComplete="off"
                  required
                  ariaDescription="Example: 12345"
                />
              </div>
            </div>
          </div>
          <div className="grid-col-6">
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-4">
                <Input
                  id="trustee-phone"
                  name="phone"
                  label="Phone Number"
                  value={phone}
                  onChange={(e) => handleFieldChange(e, setPhone)}
                  errorMessage={fieldErrors['phone']}
                  autoComplete="off"
                  type="tel"
                  ariaDescription="Example: (123)456-7890"
                />
              </div>
              <div className="grid-col-4">
                <Input
                  id="trustee-extension"
                  name="extension"
                  label="Extension"
                  value={extension}
                  onChange={(e) => handleFieldChange(e, setExtension)}
                  errorMessage={fieldErrors['extension']}
                  autoComplete="off"
                  ariaDescription="Up to 6 digits"
                />
              </div>
            </div>

            <div className="grid-row grid-gap-lg">
              <div className="grid-col-8">
                <Input
                  id="trustee-email"
                  name="email"
                  label="Email Address"
                  value={email}
                  onChange={(e) => handleFieldChange(e, setEmail)}
                  errorMessage={fieldErrors['email']}
                  type="email"
                  autoComplete="off"
                />

                <ComboBox
                  id="trustee-districts"
                  name="districts"
                  label="District"
                  options={districtOptions}
                  onUpdateSelection={(selectedOptions) => {
                    debounce(() => {
                      const selectedValues = selectedOptions.map((option) => option.value);
                      validateFieldAndUpdate('districts', selectedValues.join(','));
                      setDistricts(selectedValues);
                    }, 300);
                  }}
                  multiSelect={true}
                  singularLabel="district"
                  pluralLabel="districts"
                  placeholder={districtLoadError ? 'Error loading districts' : 'Select districts'}
                  autoComplete="off"
                />

                <ComboBox
                  id="trustee-chapters"
                  name="chapters"
                  label="Chapter Types"
                  options={CHAPTER_OPTIONS}
                  onUpdateSelection={(selectedOptions) => {
                    debounce(() => {
                      const selectedValues = selectedOptions.map(
                        (option) => option.value as ChapterType,
                      );
                      validateFieldAndUpdate('chapters', selectedValues.join(','));
                      setChapters(selectedValues);
                    }, 300);
                  }}
                  multiSelect={true}
                  singularLabel="chapter"
                  pluralLabel="chapters"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        </div>

        {errorMessage && <div role="alert">{errorMessage}</div>}
        <div className="usa-button-group">
          <Button
            id="submit-button"
            disabled={isSubmitting || !isFormValidAndComplete(getFormData())}
            type="submit"
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            className="unstyled-button"
            type="button"
            onClick={handleCancel}
            uswdsStyle={UswdsButtonStyle.Unstyled}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
