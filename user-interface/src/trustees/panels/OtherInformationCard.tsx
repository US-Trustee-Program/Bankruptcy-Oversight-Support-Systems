import './OtherInformationCard.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

interface OtherInformationCardProps {
  banks?: string[];
  softwareId?: string;
  softwareOptions: ComboOption[];
  softwareProfiles: BankruptcySoftwareProfile[];
  onEdit: () => void;
}

export default function OtherInformationCard({
  banks,
  softwareId,
  softwareOptions,
  softwareProfiles,
  onEdit,
}: Readonly<OtherInformationCardProps>) {
  const softwareName = softwareId
    ? (softwareOptions.find((opt) => opt.value === softwareId)?.label ?? 'Unknown software')
    : undefined;

  const selectedSoftware = softwareProfiles.find((p) => p.id === softwareId);
  const bankNameMap = new Map(
    selectedSoftware?.associatedBanks?.map((b) => [b.bankId, b.bankName]) ?? [],
  );

  const resolvedBanks = banks?.map((id) => bankNameMap.get(id) ?? id);
  const hasData = (resolvedBanks && resolvedBanks.length > 0) || softwareName;

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
            {softwareName && (
              <div className="trustee-software" data-testid="trustee-software">
                Software: {softwareName}
              </div>
            )}
            {resolvedBanks &&
              resolvedBanks.length > 0 &&
              resolvedBanks.map((bank, index) => (
                <div key={index} className="trustee-bank" data-testid={`trustee-bank-${index}`}>
                  Bank: {bank}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
