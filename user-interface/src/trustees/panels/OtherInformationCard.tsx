import './OtherInformationCard.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

export interface OtherInformationCardProps {
  banks?: string[];
  software?: string;
  onEdit: () => void;
}

export default function OtherInformationCard({
  banks,
  software,
  onEdit,
}: Readonly<OtherInformationCardProps>) {
  const hasData = (banks && banks.length > 0) || software;

  return (
    <div className="other-information-card-container">
      <div className="other-information-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="other-information-card-header">
              <h4>Software and Bank</h4>
              <Button
                id="edit-other-information"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit other trustee information"
                title="Edit other trustee information"
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {!hasData && <div data-testid="no-other-information">No information added.</div>}
            {banks &&
              banks.length > 0 &&
              banks.map((bank, index) => (
                <div key={index} className="trustee-bank" data-testid={`trustee-bank-${index}`}>
                  Bank: {bank}
                </div>
              ))}
            {software && (
              <div className="trustee-software" data-testid="trustee-software">
                Software: {software}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
