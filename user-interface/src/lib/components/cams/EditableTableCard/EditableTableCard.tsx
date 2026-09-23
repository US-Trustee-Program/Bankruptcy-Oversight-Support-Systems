import './EditableTableCard.scss';
import { ReactNode } from 'react';
import { Card, CardBody } from '@/lib/components/uswds/Card';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';

interface EditableTableCardColumn {
  key: string;
  header: string;
  testId?: string;
}

export type EditableTableCardTagColor = 'red' | 'green';

export interface EditableTableCardTag {
  label: ReactNode;
  color: EditableTableCardTagColor;
  id?: string;
}

// Matches the colors the trustee key-dates stories specify: #00a91c for the
// success state and #b50909 for the failure state.
const TAG_COLOR_STYLES: Record<EditableTableCardTagColor, UswdsTagStyle> = {
  green: UswdsTagStyle.Success,
  red: UswdsTagStyle.SecondaryDark,
};

interface EditableTableCardProps {
  id: string;
  title: ReactNode;
  tableAriaLabel: string;
  columns: EditableTableCardColumn[];
  values: Record<string, ReactNode>;
  tag?: EditableTableCardTag;
  onEdit?: () => void;
  editAriaLabel?: string;
  editTitle?: string;
  testId?: string;
  className?: string;
  tableId?: string;
  tableClassName?: string;
}

function EditableTableCard(props: Readonly<EditableTableCardProps>) {
  const {
    id,
    title,
    tableAriaLabel,
    columns,
    values,
    tag,
    onEdit,
    editAriaLabel,
    editTitle,
    testId,
    className,
    tableId,
    tableClassName,
  } = props;

  const effectiveEditTitle = editTitle ?? 'Edit';
  const effectiveEditAriaLabel = editAriaLabel ?? effectiveEditTitle;

  return (
    <Card
      className={className ? `editable-table-card ${className}` : 'editable-table-card'}
      data-testid={testId}
    >
      <CardBody>
        <div className="editable-table-card-header">
          <div className="editable-table-card-heading">
            <h4>{title}</h4>
            {tag && (
              <Tag id={tag.id} uswdsStyle={TAG_COLOR_STYLES[tag.color]}>
                {tag.label}
              </Tag>
            )}
          </div>
          {onEdit && (
            <Button
              id={id}
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label={effectiveEditAriaLabel}
              title={effectiveEditTitle}
              onClick={onEdit}
            >
              <IconLabel icon="edit" label="Edit" />
            </Button>
          )}
        </div>
        <CamsTable
          id={tableId}
          className={['editable-table-card-table', tableClassName].filter(Boolean).join(' ')}
          aria-label={tableAriaLabel}
        >
          <CamsTableHeader>
            {columns.map((column) => (
              <CamsTableHeaderCell key={column.key}>{column.header}</CamsTableHeaderCell>
            ))}
          </CamsTableHeader>
          <CamsTableBody>
            <CamsTableRow>
              {columns.map((column) => (
                <CamsTableCell
                  key={column.key}
                  data-cell={column.header}
                  data-testid={column.testId}
                >
                  {values[column.key]}
                </CamsTableCell>
              ))}
            </CamsTableRow>
          </CamsTableBody>
        </CamsTable>
      </CardBody>
    </Card>
  );
}

export default EditableTableCard;
