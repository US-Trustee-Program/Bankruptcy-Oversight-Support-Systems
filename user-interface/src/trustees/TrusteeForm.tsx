import './TrusteeForm.scss';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { useTrusteeFormValidation } from '@/trustees/UseTrusteeFormValidation';
import type { TrusteeFormData } from '@/trustees/UseTrusteeFormValidation.types';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { CourtDivisionDetails } from '@common/cams/courts';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Stop } from '@/lib/components/Stop';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import { ChapterType, Trustee, TrusteeInput, TrusteeStatus } from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import { useLocation } from 'react-router-dom';

export type TrusteeFormState = {
  action: 'create' | 'edit';
  cancelTo: string;
  trustee?: Trustee;
  contactInformation?: 'internal' | 'public';
};

const CHAPTER_OPTIONS: ComboOption<ChapterType>[] = [
  { value: '7-panel', label: '7 - Panel' },
  { value: '7-non-panel', label: '7 - Non-Panel' },
  { value: '11', label: '11' },
  { value: '11-subchapter-v', label: '11 - Subchapter V' },
  { value: '12', label: '12' },
  { value: '13', label: '13' },
];

const STATUS_OPTIONS: ComboOption<TrusteeStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'not active', label: 'Not Active' },
  { value: 'suspended', label: 'Suspended' },
];

export type SubmissionResult = {
  success: boolean;
  message?: string;
};

function TrusteeForm() {
  const flags = useFeatureFlags();
  const api = useApi2();
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const { fieldErrors, validateFieldAndUpdate, clearErrors, isFormValidAndComplete } =
    useTrusteeFormValidation();
  const debounce = useDebounce();

  const districtComboRef = React.useRef<ComboBoxRef | null>(null);
  const statusComboRef = React.useRef<ComboBoxRef | null>(null);
  const statusInitialized = React.useRef(false);

  const location = useLocation();
  const passedState = location.state as TrusteeFormState;

  const doEditInternalProfile =
    passedState.action === 'edit' && passedState.contactInformation === 'internal';
  const doEditPublicProfile =
    passedState.action === 'edit' && passedState.contactInformation === 'public';
  const doCreate = passedState.action === 'create';
  const { cancelTo } = passedState;

  let info: ContactInformation | null = null;
  if (doEditInternalProfile && passedState.trustee?.internal) {
    info = passedState.trustee.internal;
  } else if (doEditPublicProfile && passedState.trustee?.public) {
    info = passedState.trustee.public;
  }

  const [name, setName] = useState(passedState.trustee?.name ?? '');
  const [address1, setAddress1] = useState(info?.address?.address1 ?? '');
  const [address2, setAddress2] = useState(info?.address?.address2 ?? '');
  const [city, setCity] = useState(info?.address?.city ?? '');
  const [state, setState] = useState(info?.address?.state ?? '');
  const [zipCode, setZipCode] = useState(info?.address?.zipCode ?? '');
  const [phone, setPhone] = useState(info?.phone?.number ?? '');
  const [extension, setExtension] = useState(info?.phone?.extension ?? '');
  const [email, setEmail] = useState(info?.email ?? '');
  const [districts, setDistricts] = useState<string[]>(passedState.trustee?.districts ?? []);
  const [chapters, setChapters] = useState<ChapterType[]>(passedState.trustee?.chapters ?? []);
  const [status, setStatus] = useState<TrusteeStatus>(passedState.trustee?.status ?? 'active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [districtOptions, setDistrictOptions] = useState<ComboOption[]>([]);
  const [districtLoadError, setDistrictLoadError] = useState<string | null>(null);

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
  const navigate = useCamsNavigator();

  const onSubmit = async (formData: TrusteeFormData): Promise<SubmissionResult> => {
    const result: SubmissionResult = { success: true };
    let payload;
    if (doCreate || doEditPublicProfile) {
      payload = {
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
        },
        ...(formData.districts &&
          formData.districts.length > 0 && { districts: formData.districts }),
        ...(formData.chapters && formData.chapters.length > 0 && { chapters: formData.chapters }),
        status: formData.status,
      } satisfies TrusteeInput;
    } else {
      payload = {
        internal: {
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
        },
      } satisfies Partial<TrusteeInput>;
    }

    try {
      if (doCreate) {
        const response = await api.postTrustee(payload as TrusteeInput);
        const createdId = (response as { data?: { id?: string } })?.data?.id;
        navigate.navigateTo(`/trustees/${createdId}`);
      } else {
        await api.patchTrustee(passedState.trustee?.id || '', payload);
        navigate.navigateTo(`/trustees/${passedState.trustee?.id}`);
      }
    } catch (e) {
      result.success = false;

      if (e instanceof Error) {
        result.message = e.message;
      } else {
        result.message = doCreate ? 'Could not create trustee.' : 'Could not edit trustee.';
      }
    }
    return result;
  };

  useEffect(() => {
    setDistrictLoadError(null);
    api
      .getCourts()
      .then((response) => {
        if (!response?.data) {
          throw new Error('No data received from getCourts API');
        }

        const courts = response.data;

        const districtMap = new Map<string, ComboOption>();
        courts.forEach((court: CourtDivisionDetails) => {
          const label = `${court.courtName} (${court.courtDivisionName})`;
          districtMap.set(court.courtDivisionCode, {
            value: court.courtDivisionCode,
            label: label,
          });
        });

        const options = Array.from(districtMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );

        setDistrictOptions(options);
      })
      .catch((error) => {
        setDistrictLoadError(
          `Failed to load district options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        setDistrictOptions([]);
      });
  }, [api]);

  useEffect(() => {
    if (districtComboRef.current) {
      const selections = districts.reduce((acc, selection) => {
        const option = districtOptions.find((option) => option.value === selection);
        if (option) {
          acc.push(option);
        }
        return acc;
      }, [] as ComboOption[]);
      districtComboRef.current.setSelections(selections);
    }
  }, [districtOptions, passedState.trustee?.districts, districtComboRef.current]);

  const setStatusComboRef = (el: ComboBoxRef | null) => {
    statusComboRef.current = el;

    if (el && !statusInitialized.current) {
      el.setSelections([STATUS_OPTIONS[0]]);
      statusInitialized.current = true;
    }
  };

  // React hooks must be called before any conditional returns
  const chapterSelections = useMemo(() => {
    return chapters.reduce((acc, selection) => {
      const option = CHAPTER_OPTIONS.find((option) => option.value === selection);
      if (option) {
        acc.push(option);
      }
      return acc;
    }, [] as ComboOption[]);
  }, [chapters]);

  const statusSelection = useMemo(() => {
    const option = STATUS_OPTIONS.find((option) => option.value === status);

    if (option) {
      return option;
    } else {
      return STATUS_OPTIONS.find((option) => option.value === 'active')!;
    }
  }, [status]);

  const getFormData = useCallback((): TrusteeFormData => {
    return {
      name: name.trim(),
      address1: address1.trim(),
      address2: address2.trim() || undefined,
      city: city.trim(),
      state: state,
      zipCode: zipCode.trim(),
      phone: phone.trim(),
      extension: extension.trim() || undefined,
      email: email.trim(),
      districts: districts.length > 0 ? districts : undefined,
      chapters: chapters.length > 0 ? chapters : undefined,
      status: status,
    };
  }, [
    name,
    address1,
    address2,
    city,
    state,
    zipCode,
    phone,
    extension,
    email,
    districts,
    chapters,
    status,
  ]);

  const handleFieldChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const { value, name } = event.target;
    setter(value);

    debounce(() => {
      validateFieldAndUpdate(name as keyof TrusteeFormData, value);
    }, 300);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();

    const formData = getFormData();
    if (isFormValidAndComplete(formData)) {
      setErrorMessage(null);
      clearErrors();
      setIsSubmitting(true);

      try {
        const result = await onSubmit(formData);
        if (!result.success) {
          globalAlert?.error(`Failed to create trustee: ${result.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Could not create trustee.';
        globalAlert?.error(`Failed to create trustee: ${errorMessage}`);
        setErrorMessage(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = useCallback(() => {
    clearErrors();
    navigate.navigateTo(cancelTo);
  }, [clearErrors, navigate, cancelTo]);

  function handleComboBoxUpdate<T>(
    fieldName: keyof TrusteeFormData,
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    isMultiSelect: true,
  ): (selectedOptions: ComboOption[]) => void;
  function handleComboBoxUpdate<T>(
    fieldName: keyof TrusteeFormData,
    setter: React.Dispatch<React.SetStateAction<T>>,
    isMultiSelect: false,
  ): (selectedOptions: ComboOption[]) => void;
  function handleComboBoxUpdate<T>(
    fieldName: keyof TrusteeFormData,
    setter: React.Dispatch<React.SetStateAction<T[] | T>>,
    isMultiSelect: boolean,
  ) {
    return (selectedOptions: ComboOption[]) => {
      debounce(() => {
        const selectedValues = selectedOptions.map((option) => option.value as T);
        validateFieldAndUpdate(fieldName, selectedValues.join(','));

        if (isMultiSelect) {
          (setter as React.Dispatch<React.SetStateAction<T[]>>)(selectedValues);
        } else {
          (setter as React.Dispatch<React.SetStateAction<T>>)(selectedValues[0]);
        }
      }, 300);
    };
  }

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
        <h1 className="text-no-wrap display-inline-block margin-right-1">
          {passedState.action === 'create' ? 'Add Trustee Profile' : 'Edit Trustee Profile'}
          {passedState.contactInformation === 'internal' ? ' (USTP Internal)' : ' (Public)'}
        </h1>
        {districtLoadError && (
          <Stop id="trustee-stop" title="Error" message={districtLoadError} asError />
        )}
      </div>

      <form aria-label="Create Trustee" data-testid="trustee-form" onSubmit={handleSubmit}>
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
                disabled={passedState.contactInformation === 'internal'}
                label="Trustee Name"
                value={name}
                onChange={(e) => handleFieldChange(e, setName)}
                errorMessage={fieldErrors['name']}
                autoComplete="off"
                required
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-address1"
                className="trustee-address1-input"
                name="address1"
                label="Address Line 1"
                value={address1}
                onChange={(e) => handleFieldChange(e, setAddress1)}
                errorMessage={fieldErrors['address1']}
                autoComplete="off"
                required
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-address2"
                className="trustee-address2-input"
                name="address2"
                label="Address Line 2"
                value={address2}
                onChange={(e) => handleFieldChange(e, setAddress2)}
                errorMessage={fieldErrors['address2']}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="trustee-city"
                className="trustee-city-input"
                name="city"
                label="City"
                value={city}
                onChange={(e) => handleFieldChange(e, setCity)}
                errorMessage={fieldErrors['city']}
                autoComplete="off"
                required
              />
            </div>

            <div className="field-group">
              <UsStatesComboBox
                id="trustee-state"
                className="trustee-state-input"
                name="state"
                label="State"
                selections={[state]}
                onUpdateSelection={handleComboBoxUpdate<string>('state', setState, false)}
                autoComplete="off"
                errorMessage={fieldErrors['state']}
                required
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <Input
                id="trustee-zip"
                className="trustee-zip-input"
                name="zip"
                label="ZIP Code"
                value={zipCode}
                onChange={(e) => {
                  const { value } = e.target;
                  setZipCode(value);
                  debounce(() => {
                    validateFieldAndUpdate('zipCode', value);
                  }, 300);
                }}
                errorMessage={fieldErrors['zipCode']}
                autoComplete="off"
                ariaDescription="Example: 12345"
                required
              />
            </div>
          </div>

          <div className="form-column">
            <div className="field-group">
              <PhoneNumberInput
                id="trustee-phone"
                value={phone}
                className="trustee-phone-input"
                name="phone"
                label="Phone"
                onChange={(value) => {
                  const next = value ?? '';
                  setPhone(next);
                  debounce(() => {
                    validateFieldAndUpdate('phone', next);
                  }, 300);
                }}
                errorMessage={fieldErrors['phone']}
                autoComplete="off"
                ariaDescription="Example: 123-456-7890"
                required
              />
              <Input
                id="trustee-extension"
                className="trustee-extension-input"
                name="extension"
                label="Extension"
                value={extension}
                onChange={(e) => handleFieldChange(e, setExtension)}
                errorMessage={fieldErrors['extension']}
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
                value={email}
                onChange={(e) => handleFieldChange(e, setEmail)}
                errorMessage={fieldErrors['email']}
                type="email"
                autoComplete="off"
                required
              />
            </div>

            {(doCreate || doEditPublicProfile) && (
              <>
                <div className="field-group">
                  <ComboBox
                    id="trustee-districts"
                    className="trustee-districts-input"
                    name="districts"
                    label="District (Division)"
                    options={districtOptions}
                    onUpdateSelection={handleComboBoxUpdate<string>(
                      'districts',
                      setDistricts,
                      true,
                    )}
                    multiSelect={true}
                    singularLabel="district"
                    pluralLabel="districts"
                    placeholder={districtLoadError ? 'Error loading districts' : 'Select districts'}
                    autoComplete="off"
                    ref={districtComboRef}
                  />
                </div>

                <div className="field-group">
                  <ComboBox
                    id="trustee-chapters"
                    className="trustee-chapters-input"
                    name="chapters"
                    label="Chapter Types"
                    options={CHAPTER_OPTIONS}
                    selections={chapterSelections}
                    onUpdateSelection={handleComboBoxUpdate<ChapterType>(
                      'chapters',
                      setChapters,
                      true,
                    )}
                    multiSelect={true}
                    singularLabel="chapter"
                    pluralLabel="chapters"
                    autoComplete="off"
                  />
                </div>

                <div className="field-group">
                  <ComboBox
                    id="trustee-status"
                    className="trustee-status-input"
                    name="status"
                    label="Status"
                    options={STATUS_OPTIONS}
                    selections={[statusSelection]}
                    onUpdateSelection={handleComboBoxUpdate<TrusteeStatus>(
                      'status',
                      setStatus,
                      false,
                    )}
                    multiSelect={false}
                    autoComplete="off"
                    ref={setStatusComboRef}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {errorMessage && <div role="alert">{errorMessage}</div>}
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

export default React.memo(TrusteeForm);
