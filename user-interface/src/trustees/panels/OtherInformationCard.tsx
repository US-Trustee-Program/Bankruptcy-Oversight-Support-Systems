import './OtherInformationCard.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

interface OtherInformationCardProps {
  banks?: string[];
  softwareId?: string;
  softwareOptions: ComboOption[];
  onEdit: () => void;
}

export default function OtherInformationCard({
  banks,
  softwareId,
  softwareOptions,
  onEdit,
}: Readonly<OtherInformationCardProps>) {
  const softwareName = softwareId
    ? (softwareOptions.find((opt) => opt.value === softwareId)?.label ?? 'Unknown software')
    : undefined;
  const hasData = (banks && banks.length > 0) || softwareName;

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
            {softwareName && (
              <div className="trustee-software" data-testid="trustee-software">
                Software: {softwareName}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
