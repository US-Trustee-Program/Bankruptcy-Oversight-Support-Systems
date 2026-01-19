import './TrusteeAssistantForm.scss';
import './TrusteeContactForm.scss';
import React, { useCallback, useRef, useState } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Stop } from '@/lib/components/Stop';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import ZipCodeInput from '@/lib/components/ZipCodeInput';
import { TrusteeInput, TrusteeAssistant } from '@common/cams/trustees';
import { TRUSTEE_ASSISTANT_SPEC, TrusteeAssistantFormData } from './trusteeForms.types';
import { validateEach, validateObject, ValidatorReasonMap } from '@common/cams/validation';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';

const getInitialFormData = (assistant?: TrusteeAssistant): TrusteeAssistantFormData => {
  if (!assistant) {
    return {
      name: undefined,
      address1: undefined,
      address2: undefined,
      city: undefined,
      state: undefined,
      zipCode: undefined,
      phone: undefined,
      extension: undefined,
      email: undefined,
    };
  }

  const contact = assistant.contact;
  return {
    name: assistant.name,
    address1: contact.address?.address1,
    address2: contact.address?.address2,
    city: contact.address?.city,
    state: contact.address?.state,
    zipCode: contact.address?.zipCode,
    phone: contact.phone?.number,
    extension: contact.phone?.extension,
    email: contact.email,
  };
};

export function validateField(
  field: keyof TrusteeAssistantFormData,
  value: string | undefined,
): string[] | undefined {
  const valueToEval = value?.trim() || undefined;
  const rules = TRUSTEE_ASSISTANT_SPEC[field];

  if (!rules) {
    return undefined;
  }

  const result = validateEach(rules, valueToEval);
  return result.valid ? undefined : result.reasons;
}

type TrusteeAssistantFormProps = {
  trusteeId: string;
  assistant?: TrusteeAssistant;
};

function TrusteeAssistantForm(props: Readonly<TrusteeAssistantFormProps>) {
  const flags = useFeatureFlags();

  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();

  const { trusteeId, assistant } = props;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidatorReasonMap>({});
  const [formData, setFormData] = useState<TrusteeAssistantFormData>(getInitialFormData(assistant));
  const [saveAlert, setSaveAlert] = useState<string | null>(null);
  const partialAddressAlertRef = useRef<AlertRefType>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  const mapPayload = (formData: TrusteeAssistantFormData): Partial<TrusteeInput> => {
    // If name is empty, clear the entire assistant
    if (!formData.name?.trim()) {
      return { assistant: undefined };
    }

    return {
      assistant: {
        name: formData.name.trim(),
        contact: {
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
      },
    } as Partial<TrusteeInput>;
  };

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target;
    const value = event.target.value === '' ? undefined : event.target.value;
    const fieldName = name as keyof TrusteeAssistantFormData;

    updateField(fieldName, value);
    debounce(() => {
      validateFieldAndUpdate(fieldName, value);
    }, 300);
  };

  const handleStateSelection = (selectedOptions: ComboOption[]) => {
    const value = selectedOptions[0]?.value;
    updateField('state', value);
    debounce(() => {
      validateFieldAndUpdate('state', value);
    }, 300);
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || undefined;
    updateField('zipCode', value);
    debounce(() => {
      validateFieldAndUpdate('zipCode', value);
    }, 300);
  };

  const handleCancel = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const currentFormData = getFormData();

    if (validateFormAndUpdateErrors(currentFormData)) {
      setIsSubmitting(true);

      const payload = mapPayload(currentFormData);
      try {
        await Api2.patchTrustee(trusteeId, payload);
        navigate.navigateTo(`/trustees/${trusteeId}`);
      } catch (e) {
        globalAlert?.error(`Failed to update trustee assistant: ${(e as Error).message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const validateFormAndUpdateErrors = (formData: TrusteeAssistantFormData): boolean => {
    const results = validateObject(TRUSTEE_ASSISTANT_SPEC, formData);

    if (!results.valid && results.reasonMap) {
      setFieldErrors(results.reasonMap);
    }

    if (!results.valid && results.reasonMap?.$?.reasons) {
      setSaveAlert(results.reasonMap.$.reasons.join(' '));
      partialAddressAlertRef.current?.show();
    }

    return !!results.valid;
  };

  const validateFieldAndUpdate = (
    field: keyof TrusteeAssistantFormData,
    value: string | undefined,
  ): void => {
    const updatedFormData = getFormData({ name: field, value });

    const results = validateObject(TRUSTEE_ASSISTANT_SPEC, updatedFormData);

    if (!results.valid && results.reasonMap) {
      setFieldErrors(results.reasonMap);
    } else {
      setFieldErrors({});
    }
  };

  const getFormData = (override?: {
    name: keyof TrusteeAssistantFormData;
    value: string | undefined;
  }) => {
    const trimmedData = {
      ...formData,
      name: formData.name?.trim(),
      address1: formData.address1?.trim(),
      address2: formData.address2?.trim(),
      city: formData.city?.trim(),
      zipCode: formData.zipCode?.trim(),
      phone: formData.phone?.trim(),
      extension: formData.extension?.trim(),
      email: formData.email?.trim(),
    };

    for (const key of Object.keys(trimmedData)) {
      if (trimmedData[key as keyof TrusteeAssistantFormData] === '') {
        trimmedData[key as keyof TrusteeAssistantFormData] = undefined;
      }
    }

    if (override) {
      return { ...trimmedData, [override.name]: override.value } as TrusteeAssistantFormData;
    }
    return trimmedData;
  };

  const updateField = (field: keyof TrusteeAssistantFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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
      <form
        aria-label="Edit Trustee Assistant"
        data-testid="trustee-assistant-form"
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
                id="assistant-name"
                className="assistant-name-input"
                name="name"
                label="Assistant Name"
                required
                value={formData.name}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['name']?.reasons?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="assistant-address1"
                className="assistant-address1-input"
                name="address1"
                label="Address Line 1"
                required
                value={formData.address1}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address1']?.reasons?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="assistant-address2"
                className="assistant-address2-input"
                name="address2"
                label="Address Line 2"
                value={formData.address2 || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address2']?.reasons?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="assistant-city"
                className="assistant-city-input"
                name="city"
                label="City"
                required
                value={formData.city}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['city']?.reasons?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <UsStatesComboBox
                id="assistant-state"
                className="assistant-state-input"
                name="state"
                label="State"
                required
                selections={formData.state ? [formData.state] : []}
                onUpdateSelection={handleStateSelection}
                autoComplete="off"
                errorMessage={fieldErrors['state']?.reasons?.join(' ')}
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <ZipCodeInput
                id="assistant-zip"
                className="assistant-zip-input"
                name="zipCode"
                label="Zip Code"
                required
                value={formData.zipCode}
                onChange={handleZipCodeChange}
                errorMessage={fieldErrors['zipCode']?.reasons?.join(' ')}
                autoComplete="off"
                ariaDescription="Example: 12345"
              />
            </div>
          </div>

          <div className="form-column">
            <div id="phone-group" className="field-group">
              <PhoneNumberInput
                id="assistant-phone"
                value={formData.phone}
                className="assistant-phone-input"
                name="phone"
                label="Phone"
                required
                onChange={handleFieldChange}
                errorMessage={fieldErrors['phone']?.reasons?.join(' ')}
                autoComplete="off"
              />
              <Input
                id="assistant-extension"
                className="assistant-extension-input"
                name="extension"
                label="Extension"
                value={formData.extension || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['extension']?.reasons?.join(' ')}
                autoComplete="off"
                ariaDescription="Up to 6 digits"
              />
            </div>

            <div className="field-group">
              <Input
                id="assistant-email"
                className="assistant-email-input"
                name="email"
                label="Email"
                required
                value={formData.email}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['email']?.reasons?.join(' ')}
                type="email"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <Alert
          role="alert"
          className="form-field-warning"
          type={UswdsAlertStyle.Error}
          inline={true}
          slim={false}
          ref={partialAddressAlertRef}
          message={saveAlert ?? ''}
        />
        <div className="usa-button-group">
          <Button id="submit-button" type="submit">
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button
            className="spaced-button"
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

export default React.memo(TrusteeAssistantForm);
