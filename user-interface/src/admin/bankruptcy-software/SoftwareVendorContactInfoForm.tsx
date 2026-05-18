import './SoftwareVendorContactInfoForm.scss';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';
import { BankruptcySoftwareProfile, SoftwareContactInfo } from '@common/cams/bankruptcy-software';
import Input from '@/lib/components/uswds/Input';
import { InputRef } from '@/lib/type-declarations/input-fields';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import ZipCodeInput from '@/lib/components/ZipCodeInput';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import Api2 from '@/lib/models/api2';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  email as emailValidator,
  website as websiteValidator,
} from '@common/cams/trustees-validators';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';

function validateEmailValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const result = emailValidator(trimmed);
  return result.valid ? undefined : (result.reasons?.[0] ?? FIELD_VALIDATION_MESSAGES.EMAIL);
}

function validateWebsiteValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const result = websiteValidator(trimmed);
  return result.valid ? undefined : (result.reasons?.[0] ?? FIELD_VALIDATION_MESSAGES.WEBSITE);
}

interface SoftwareVendorContactInfoFormProps {
  software: BankruptcySoftwareProfile;
  onSaved: (updated: BankruptcySoftwareProfile) => void;
}

export function SoftwareVendorContactInfoForm({
  software,
  onSaved,
}: Readonly<SoftwareVendorContactInfoFormProps>) {
  const { softwareId } = useParams();
  const navigate = useNavigate();
  const alert = useGlobalAlert();

  const existingContact = software.contact;

  const [contactNames, setContactNames] = useState<string[]>(
    existingContact?.contactNames?.length ? existingContact.contactNames : [''],
  );
  const [addressLine1, setAddressLine1] = useState(existingContact?.address?.address1 ?? '');
  const [addressLine2, setAddressLine2] = useState(existingContact?.address?.address2 ?? '');
  const [city, setCity] = useState(existingContact?.address?.city ?? '');
  const [state, setState] = useState(existingContact?.address?.state ?? '');
  const [zipCode, setZipCode] = useState(existingContact?.address?.zipCode ?? '');
  const [phone, setPhone] = useState(existingContact?.phone?.number ?? '');
  const [extension, setExtension] = useState(existingContact?.phone?.extension ?? '');
  const extensionRef = useRef<InputRef>(null);
  const [emails, setEmails] = useState<string[]>(
    existingContact?.emails?.length ? existingContact.emails : [''],
  );
  const [website, setWebsite] = useState(existingContact?.website ?? '');
  const [emailErrors, setEmailErrors] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      (existingContact?.emails ?? [])
        .map((e, i) => [i, validateEmailValue(e)])
        .filter(([, err]) => err !== undefined),
    ),
  );
  const [websiteError, setWebsiteError] = useState<string | undefined>(() =>
    validateWebsiteValue(existingContact?.website ?? ''),
  );

  function addContactName() {
    setContactNames((prev) => [...prev, '']);
  }

  function updateContactName(index: number, value: string) {
    setContactNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function addEmail() {
    setEmails((prev) => [...prev, '']);
  }

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
    setEmailErrors((prev) => {
      const next = { ...prev };
      const error = validateEmailValue(value);
      if (error) {
        next[index] = error;
      } else {
        delete next[index];
      }
      return next;
    });
  }

  function handleAddressLine1Change(e: React.ChangeEvent<HTMLInputElement>) {
    setAddressLine1(e.target.value);
  }

  function handleAddressLine2Change(e: React.ChangeEvent<HTMLInputElement>) {
    setAddressLine2(e.target.value);
  }

  function handleCityChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCity(e.target.value);
  }

  function handleStateChange(options: ComboOption[]) {
    setState(options[0]?.value ?? '');
  }

  function handleZipCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setZipCode(e.target.value);
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(e.target.value);
  }

  function handleExtensionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = (e.target.value.match(/\d/g) ?? []).slice(0, 6).join('');
    extensionRef.current?.setValue(digitsOnly);
    setExtension(digitsOnly);
    e.target.value = digitsOnly;
  }

  function handleWebsiteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setWebsite(value);
    setWebsiteError(validateWebsiteValue(value));
  }

  async function handleSave() {
    const hasEmailErrors = Object.values(emailErrors).some(Boolean);
    if (hasEmailErrors || websiteError) return;

    const trimmedAddress1 = addressLine1.trim();
    const trimmedAddress2 = addressLine2.trim();
    const trimmedCity = city.trim();
    const trimmedZipCode = zipCode.trim();
    const trimmedPhone = phone.trim();

    const hasAddress = trimmedAddress1 || trimmedAddress2 || trimmedCity || state || trimmedZipCode;

    const address = hasAddress
      ? {
          address1: trimmedAddress1 || undefined,
          address2: trimmedAddress2 || undefined,
          city: trimmedCity || undefined,
          state: state || undefined,
          zipCode: trimmedZipCode || undefined,
          countryCode: 'US' as const,
        }
      : undefined;

    const contact: SoftwareContactInfo = {
      contactNames: contactNames.filter((n) => n.trim()),
      address,
      phone: trimmedPhone
        ? { number: trimmedPhone, extension: extension.trim() || undefined }
        : undefined,
      emails: emails.filter((e) => e.trim()),
      website: website.trim() || undefined,
    };

    try {
      const response = await Api2.updateSoftware(software.id, { contact });
      const updated = response!.data;
      onSaved(updated);
      navigate(`/admin/bankruptcy-software/${softwareId}/overview`);
      alert?.success('Vendor contact information updated successfully.');
    } catch (error) {
      getAppInsights()?.appInsights?.trackException({ exception: error as Error });
      alert?.error('Failed to update vendor contact information. Please try again.');
    }
  }

  return (
    <div className="contact-info-form" data-testid="contact-info-form">
      <h1>{software.name}</h1>
      <h2>Add Software Vendor Contact Information</h2>
      <div className="form-columns">
        <div className="form-col">
          {contactNames.map((name, i) => (
            <Input
              key={i}
              id={`contact-name-${i}`}
              label={i === 0 ? 'Software Contact Name' : ''}
              value={name}
              onChange={(e) => updateContactName(i, e.target.value)}
            />
          ))}
          <button
            type="button"
            className="usa-button usa-button--unstyled contact-add-button"
            onClick={addContactName}
            data-testid="add-contact-name-button"
          >
            <Icon name="add" /> Add Another Contact Name
          </button>
          <Input
            id="address-line-1"
            className="input-under-button"
            label="Software Contact Address Line 1"
            value={addressLine1}
            onChange={handleAddressLine1Change}
          />
          <Input
            id="address-line-2"
            label="Software Contact Address Line 2"
            value={addressLine2}
            onChange={handleAddressLine2Change}
          />
          <Input id="city" label="Software Contact City" value={city} onChange={handleCityChange} />
          <UsStatesComboBox
            id="state"
            label="Software Contact State"
            selections={state ? [state] : []}
            onUpdateSelection={handleStateChange}
          />
          <ZipCodeInput
            id="zip-code"
            className="zip-code-input"
            label="Software Contact Zip Code"
            ariaDescription="Example: 12345"
            value={zipCode}
            onChange={handleZipCodeChange}
          />
        </div>
        <div className="form-col">
          <div className="phone-extension-row">
            <div className="phone-col">
              <PhoneNumberInput
                id="phone"
                label="Software Contact Phone"
                ariaDescription="Example: 123-456-7890"
                value={phone}
                onChange={handlePhoneChange}
              />
            </div>
            <div className="extension-col">
              <Input
                ref={extensionRef}
                id="extension"
                label="Extension"
                ariaDescription="Up to 6 digits"
                value={extension}
                onChange={handleExtensionChange}
              />
            </div>
          </div>
          {emails.map((emailValue, i) => (
            <Input
              key={i}
              id={`email-${i}`}
              label={i === 0 ? 'Software Contact Email' : ''}
              value={emailValue}
              onChange={(e) => updateEmail(i, e.target.value)}
              errorMessage={emailErrors[i]}
            />
          ))}
          <button
            type="button"
            className="usa-button usa-button--unstyled contact-add-button"
            onClick={addEmail}
            data-testid="add-email-button"
          >
            <Icon name="add" /> Add Another Email
          </button>
          <Input
            id="website"
            className="input-under-button"
            label="Website"
            value={website}
            onChange={handleWebsiteChange}
            errorMessage={websiteError}
          />
        </div>
      </div>
      <div className="grid-row margin-top-4">
        <div className="grid-col-12">
          <Button
            id="save-contact-info"
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={handleSave}
            disabled={Object.values(emailErrors).some(Boolean) || !!websiteError}
          >
            Save
          </Button>
          <Link
            to={`/admin/bankruptcy-software/${softwareId}/overview`}
            className="usa-link margin-left-2"
            data-testid="cancel-contact-info-link"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
