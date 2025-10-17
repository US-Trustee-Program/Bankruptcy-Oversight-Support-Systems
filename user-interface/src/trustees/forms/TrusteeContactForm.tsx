import './TrusteeContactForm.scss';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useApi2 } from '@/lib/hooks/UseApi2';
import {
  TrusteeFormData,
  useTrusteeContactForm,
  UseTrusteeContactFormProps,
} from './UseTrusteeContactForm';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Stop } from '@/lib/components/Stop';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { ChapterType, TrusteeInput, TrusteeStatus } from '@common/cams/trustees';
import { normalizeWebsiteUrl } from '@common/cams/regex';

const CHAPTER_OPTIONS: ComboOption<ChapterType>[] = [
  { value: '7-panel', label: '7 - Panel' },
  { value: '7-non-panel', label: '7 - Non-Panel' },
  { value: '11', label: '11' },
  { value: '11-subchapter-v', label: '11 - Subchapter V' },
  { value: '12', label: '12' },
  { value: '13', label: '13' },
];

const STATUS_OPTIONS: ComboOption<TrusteeStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'not active', label: 'Not Active' },
  { value: 'suspended', label: 'Suspended' },
];

function TrusteeContactForm(props: Readonly<UseTrusteeContactFormProps>) {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();

  const districtComboRef = React.useRef<ComboBoxRef | null>(null);
  const statusComboRef = React.useRef<ComboBoxRef | null>(null);

  const doEditPublicProfile = props.action === 'edit' && props.contactInformation === 'public';
  const doCreate = props.action === 'create';
  const { cancelTo } = props;

  const {
    formData,
    updateField,
    getFormData,
    fieldErrors,
    validateFieldAndUpdate,
    clearErrors,
    clearFieldError,
    validateFormAndUpdateErrors,
    getDynamicSpec,
  } = useTrusteeContactForm(props);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [selectedDistrictOptions, setSelectedDistrictOptions] = useState<ComboOption[]>([]);
  const [districtLoadError, setDistrictLoadError] = useState<string | null>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  const mapPayload = (formData: TrusteeFormData): Partial<TrusteeInput> => {
    let payload;
    if (doCreate || doEditPublicProfile) {
      // Normalize website URL by adding protocol if missing
      const normalizedWebsite = normalizeWebsiteUrl(formData.website);

      payload = {
        name: formData.name,
        public: {
          address: {
            address1: formData.address1,
            ...(formData.address2 && { address2: formData.address2 }),
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            countryCode: 'US',
          },
          phone: { number: formData.phone, extension: formData.extension },
          email: formData.email,
          ...(normalizedWebsite && normalizedWebsite.length > 0 && { website: normalizedWebsite }),
        },
        districts: formData.districts && formData.districts.length > 0 ? formData.districts : null,
        chapters: formData.chapters && formData.chapters.length > 0 ? formData.chapters : null,
        status: formData.status,
      } as TrusteeInput;
    } else {
      payload = {
        internal: {
          address:
            formData.address1 && formData.city && formData.state && formData.zipCode
              ? {
                  address1: formData.address1,
                  ...(formData.address2 && { address2: formData.address2 }),
                  city: formData.city,
                  state: formData.state,
                  zipCode: formData.zipCode,
                  countryCode: 'US',
                }
              : null,
          phone: formData.phone ? { number: formData.phone, extension: formData.extension } : null,
          email: formData.email ?? null,
        },
      } as Partial<TrusteeInput>;
    }
    return payload;
  };

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const currentFormData = getFormData();

    if (validateFormAndUpdateErrors(currentFormData, getDynamicSpec())) {
      setErrorMessage(null);
      clearErrors();
      setIsSubmitting(true);

      const payload = mapPayload(currentFormData);
      try {
        if (doCreate) {
          const response = await api.postTrustee(payload as TrusteeInput);
          const createdId = (response as { data?: { trusteeId?: string } })?.data?.trusteeId;
          navigate.navigateTo(`/trustees/${createdId}`);
        } else {
          const updateTrusteeResponse = await api.patchTrustee(props.trusteeId!, payload);
          navigate.navigateTo(`/trustees/${props.trusteeId}`, {
            trustee: updateTrusteeResponse?.data,
          });
        }
      } catch (e) {
        globalAlert?.error(
          `Failed to ${doCreate ? 'create' : 'update'} trustee: ${(e as Error).message}`,
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  useEffect(() => {
    setDistrictLoadError(null);
    api
      .getCourts()
      .then((response) => {
        if (!response?.data) {
          throw new Error('No data received from getCourts API');
        }

        const courts = response.data;

        const districtMap = new Map<string, ComboOption>();
        for (const court of courts) {
          const label = `${court.courtName} (${court.courtDivisionName})`;
          districtMap.set(court.courtDivisionCode, {
            value: court.courtDivisionCode,
            label: label,
          });
        }

        const options = Array.from(districtMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );

        const selectedOptions = (formData.districts || []).reduce((acc, selection) => {
          const option = options.find((option) => option.value === selection);
          if (option) {
            acc.push(option);
          }
          return acc;
        }, [] as ComboOption[]);

        setDistrictOptions(options);
        setSelectedDistrictOptions(selectedOptions);
      })
      .catch((error) => {
        setDistrictLoadError(
          `Failed to load district options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setDistrictOptions([]);
      });
  }, [api, formData.districts]);

  const chapterSelections = useMemo(() => {
    return (formData.chapters || []).reduce((acc, selection) => {
      const option = CHAPTER_OPTIONS.find((option) => option.value === selection);
      if (option) {
        acc.push(option);
      }
      return acc;
    }, [] as ComboOption[]);
  }, [formData.chapters]);

  const statusSelection = useMemo(() => {
    const option = STATUS_OPTIONS.find((option) => option.value === formData.status);

    if (option) {
      return option;
    } else {
      return STATUS_OPTIONS.find((option) => option.value === 'active')!;
    }
  }, [formData.status]);

  const isRequired = (field: keyof TrusteeFormData): { required?: true } => {
    const commonRequiredFields = ['name', 'address1', 'city', 'state', 'zipCode'];
    const fullActualFields = [...commonRequiredFields, 'phone', 'email'];
    const dynamicSpecFields = Object.keys(getDynamicSpec());
    const requiredFields =
      doCreate || doEditPublicProfile
        ? fullActualFields
        : dynamicSpecFields.filter((f) => commonRequiredFields.includes(f));
    return requiredFields.includes(field) ? { required: true } : {};
  };

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, name } = event.target;
    const fieldName = name as keyof TrusteeFormData;
    const spec = getDynamicSpec({ name: fieldName, value });

    const requiredAddressFields = ['address1', 'city', 'state', 'zipCode'];

    // Check if this is an address-related field
    const isAddressField = requiredAddressFields.includes(fieldName);

    updateField(fieldName, value);
    debounce(() => {
      validateFieldAndUpdate(fieldName, value, spec);

      // For internal profile editing when a field is cleared, check if we need to clear address validation errors
      if (props.contactInformation === 'internal' && isAddressField && value.trim() === '') {
        // Get current form data with this field's new value
        const currentData = getFormData({ name: fieldName, value });

        // Check if all address fields are now empty
        const allAddressFieldsEmpty =
          !currentData.address1 && !currentData.city && !currentData.state && !currentData.zipCode;

        // If all address fields are empty, clear any remaining address field errors
        if (allAddressFieldsEmpty) {
          for (const field of requiredAddressFields) {
            clearFieldError(field);
          }
        }
      }
    }, 300);
  };

  const handleCancel = useCallback(() => {
    clearErrors();
    navigate.navigateTo(cancelTo);
  }, [clearErrors, navigate, cancelTo]);

  function handleComboBoxUpdate<T>(
    fieldName: keyof TrusteeFormData,
    isMultiSelect: boolean,
  ): (selectedOptions: ComboOption[]) => void {
    return (selectedOptions: ComboOption[]) => {
      // Update form state immediately so consumers (and submit) see the new value.
      const selectedValues = selectedOptions.map((option) => option.value as T);
      if (isMultiSelect) {
        updateField(fieldName, selectedValues);
      } else {
        updateField(fieldName, selectedValues[0]);
      }

      // Debounce validation only.
      debounce(() => {
        validateFieldAndUpdate(fieldName, selectedValues.join(','), getDynamicSpec());
      }, 300);
    };
  }

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

  return (
    <div className="trustee-form-screen">
      <div className="form-header">
        {props.action === 'create' && (
          <h1 className="text-no-wrap display-inline-block margin-right-1 create-trustee">
            Add Trustee Profile
          </h1>
        )}
        {districtLoadError && (
          <Stop id="trustee-stop" title="Error" message={districtLoadError} asError />
        )}
      </div>

      <form
        aria-label={`${props.action === 'create' ? 'Create' : 'Edit'} Trustee`}
        data-testid="trustee-form"
        onSubmit={handleSubmit}
      >
        <div className="form-header">
          <span>
            A red asterisk (<span className="text-secondary-dark">*</span>) indicates a required
            field.
          </span>
        </div>

        <div className="form-container">
          <div className="form-column">
            <div className="field-group">
              <Input
                id="trustee-name"
                className="trustee-name-input"
                name="name"
                disabled={props.contactInformation === 'internal'}
                label="Trustee Name"
                value={formData.name}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['name']}
                autoComplete="off"
                {...isRequired('name')}
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-address1"
                className="trustee-address1-input"
                name="address1"
                label="Address Line 1"
                value={formData.address1}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address1']}
                autoComplete="off"
                {...isRequired('address1')}
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-address2"
                className="trustee-address2-input"
                name="address2"
                label="Address Line 2"
                value={formData.address2 || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address2']}
                autoComplete="off"
                {...isRequired('address2')}
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-city"
                className="trustee-city-input"
                name="city"
                label="City"
                value={formData.city}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['city']}
                autoComplete="off"
                {...isRequired('city')}
              />
            </div>

            <div className="field-group">
              <UsStatesComboBox
                id="trustee-state"
                className="trustee-state-input"
                name="state"
                label="State"
                selections={formData.state ? [formData.state] : []}
                onUpdateSelection={(selectedOptions) => {
                  // Apply selection immediately so formData is in sync for submission.
                  const value = selectedOptions[0]?.value;
                  updateField('state', value);

                  // Debounce validation only.
                  debounce(() => {
                    validateFieldAndUpdate('state', value, getDynamicSpec());
                  }, 300);
                }}
                autoComplete="off"
                errorMessage={fieldErrors['state']}
                {...isRequired('state')}
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <Input
                id="trustee-zip"
                className="trustee-zip-input"
                name="zipCode"
                label="ZIP Code"
                value={formData.zipCode}
                onChange={(e) => {
                  const { value } = e.target;
                  // Update immediately so the value is present for submission and other logic.
                  updateField('zipCode', value);

                  // Debounce validation only.
                  debounce(() => {
                    validateFieldAndUpdate('zipCode', value, getDynamicSpec());
                  }, 300);
                }}
                errorMessage={fieldErrors['zipCode']}
                autoComplete="off"
                ariaDescription="Example: 12345"
                {...isRequired('zipCode')}
              />
            </div>
          </div>

          <div className="form-column">
            <div className="field-group">
              <PhoneNumberInput
                id="trustee-phone"
                value={formData.phone}
                className="trustee-phone-input"
                name="phone"
                label="Phone"
                onChange={handleFieldChange}
                errorMessage={fieldErrors['phone']}
                autoComplete="off"
                ariaDescription="Example: 123-456-7890"
                {...isRequired('phone')}
              />
              <Input
                id="trustee-extension"
                className="trustee-extension-input"
                name="extension"
                label="Extension"
                value={formData.extension || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['extension']}
                autoComplete="off"
                ariaDescription="Up to 6 digits"
                {...isRequired('extension')}
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-email"
                className="trustee-email-input"
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['email']}
                type="email"
                autoComplete="off"
                {...isRequired('email')}
              />
            </div>

            {(doCreate || doEditPublicProfile) && (
              <>
                <div className="field-group">
                  <Input
                    id="trustee-website"
                    className="trustee-website-input"
                    name="website"
                    label="Website"
                    value={formData.website || ''}
                    onChange={handleFieldChange}
                    errorMessage={fieldErrors['website']}
                    type="website"
                    autoComplete="off"
                    {...isRequired('website')}
                  />
                </div>

                <div className="field-group">
                  <ComboBox
                    id="trustee-districts"
                    className="trustee-districts-input"
                    name="districts"
                    label="District (Division)"
                    options={districtOptions}
                    selections={selectedDistrictOptions}
                    onUpdateSelection={handleComboBoxUpdate<string>('districts', true)}
                    multiSelect={true}
                    singularLabel="district"
                    pluralLabel="districts"
                    placeholder={districtLoadError ? 'Error loading districts' : 'Select districts'}
                    autoComplete="off"
                    ref={districtComboRef}
                    {...isRequired('districts')}
                  />
                </div>

                <div className="field-group">
                  <ComboBox
                    id="trustee-chapters"
                    className="trustee-chapters-input"
                    name="chapters"
                    label="Chapter Types"
                    options={CHAPTER_OPTIONS}
                    selections={chapterSelections}
                    onUpdateSelection={handleComboBoxUpdate<ChapterType>('chapters', true)}
                    multiSelect={true}
                    singularLabel="chapter"
                    pluralLabel="chapters"
                    autoComplete="off"
                    {...isRequired('chapters')}
                  />
                </div>

                <div className="field-group">
                  <ComboBox
                    id="trustee-status"
                    className="trustee-status-input"
                    name="status"
                    label="Status"
                    options={STATUS_OPTIONS}
                    selections={[statusSelection]}
                    onUpdateSelection={handleComboBoxUpdate<TrusteeStatus>('status', false)}
                    multiSelect={false}
                    autoComplete="off"
                    ref={statusComboRef}
                    {...isRequired('status')}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {errorMessage && <div role="alert">{errorMessage}</div>}
        <div className="usa-button-group">
          <Button id="submit-button" type="submit" onClick={handleSubmit}>
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

export default React.memo(TrusteeContactForm);
