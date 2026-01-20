import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import Api2 from '@/lib/models/api2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useDebounce from '@/lib/hooks/UseDebounce';
import React, { useState, useCallback } from 'react';
import { Trustee, zoomInfoSpec, ZoomInfo } from '@common/cams/trustees';
import { validateEach } from '@common/cams/validation';

const validateField = (fieldName: keyof ZoomInfo, value: string): string | null => {
  const validators = zoomInfoSpec[fieldName];
  if (!validators) return null;

  const result = validateEach(validators, value);
  if (result.valid) return null;

  return result.reasons?.[0] ?? 'Invalid value';
};

type TrusteeZoomInfoFormProps = {
  trustee: Trustee;
};

function TrusteeZoomInfoForm(props: Readonly<TrusteeZoomInfoFormProps>) {
  const globalAlert = useGlobalAlert();
  const debounce = useDebounce();
  const { trustee } = props;
  const trusteeId = trustee.trusteeId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState({
    link: trustee.zoomInfo?.link ?? '',
    phone: trustee.zoomInfo?.phone ?? '',
    meetingId: trustee.zoomInfo?.meetingId ?? '',
    passcode: trustee.zoomInfo?.passcode ?? '', // pragma: allowlist secret
  });

  const navigate = useCamsNavigator();

  const handleCancel = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  const createChangeHandler =
    (fieldName: keyof typeof formState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setFormState((prev) => ({ ...prev, [fieldName]: value }));

      debounce(() => {
        const error = validateField(fieldName, value);
        setFieldErrors((prev) => {
          if (error) {
            return { ...prev, [fieldName]: error };
          }
          const { [fieldName]: _, ...rest } = prev;
          return rest;
        });
      }, 300);
    };

  const validateAll = (state: typeof formState): Record<string, string> => {
    const errors: Record<string, string> = {};
    (Object.keys(state) as (keyof typeof formState)[]).forEach((field) => {
      const error = validateField(field, state[field]);
      if (error) errors[field] = error;
    });
    return errors;
  };

  async function handleSubmit(event?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    event?.preventDefault();

    if (!trusteeId?.trim()) {
      globalAlert?.error('Cannot save zoom information: Trustee ID is missing');
      return;
    }

    const errors = validateAll(formState);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const response = await Api2.patchTrustee(trusteeId, { zoomInfo: formState });
      if (response?.data) {
        navigate.navigateTo(`/trustees/${trusteeId}`);
      }
    } catch (e) {
      globalAlert?.error(`Failed to update zoom information: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  const hasEmptyFields = Object.values(formState).some((v) => !v.trim());
  const isSaveDisabled = isSubmitting || hasErrors || hasEmptyFields;

  return (
    <div className="trustee-zoom-info-form-screen">
      <p>
        A red asterisk (<span className="text-secondary-dark">*</span>) indicates a required field.
      </p>
      <form data-testid="trustee-zoom-info-form">
        <div className="form-container">
          <div className="form-column">
            <Input
              id="trustee-zoom-link"
              label="Zoom Link"
              name="zoom-link"
              value={formState.link}
              onChange={createChangeHandler('link')}
              data-testid="trustee-zoom-link-input"
              required={true}
              className="margin-top-0"
              ariaDescription={[
                'Copy and paste the entire zoom meeting URL here.',
                'Example: https://us02web.zoom.us/j/0000000000',
              ]}
              errorMessage={fieldErrors.link}
            />
            <PhoneNumberInput
              id="trustee-zoom-phone"
              label="Zoom Phone"
              name="zoom-phone"
              value={formState.phone}
              onChange={createChangeHandler('phone')}
              data-testid="trustee-zoom-phone-input"
              required={true}
              errorMessage={fieldErrors.phone}
            />
            <Input
              id="trustee-zoom-meeting-id"
              label="Meeting ID"
              name="zoom-meeting-id"
              value={formState.meetingId}
              onChange={createChangeHandler('meetingId')}
              data-testid="trustee-zoom-meeting-id-input"
              required={true}
              errorMessage={fieldErrors.meetingId}
            />
            <Input
              id="trustee-zoom-passcode"
              label="Passcode"
              name="zoom-passcode"
              value={formState.passcode}
              onChange={createChangeHandler('passcode')}
              data-testid="trustee-zoom-passcode-input"
              required={true}
              errorMessage={fieldErrors.passcode}
            />
          </div>
        </div>
        <div className="grid-row margin-top-5">
          <div className="grid-col-auto">
            <Button
              id="button-trustee-zoom-info-form-submit"
              uswdsStyle={UswdsButtonStyle.Default}
              onClick={handleSubmit}
              disabled={isSaveDisabled}
            >
              Save
            </Button>
          </div>
          <div className="grid-col-auto margin-top-auto margin-bottom-auto">
            <Button
              id="button-trustee-zoom-info-form-cancel"
              uswdsStyle={UswdsButtonStyle.Unstyled}
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default TrusteeZoomInfoForm;
