import { useRef, useState } from 'react';
import { Pagination } from '@/lib/components/uswds/Pagination';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import {
  CamsTable,
  CamsTableBody,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import { SearchPredicate, DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';
import {
  OfficeSetupRow,
  PROTOTYPE_OFFICES,
  PrototypeDivision,
  formatDivision,
  formatOffice,
  officeKey,
} from './office-division-setup-data';
import { DivisionChange } from './office-division-assignments';
import { EditDivisionsModal, EditDivisionsModalRef } from './EditDivisionsModal';

const UNASSIGNED_KEY = 'unassigned';

// The unassigned row is listed first and sits in the table like an office without one.
type TableRow = { key: string; office: OfficeSetupRow | null };

const TABLE_ROWS: TableRow[] = [
  { key: UNASSIGNED_KEY, office: null },
  ...PROTOTYPE_OFFICES.map((office) => ({ key: officeKey(office), office })),
];

const REGION_OFFICE_OPTIONS: ComboOption[] = [
  { value: UNASSIGNED_KEY, label: '(unassigned)' },
  ...PROTOTYPE_OFFICES.map((office) => ({
    value: officeKey(office),
    label: `Region ${office.regionId} - ${office.officeName}`,
  })),
];

type OfficeDivisionSetupOfficesProps = {
  divisions: PrototypeDivision[];
  onSaveChanges: (office: OfficeSetupRow, changes: DivisionChange[]) => void;
};

function groupDivisionsByOffice(divisions: PrototypeDivision[]) {
  const byOffice = new Map<string, PrototypeDivision[]>();
  divisions.forEach((division) => {
    const key = division.office ? officeKey(division.office) : UNASSIGNED_KEY;
    byOffice.set(key, [...(byOffice.get(key) ?? []), division]);
  });
  return byOffice;
}

type DivisionListProps = { divisions: PrototypeDivision[]; isUnassignedRow: boolean };

function DivisionList({ divisions, isUnassignedRow }: Readonly<DivisionListProps>) {
  if (divisions.length === 0 && isUnassignedRow) return <>No divisions unassigned</>;
  if (divisions.length === 0) return <>None</>;
  return <>{divisions.map(formatDivision).join(', ')}</>;
}

export function OfficeDivisionSetupOffices({
  divisions,
  onSaveChanges,
}: Readonly<OfficeDivisionSetupOfficesProps>) {
  const editModalRef = useRef<EditDivisionsModalRef>(null);
  const [selectedRegionOffice, setSelectedRegionOffice] = useState<ComboOption[]>([]);
  const [searchPredicate, setSearchPredicate] = useState<SearchPredicate>({
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
  });

  const divisionsByOffice = groupDivisionsByOffice(divisions);
  const selectedKey = selectedRegionOffice[0]?.value;
  const rows = selectedKey ? TABLE_ROWS.filter((row) => row.key === selectedKey) : TABLE_ROWS;

  function handleRegionOfficeChange(selections: ComboOption[]) {
    setSelectedRegionOffice(selections);
    setSearchPredicate((predicate) => ({ ...predicate, offset: DEFAULT_SEARCH_OFFSET }));
  }

  const limit = searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT;
  const offset = searchPredicate.offset ?? DEFAULT_SEARCH_OFFSET;
  const pageOfRows = rows.slice(offset, offset + limit);
  const totalPages = Math.ceil(rows.length / limit);

  return (
    <div className="office-division-setup-offices" data-testid="office-division-setup-offices">
      <div className="region-office-filter">
        <ComboBox
          id="region-office-filter"
          label="Region & Office"
          ariaLabelPrefix="Region & Office"
          options={REGION_OFFICE_OPTIONS}
          selections={selectedRegionOffice}
          onUpdateSelection={handleRegionOfficeChange}
          multiSelect={false}
          placeholder="- Select one -"
          autoComplete="off"
        />
      </div>
      <CamsTable id="office-division-setup-table" aria-label="USTP offices">
        <CamsTableHeader>
          <CamsTableHeaderCell className="region-column">Region</CamsTableHeaderCell>
          <CamsTableHeaderCell className="office-column">Office</CamsTableHeaderCell>
          <CamsTableHeaderCell>Division(s)</CamsTableHeaderCell>
          <CamsTableHeaderCell className="actions-column">
            <span className="usa-sr-only">Actions</span>
          </CamsTableHeaderCell>
        </CamsTableHeader>
        <CamsTableBody>
          {pageOfRows.map(({ key, office }) => (
            <CamsTableRow key={key} className={office ? undefined : 'unassigned-row'}>
              <CamsTableCell className="region-column" data-cell={office ? 'Region' : undefined}>
                {office?.regionId}
              </CamsTableCell>
              <CamsTableCell className="office-column" data-cell="Office">
                {office ? office.officeName : 'Unassigned'}
              </CamsTableCell>
              <CamsTableCell data-cell="Division(s)">
                <DivisionList
                  divisions={divisionsByOffice.get(key) ?? []}
                  isUnassignedRow={!office}
                />
              </CamsTableCell>
              <CamsTableCell className="actions-column" data-cell="">
                {office && (
                  <Button
                    id={`edit-offices-${key}`}
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    aria-label={`Edit Offices: ${formatOffice(office)}`}
                    onClick={() => editModalRef.current?.show(office)}
                  >
                    <IconLabel icon="edit" label="Edit Offices" />
                  </Button>
                )}
              </CamsTableCell>
            </CamsTableRow>
          ))}
        </CamsTableBody>
      </CamsTable>
      {totalPages > 1 && (
        <Pagination<SearchPredicate>
          paginationValues={{
            count: pageOfRows.length,
            limit,
            currentPage: Math.floor(offset / limit) + 1,
            totalPages,
            totalCount: rows.length,
          }}
          searchPredicate={searchPredicate}
          retrievePage={setSearchPredicate}
        />
      )}
      <EditDivisionsModal
        ref={editModalRef}
        modalId="edit-divisions-modal"
        divisions={divisions}
        onSave={onSaveChanges}
      />
    </div>
  );
}
