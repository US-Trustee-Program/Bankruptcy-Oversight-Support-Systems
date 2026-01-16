import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import Api2 from '@/lib/models/api2';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import useDebounce from '@/lib/hooks/UseDebounce';
import React, { useState, useCallback } from 'react';
import { Trustee } from '@common/cams/trustees';
import { PHONE_REGEX, WEBSITE_RELAXED_REGEX } from '@common/cams/regex';

const MEETING_ID_REGEX = /^\d{9,11}$/;

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
  const [link, setLink] = useState<string>(trustee.zoomInfo?.link ?? '');
  const [phone, setPhone] = useState<string>(trustee.zoomInfo?.phone ?? '');
  const [meetingId, setMeetingId] = useState<string>(trustee.zoomInfo?.meetingId ?? '');
  const [passcode, setPasscode] = useState<string>(trustee.zoomInfo?.passcode ?? '');

  const navigate = useCamsNavigator();

  const handleCancel = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  const validateLink = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Zoom Link is required';
    }
    if (!WEBSITE_RELAXED_REGEX.test(value)) {
      return 'Zoom Link must be a valid URL';
    }
    if (value.length > 255) {
      return 'Max length 255 characters';
    }
    return null;
  };

  const validatePhone = (value: string): string | null => {
    if (!value || value.trim() === '' || !PHONE_REGEX.test(value)) {
      return 'Must be a valid phone number';
    }
    return null;
  };

  const validateMeetingId = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Meeting ID is required';
    }
    if (!MEETING_ID_REGEX.test(value)) {
      return 'Must be 9 to 11 digits';
    }
    return null;
  };

  const validateField = (fieldName: string, value: string): string | null => {
    if (fieldName === 'link') {
      return validateLink(value);
    }
    if (fieldName === 'phone') {
      return validatePhone(value);
    }
    if (fieldName === 'meetingId') {
      return validateMeetingId(value);
    }
    if (!value || value.trim() === '') {
      const fieldLabels: Record<string, string> = {
        passcode: 'Passcode', // pragma: allowlist secret
      };
      const label = fieldLabels[fieldName] || fieldName;
      return `${label} is required`;
    }
    return null;
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLink(value);

    debounce(() => {
      const error = validateLink(value);
      setFieldErrors((prev) => {
        if (error) {
          return { ...prev, link: error };
        } else {
          const { link: _, ...rest } = prev;
          return rest;
        }
      });
    }, 300);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);

    debounce(() => {
      const error = validatePhone(value);
      setFieldErrors((prev) => {
        if (error) {
          return { ...prev, phone: error };
        } else {
          const { phone: _, ...rest } = prev;
          return rest;
        }
      });
    }, 300);
  };

  const handleMeetingIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMeetingId(value);

    debounce(() => {
      const error = validateField('meetingId', value);
      setFieldErrors((prev) => {
        if (error) {
          return { ...prev, meetingId: error };
        } else {
          const { meetingId: _, ...rest } = prev;
          return rest;
        }
      });
    }, 300);
  };

  const handlePasscodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasscode(value);

    debounce(() => {
      const error = validateField('passcode', value);
      setFieldErrors((prev) => {
        if (error) {
          return { ...prev, passcode: error };
        } else {
          const { passcode: _, ...rest } = prev;
          return rest;
        }
      });
    }, 300);
  };

  async function handleSubmit(event?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (event) {
      event.preventDefault();
    }

    // Guard clause: prevent submission if trusteeId is missing
    if (!trusteeId || trusteeId.trim() === '') {
      globalAlert?.error('Cannot save zoom information: Trustee ID is missing');
      return;
    }

    // Validate all fields
    const errors: Record<string, string> = {};

    const linkError = validateField('link', link);
    if (linkError) errors.link = linkError;

    const phoneError = validatePhone(phone);
    if (phoneError) errors.phone = phoneError;

    const meetingIdError = validateField('meetingId', meetingId);
    if (meetingIdError) errors.meetingId = meetingIdError;

    const passcodeError = validateField('passcode', passcode);
    if (passcodeError) errors.passcode = passcodeError;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear any previous errors
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const zoomInfoToSend = {
        link,
        phone,
        meetingId,
        passcode,
      };

      const response = await Api2.patchTrustee(trusteeId, {
        zoomInfo: zoomInfoToSend,
      });
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
  const hasEmptyFields = !link.trim() || !phone.trim() || !meetingId.trim() || !passcode.trim();
  const isSaveDisabled = isSubmitting || hasErrors || hasEmptyFields;

  return (
    <div className="trustee-zoom-info-form-screen">
      <h3>Edit 341 meeting Information</h3>
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
              value={link}
              onChange={handleLinkChange}
              data-testid="trustee-zoom-link-input"
              required={true}
              ariaDescription={[
                'Copy and paste the entire zoom meeting URI here.',
                'Example: https://us02web.zoom.us/j/0000000000',
              ]}
              errorMessage={fieldErrors.link}
            />
            <PhoneNumberInput
              id="trustee-zoom-phone"
              label="Zoom Phone"
              name="zoom-phone"
              value={phone}
              onChange={handlePhoneChange}
              data-testid="trustee-zoom-phone-input"
              required={true}
              errorMessage={fieldErrors.phone}
            />
            <Input
              id="trustee-zoom-meeting-id"
              label="Meeting ID"
              name="zoom-meeting-id"
              value={meetingId}
              onChange={handleMeetingIdChange}
              data-testid="trustee-zoom-meeting-id-input"
              required={true}
              errorMessage={fieldErrors.meetingId}
            />
            <Input
              id="trustee-zoom-passcode"
              label="Passcode"
              name="zoom-passcode"
              value={passcode}
              onChange={handlePasscodeChange}
              data-testid="trustee-zoom-passcode-input"
              required={true}
              errorMessage={fieldErrors.passcode}
            />
          </div>
        </div>
        <div className="grid-row margin-top-4">
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
