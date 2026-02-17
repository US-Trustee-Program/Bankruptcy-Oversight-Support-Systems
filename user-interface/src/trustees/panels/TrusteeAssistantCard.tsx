import './TrusteeAssistantCard.scss';
import { TrusteeAssistant } from '@common/cams/trustee-assistants';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';

interface TrusteeAssistantCardProps {
  assistant?: TrusteeAssistant;
  index: number;
  onEdit: () => void;
  onAdd: () => void;
}

export default function TrusteeAssistantCard({
  assistant,
  index,
  onEdit,
  onAdd,
}: Readonly<TrusteeAssistantCardProps>) {
  const isEmpty = !assistant;
  const isNameOnly = assistant && !assistant.title && !assistant.contact;
  const buttonId = isEmpty ? 'edit-assistant-empty' : `edit-assistant-${index}`;
  const handleClick = isEmpty ? onAdd : onEdit;
  const buttonLabel = isEmpty ? 'Add assistant' : `Edit assistant ${assistant?.name ?? ''}`;

  return (
    <div className="trustee-assistant-card-container">
      <div className="trustee-assistant-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="trustee-assistant-card-header">
              <h4 data-testid={isEmpty ? undefined : `assistant-name-${index}`}>
                {isEmpty ? 'Assistant' : assistant.name}
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
            {isEmpty && <div data-testid="no-assistant-information">No information added.</div>}
            {!isEmpty && isNameOnly && (
              <div data-testid={`assistant-name-only-${index}`}>
                No additional information added.
              </div>
            )}
            {!isEmpty && !isNameOnly && (
              <>
                {assistant.title && (
                  <div className="assistant-title" data-testid={`assistant-title-${index}`}>
                    {assistant.title}
                  </div>
                )}
                {assistant.contact && (
                  <FormattedContact
                    contact={assistant.contact}
                    testIdPrefix={`assistant-${index}`}
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
