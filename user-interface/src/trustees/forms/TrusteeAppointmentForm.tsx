import './TrusteeContactForm.scss';
import './TrusteeAppointmentForm.scss';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { Stop } from '@/lib/components/Stop';
import {
  TrusteeAppointmentInput,
  TrusteeAppointment,
  chapterAppointmentTypeMap,
  getStatusOptions,
  formatAppointmentStatus,
} from '@common/cams/trustee-appointments';
import { formatAppointmentType } from '@common/cams/trustees';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useLocation } from 'react-router-dom';
import { ChapterType, AppointmentType, AppointmentStatus } from '@common/cams/types/Appointments';

const CHAPTER_OPTIONS: ComboOption<ChapterType>[] = [
  { value: '7', label: 'Chapter 7' },
  { value: '11', label: 'Chapter 11' },
  { value: '11-subchapter-v', label: 'Chapter 11 Subchapter V' },
  { value: '12', label: 'Chapter 12' },
  { value: '13', label: 'Chapter 13' },
];

function navigateToAppointments(trusteeId: string, navigate: ReturnType<typeof useCamsNavigator>) {
  navigate.navigateTo(`/trustees/${trusteeId}/appointments`);
}

type FormData = {
  districtKey: string; // Combined key: "{courtId}|{divisionCode}"
  chapter: ChapterType;
  appointmentType: AppointmentType;
  status: AppointmentStatus | '';
  effectiveDate: string;
  appointedDate: string;
};

export type TrusteeAppointmentFormProps = {
  trusteeId: string;
  existingAppointments?: TrusteeAppointment[];
  appointment?: TrusteeAppointment;
};

function TrusteeAppointmentForm(props: Readonly<TrusteeAppointmentFormProps>) {
  const flags = useFeatureFlags();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const navigate = useCamsNavigator();
  const location = useLocation();

  const { trusteeId, existingAppointments: passedAppointments, appointment } = props;
  const isEditMode = !!appointment;

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
  const [formData, setFormData] = useState<FormData>(() => {
    if (appointment) {
      return {
        districtKey: `${appointment.courtId}|${appointment.divisionCode}`,
        chapter: appointment.chapter,
        appointmentType: appointment.appointmentType,
        status: appointment.status,
        effectiveDate: appointment.effectiveDate.split('T')[0],
        appointedDate: appointment.appointedDate.split('T')[0],
      };
    }
    return {
      districtKey: '',
      chapter: '' as ChapterType,
      appointmentType: '' as AppointmentType,
      status: 'active' as AppointmentStatus,
      effectiveDate: '',
      appointedDate: '',
    };
  });

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const appointmentTypeOptions = useMemo<ComboOption<AppointmentType>[]>(() => {
    if (!formData.chapter) return [];

    const types = chapterAppointmentTypeMap[formData.chapter];
    const filteredTypes = isEditMode
      ? types
      : types.filter((type) => type !== 'off-panel' && type !== 'out-of-pool');

    return filteredTypes.map((type) => ({
      value: type,
      label: formatAppointmentType(type),
    }));
  }, [formData.chapter, isEditMode]);

  // Dynamically generate status options based on selected chapter and appointment type
  const statusOptions = useMemo<ComboOption<AppointmentStatus>[]>(() => {
    if (!formData.chapter || !formData.appointmentType) return [];

    const statuses = getStatusOptions(formData.chapter, formData.appointmentType);
    return statuses.map((status) => ({
      value: status,
      label: formatAppointmentStatus(status),
    }));
  }, [formData.chapter, formData.appointmentType]);

  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const response = await Api2.getCourts();
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

  // Pure validation function
  const getValidationError = (
    data: FormData,
    appointments: TrusteeAppointment[],
    options: ComboOption[],
    currentAppointmentId?: string,
  ): string | null => {
    if (!data.districtKey || !data.chapter || !data.appointmentType) return null;

    const [courtId, divisionCode] = data.districtKey.split('|');

    const hasOverlap = appointments.some(
      (appointment) =>
        appointment.id !== currentAppointmentId &&
        appointment.courtId === courtId &&
        appointment.divisionCode === divisionCode &&
        appointment.chapter === data.chapter &&
        appointment.appointmentType === data.appointmentType &&
        appointment.status === 'active',
    );

    if (!hasOverlap) return null;

    const district = options.find((opt) => opt.value === data.districtKey);
    const chapter = CHAPTER_OPTIONS.find((opt) => opt.value === data.chapter);
    const appointmentTypeLabel = formatAppointmentType(data.appointmentType);

    return `An active appointment already exists for ${chapter?.label} - ${appointmentTypeLabel} in ${district?.label}. Please end the existing appointment before creating a new one.`;
  };

  const validationError = getValidationError(
    formData,
    existingAppointments,
    districtOptions,
    appointment?.id,
  );

  const isFormValid =
    !!formData.districtKey &&
    !!formData.chapter &&
    !!formData.appointmentType &&
    !!formData.status &&
    !!formData.appointedDate &&
    !validationError;

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();

    if (validationError) {
      return;
    }

    setIsSubmitting(true);

    const [courtId, divisionCode] = formData.districtKey.split('|');

    const payload: TrusteeAppointmentInput = {
      chapter: formData.chapter,
      appointmentType: formData.appointmentType,
      courtId,
      divisionCode,
      appointedDate: formData.appointedDate,
      status: formData.status as AppointmentStatus,
      effectiveDate: isEditMode ? formData.effectiveDate : formData.appointedDate,
    };

    try {
      if (isEditMode && appointment) {
        await Api2.putTrusteeAppointment(trusteeId, appointment.id, payload);
      } else {
        await Api2.postTrusteeAppointment(trusteeId, payload);
      }
      navigateToAppointments(trusteeId, navigate);
    } catch (e) {
      const action = isEditMode ? 'update' : 'create';
      globalAlert?.error(`Failed to ${action} appointment: ${(e as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    navigateToAppointments(trusteeId, navigate);
  }, [navigate, trusteeId]);

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => {
      // When chapter changes, reset appointmentType and status
      if (field === 'chapter') {
        // Type guard to ensure value is a valid ChapterType
        const isValidChapter = (val: string): val is ChapterType => {
          return val in chapterAppointmentTypeMap;
        };

        if (isValidChapter(value)) {
          const types = chapterAppointmentTypeMap[value];
          const filteredTypes = isEditMode
            ? types
            : types.filter((type) => type !== 'off-panel' && type !== 'out-of-pool');
          const appointmentType =
            filteredTypes && filteredTypes.length === 1
              ? filteredTypes[0]
              : ('' as AppointmentType);
          const status = isEditMode ? '' : 'active';
          return { ...prev, chapter: value, appointmentType, status };
        }
      }

      // When appointmentType changes, reset status
      if (field === 'appointmentType') {
        const status = isEditMode ? '' : 'active';
        return {
          ...prev,
          appointmentType: value as AppointmentType,
          status,
        };
      }

      return { ...prev, [field]: value };
    });
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

  return (
    <div className="trustee-form-screen">
      <form
        aria-label={isEditMode ? 'Edit Trustee Appointment' : 'Add Trustee Appointment'}
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
                selections={
                  formData.districtKey
                    ? [districtOptions.find((opt) => opt.value === formData.districtKey)!]
                    : undefined
                }
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
                selections={
                  formData.chapter
                    ? [CHAPTER_OPTIONS.find((opt) => opt.value === formData.chapter)!]
                    : undefined
                }
                onUpdateSelection={(options) => {
                  handleFieldChange('chapter', options[0]?.value ?? '');
                }}
              />
            </div>

            <div className="field-group">
              <ComboBox
                id="appointmentType"
                label="Type"
                required={true}
                disabled={!formData.chapter}
                options={appointmentTypeOptions}
                ariaDescription="Select Chapter to see available types."
                selections={
                  formData.appointmentType
                    ? [
                        appointmentTypeOptions.find(
                          (opt) => opt.value === formData.appointmentType,
                        )!,
                      ]
                    : undefined
                }
                onUpdateSelection={(options) => {
                  handleFieldChange('appointmentType', options[0]?.value ?? '');
                }}
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

            {isEditMode && (
              <div className="field-group">
                <ComboBox
                  id="status"
                  label="Status"
                  required={true}
                  disabled={!formData.chapter || !formData.appointmentType}
                  options={statusOptions}
                  selections={
                    formData.status
                      ? [statusOptions.find((opt) => opt.value === formData.status)!]
                      : undefined
                  }
                  onUpdateSelection={(options) => {
                    handleFieldChange('status', options[0]?.value ?? '');
                  }}
                />
              </div>
            )}

            {isEditMode && (
              <div className="field-group">
                <Input
                  id="effectiveDate"
                  name="effectiveDate"
                  label="Status Effective Date"
                  type="date"
                  required={true}
                  value={formData.effectiveDate}
                  onChange={(e) => handleFieldChange('effectiveDate', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="usa-button-group">
          <Button id="submit-button" type="submit" disabled={!isFormValid || isSubmitting}>
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
