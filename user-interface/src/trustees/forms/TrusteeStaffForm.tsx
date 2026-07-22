import './TrusteeStaffForm.scss';
import './TrusteeContactForm.scss';
import React, { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import useFeatureFlags, {
  TRUSTEE_MANAGEMENT,
  TRUSTEE_TYPED_PHONES,
} from '@/lib/hooks/UseFeatureFlags';
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
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import { TrusteeStaffFormData, trusteeStaffSpec } from './trusteeForms.types';
import { validateEach, validateObject, ValidatorFunction } from '@common/cams/validation';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  normalizeFormData,
  validateDirectPhoneFields,
  validateTypedPhones,
} from './trusteeForms.utils';
import { scrollToFirstError } from '@/lib/utils/form-helpers';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import RemovalModal, { RemovalModalRef } from '@/lib/components/uswds/modal/RemovalModal';
import { Address } from '@common/cams/contact';
import { Trustee, TypedPhoneNumber, PHONE_TYPES } from '@common/cams/trustees';
import TypedPhoneList from '@/lib/components/cams/TypedPhoneList/TypedPhoneList';

const getInitialFormData = (staffMember?: TrusteeStaff): TrusteeStaffFormData => {
  const contact = staffMember?.contact;

  return {
    name: staffMember?.name,
    title: staffMember?.title,
    address1: contact?.address?.address1,
    address2: contact?.address?.address2,
    city: contact?.address?.city,
    state: contact?.address?.state,
    zipCode: contact?.address?.zipCode,
    phones: PHONE_TYPES.map(
      (type) => contact?.phones?.find((p) => p.type === type) ?? { number: '', type },
    ),
    email: contact?.email,
  };
};

type StringFieldKey = Exclude<keyof TrusteeStaffFormData, 'phones'>;

export function validateField(
  field: StringFieldKey,
  value: string | undefined,
): string[] | undefined {
  const valueToEval = value?.trim() || undefined;
  const rules = trusteeStaffSpec[field] as ValidatorFunction[] | undefined;

  if (!rules) {
    return undefined;
  }

  const result = validateEach(rules, valueToEval);
  return result.valid ? undefined : result.reasons;
}

type TrusteeStaffFormProps = {
  trusteeId: string;
  trustee?: Trustee;
};

function TrusteeStaffForm(props: Readonly<TrusteeStaffFormProps>) {
  const flags = useFeatureFlags();
  const typedPhonesEnabled = flags[TRUSTEE_TYPED_PHONES] === true;
  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const debounce = useDebounce();
  const routeParams = useParams<{ staffId?: string }>();
  const navigate = useCamsNavigator();

  const { trusteeId, trustee } = props;
  const staffId = routeParams.staffId;

  const isCreateMode = !staffId;

  const staffMember = isCreateMode ? undefined : trustee?.staff?.find((s) => s.id === staffId);

  type FieldErrors = Partial<
    Record<keyof TrusteeStaffFormData | '$' | 'phone' | 'extension', string[] | undefined>
  >;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<TrusteeStaffFormData>(getInitialFormData(staffMember));
  const [saveAlert, setSaveAlert] = useState<string | null>(null);
  const partialAddressAlertRef = useRef<AlertRefType>(null);

  const deleteModalId = 'delete-staff-modal';
  const deleteModalRef = useRef<RemovalModalRef>(null);
  const openDeleteModalButtonRef = useRef<OpenModalButtonRef>(null);

  const handleCancel = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  const handleDeleteSuccess = useCallback(() => {
    navigate.navigateTo(`/trustees/${trusteeId}`);
  }, [navigate, trusteeId]);

  if (!isCreateMode && !staffMember) {
    return (
      <Stop
        id="staff-not-found-alert"
        title="Error"
        message="Trustee staff member not found."
        asError
      />
    );
  }

  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function getAddressInfo({
    address1,
    address2,
    city,
    zipCode,
    state,
  }: Partial<Address>): Address | undefined {
    if (!address1 || !city || !state || !zipCode) return undefined;
    return {
      address1,
      address2,
      city,
      state,
      zipCode,
      countryCode: 'US' as const,
    };
  }

  const mapStaffPayload = (formData: TrusteeStaffFormData): TrusteeStaffInput => {
    const { name, title, ...contactInfo } = formData;
    const staffTrusteePayload: Partial<TrusteeStaff> & { name: string } = { name: name! };
    if (title) staffTrusteePayload.title = title;

    const addressInfo = getAddressInfo(contactInfo);
    const phones = contactInfo.phones.filter((p) => p.number.trim());
    const emailInfo = contactInfo.email || undefined;

    const hasContactInfo = addressInfo || phones.length > 0 || emailInfo;
    if (!hasContactInfo) return staffTrusteePayload;

    staffTrusteePayload.contact = {};
    if (addressInfo) staffTrusteePayload.contact.address = addressInfo;
    if (phones.length > 0) staffTrusteePayload.contact.phones = phones;
    if (emailInfo) staffTrusteePayload.contact.email = emailInfo;

    return staffTrusteePayload;
  };

  const handleFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target;
    const value = event.target.value === '' ? undefined : event.target.value;
    const fieldName = name as StringFieldKey;

    updateField(fieldName, value);
    debounce(() => {
      validateFieldAndUpdate(fieldName, value);
    }, 300);
  };

  const validateDirectPhoneAndUpdate = (phones: TypedPhoneNumber[]): void => {
    const { phone, extension } = validateDirectPhoneFields(phones);
    setFieldErrors((prev) => ({ ...prev, phone, extension }));
  };

  const handleDirectPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const number = e.target.value;
    const nextPhones = formData.phones.map((p) => (p.type === 'direct' ? { ...p, number } : p));
    updateField('phones', nextPhones);
    debounce(() => {
      validateDirectPhoneAndUpdate(nextPhones);
    }, 300);
  };

  const handleDirectExtensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const extension = e.target.value || undefined;
    const nextPhones = formData.phones.map((p) => (p.type === 'direct' ? { ...p, extension } : p));
    updateField('phones', nextPhones);
    debounce(() => {
      validateDirectPhoneAndUpdate(nextPhones);
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
    const value = e.target.value || undefined;
    updateField('zipCode', value);
    debounce(() => {
      validateFieldAndUpdate('zipCode', value);
    }, 300);
  };

  const handleSubmit = async (ev: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    const currentFormData = normalizeFormData(formData);

    if (validateFormAndUpdateErrors(currentFormData)) {
      setIsSubmitting(true);

      try {
        const payload = mapStaffPayload(currentFormData);
        if (isCreateMode) {
          await Api2.createStaffMember(trusteeId, payload);
        } else {
          await Api2.updateStaffMember(trusteeId, staffId, payload);
        }
        navigate.navigateTo(`/trustees/${trusteeId}`);
      } catch (e) {
        const action = isCreateMode ? 'create' : 'update';
        globalAlert?.error(`Failed to ${action} trustee staff member: ${(e as Error).message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const validateFormAndUpdateErrors = (formData: TrusteeStaffFormData): boolean => {
    const results = validateObject(trusteeStaffSpec, formData);
    const directPhoneErrors = typedPhonesEnabled ? {} : validateDirectPhoneFields(formData.phones);
    const hasDirectPhoneErrors = !!(directPhoneErrors.phone || directPhoneErrors.extension);
    const hasTypedPhoneRowErrors =
      typedPhonesEnabled && Object.keys(validateTypedPhones(formData.phones)).length > 0;
    const isValid = !!results.valid && !hasDirectPhoneErrors && !hasTypedPhoneRowErrors;

    partialAddressAlertRef.current?.hide();

    if (!isValid) {
      const reasonMapErrors = results.reasonMap
        ? Object.fromEntries(Object.entries(results.reasonMap).map(([k, v]) => [k, v?.reasons]))
        : {};
      setFieldErrors({ ...reasonMapErrors, ...directPhoneErrors } as FieldErrors);

      if (results.reasonMap?.$?.reasons) {
        setSaveAlert(results.reasonMap.$.reasons.join(' '));
        partialAddressAlertRef.current?.show();
      }
      scrollToFirstError();
    } else {
      setFieldErrors({});
      setSaveAlert(null);
    }

    return isValid;
  };

  const validateFieldAndUpdate = (field: StringFieldKey, value: string | undefined): void => {
    const reasons = validateField(field, value);

    setFieldErrors((prev) => ({
      ...prev,
      [field]: reasons,
    }));
  };

  const updateField = (field: keyof TrusteeStaffFormData, value: unknown) => {
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

  const directPhone = formData.phones.find((p) => p.type === 'direct');
  const phoneRowErrors = validateTypedPhones(formData.phones);

  return (
    <div className="staff-trustee-form-screen">
      <form
        noValidate
        aria-label={isCreateMode ? 'Create Trustee Staff' : 'Edit Trustee Staff'}
        data-testid="trustee-staff-form"
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
                id="staff-name"
                className="staff-name-input"
                name="name"
                label="Trustee Staff Name"
                required
                value={formData.name}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['name']?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="staff-title"
                data-testid="staff-title"
                className="staff-title-input"
                name="title"
                label="Title"
                value={formData.title || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['title']?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="staff-address1"
                className="staff-address1-input"
                name="address1"
                label="Address Line 1"
                value={formData.address1}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address1']?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="staff-address2"
                className="staff-address2-input"
                name="address2"
                label="Address Line 2"
                value={formData.address2 || ''}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['address2']?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <Input
                id="staff-city"
                className="staff-city-input"
                name="city"
                label="City"
                value={formData.city}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['city']?.join(' ')}
                autoComplete="off"
              />
            </div>

            <div className="field-group">
              <UsStatesComboBox
                id="staff-state"
                className="staff-state-input"
                name="state"
                label="State"
                selections={formData.state ? [formData.state] : []}
                onUpdateSelection={handleStateSelection}
                autoComplete="off"
                errorMessage={fieldErrors['state']?.join(' ')}
              ></UsStatesComboBox>
            </div>

            <div className="field-group">
              <ZipCodeInput
                id="staff-zip"
                className="staff-zip-input"
                name="zipCode"
                label="Zip Code"
                value={formData.zipCode}
                onChange={handleZipCodeChange}
                errorMessage={fieldErrors['zipCode']?.join(' ')}
                autoComplete="off"
                ariaDescription="Example: 12345"
              />
            </div>
          </div>

          <div className="form-column">
            <div id="phone-group" className="field-group">
              {typedPhonesEnabled ? (
                <TypedPhoneList
                  phones={formData.phones}
                  onChange={(phones: TypedPhoneNumber[]) => updateField('phones', phones)}
                  errors={phoneRowErrors}
                />
              ) : (
                <>
                  <PhoneNumberInput
                    id="staff-phone"
                    value={directPhone?.number}
                    className="staff-phone-input"
                    name="phone"
                    label="Phone"
                    onChange={handleDirectPhoneChange}
                    errorMessage={fieldErrors['phone']?.join(' ')}
                    autoComplete="off"
                  />
                  <Input
                    id="staff-extension"
                    className="staff-extension-input"
                    name="extension"
                    label="Extension"
                    value={directPhone?.extension || ''}
                    onChange={handleDirectExtensionChange}
                    errorMessage={fieldErrors['extension']?.join(' ')}
                    autoComplete="off"
                    ariaDescription="Up to 6 digits"
                  />
                </>
              )}
            </div>

            <div className="field-group">
              <Input
                id="staff-email"
                className="staff-email-input"
                name="email"
                label="Email"
                value={formData.email}
                onChange={handleFieldChange}
                errorMessage={fieldErrors['email']?.join(' ')}
                type="email"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className="trustee-form-error-wrapper">
          <Alert
            role="alert"
            id="staff-form-error-alert"
            className="form-field-warning"
            type={UswdsAlertStyle.Error}
            inline={true}
            slim={false}
            ref={partialAddressAlertRef}
            message={saveAlert ?? ''}
          />
        </div>
        <div className="usa-button-group">
          <Button id="submit-button" type="submit">
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          {!isCreateMode && staffId && (
            <OpenModalButton
              id="delete-staff-button"
              uswdsStyle={UswdsButtonStyle.Secondary}
              modalId={deleteModalId}
              modalRef={deleteModalRef}
              ref={openDeleteModalButtonRef}
              openProps={{
                onDelete: async () => {
                  try {
                    await Api2.deleteStaffMember(trusteeId, staffId);
                    handleDeleteSuccess();
                  } catch {
                    globalAlert?.error('There was a problem removing the trustee staff member.');
                    throw new Error('Delete failed');
                  }
                },
              }}
              ariaLabel="Delete this trustee staff member"
            >
              Delete
            </OpenModalButton>
          )}
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
      {!isCreateMode && staffId && (
        <RemovalModal ref={deleteModalRef} modalId={deleteModalId} objectName="staff member" />
      )}
    </div>
  );
}

export default React.memo(TrusteeStaffForm);
