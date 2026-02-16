import './TrusteeContactForm.scss';
import './TrusteePublicContactForm.scss';
import React, { useState, useCallback } from 'react';
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
import { TrusteeInput } from '@common/cams/trustees';
import { TrusteePublicFormData, trusteePublicSpec } from './trusteeForms.types';
import { flattenReasonMap, validateEach, validateObject } from '@common/cams/validation';
import { normalizeFormData } from './trusteeForms.utils';
import { scrollToFirstError } from '@/lib/utils/form-helpers';

const getInitialFormData = (info: Partial<TrusteeInput> | undefined): TrusteePublicFormData => {
  return {
    name: info?.name,
    companyName: info?.public?.companyName,
    address1: info?.public?.address?.address1,
    address2: info?.public?.address?.address2,
    city: info?.public?.address?.city,
    state: info?.public?.address?.state,
    zipCode: info?.public?.address?.zipCode,
    phone: info?.public?.phone?.number,
    extension: info?.public?.phone?.extension,
    email: info?.public?.email,
    website: info?.public?.website,
  };
};

export function validateField(
  field: keyof TrusteePublicFormData,
  value: string,
): string | undefined {
  const stringValue = String(value);
  const trimmedValue = stringValue.trim();

  if (
    (field === 'extension' && !trimmedValue) ||
    (field === 'website' && !trimmedValue) ||
    (field === 'companyName' && !trimmedValue)
  ) {
    return undefined;
  }

  if (trusteePublicSpec[field]) {
    const result = validateEach(trusteePublicSpec[field], trimmedValue);
    return result.valid ? undefined : result.reasons!.join(' ');
  }

  return undefined;
}

export type TrusteePublicContactFormProps = {
  trusteeId?: string;
  action: 'create' | 'edit';
  cancelTo: string;
  trustee?: Partial<TrusteeInput>;
};

function TrusteePublicContactForm(props: Readonly<TrusteePublicContactFormProps>) {
  const flags = useFeatureFlags();

  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();

  const { cancelTo } = props;
  const isCreate = props.action === 'create';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<TrusteePublicFormData>(
    getInitialFormData(props.trustee ?? undefined),
  );

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  // TODO: 12/17/25 This method returns partial but the return value is 'as TrusteeInput' in the submit handler. Let's fix that.
  // maybe use 'satisfies' operator, but we'll need to adjust the mapPayload return type accordingly.
  const mapPayload = (formData: TrusteePublicFormData): Partial<TrusteeInput> => {
    const trimmedCompanyName = formData.companyName?.trim();

    return {
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
        ...(formData.website && formData.website.length > 0 && { website: formData.website }),
        ...(trimmedCompanyName && { companyName: trimmedCompanyName }),
      },
    } as TrusteeInput;
  };

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const currentFormData = normalizeFormData(formData);

    if (validateFormAndUpdateErrors(currentFormData)) {
      setFieldErrors({});
      setIsSubmitting(true);

      const payload = mapPayload(currentFormData);
      try {
        if (isCreate) {
          // TODO: 12/17/25 Let's get rid of the need to use 'as' here.
          // Modify the return type for Api2.postTrustee to include the intended partial
          // which includes only the trusteeId.
          const response = await Api2.postTrustee(payload as TrusteeInput);
          const createdId = (response as { data?: { trusteeId?: string } })?.data?.trusteeId;
          navigate.navigateTo(`/trustees/${createdId}`);
        } else {
          await Api2.patchTrustee(props.trusteeId!, payload);
          navigate.navigateTo(`/trustees/${props.trusteeId}`);
        }
      } catch (e) {
        globalAlert?.error(
          `Failed to ${isCreate ? 'create' : 'update'} trustee: ${(e as Error).message}`,
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const requiredFields: Set<keyof TrusteePublicFormData> = new Set([
    'name',
    'address1',
    'city',
    'state',
    'zipCode',
    'phone',
    'email',
  ]);

  const isRequired = (field: keyof TrusteePublicFormData): { required?: true } => {
    return requiredFields.has(field) ? { required: true } : {};
  };

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, name } = event.target;
    const fieldName = name as keyof TrusteePublicFormData;

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
    const { value } = e.target;
    updateField('zipCode', value);

    debounce(() => {
      validateFieldAndUpdate('zipCode', value);
    }, 300);
  };

  const handleCancel = useCallback(() => {
    setFieldErrors({});
    navigate.navigateTo(cancelTo);
  }, [navigate, cancelTo]);

  const validateFormAndUpdateErrors = (formData: TrusteePublicFormData): boolean => {
    const results = validateObject(trusteePublicSpec, formData);
    if (!results.valid && results.reasonMap) {
      const newFieldErrors = Object.fromEntries(
        Object.entries(flattenReasonMap(results.reasonMap)).map(([jsonPath, reasons]) => {
          const field = jsonPath.split('.')[1];
          return [field, reasons.join('. ') + '.'];
        }),
      );
      setFieldErrors(newFieldErrors);
      scrollToFirstError();
    }
    return !!results.valid;
  };

  const validateFieldAndUpdate = (field: keyof TrusteePublicFormData, value: string): void => {
    const error = validateField(field, value);

    setFieldErrors((prevErrors) => {
      if (error) {
        return { ...prevErrors, [field]: error };
      } else {
        const { [field]: _, ...rest } = prevErrors;
        return rest;
      }
    });
  };

  const updateField = (field: keyof TrusteePublicFormData, value: unknown) => {
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
      <div className="form-header">
        {isCreate && (
          <h1 className="text-no-wrap display-inline-block margin-right-1 create-trustee">
            Add Trustee Profile
          </h1>
        )}
      </div>

      <form
        noValidate
        aria-label={`${isCreate ? 'Create' : 'Edit'} Trustee`}
        data-testid="trustee-public-form"
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
                id="trustee-company-name"
                className="trustee-company-name-input"
                name="companyName"
                label="Company Name"
                value={formData.companyName || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['companyName']}
                autoComplete="off"
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
                onUpdateSelection={handleStateSelection}
                autoComplete="off"
                errorMessage={fieldErrors['state']}
                {...isRequired('state')}
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <ZipCodeInput
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
          </div>
        </div>

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

export default React.memo(TrusteePublicContactForm);
