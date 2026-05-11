import './TrusteeContactForm.scss';
import './TrusteeAppointmentForm.scss';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import PillBox from '@/lib/components/PillBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { useLocation } from 'react-router-dom';
import { useDivisionSelection, ALL_DIVISIONS_VALUE } from './useDivisionSelection';
import { findMergeTarget, buildMergeResult } from './appointmentMergeHelpers';

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

type CourtDivisionInput = {
  courtId: string;
  divisionCodes: string[];
  districtKey: string;
};

/**
 * Extract court and division information from form data.
 * Handles both legacy (combined districtKey) and new (separate courtId/divisionCodes) formats.
 * Expands "All Divisions" synthetic value to actual division codes.
 *
 * @param formData - The form data
 * @param useSeparateFields - Whether district-division flag is enabled (separate fields)
 * @param allCourts - All available court divisions (needed for "All Divisions" expansion)
 * @returns {courtId, divisionCodes} or null if required fields are missing
 */
export function extractCourtAndDivisions(
  formData: CourtDivisionInput,
  useSeparateFields: boolean,
  allCourts: CourtDivisionDetails[],
): { courtId: string; divisionCodes: string[] } | null {
  if (useSeparateFields) {
    // New format: separate courtId and divisionCodes fields
    if (!formData.courtId || formData.divisionCodes.length === 0) {
      return null;
    }

    let divisionCodes = formData.divisionCodes;

    // Expand "All Divisions" synthetic value to actual division codes
    if (divisionCodes.includes(ALL_DIVISIONS_VALUE)) {
      divisionCodes = getDivisionsForDistrict(allCourts, formData.courtId).map(
        (d) => d.courtDivisionCode,
      );
    }

    return {
      courtId: formData.courtId,
      divisionCodes,
    };
  } else {
    // Legacy format: combined districtKey (courtId|divisionCode)
    if (!formData.districtKey) {
      return null;
    }

    const [courtId, divisionCode] = formData.districtKey.split('|');
    return {
      courtId,
      divisionCodes: [divisionCode],
    };
  }
}

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
        divisionCodes: appointment.divisionCodes?.length
          ? appointment.divisionCodes
          : appointment.divisionCode
            ? [appointment.divisionCode]
            : [],
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

  // Accessibility: focus management for validation errors
  const validationAlertRef = useRef<HTMLDivElement>(null);
  const [prevValidationError, setPrevValidationError] = useState<string | null>(null);

  // Accessibility: live region for "All Divisions" auto-selection announcement
  const [divisionAnnouncement, setDivisionAnnouncement] = useState('');
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAutoSelectAllDivisions = useCallback(() => {
    const districtName = districtOptions.find((opt) => opt.value === formData.courtId)?.label;
    if (districtName) {
      setDivisionAnnouncement(`All Divisions selected for ${districtName}`);
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
      announcementTimeoutRef.current = setTimeout(() => {
        setDivisionAnnouncement('');
      }, 1000);
    }
  }, [districtOptions, formData.courtId]);

  // Cleanup announcement timeout on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  const handleDivisionCodesChange = useCallback(
    (codes: string[]) => {
      setFormData((prev) => ({ ...prev, divisionCodes: codes }));
    },
    [setFormData],
  );

  const {
    divisionOptions,
    divisionSelections,
    handleDivisionSelection,
    handlePillRemoval,
    handleDivisionBlur,
  } = useDivisionSelection({
    courtId: formData.courtId,
    allCourts,
    divisionCodes: formData.divisionCodes,
    enabled: districtDivisionEnabled,
    onDivisionCodesChange: handleDivisionCodesChange,
    onAutoSelectAllDivisions: handleAutoSelectAllDivisions,
  });

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
        if (districtDivisionEnabled) {
          const uniqueDistricts = getUniqueDistricts(courtsData);
          const options = uniqueDistricts.map((district) => ({
            value: district.courtId,
            label: district.courtName,
          }));
          setDistrictOptions(options);
        } else {
          const sortedCourts = sortByCourtLocation(courtsData);
          const options = sortedCourts.map((district) => {
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
  }, [globalAlert, districtDivisionEnabled]);

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

  // Validation: checks for overlapping active appointments
  const getValidationError = (
    data: FormData,
    appointments: TrusteeAppointment[],
    options: ComboOption[],
    currentAppointmentId?: string,
    doUseSeparateFields?: boolean,
  ): string | null => {
    // Validate required fields
    if (!data.chapter || !data.appointmentType) return null;

    // Extract court and divisions using shared helper
    const courtInfo = extractCourtAndDivisions(data, !!doUseSeparateFields, allCourts);
    if (!courtInfo) return null;

    const { courtId, divisionCodes: divisionCodesToCheck } = courtInfo;

    // Check for overlap: any of the new divisions overlap with any existing appointment's divisions
    const conflictingAppointment = appointments.find((appointment) => {
      if (
        appointment.id === currentAppointmentId ||
        appointment.courtId !== courtId ||
        appointment.chapter !== data.chapter ||
        appointment.appointmentType !== data.appointmentType ||
        appointment.status !== 'active'
      ) {
        return false;
      }

      // Get existing appointment's divisions (could be array or single code for backward compat)
      const existingDivisions = (appointment.divisionCodes || [appointment.divisionCode]).filter(
        Boolean,
      ) as string[];

      // Check if ANY of the new divisions overlap with ANY of the existing divisions
      return divisionCodesToCheck.some((code) => existingDivisions.includes(code));
    });

    if (!conflictingAppointment) return null;

    // Build error message
    const chapter = CHAPTER_OPTIONS.find((opt) => opt.value === data.chapter);
    const appointmentTypeLabel = formatAppointmentType(data.appointmentType);

    let districtLabel: string;
    if (doUseSeparateFields) {
      // Find district name from allCourts
      const court = allCourts.find((c) => c.courtId === courtId);
      // Show the first conflicting division in the error message
      const conflictingDivisionCode =
        conflictingAppointment.divisionCodes?.[0] || conflictingAppointment.divisionCode;
      const division = allCourts.find(
        (c) => c.courtId === courtId && c.courtDivisionCode === conflictingDivisionCode,
      );
      districtLabel = court && division ? `${court.courtName} (${division.courtDivisionName})` : '';
    } else {
      const districtKey = `${courtId}|${conflictingAppointment.divisionCode}`;
      const district = options.find((opt) => opt.value === districtKey);
      districtLabel = district?.label ?? '';
    }

    return `An active appointment already exists for ${chapter?.label} - ${appointmentTypeLabel} in ${districtLabel}. Please end the existing appointment before creating a new one.`;
  };

  const doUseSeparateFields = districtDivisionEnabled;

  const validationError = getValidationError(
    formData,
    existingAppointments,
    districtOptions,
    appointment?.id,
    doUseSeparateFields,
  );

  // Accessibility: move focus to validation error when it newly appears.
  // Uses requestAnimationFrame to run after ComboBox's own focus management.
  useEffect(() => {
    if (validationError && !prevValidationError && validationAlertRef.current) {
      const alertEl = validationAlertRef.current;
      requestAnimationFrame(() => {
        alertEl.focus();
      });
    }
    setPrevValidationError(validationError);
  }, [validationError, prevValidationError]);

  const hasCourtSelection = !!extractCourtAndDivisions(formData, doUseSeparateFields, allCourts);
  const isFormValid =
    hasCourtSelection &&
    !!formData.chapter &&
    !!formData.appointmentType &&
    !!formData.status &&
    (!isEditMode || !!formData.effectiveDate) &&
    !!formData.appointedDate &&
    !validationError;

  const handleSubmit = async (ev: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();

    if (validationError) {
      return;
    }

    setIsSubmitting(true);

    // Extract court and divisions using shared helper
    const courtInfo = extractCourtAndDivisions(formData, doUseSeparateFields, allCourts);
    if (!courtInfo) {
      globalAlert?.warning('Missing required court or division information');
      setIsSubmitting(false);
      return;
    }

    const { courtId, divisionCodes } = courtInfo;

    const payload: TrusteeAppointmentInput = {
      chapter: formData.chapter as AppointmentChapterType,
      appointmentType: formData.appointmentType as AppointmentType,
      courtId,
      divisionCode: divisionCodes[0], // Send first for backward compatibility
      divisionCodes, // Send array of division codes
      appointedDate: formData.appointedDate,
      status: formData.status as AppointmentStatus,
      effectiveDate: isEditMode ? formData.effectiveDate : formData.appointedDate,
    };

    try {
      if (isEditMode && appointment) {
        await Api2.putTrusteeAppointment(trusteeId, appointment.id, payload);
      } else {
        const mergeTarget = findMergeTarget(
          courtId,
          formData.chapter,
          formData.appointmentType,
          existingAppointments,
        );
        const mergeResult = buildMergeResult(mergeTarget, payload, allCourts);

        if (mergeResult.type === 'merged') {
          await Api2.putTrusteeAppointment(trusteeId, mergeResult.targetId, mergeResult.payload);
          globalAlert?.success(
            `Updated existing appointment to include ${mergeResult.addedNames.join(', ')}`,
          );
          navigateToAppointments(trusteeId, navigate);
          return;
        }

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
      if (field === 'courtId' && doUseSeparateFields) {
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

  const handleComboBoxUpdate = (field: keyof FormData, options: ComboOption[]) => {
    handleFieldChange(field, options[0]?.value ?? '');
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
    <div className="appointment-trustee-form-screen">
      <form
        aria-label={isEditMode ? 'Edit Trustee Appointment' : 'Add Trustee Appointment'}
        data-testid="trustee-appointment-form"
        onSubmit={handleSubmit}
      >
        <FormRequirementsNotice />

        {/* Accessibility: live region for auto-selection announcements */}
        <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
          {divisionAnnouncement}
        </div>

        {validationError && (
          <div ref={validationAlertRef} tabIndex={-1} className="trustee-form-error-wrapper">
            <Alert
              type={UswdsAlertStyle.Error}
              inline={true}
              show={true}
              message={validationError}
            />
          </div>
        )}

        <div className="form-container">
          <div className="form-column">
            {doUseSeparateFields ? (
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
                      ariaDescription={
                        formData.courtId
                          ? `Divisions where this trustee will be assigned in ${districtOptions.find((opt) => opt.value === formData.courtId)?.label ?? 'the selected district'}`
                          : 'Select a district first to enable division selection'
                      }
                      selections={divisionSelections}
                      onUpdateSelection={handleDivisionSelection}
                      hideClearAllButton={
                        formData.divisionCodes.length === 1 &&
                        formData.divisionCodes[0] === ALL_DIVISIONS_VALUE
                      }
                    />
                  </div>

                  {/* Division pills - display below dropdown */}
                  {formData.divisionCodes.length > 0 &&
                    divisionSelections &&
                    (formData.divisionCodes.length === 1 &&
                    formData.divisionCodes[0] === ALL_DIVISIONS_VALUE ? (
                      // Show non-interactive badge when only "All Divisions" is selected
                      <div className="division-pills-container">
                        <span className="pill usa-button--unstyled division-pill-static">
                          <div className="pill-text">All Divisions</div>
                        </span>
                      </div>
                    ) : (
                      // Use PillBox for removable specific divisions
                      <PillBox
                        id="division-pills"
                        className="division-pills-container"
                        selections={divisionSelections!}
                        wrapPills={true}
                        ariaLabelPrefix="Division"
                        onSelectionChange={handlePillRemoval}
                      />
                    ))}
                </div>
              </>
            ) : (
              /* Combined district dropdown when flag is OFF */
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
