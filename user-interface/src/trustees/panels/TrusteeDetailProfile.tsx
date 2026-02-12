import './TrusteeDetailProfile.scss';
import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import TrusteeOverviewCard from './TrusteeOverviewCard';
import MeetingOfCreditorsInfoCard from './MeetingOfCreditorsInfoCard';
import OtherInformationCard from './OtherInformationCard';
import ContactInformationCard from './ContactInformationCard';
import TrusteeAssistantCard from './TrusteeAssistantCard';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
  onAddAssistant: () => void;
  onEditAssistant: (assistantId: string) => void;
  onEditOtherInformation: () => void;
  onEditZoomInfo: () => void;
}

export default function TrusteeDetailProfile({
  trustee,
  onEditPublicProfile,
  onEditInternalProfile,
  onAddAssistant,
  onEditAssistant,
  onEditOtherInformation,
  onEditZoomInfo,
}: Readonly<TrusteeDetailProfileProps>) {
  return (
    <div className="right-side-screen-content">
      <div className="trustee-detail-profile-container">
        {/* Contact Information Section */}
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

        {/* Assistant(s) Section */}
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
                + Add Another Assistant
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

        {/* 341 Meeting and Other Information Section */}
        <section className="trustee-profile-section">
          <h2 className="trustee-profile-section-heading">341 Meeting and Other Information</h2>
          <div className="trustee-profile-cards-row">
            <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} onEdit={onEditZoomInfo} />
            <OtherInformationCard
              banks={trustee.banks}
              software={trustee.software}
              onEdit={onEditOtherInformation}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
