import './TrusteeDetailProfile.scss';
import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import TrusteeOverviewCard from './TrusteeOverviewCard';
import MeetingOfCreditorsInfoCard from './MeetingOfCreditorsInfoCard';
import OtherInformationCard from './OtherInformationCard';
import ContactInformationCard from './ContactInformationCard';
import TrusteeStaffCard from './TrusteeStaffCard';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
  onAddStaff: () => void;
  onEditStaff: (staffId: string) => void;
  onEditOtherInformation: () => void;
  onEditZoomInfo: () => void;
  showSoftwareBankInfo?: boolean;
  softwareProfiles: BankruptcySoftwareProfile[];
}

export default function TrusteeDetailProfile({
  trustee,
  onEditPublicProfile,
  onEditInternalProfile,
  onAddStaff,
  onEditStaff,
  onEditOtherInformation,
  onEditZoomInfo,
  showSoftwareBankInfo = true,
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
            <h2 className="trustee-profile-section-heading">Trustee Staff</h2>
            {trustee.staff && trustee.staff.length > 0 && (
              <Button
                id="add-another-staff-button"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Add trustee staff"
                onClick={onAddStaff}
              >
                <Icon name="add" className="add-icon" />
                Add Trustee Staff
              </Button>
            )}
          </div>
          <div className="trustee-profile-staff-grid">
            {(!trustee.staff || trustee.staff.length === 0) && (
              <TrusteeStaffCard index={0} onEdit={onAddStaff} onAdd={onAddStaff} />
            )}
            {trustee.staff &&
              trustee.staff.length > 0 &&
              trustee.staff.map((staffMember, index) => (
                <TrusteeStaffCard
                  key={staffMember.id || index}
                  staffMember={staffMember}
                  index={index}
                  onEdit={() => onEditStaff(staffMember.id)}
                  onAdd={onAddStaff}
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
