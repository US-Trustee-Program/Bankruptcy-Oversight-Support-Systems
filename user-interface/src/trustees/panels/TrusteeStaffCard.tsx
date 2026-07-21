import './TrusteeStaffCard.scss';
import { TrusteeStaff } from '@common/cams/trustee-staff';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';

interface TrusteeStaffCardProps {
  staffMember?: TrusteeStaff;
  index: number;
  onEdit: () => void;
  onAdd: () => void;
}

export default function TrusteeStaffCard({
  staffMember,
  index,
  onEdit,
  onAdd,
}: Readonly<TrusteeStaffCardProps>) {
  const isEmpty = !staffMember;
  const isNameOnly = staffMember && !staffMember.title && !staffMember.contact;
  const buttonId = isEmpty ? 'edit-staff-empty' : `edit-staff-${index}`;
  const handleClick = isEmpty ? onAdd : onEdit;
  const buttonLabel = isEmpty
    ? 'Add trustee staff member'
    : `Edit trustee staff member ${staffMember?.name ?? ''}`;

  return (
    <div className="trustee-staff-card-container">
      <div className="trustee-staff-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="trustee-staff-card-header">
              <h4 data-testid={isEmpty ? undefined : `staff-name-${index}`}>
                {isEmpty ? 'Trustee Staff' : staffMember.name}
              </h4>
              <Button
                id={buttonId}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={buttonLabel}
                title={buttonLabel}
                onClick={handleClick}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {isEmpty && <div data-testid="no-staff-information">No information added.</div>}
            {!isEmpty && isNameOnly && (
              <div data-testid={`staff-name-only-${index}`}>No additional information added.</div>
            )}
            {!isEmpty && !isNameOnly && (
              <>
                {staffMember.title && (
                  <div className="staff-title" data-testid={`staff-title-${index}`}>
                    {staffMember.title}
                  </div>
                )}
                {staffMember.contact && (
                  <FormattedContact
                    contact={staffMember.contact}
                    phones={staffMember.contact.phone ? [staffMember.contact.phone] : undefined}
                    testIdPrefix={`staff-${index}`}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
