import './Chapter13StandingKeyDatesCard.scss';
import { type ReactNode } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

interface Chapter13StandingKeyDatesCardField {
  label: string;
  value: ReactNode;
  testId?: string;
}

export interface Chapter13StandingKeyDatesCardProps {
  title: string;
  tag?: ReactNode;
  onEdit?: () => void;
  editAriaLabel?: string;
  editTitle?: string;
  testId: string;
  fields: Chapter13StandingKeyDatesCardField[];
}

/**
 * Themed key-dates card for Chapter 13 Standing appointments, matching the Figma mockup's
 * label-over-value column grid layout (distinct from the generic list-style InfoCard used by
 * other appointment variants).
 */
export default function Chapter13StandingKeyDatesCard(
  props: Readonly<Chapter13StandingKeyDatesCardProps>,
) {
  const { title, tag, onEdit, editAriaLabel, editTitle, testId, fields } = props;
  const effectiveEditTitle = editTitle ?? 'Edit';
  const effectiveEditAriaLabel = editAriaLabel ?? effectiveEditTitle;

  return (
    <div className="key-dates-card usa-card" data-testid={testId}>
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="key-dates-card-header">
            <h4>{title}</h4>
            {tag}
            {onEdit && (
              <Button
                id={`edit-${testId}`}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={effectiveEditAriaLabel}
                title={effectiveEditTitle}
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <div className="key-dates-card-fields">
            {fields.map((field, index) => (
              <div
                className="key-dates-field"
                key={field.testId ?? `${field.label}-${index}`}
                data-testid={field.testId}
              >
                <div className="key-dates-field-label">{field.label}</div>
                <div className="key-dates-field-value">{field.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
