import './CamsUsers.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Api2 from '@/lib/models/api2';
import {
  CamsTable,
  CamsTableBody,
  CamsTableCell,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
} from '@/lib/components/cams/CamsTable';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import useDebounce from '@/lib/hooks/UseDebounce';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { CamsRoleLabels } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  CamsUsersPredicate,
  CamsUserWithPermissions,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { AddPermissionModal, AddPermissionModalRef } from './AddPermissionModal';

const PAGE_SIZE = 20;
const ALL = 'All';
// Same as the data-verification searches (TrusteeSearchModal, TrusteesList).
const MIN_FILTER_LENGTH = 2;
const FILTER_DEBOUNCE_MS = 300;

type PagePredicate = { limit: number; offset: number };
type Filters = Pick<CamsUsersPredicate, 'name' | 'email'>;
type UsersPage = {
  data: CamsUserWithPermissions[];
  pagination: PaginationModel;
  filtered: boolean;
};

/** The text a filter applies: trimmed, and nothing until it is long enough. */
function effectiveFilter(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length >= MIN_FILTER_LENGTH ? trimmed : undefined;
}

function TextFilter({
  id,
  label,
  placeholder,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <div className="cams-users__filter">
      <div className="cams-users__filter-header">
        <label className="usa-label" htmlFor={id}>
          {label}
        </label>
        <button
          id={`${id}-clear`}
          type="button"
          className="usa-button usa-button--unstyled cams-users__filter-clear"
          aria-label={`Clear ${label} filter`}
          hidden={value.length === 0}
          onClick={() => onChange('')}
        >
          Clear
        </button>
      </div>
      <input
        id={id}
        type="text"
        className="usa-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function PermissionLines({
  lines,
  emptyLabel,
}: Readonly<{ lines: string[]; emptyLabel?: string }>) {
  if (lines.length === 0) {
    return emptyLabel ? <span className="usa-sr-only">{emptyLabel}</span> : null;
  }
  return (
    // role="list" keeps list semantics in Safari/VoiceOver, which drop them when list-style is none.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ul className="cams-users__permission-lines" role="list">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

function countLabel(totalCount: number) {
  return `${totalCount} ${totalCount === 1 ? 'CAMS User' : 'CAMS Users'}`;
}

export function CamsUsers() {
  const [page, setPage] = useState<UsersPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [offices, setOffices] = useState<UstpOfficeDetails[]>([]);
  // Office names label each permission, so the table waits for them rather than flashing codes.
  const [officesLoaded, setOfficesLoaded] = useState(false);
  const [officesFailed, setOfficesFailed] = useState(false);
  const [nameText, setNameText] = useState('');
  const [emailText, setEmailText] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const modalRef = useRef<AddPermissionModalRef>(null);
  // The filters the current rows were loaded with; paging and reloads reuse them.
  const filtersRef = useRef<Filters>({});
  // Each load takes a ticket; only the latest load may update the table.
  const loadTicketRef = useRef(0);
  const debounce = useDebounce();

  const loadPage = useCallback(async (pageOffset: number, focusHeading = false) => {
    const ticket = ++loadTicketRef.current;
    const filters = filtersRef.current;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const predicate: CamsUsersPredicate = { limit: PAGE_SIZE, offset: pageOffset };
      if (filters.name) predicate.name = filters.name;
      if (filters.email) predicate.email = filters.email;
      const response = await Api2.getCamsUsers(predicate);
      if (ticket !== loadTicketRef.current) return;
      setPage({
        data: response.data,
        pagination: response.pagination!,
        filtered: !!(filters.name || filters.email),
      });
      setOffset(pageOffset);
      // A page change replaces the rows the user was on; start them at the top of the new page.
      if (focusHeading) headingRef.current?.focus();
    } catch {
      if (ticket === loadTicketRef.current) setLoadFailed(true);
    } finally {
      if (ticket === loadTicketRef.current) setIsLoading(false);
    }
  }, []);

  const nameFilter = effectiveFilter(nameText);
  const emailFilter = effectiveFilter(emailText);

  useEffect(() => {
    // Re-arming cancels any pending change, including text deleted before typing stopped.
    debounce(() => {
      const applied = filtersRef.current;
      if (applied.name === nameFilter && applied.email === emailFilter) return;
      filtersRef.current = { name: nameFilter, email: emailFilter };
      loadPage(0);
    }, FILTER_DEBOUNCE_MS);
  }, [nameFilter, emailFilter, debounce, loadPage]);

  useEffect(() => {
    loadPage(0);
    Api2.getOffices()
      .then((response) => setOffices(response.data))
      .catch(() => setOfficesFailed(true))
      .finally(() => setOfficesLoaded(true));
  }, [loadPage]);

  const officeNames = useMemo(
    () => new Map(offices.map((office) => [office.officeCode, office.officeName])),
    [offices],
  );

  function officeLabel(permission: UserRoleAssignment) {
    if (permission.officeCode === null) return ALL;
    return officeNames.get(permission.officeCode) ?? permission.officeCode;
  }

  const isReady = officesLoaded && page !== null;
  const heading = isReady ? countLabel(page.pagination.totalCount ?? 0) : 'CAMS Users';
  const isWorking = isLoading || !officesLoaded;
  let status = '';
  if (isWorking) status = 'Loading CAMS users...';
  else if (isReady && !loadFailed) status = heading;

  return (
    <div className="cams-users" data-testid="cams-users-panel">
      <div className="cams-users__filters">
        <TextFilter
          id="cams-users-name-filter"
          label="CAMS User Name"
          placeholder="Search by name"
          value={nameText}
          onChange={setNameText}
        />
        <TextFilter
          id="cams-users-email-filter"
          label="Email"
          placeholder="Search by email"
          value={emailText}
          onChange={setEmailText}
        />
      </div>
      <h2 id="cams-users-count" ref={headingRef} tabIndex={-1}>
        {heading}
      </h2>
      <div className="usa-sr-only" role="status" data-testid="cams-users-status">
        {status}
      </div>
      {isWorking && (
        <LoadingSpinner
          id="cams-users-loading"
          data-testid="cams-users-loading"
          caption="Loading..."
          aria-hidden="true"
        />
      )}
      {loadFailed && !isLoading && (
        <Alert
          id="cams-users-load-error"
          message="Unable to load CAMS users. Please try again."
          type={UswdsAlertStyle.Error}
          show={true}
          inline={true}
        />
      )}
      {officesFailed && (
        <Alert
          id="cams-users-offices-error"
          message="Unable to load office names. Offices are shown by code, and permissions cannot be added."
          type={UswdsAlertStyle.Warning}
          show={true}
          inline={true}
        />
      )}
      {isReady && !loadFailed && page.data.length === 0 && (
        <p id="cams-users-empty">
          {page.filtered ? 'No CAMS users match your search criteria.' : 'No CAMS users found.'}
        </p>
      )}
      {/* Kept mounted while a page reloads, so focus stays on the row the user was working in. */}
      {isReady && !loadFailed && page.data.length > 0 && (
        <>
          <CamsTable id="cams-users-table" aria-label="CAMS Users">
            <CamsTableHeader>
              <CamsTableHeaderCell>Name</CamsTableHeaderCell>
              <CamsTableHeaderCell>Email</CamsTableHeaderCell>
              <CamsTableHeaderCell>Role</CamsTableHeaderCell>
              <CamsTableHeaderCell>Region</CamsTableHeaderCell>
              <CamsTableHeaderCell>Office</CamsTableHeaderCell>
              <CamsTableHeaderCell>
                <span className="usa-sr-only">Actions</span>
              </CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              {page.data.map((user) => (
                <CamsTableRow key={user.id} data-testid={`cams-user-row-${user.id}`}>
                  <CamsTableCell data-cell="Name">{user.name}</CamsTableCell>
                  <CamsTableCell data-cell="Email">{user.email}</CamsTableCell>
                  <CamsTableCell data-cell="Role">
                    <PermissionLines
                      lines={user.permissions.map((p) => CamsRoleLabels[p.role])}
                      emptyLabel="No permissions"
                    />
                  </CamsTableCell>
                  <CamsTableCell data-cell="Region">
                    <PermissionLines lines={user.permissions.map((p) => p.regionId ?? ALL)} />
                  </CamsTableCell>
                  <CamsTableCell data-cell="Office">
                    <PermissionLines lines={user.permissions.map(officeLabel)} />
                  </CamsTableCell>
                  <CamsTableCell data-cell="">
                    <Button
                      id={`add-permission-${user.id}`}
                      uswdsStyle={UswdsButtonStyle.Unstyled}
                      aria-label={`Add Permission to ${user.name}`}
                      disabled={officesFailed}
                      onClick={() => modalRef.current?.show({ id: user.id, name: user.name })}
                    >
                      <IconLabel icon="add_circle" label="Add Permission" />
                    </Button>
                  </CamsTableCell>
                </CamsTableRow>
              ))}
            </CamsTableBody>
          </CamsTable>
          {(page.pagination.totalPages ?? 1) > 1 && (
            <Pagination<PagePredicate>
              paginationValues={page.pagination}
              searchPredicate={{ limit: PAGE_SIZE, offset }}
              retrievePage={(predicate) => loadPage(predicate.offset ?? 0, true)}
            />
          )}
        </>
      )}
      <AddPermissionModal
        ref={modalRef}
        modalId="add-permission-modal"
        offices={offices}
        onSuccess={() => loadPage(offset)}
      />
    </div>
  );
}
