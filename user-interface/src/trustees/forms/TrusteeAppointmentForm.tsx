import './TrusteeContactForm.scss';
import './TrusteeAppointmentForm.scss';
import React, { useState, useCallback, useEffect } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { Stop } from '@/lib/components/Stop';
import { TrusteeAppointmentInput, TrusteeAppointment } from '@common/cams/trustee-appointments';
import { ChapterType } from '@common/cams/trustees';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useLocation } from 'react-router-dom';

const CHAPTER_OPTIONS: ComboOption<ChapterType>[] = [
  { value: '7-panel', label: 'Chapter 7 - Panel' },
  { value: '7-non-panel', label: 'Chapter 7 - Non-Panel' },
  { value: '11', label: 'Chapter 11' },
  { value: '11-subchapter-v', label: 'Chapter 11 Subchapter V' },
  { value: '12', label: 'Chapter 12' },
  { value: '13', label: 'Chapter 13' },
];

const STATUS_OPTIONS: ComboOption<'active' | 'inactive'>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

type FormData = {
  districtKey: string; // Combined key: "{courtId}|{divisionCode}"
  chapter: ChapterType;
  status: 'active' | 'inactive';
  effectiveDate: string;
  appointedDate: string;
};

export type TrusteeAppointmentFormProps = {
  trusteeId: string;
  existingAppointments?: TrusteeAppointment[];
};

function TrusteeAppointmentForm(props: Readonly<TrusteeAppointmentFormProps>) {
  const flags = useFeatureFlags();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const navigate = useCamsNavigator();
  const location = useLocation();

  const { trusteeId, existingAppointments: passedAppointments } = props;

  // Try to get appointments from props first, then from navigation state
  const appointmentsFromState = (location.state as { existingAppointments?: TrusteeAppointment[] })
    ?.existingAppointments;
  const appointmentsToUse = passedAppointments ?? appointmentsFromState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(!appointmentsToUse);
  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<TrusteeAppointment[]>(
    appointmentsToUse ?? [],
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    districtKey: '',
    chapter: '' as ChapterType,
    status: '' as 'active' | 'inactive',
    effectiveDate: '',
    appointedDate: '',
  });

  // Track selections for ComboBoxes
  const selectedDistrict = formData.districtKey
    ? districtOptions.find((opt) => opt.value === formData.districtKey)
    : undefined;
  const selectedChapter = CHAPTER_OPTIONS.find((opt) => opt.value === formData.chapter);
  const selectedStatus = STATUS_OPTIONS.find((opt) => opt.value === formData.status);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const response = await Api2.getCourts();
        if (!response.data || response.data.length === 0) {
          throw new Error('No districts available');
        }
        const options = response.data.map((district) => ({
          value: `${district.courtId}|${district.courtDivisionCode}`,
          label: `${district.courtName} - ${district.courtDivisionName}`,
        }));
        setDistrictOptions(options);
      } catch (err) {
        globalAlert?.error('Failed to load districts');
        console.error('Error loading districts:', err);
      } finally {
        setIsLoadingDistricts(false);
      }
    };

    loadDistricts();
  }, [globalAlert]);

  useEffect(() => {
    if (appointmentsToUse) {
      return;
    }

    const loadAppointments = async () => {
      try {
        const response = await Api2.getTrusteeAppointments(trusteeId);
        setExistingAppointments(response.data ?? []);
      } catch (err) {
        globalAlert?.error('Failed to load existing appointments');
        console.error('Error loading appointments:', err);
      } finally {
        setIsLoadingAppointments(false);
      }
    };

    loadAppointments();
  }, [trusteeId, appointmentsToUse, globalAlert]);

  const validateAppointment = useCallback((): boolean => {
    if (!formData.districtKey || !formData.chapter) {
      setValidationError(null);
      return true;
    }

    const [courtId, divisionCode] = formData.districtKey.split('|');

    // Check for overlapping active appointments
    const hasOverlap = existingAppointments.some((appointment) => {
      return (
        appointment.courtId === courtId &&
        appointment.divisionCode === divisionCode &&
        appointment.chapter === formData.chapter &&
        appointment.status === 'active'
      );
    });

    if (hasOverlap) {
      const district = districtOptions.find((opt) => opt.value === formData.districtKey);
      const chapter = CHAPTER_OPTIONS.find((opt) => opt.value === formData.chapter);
      setValidationError(
        `An active appointment already exists for ${chapter?.label} in ${district?.label}. Please end the existing appointment before creating a new one.`,
      );
      return false;
    }

    setValidationError(null);
    return true;
  }, [formData.districtKey, formData.chapter, existingAppointments, districtOptions]);

  // Validate whenever relevant fields change
  useEffect(() => {
    validateAppointment();
  }, [validateAppointment]);

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();

    if (!validateAppointment()) {
      return;
    }

    setIsSubmitting(true);

    const [courtId, divisionCode] = formData.districtKey.split('|');

    const payload: TrusteeAppointmentInput = {
      chapter: formData.chapter,
      courtId,
      divisionCode,
      appointedDate: formData.appointedDate,
      status: formData.status,
      effectiveDate: formData.effectiveDate,
    };

    try {
      await Api2.postTrusteeAppointment(trusteeId, payload);
      navigate.navigateTo(`/trustees/${trusteeId}`);
    } catch (e) {
      globalAlert?.error(`Failed to create appointment: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!flags[TRUSTEE_MANAGEMENT]) {
    return (
      <div data-testid="trustee-appointment-create-disabled">
        Trustee management is not enabled.
      </div>
    );
  }

  if (!canManage) {
    return (
      <Stop
        id="forbidden-alert"
        title="Forbidden"
        message="You do not have permission to manage Trustee Appointments"
        asError
      />
    );
  }

  if (isLoadingDistricts || isLoadingAppointments) {
    return <LoadingSpinner caption="Loading form data..." />;
  }

  const isFormValid =
    formData.districtKey &&
    formData.chapter &&
    formData.status &&
    formData.effectiveDate &&
    formData.appointedDate &&
    !validationError;

  return (
    <div className="trustee-form-screen">
      <form
        aria-label="Add Trustee Appointment"
        data-testid="trustee-appointment-form"
        onSubmit={handleSubmit}
      >
        <div className="form-header">
          <span>
            A red asterisk (<span className="text-secondary-dark">*</span>) indicates a required
            field.
          </span>
        </div>

        {validationError && (
          <Alert type={UswdsAlertStyle.Error} inline={true} show={true} message={validationError} />
        )}

        <div className="form-container">
          <div className="form-column">
            <div className="field-group">
              <ComboBox
                id="district"
                label="District"
                required={true}
                options={districtOptions}
                selections={selectedDistrict ? [selectedDistrict] : undefined}
                onUpdateSelection={(options) => {
                  handleFieldChange('districtKey', options[0]?.value ?? '');
                }}
              />
            </div>

            <div className="field-group">
              <ComboBox
                id="chapter"
                label="Chapter"
                required={true}
                options={CHAPTER_OPTIONS}
                selections={selectedChapter ? [selectedChapter] : undefined}
                onUpdateSelection={(options) => {
                  handleFieldChange('chapter', options[0]?.value ?? '');
                }}
              />
            </div>

            <div className="field-group">
              <ComboBox
                id="status"
                label="Status"
                required={true}
                options={STATUS_OPTIONS}
                selections={selectedStatus ? [selectedStatus] : undefined}
                onUpdateSelection={(options) => {
                  handleFieldChange('status', options[0]?.value ?? '');
                }}
              />
            </div>

            <div className="field-group">
              <Input
                id="effectiveDate"
                name="effectiveDate"
                label="Status Date"
                type="date"
                required={true}
                value={formData.effectiveDate}
                onChange={(e) => handleFieldChange('effectiveDate', e.target.value)}
              />
            </div>

            <div className="field-group">
              <Input
                id="appointedDate"
                name="appointedDate"
                label="Appointment Date"
                type="date"
                required={true}
                value={formData.appointedDate}
                onChange={(e) => handleFieldChange('appointedDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="usa-button-group">
          <Button
            id="submit-button"
            type="submit"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
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

export default React.memo(TrusteeAppointmentForm);
