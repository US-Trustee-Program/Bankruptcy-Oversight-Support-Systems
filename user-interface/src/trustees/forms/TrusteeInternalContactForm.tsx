import './TrusteeContactForm.scss';
import React, { useState, useCallback } from 'react';
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
import { TRUSTEE_INTERNAL_SPEC, TrusteeInternalFormData } from './TrusteeSpecs';
import {
  flattenReasonMap,
  validateEach,
  validateObject,
  ValidationSpec,
} from '@common/cams/validation';
import { ContactInformation } from '@common/cams/contact';
import Validators from '@common/cams/validators';

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

function TrusteeInternalContactForm(props: Readonly<TrusteeInternalContactFormProps>) {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();

  const { cancelTo } = props;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<TrusteeInternalFormData>(
    getInitialFormData(props.trustee?.internal),
  );

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  const mapPayload = (formData: TrusteeInternalFormData): Partial<TrusteeInput> => {
    const payload = {
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

    return payload;
  };

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const currentFormData = getFormData();

    if (validateFormAndUpdateErrors(currentFormData)) {
      setErrorMessage(null);
      setFieldErrors({});
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

  /**
   * Dynamically creates a validation spec based on form state
   * Particularly useful for internal profile editing where certain fields may not be required
   */
  const getDynamicSpec = (currentFormData: TrusteeInternalFormData) => {
    const spec: Partial<ValidationSpec<TrusteeInternalFormData>> = { ...TRUSTEE_INTERNAL_SPEC };

    // TODO: We need to require address if address line 2 is present

    if (
      !currentFormData.address1 &&
      !currentFormData.city &&
      !currentFormData.state &&
      !currentFormData.zipCode
    ) {
      delete spec.address1;
      delete spec.address2;
      delete spec.city;
      delete spec.state;
      delete spec.zipCode;
    }
    if (!currentFormData.phone) {
      delete spec.phone;
    }
    if (!currentFormData.email) {
      delete spec.email;
    }

    return spec;
  };

  const isRequired = (field: keyof TrusteeInternalFormData): { required?: true } => {
    const spec = getDynamicSpec(getFormData());
    // TODO: Phone Extension is optional even if Extension is in the Spec
    // The optional spec is present and incorrectly returns true in the ternary check below
    return spec[field] && spec[field][0] !== Validators.optional ? { required: true } : {};
  };

  const formIsEmpty = (): boolean => {
    const currentData = getFormData();
    return (
      !currentData.address1 &&
      !currentData.address2 &&
      !currentData.city &&
      !currentData.state &&
      !currentData.zipCode &&
      !currentData.phone &&
      !currentData.extension &&
      !currentData.email
    );
  };

  const clearAddressErrorsIfAllEmpty = (
    fieldName: keyof TrusteeInternalFormData,
    value: string,
  ): void => {
    const requiredAddressFields = ['address1', 'city', 'state', 'zipCode'];
    const isAddressField = requiredAddressFields.includes(fieldName);
    if (isAddressField && (value === undefined || value.trim() === '')) {
      const currentData = getFormData({ name: fieldName, value });

      const allAddressFieldsEmpty =
        !currentData.address1 && !currentData.city && !currentData.state && !currentData.zipCode;

      if (allAddressFieldsEmpty) {
        setFieldErrors((prevErrors) => {
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
    const { value, name } = event.target;
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
    setFieldErrors({});
    navigate.navigateTo(cancelTo);
  }, [navigate, cancelTo]);

  const validateFormAndUpdateErrors = (formData: TrusteeInternalFormData): boolean => {
    const results = validateObject(getDynamicSpec(formData), formData);
    if (!results.valid && results.reasonMap) {
      const newFieldErrors = Object.fromEntries(
        Object.entries(flattenReasonMap(results.reasonMap)).map(([jsonPath, reasons]) => {
          const field = jsonPath.split('.')[1];
          return [field, reasons.join('. ') + '.'];
        }),
      );
      setFieldErrors(newFieldErrors);
    }
    return !!results.valid;
  };

  const validateFieldAndUpdate = (
    field: keyof TrusteeInternalFormData,
    value: string,
  ): string | null => {
    const error = validateField(field, value, TRUSTEE_INTERNAL_SPEC);

    setFieldErrors((prevErrors) => {
      if (error) {
        return { ...prevErrors, [field]: error };
      } else {
        const { [field]: _, ...rest } = prevErrors;
        return rest;
      }
    });

    return error;
  };

  function validateField(
    field: keyof TrusteeInternalFormData,
    value: string,
    spec: Partial<typeof TRUSTEE_INTERNAL_SPEC>,
  ): string | null {
    // Convert to string and trim
    const stringValue = String(value);
    const trimmedValue = stringValue.trim();

    if (field === 'extension' && !trimmedValue) {
      return null;
    }

    if (spec?.[field]) {
      const result = validateEach(spec[field], trimmedValue);
      return result.valid ? null : result.reasons!.join(' ');
    } else {
      return null;
    }
  }

  const getFormData = (override?: { name: keyof TrusteeInternalFormData; value: string }) => {
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
                onUpdateSelection={handleStateSelection}
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
                onChange={handleZipCodeChange}
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
          </div>
        </div>

        {errorMessage && <div role="alert">{errorMessage}</div>}
        <div className="usa-button-group">
          <Button id="submit-button" type="submit" onClick={handleSubmit} disabled={formIsEmpty()}>
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
