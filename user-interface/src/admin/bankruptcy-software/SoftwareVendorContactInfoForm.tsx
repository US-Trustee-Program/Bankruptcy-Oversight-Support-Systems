import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BankruptcySoftwareProfile, SoftwareContactInfo } from '@common/cams/bankruptcy-software';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import Input from '@/lib/components/uswds/Input';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import PhoneNumberInput from '@/lib/components/PhoneNumberInput';
import ZipCodeInput from '@/lib/components/ZipCodeInput';
import UsStatesComboBox from '@/lib/components/combobox/UsStatesComboBox';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import Api2 from '@/lib/models/api2';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

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
  const [emails, setEmails] = useState<string[]>(
    existingContact?.emails?.length ? existingContact.emails : [''],
  );
  const [website, setWebsite] = useState(existingContact?.website ?? '');

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
  }

  async function handleSave() {
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
    <MainContent data-testid="contact-info-form">
      <DocumentTitle name="Add Software Vendor Contact Information" />
      <h1>{software.name}</h1>
      <h2>Add Software Vendor Contact Information</h2>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-6">
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
            className="usa-button usa-button--unstyled"
            onClick={addContactName}
            data-testid="add-contact-name-button"
          >
            + Add Another Contact Name
          </button>
          <Input
            id="address-line-1"
            label="Software Contact Address Line 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
          <Input
            id="address-line-2"
            label="Software Contact Address Line 2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
          <Input
            id="city"
            label="Software Contact City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <UsStatesComboBox
            id="state"
            label="Software Contact State"
            selections={state ? [state] : []}
            onUpdateSelection={(options: ComboOption[]) => setState(options[0]?.value ?? '')}
          />
          <ZipCodeInput
            id="zip-code"
            label="Software Contact Zip Code"
            ariaDescription="Example: 12345"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
          />
        </div>
        <div className="grid-col-6">
          <PhoneNumberInput
            id="phone"
            label="Software Contact Phone"
            ariaDescription="Example: 123-456-7890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            id="extension"
            label="Extension"
            ariaDescription="Up to 6 digits"
            maxLength={6}
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
          />
          {emails.map((email, i) => (
            <Input
              key={i}
              id={`email-${i}`}
              label={i === 0 ? 'Software Contact Email' : ''}
              type="email"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
            />
          ))}
          <button
            type="button"
            className="usa-button usa-button--unstyled"
            onClick={addEmail}
            data-testid="add-email-button"
          >
            + Add Another Email
          </button>
          <Input
            id="website"
            label="Website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>
      <div className="grid-row margin-top-4">
        <div className="grid-col-12">
          <Button id="save-contact-info" uswdsStyle={UswdsButtonStyle.Default} onClick={handleSave}>
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
    </MainContent>
  );
}
