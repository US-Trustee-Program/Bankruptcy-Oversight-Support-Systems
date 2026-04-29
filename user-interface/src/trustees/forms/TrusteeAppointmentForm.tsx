import './TrusteeContactForm.scss';
import './TrusteeAppointmentForm.scss';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DatePicker from '@/lib/components/uswds/DatePicker';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useFeatureFlags, {
  TRUSTEE_MANAGEMENT,
  TRUSTEE_DISTRICT_DIVISION,
} from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import {
  sortByCourtLocation,
  getUniqueDistricts,
  getDivisionsForDistrict,
} from '@/lib/utils/court-utils';
import { CourtDivisionDetails } from '@common/cams/courts';
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
import {
  AppointmentChapterType,
  AppointmentStatus,
  AppointmentType,
  formatAppointmentType,
} from '@common/cams/trustees';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { useLocation } from 'react-router-dom';

const CHAPTER_OPTIONS: ComboOption<AppointmentChapterType>[] = [
  { value: '7', label: 'Chapter 7' },
  { value: '11', label: 'Chapter 11' },
  { value: '11-subchapter-v', label: 'Chapter 11 Subchapter V' },
  { value: '12', label: 'Chapter 12' },
  { value: '13', label: 'Chapter 13' },
];

function navigateToAppointments(trusteeId: string, navigate: ReturnType<typeof useCamsNavigator>) {
  navigate.navigateTo(`/trustees/${trusteeId}/appointments`);
}

// Helper functions for appointment type derivation
function getAvailableAppointmentTypes(
  chapter: AppointmentChapterType,
  isEditMode: boolean,
): AppointmentType[] {
  const types = chapterAppointmentTypeMap[chapter] ?? [];
  return isEditMode
    ? [...types]
    : types.filter((type) => type !== 'off-panel' && type !== 'out-of-pool');
}

function getDefaultAppointmentType(
  chapter: AppointmentChapterType,
  isEditMode: boolean,
): AppointmentType | '' {
  const types = getAvailableAppointmentTypes(chapter, isEditMode);
  return types.length === 1 ? types[0] : '';
}

// Synthetic value for "All Divisions" option
const ALL_DIVISIONS_VALUE = '__ALL__';

type FormData = {
  districtKey: string; // Combined key: "{courtId}|{divisionCode}" (used when flag is OFF)
  courtId: string; // Separate court ID (used when flag is ON)
  divisionCodes: string[]; // Multi-select division codes (used when flag is ON)
  chapter: AppointmentChapterType | '';
  appointmentType: AppointmentType | '';
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

  // Extract flag value to avoid re-render loops (flags object reference changes)
  const districtDivisionEnabled = !!flags[TRUSTEE_DISTRICT_DIVISION];

  const appointmentsFromState = (location.state as { existingAppointments?: TrusteeAppointment[] })
    ?.existingAppointments;
  const appointmentsToUse = passedAppointments ?? appointmentsFromState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(!appointmentsToUse);
  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [allCourts, setAllCourts] = useState<CourtDivisionDetails[]>([]); // Store raw courts data
  const [existingAppointments, setExistingAppointments] = useState<TrusteeAppointment[]>(
    appointmentsToUse ?? [],
  );
  const [formData, setFormData] = useState<FormData>(() => {
    if (appointment) {
      return {
        districtKey: `${appointment.courtId}|${appointment.divisionCode ?? ''}`,
        courtId: appointment.courtId,
        divisionCodes: appointment.divisionCode ? [appointment.divisionCode] : [],
        chapter: appointment.chapter,
        appointmentType: appointment.appointmentType,
        status: appointment.status,
        effectiveDate: appointment.effectiveDate.split('T')[0],
        appointedDate: appointment.appointedDate.split('T')[0],
      };
    }
    return {
      districtKey: '',
      courtId: '',
      divisionCodes: [], // Start empty, will be set to [ALL_DIVISIONS_VALUE] when district selected
      chapter: '' as AppointmentChapterType,
      appointmentType: '' as AppointmentType,
      status: 'active' as AppointmentStatus,
      effectiveDate: '',
      appointedDate: '',
    };
  });

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const divisionOptions = useMemo<ComboOption[]>(() => {
    if (!formData.courtId || !allCourts.length) return [];

    const divisions = getDivisionsForDistrict(allCourts, formData.courtId);

    return [
      { value: ALL_DIVISIONS_VALUE, label: 'All Divisions' },
      ...divisions.map((div) => ({
        value: div.courtDivisionCode,
        label: div.courtDivisionName,
      })),
    ];
  }, [formData.courtId, allCourts]);

  const appointmentTypeOptions = useMemo<ComboOption<AppointmentType>[]>(() => {
    if (!formData.chapter) return [];

    return getAvailableAppointmentTypes(formData.chapter, isEditMode)
      .map((type) => ({
        value: type,
        label: formatAppointmentType(type),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [formData.chapter, isEditMode]);

  // Dynamically generate status options based on selected chapter and appointment type
  const statusOptions = useMemo<ComboOption<AppointmentStatus>[]>(() => {
    if (!formData.chapter || !formData.appointmentType) return [];

    const statuses = getStatusOptions(formData.chapter, formData.appointmentType);
    return statuses
      .map((status) => ({
        value: status,
        label: formatAppointmentStatus(status),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [formData.chapter, formData.appointmentType]);

  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const response = await Api2.getCourts();
        const courtsData = response.data;
        setAllCourts(courtsData); // Store raw data for division filtering

        // Build district options based on feature flag
        if (districtDivisionEnabled && !isEditMode) {
          // When flag is ON: build options from unique districts
          const uniqueDistricts = getUniqueDistricts(courtsData);
          const options = uniqueDistricts.map((district) => ({
            value: district.courtId,
            label: district.courtName,
          }));
          setDistrictOptions(options);
        } else {
          // When flag is OFF or edit mode: use existing combined format
          const sortedCourts = sortByCourtLocation(courtsData);
          const options = sortedCourts.map((district) => {
            // Build label with guards for missing data
            let label: string;
            if (district.courtName && district.courtDivisionName) {
              label = `${district.courtName} (${district.courtDivisionName})`;
            } else if (district.courtName) {
              label = district.courtName;
            } else {
              label = `Court ${district.courtId}`;
            }

            return {
              value: `${district.courtId}|${district.courtDivisionCode}`,
              label,
            };
          });
          setDistrictOptions(options);
        }
      } catch (err) {
        globalAlert?.error('Failed to load districts');
        console.error('Error loading districts:', err);
      } finally {
        setIsLoadingDistricts(false);
      }
    };

    loadDistricts();
  }, [globalAlert, districtDivisionEnabled, isEditMode]);

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

  // Auto-select "All Divisions" when district is selected
  useEffect(() => {
    if (districtDivisionEnabled && !isEditMode && divisionOptions.length > 0) {
      // Only auto-select if divisions are currently empty (fresh district selection)
      if (formData.divisionCodes.length === 0) {
        setFormData((prev) => ({
          ...prev,
          divisionCodes: [ALL_DIVISIONS_VALUE],
        }));
      }
    }
  }, [divisionOptions, districtDivisionEnabled, isEditMode, formData.divisionCodes.length]);

  // Pure validation function
  const getValidationError = (
    data: FormData,
    appointments: TrusteeAppointment[],
    options: ComboOption[],
    currentAppointmentId?: string,
    useSeparateFields?: boolean,
  ): string | null => {
    // Get courtId and divisionCode based on flag state
    let courtId: string;
    let divisionCode: string;

    if (useSeparateFields) {
      // When flag is ON, use separate fields
      if (
        !data.courtId ||
        data.divisionCodes.length === 0 ||
        !data.chapter ||
        !data.appointmentType
      )
        return null;
      courtId = data.courtId;
      // For validation, use first division code
      divisionCode = data.divisionCodes[0];
    } else {
      // When flag is OFF, use combined districtKey
      if (!data.districtKey || !data.chapter || !data.appointmentType) return null;
      [courtId, divisionCode] = data.districtKey.split('|');
    }

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

    // Build error message
    const chapter = CHAPTER_OPTIONS.find((opt) => opt.value === data.chapter);
    const appointmentTypeLabel = formatAppointmentType(data.appointmentType);

    let districtLabel: string;
    if (useSeparateFields) {
      // Find district name from allCourts
      const court = allCourts.find((c) => c.courtId === courtId);
      const division = allCourts.find(
        (c) => c.courtId === courtId && c.courtDivisionCode === divisionCode,
      );
      districtLabel = court && division ? `${court.courtName} (${division.courtDivisionName})` : '';
    } else {
      const district = options.find((opt) => opt.value === data.districtKey);
      districtLabel = district?.label ?? '';
    }

    return `An active appointment already exists for ${chapter?.label} - ${appointmentTypeLabel} in ${districtLabel}. Please end the existing appointment before creating a new one.`;
  };

  const useSeparateFields = districtDivisionEnabled && !isEditMode;

  const validationError = getValidationError(
    formData,
    existingAppointments,
    districtOptions,
    appointment?.id,
    useSeparateFields,
  );

  const isFormValid = useSeparateFields
    ? !!formData.courtId &&
      formData.divisionCodes.length > 0 &&
      !!formData.chapter &&
      !!formData.appointmentType &&
      !!formData.status &&
      (!isEditMode || !!formData.effectiveDate) &&
      !!formData.appointedDate &&
      !validationError
    : !!formData.districtKey &&
      !!formData.chapter &&
      !!formData.appointmentType &&
      !!formData.status &&
      (!isEditMode || !!formData.effectiveDate) &&
      !!formData.appointedDate &&
      !validationError;

  const handleSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();

    if (validationError) {
      return;
    }

    setIsSubmitting(true);

    // Get courtId and divisionCode(s) based on flag state
    let courtId: string;
    let divisionCode: string | undefined;
    let divisionCodes: string[] | undefined;

    if (useSeparateFields) {
      // When flag is ON, use separate fields and map "All Divisions" to actual codes
      courtId = formData.courtId;

      // Map "__ALL__" to all actual division codes for this district
      divisionCodes = formData.divisionCodes;
      if (divisionCodes.includes(ALL_DIVISIONS_VALUE)) {
        divisionCodes = getDivisionsForDistrict(allCourts, courtId).map((d) => d.courtDivisionCode);
      }

      // Send array to backend (backend now supports divisionCodes array)
      // Also send first as divisionCode for backward compatibility
      divisionCode = divisionCodes[0];
    } else {
      // When flag is OFF, split the composite key
      [courtId, divisionCode] = formData.districtKey.split('|');
    }

    const payload: TrusteeAppointmentInput = {
      chapter: formData.chapter as AppointmentChapterType,
      appointmentType: formData.appointmentType as AppointmentType,
      courtId,
      divisionCode,
      divisionCodes, // New: send array of division codes
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
      // When district (courtId) changes, reset divisions to empty (useEffect will set to "All Divisions")
      if (field === 'courtId' && useSeparateFields) {
        return { ...prev, courtId: value, divisionCodes: [] };
      }

      // When chapter changes, reset appointmentType and status
      if (field === 'chapter') {
        // Type guard to ensure value is a valid AppointmentChapterType
        const isValidChapter = (val: string): val is AppointmentChapterType => {
          return val in chapterAppointmentTypeMap;
        };

        if (isValidChapter(value)) {
          const appointmentType = getDefaultAppointmentType(value, isEditMode);
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

  const getSelections = (fieldValue: string, options: ComboOption[]) => {
    if (!fieldValue) return undefined;
    const selected = options.find((opt) => opt.value === fieldValue);
    return selected ? [selected] : undefined;
  };

  const getMultiSelections = (fieldValues: string[], options: ComboOption[]) => {
    if (!fieldValues || fieldValues.length === 0) return undefined;
    const selected = options.filter((opt) => fieldValues.includes(opt.value));
    return selected.length > 0 ? selected : undefined;
  };

  const handleComboBoxUpdate = (field: keyof FormData, options: ComboOption[]) => {
    handleFieldChange(field, options[0]?.value ?? '');
  };

  // Handle division selection with mutually exclusive "All Divisions" logic
  const handleDivisionSelection = (selectedOptions: ComboOption[]) => {
    const selectedValues = selectedOptions.map((opt) => opt.value);
    const prevValues = formData.divisionCodes;

    // Edge case: User clicked X to clear "All Divisions" - prevent it by re-selecting
    if (selectedValues.length === 0 && prevValues.includes(ALL_DIVISIONS_VALUE)) {
      return; // Do nothing, keep "All Divisions" selected
    }

    // If both "All Divisions" and specific divisions are present
    if (selectedValues.includes(ALL_DIVISIONS_VALUE) && selectedValues.length > 1) {
      // Determine what was just added
      const addedValues = selectedValues.filter((v) => !prevValues.includes(v));

      if (addedValues.includes(ALL_DIVISIONS_VALUE)) {
        // "All Divisions" was just added - keep only it
        setFormData((prev) => ({ ...prev, divisionCodes: [ALL_DIVISIONS_VALUE] }));
      } else {
        // A specific division was just added - remove "All Divisions"
        setFormData((prev) => ({
          ...prev,
          divisionCodes: selectedValues.filter((v) => v !== ALL_DIVISIONS_VALUE),
        }));
      }
      return;
    }

    // Normal case: just update to whatever was selected
    setFormData((prev) => ({ ...prev, divisionCodes: selectedValues }));
  };

  // Handle when focus leaves the entire division dropdown component
  const handleDivisionBlur = (e: React.FocusEvent) => {
    const currentTarget = e.currentTarget;

    // Check if the new focus target is outside the division dropdown component
    setTimeout(() => {
      // If focus moved to an element outside this component
      if (!currentTarget.contains(document.activeElement)) {
        if (!formData.courtId || !allCourts.length) return;

        const allAvailableDivisions = getDivisionsForDistrict(allCourts, formData.courtId).map(
          (d) => d.courtDivisionCode,
        );

        // If user selected all individual divisions (and not already "All Divisions")
        if (
          !formData.divisionCodes.includes(ALL_DIVISIONS_VALUE) &&
          formData.divisionCodes.length === allAvailableDivisions.length &&
          formData.divisionCodes.length > 0 &&
          allAvailableDivisions.every((code) => formData.divisionCodes.includes(code))
        ) {
          // Auto-convert to "All Divisions"
          setFormData((prev) => ({ ...prev, divisionCodes: [ALL_DIVISIONS_VALUE] }));
        }
      }
    }, 100);
  };

  const handleDateChange = (field: keyof FormData, e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange(field, e.target.value);
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
        <FormRequirementsNotice />

        {validationError && (
          <Alert type={UswdsAlertStyle.Error} inline={true} show={true} message={validationError} />
        )}

        <div className="form-container">
          <div className="form-column">
            {useSeparateFields ? (
              <>
                {/* District dropdown when flag is ON */}
                <div className="field-group">
                  <ComboBox
                    id="district"
                    label="District"
                    required={true}
                    options={districtOptions}
                    selections={getSelections(formData.courtId, districtOptions)}
                    onUpdateSelection={(options) => handleComboBoxUpdate('courtId', options)}
                  />
                </div>

                {/* Division dropdown when flag is ON */}
                <div className="field-group division-field-group">
                  <div className="division-dropdown-wrapper" onBlur={handleDivisionBlur}>
                    <ComboBox
                      id="division"
                      label="Assignable Divisions"
                      required={true}
                      multiSelect={true}
                      wrapPills={true}
                      pluralLabel="divisions"
                      singularLabel="division"
                      disabled={!formData.courtId}
                      options={divisionOptions}
                      ariaDescription="Divisions where this trustee will be assigned"
                      selections={getMultiSelections(formData.divisionCodes, divisionOptions)}
                      onUpdateSelection={handleDivisionSelection}
                      hideClearAllButton={
                        formData.divisionCodes.length === 1 &&
                        formData.divisionCodes[0] === ALL_DIVISIONS_VALUE
                      }
                    />
                  </div>

                  {/* Division pills - display below dropdown */}
                  {formData.divisionCodes.length > 0 && (
                    <div className="division-pills-container">
                      {getMultiSelections(formData.divisionCodes, divisionOptions)?.map(
                        (division) => {
                          const showRemoveButton = !(
                            formData.divisionCodes.length === 1 &&
                            formData.divisionCodes[0] === ALL_DIVISIONS_VALUE
                          );
                          return (
                            <span key={division.value} className="usa-tag division-pill">
                              {division.label}
                              {showRemoveButton && (
                                <button
                                  type="button"
                                  className="usa-tag__remove-button"
                                  onClick={() => {
                                    const newCodes = formData.divisionCodes.filter(
                                      (code) => code !== division.value,
                                    );
                                    // If removing last item, default back to "All Divisions"
                                    setFormData((prev) => ({
                                      ...prev,
                                      divisionCodes:
                                        newCodes.length === 0 ? [ALL_DIVISIONS_VALUE] : newCodes,
                                    }));
                                  }}
                                  aria-label={`Remove ${division.label}`}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Combined district dropdown when flag is OFF or edit mode */
              <div className="field-group">
                <ComboBox
                  id="district"
                  label="District"
                  required={true}
                  options={districtOptions}
                  selections={getSelections(formData.districtKey, districtOptions)}
                  onUpdateSelection={(options) => handleComboBoxUpdate('districtKey', options)}
                />
              </div>
            )}

            <div className="field-group">
              <ComboBox
                id="chapter"
                label="Chapter"
                required={true}
                options={CHAPTER_OPTIONS}
                selections={getSelections(formData.chapter, CHAPTER_OPTIONS)}
                onUpdateSelection={(options) => handleComboBoxUpdate('chapter', options)}
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
                selections={getSelections(formData.appointmentType, appointmentTypeOptions)}
                onUpdateSelection={(options) => handleComboBoxUpdate('appointmentType', options)}
              />
            </div>

            <div className="field-group appointedDate">
              <DatePicker
                id="appointedDate"
                name="appointedDate"
                label="Appointment Date"
                required={true}
                value={formData.appointedDate}
                onChange={(e) => handleDateChange('appointedDate', e)}
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
                  selections={getSelections(formData.status, statusOptions)}
                  onUpdateSelection={(options) => handleComboBoxUpdate('status', options)}
                />
              </div>
            )}

            {isEditMode && (
              <div className="field-group">
                <DatePicker
                  id="effectiveDate"
                  name="effectiveDate"
                  label="Status Effective Date"
                  required={true}
                  value={formData.effectiveDate}
                  onChange={(e) => handleDateChange('effectiveDate', e)}
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

export default React.memo(TrusteeAppointmentForm);
