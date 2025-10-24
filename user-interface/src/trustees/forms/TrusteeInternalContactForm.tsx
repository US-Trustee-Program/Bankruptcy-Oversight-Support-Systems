import './TrusteeContactForm.scss';
import React, { useCallback, useRef, useState } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Stop } from '@/lib/components/Stop';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { TrusteeInput } from '@common/cams/trustees';
import { TRUSTEE_INTERNAL_SPEC, TrusteeInternalFormData } from './trusteeForms.types';
import {
  validateEach,
  validateObject,
  ValidationSpec,
  ValidatorReasonMap,
} from '@common/cams/validation';
import { ContactInformation } from '@common/cams/contact';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';

const getInitialFormData = (
  info: Partial<ContactInformation> | undefined,
): TrusteeInternalFormData => {
  return {
    address1: info?.address?.address1,
    address2: info?.address?.address2,
    city: info?.address?.city,
    state: info?.address?.state,
    zipCode: info?.address?.zipCode,
    phone: info?.phone?.number,
    extension: info?.phone?.extension,
    email: info?.email,
  };
};

export type TrusteeInternalContactFormProps = {
  trusteeId: string;
  cancelTo: string;
  trustee?: Partial<TrusteeInput>;
};

/*
No Fieldsets ✅
No * indicators ✅
No (optional) indicators ✅
Alert but only on save click. ✅
Phone number needs validation if extension is filled out but number is not
Hyphen when typing more than 5 digits in zip code
Validation message for zip code "must be 5 or 9 digits" ✅
Validation for the max length should just say "max length X characters"
(if possible let's fix the alert message on the zip code validation so it doesn't wrap)
When we send null to the API, we are getting null back but we agreed that null should only be sent in the PATCH payload.
*/
function TrusteeInternalContactForm(props: Readonly<TrusteeInternalContactFormProps>) {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();

  const { cancelTo } = props;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldErrors2, setFieldErrors2] = useState<ValidatorReasonMap>({});
  const [formData, setFormData] = useState<TrusteeInternalFormData>(
    getInitialFormData(props.trustee?.internal),
  );
  const partialAddressAlertRef = useRef<AlertRefType>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  const mapPayload = (formData: TrusteeInternalFormData): Partial<TrusteeInput> => {
    return {
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
  };

  const getDynamicSpec = (currentFormData: TrusteeInternalFormData) => {
    const spec: Partial<ValidationSpec<TrusteeInternalFormData>> = { ...TRUSTEE_INTERNAL_SPEC };

    const keys = Object.keys(spec) as Array<keyof TrusteeInternalFormData>;
    for (const key of keys) {
      if ((key as unknown as string) === '$') {
        continue;
      }
      if (!(key in currentFormData)) {
        delete spec[key];
      }
    }

    return spec;
  };

  const clearAddressErrorsIfAllEmpty = (
    fieldName: keyof TrusteeInternalFormData,
    value: string | undefined,
  ): void => {
    const requiredAddressFields = ['address1', 'city', 'state', 'zipCode'];
    const isAddressField = requiredAddressFields.includes(fieldName);
    if (isAddressField && (value === undefined || value.trim() === '')) {
      const currentData = getFormData({ name: fieldName, value });

      const allAddressFieldsEmpty =
        !currentData.address1 && !currentData.city && !currentData.state && !currentData.zipCode;

      if (allAddressFieldsEmpty) {
        setFieldErrors2((prevErrors) => {
          const { ...copy } = prevErrors;
          for (const field of requiredAddressFields) {
            delete copy[field];
          }
          return copy;
        });
      }
    }
  };

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target;
    const value = event.target.value === '' ? undefined : event.target.value;
    const fieldName = name as keyof TrusteeInternalFormData;

    updateField(fieldName, value);
    debounce(() => {
      validateFieldAndUpdate(fieldName, value);
      clearAddressErrorsIfAllEmpty(fieldName, value);
    }, 300);
  };

  const handleStateSelection = (selectedOptions: ComboOption[]) => {
    const value = selectedOptions[0]?.value;
    updateField('state', value);

    debounce(() => {
      validateFieldAndUpdate('state', value);
      clearAddressErrorsIfAllEmpty('state', value);
    }, 300);
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    updateField('zipCode', value);

    debounce(() => {
      validateFieldAndUpdate('zipCode', value);
      clearAddressErrorsIfAllEmpty('zipCode', value);
    }, 300);
  };

  const handleCancel = useCallback(() => {
    navigate.navigateTo(cancelTo);
  }, [navigate, cancelTo]);

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const currentFormData = getFormData();

    if (validateFormAndUpdateErrors(currentFormData)) {
      setErrorMessage(null);
      setIsSubmitting(true);

      const payload = mapPayload(currentFormData);
      try {
        await api.patchTrustee(props.trusteeId, payload);
        navigate.navigateTo(`/trustees/${props.trusteeId}`);
      } catch (e) {
        globalAlert?.error(`Failed to update trustee: ${(e as Error).message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const validateFormAndUpdateErrors = (formData: TrusteeInternalFormData): boolean => {
    const spec = getDynamicSpec(formData);
    const results = validateObject(spec, formData);
    if (!results.valid && results.reasonMap) {
      setFieldErrors2(results.reasonMap);
    }
    return !!results.valid;
  };

  const validateFieldAndUpdate = (
    field: keyof TrusteeInternalFormData,
    value: string | undefined,
  ): ValidatorReasonMap | null => {
    const error = validateField(field, value, TRUSTEE_INTERNAL_SPEC);

    setFieldErrors2((prevErrors) => {
      if (error) {
        return { ...prevErrors, ...error };
      } else {
        const { [field]: _, ...rest } = prevErrors;
        return rest;
      }
    });

    return error;
  };

  function validateField(
    field: keyof TrusteeInternalFormData,
    value: string | undefined,
    spec: Partial<typeof TRUSTEE_INTERNAL_SPEC>,
  ): ValidatorReasonMap | null {
    const valueToEval = value?.trim() || undefined;

    if (spec?.[field]) {
      const result = validateEach(spec[field], valueToEval);
      const validatorReasonMap: ValidatorReasonMap = {};
      if (result.valid) {
        return null;
      } else {
        validatorReasonMap[field] = { reasons: result.reasons };
        return validatorReasonMap;
      }
    } else {
      return null;
    }
  }

  const getFormData = (override?: {
    name: keyof TrusteeInternalFormData;
    value: string | undefined;
  }) => {
    const trimmedData = {
      ...formData,
      address1: formData.address1?.trim(),
      address2: formData.address2?.trim(),
      city: formData.city?.trim(),
      zipCode: formData.zipCode?.trim(),
      phone: formData.phone?.trim(),
      extension: formData.extension?.trim(),
      email: formData.email?.trim(),
    };

    for (const key of Object.keys(trimmedData)) {
      if (trimmedData[key as keyof TrusteeInternalFormData] === '') {
        trimmedData[key as keyof TrusteeInternalFormData] = undefined;
      }
    }

    if (override) {
      return { ...trimmedData, [override.name]: override.value } as TrusteeInternalFormData;
    }
    return trimmedData;
  };

  const updateField = (field: keyof TrusteeInternalFormData, value: unknown) => {
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
      <form aria-label="Edit Trustee" data-testid="trustee-internal-form" onSubmit={handleSubmit}>
        <div className="form-container">
          <div className="form-column">
            <div className="field-group">
              <Input
                id="trustee-address1"
                className="trustee-address1-input"
                name="address1"
                label="Address Line 1"
                value={formData.address1}
                onChange={handleFieldChange}
                errorMessage={fieldErrors2['address1']?.reasons?.join(' ')}
                autoComplete="off"
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
                errorMessage={fieldErrors2['address2']?.reasons?.join(' ')}
                autoComplete="off"
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
                errorMessage={fieldErrors2['city']?.reasons?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <UsStatesComboBox
                id="trustee-state"
                className="trustee-state-input"
                name="state"
                label="State"
                selections={formData.state ? [formData.state] : []}
                onUpdateSelection={handleStateSelection}
                autoComplete="off"
                errorMessage={fieldErrors2['state']?.reasons?.join(' ')}
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <Input
                id="trustee-zip"
                className="trustee-zip-input"
                name="zipCode"
                label="ZIP Code"
                value={formData.zipCode}
                onChange={handleZipCodeChange}
                errorMessage={fieldErrors2['zipCode']?.reasons?.join(' ')}
                autoComplete="off"
                ariaDescription="Example: 12345"
              />
            </div>
          </div>

          <div className="form-column">
            <div id="phone-group" className="field-group">
              <PhoneNumberInput
                id="trustee-phone"
                value={formData.phone}
                className="trustee-phone-input"
                name="phone"
                label="Phone"
                onChange={handleFieldChange}
                errorMessage={fieldErrors2['phone']?.reasons?.join(' ')}
                autoComplete="off"
                ariaDescription="Example: 123-456-7890"
              />
              <Input
                id="trustee-extension"
                className="trustee-extension-input"
                name="extension"
                label="Extension"
                value={formData.extension || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors2['extension']?.reasons?.join(' ')}
                autoComplete="off"
                ariaDescription="Up to 6 digits"
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
                errorMessage={fieldErrors2['email']?.reasons?.join(' ')}
                type="email"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {errorMessage && <div role="alert">{errorMessage}</div>}
        <Alert
          role="alert"
          className="form-field-warning"
          type={UswdsAlertStyle.Error}
          inline={true}
          slim={false}
          ref={partialAddressAlertRef}
          message="You have entered a partial address. Please complete or clear the address fields."
        />
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

export default React.memo(TrusteeInternalContactForm);
