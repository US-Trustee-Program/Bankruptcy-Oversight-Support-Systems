import './InfoCard.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

export interface InfoCardField {
  label: string;
  value: React.ReactNode;
  testId?: string;
}

export interface InfoCardProps {
  id: string;
  title: string;
  fields: InfoCardField[];
  onEdit?: () => void;
  editAriaLabel?: string;
  editTitle?: string;
  testId?: string;
  listTestId?: string;
}

export default function InfoCard(props: Readonly<InfoCardProps>) {
  const { id, title, fields, onEdit, editAriaLabel, editTitle, testId, listTestId } = props;

  return (
    <div className="info-card usa-card" data-testid={testId}>
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="info-card-header">
            <h4>{title}</h4>
            {onEdit && (
              <Button
                id={id}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={editAriaLabel}
                title={editTitle}
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <ul className="info-card-list" data-testid={listTestId}>
            {fields.map((field) => (
              <li key={field.label} data-testid={field.testId}>
                <span className="info-card-label">{field.label}:</span> {field.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
