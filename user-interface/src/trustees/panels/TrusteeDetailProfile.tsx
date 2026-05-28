import './TrusteeDetailProfile.scss';
import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import TrusteeOverviewCard from './TrusteeOverviewCard';
import MeetingOfCreditorsInfoCard from './MeetingOfCreditorsInfoCard';
import OtherInformationCard from './OtherInformationCard';
import ContactInformationCard from './ContactInformationCard';
import TrusteeAssistantCard from './TrusteeAssistantCard';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
  onAddAssistant: () => void;
  onEditAssistant: (assistantId: string) => void;
  onEditOtherInformation: () => void;
  onEditZoomInfo: () => void;
  showSoftwareBankInfo?: boolean;
  softwareOptions: ComboOption[];
  softwareProfiles: BankruptcySoftwareProfile[];
}

export default function TrusteeDetailProfile({
  trustee,
  onEditPublicProfile,
  onEditInternalProfile,
  onAddAssistant,
  onEditAssistant,
  onEditOtherInformation,
  onEditZoomInfo,
  showSoftwareBankInfo = true,
  softwareOptions,
  softwareProfiles,
}: Readonly<TrusteeDetailProfileProps>) {
  return (
    <div className="right-side-screen-content">
      <div className="trustee-detail-profile-container">
        <section className="trustee-profile-section">
          <h2 className="trustee-profile-section-heading">Contact Information</h2>
          <div className="trustee-profile-cards-row">
            <TrusteeOverviewCard trustee={trustee} onEdit={onEditPublicProfile} />
            <ContactInformationCard
              internalContact={trustee.internal}
              onEdit={onEditInternalProfile}
            />
          </div>
        </section>

        <section className="trustee-profile-section">
          <div className="trustee-profile-section-header">
            <h2 className="trustee-profile-section-heading">Assistant(s)</h2>
            {trustee.assistants && trustee.assistants.length > 0 && (
              <Button
                id="add-another-assistant-button"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Add another assistant"
                onClick={onAddAssistant}
              >
                <Icon name="add" className="add-icon" />
                Add Another Assistant
              </Button>
            )}
          </div>
          <div className="trustee-profile-assistants-grid">
            {(!trustee.assistants || trustee.assistants.length === 0) && (
              <TrusteeAssistantCard index={0} onEdit={onAddAssistant} onAdd={onAddAssistant} />
            )}
            {trustee.assistants &&
              trustee.assistants.length > 0 &&
              trustee.assistants.map((assistant, index) => (
                <TrusteeAssistantCard
                  key={assistant.id || index}
                  assistant={assistant}
                  index={index}
                  onEdit={() => onEditAssistant(assistant.id)}
                  onAdd={onAddAssistant}
                />
              ))}
          </div>
        </section>

        <section className="trustee-profile-section">
          <h2 className="trustee-profile-section-heading">
            {showSoftwareBankInfo ? '341 Meeting and Other Information' : '341 Meeting Information'}
          </h2>
          <div className="trustee-profile-cards-row">
            <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} onEdit={onEditZoomInfo} />
            {showSoftwareBankInfo && (
              <OtherInformationCard
                banks={trustee.banks}
                softwareId={trustee.softwareId}
                softwareOptions={softwareOptions}
                softwareProfiles={softwareProfiles}
                onEdit={onEditOtherInformation}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
