import './CamsUsers.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
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
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  CamsUsersPredicate,
  CamsUserWithPermissions,
  isUnscopedRole,
  scopeLabel,
  UserRoleAssignment,
} from '@common/cams/user-access';
import { RemovePermissionModal, RemovePermissionModalRef } from './RemovePermissionModal';
import { AddPermissionModal, AddPermissionModalRef } from './AddPermissionModal';
import { PagePredicate, PERMISSIONS_PAGE_SIZE } from './permissions-paging';

const ALL = 'All';
// Same as the data-verification searches (TrusteeSearchModal, TrusteesList).
const MIN_FILTER_LENGTH = 2;
const FILTER_DEBOUNCE_MS = 300;

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
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="cams-users__filter">
      <div className="cams-users__filter-header">
        <label className="usa-label" htmlFor={id}>
          {label}
        </label>
        {value.length > 0 && (
          <button
            id={`${id}-clear`}
            type="button"
            className="usa-button usa-button--unstyled cams-users__filter-clear"
            aria-label={`Clear ${label} filter`}
            onClick={() => {
              onChange('');
              // The button unmounts once the filter is empty, so keep focus in the filter.
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <input
        ref={inputRef}
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

// Email is the widest column; a break point after the @ lets it wrap there instead of mid-word.
function EmailText({ email }: Readonly<{ email?: string }>) {
  if (!email?.includes('@')) return <span data-testid="cams-user-email">{email}</span>;
  const at = email.indexOf('@');
  return (
    <span data-testid="cams-user-email">
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </span>
  );
}

function countLabel(totalCount: number) {
  return `${totalCount} ${totalCount === 1 ? 'CAMS User' : 'CAMS Users'}`;
}

export function CamsUsers() {
  // Super Users cannot remove their own permissions; the API refuses it too.
  const signedInUserId = LocalStorage.getSession()?.user.id;
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
  const removeModalRef = useRef<RemovePermissionModalRef>(null);
  // The filters the current rows were loaded with; paging and reloads reuse them.
  const filtersRef = useRef<Filters>({});
  // Each load takes a ticket; only the latest load may update the table.
  const loadTicketRef = useRef(0);
  const debounce = useDebounce();

  /** Loads a page of users; resolves true only when that page is now shown. */
  const loadPage = useCallback(async (pageOffset: number, focusHeading = false) => {
    const ticket = ++loadTicketRef.current;
    const filters = filtersRef.current;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const predicate: CamsUsersPredicate = { limit: PERMISSIONS_PAGE_SIZE, offset: pageOffset };
      if (filters.name) predicate.name = filters.name;
      if (filters.email) predicate.email = filters.email;
      const response = await Api2.getCamsUsers(predicate);
      if (ticket !== loadTicketRef.current) return false;
      setPage({
        data: response.data,
        pagination: response.pagination!,
        filtered: !!(filters.name || filters.email),
      });
      setOffset(pageOffset);
      // A page change replaces the rows the user was on; start them at the top of the new page.
      if (focusHeading) headingRef.current?.focus();
      return true;
    } catch {
      if (ticket === loadTicketRef.current) {
        // The table, pagination and row buttons all unmount on failure (gated on !loadFailed
        // below), so whatever had focus - the row's Add Permission button after a grant, or
        // nothing in particular after a page change - is gone. The heading stays mounted either
        // way, so it's always a safe place to land focus.
        setLoadFailed(true);
        headingRef.current?.focus();
      }
      return false;
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

  function officeName(officeCode: string) {
    return officeNames.get(officeCode) ?? officeCode;
  }

  function officeLabel(permission: UserRoleAssignment) {
    return permission.officeCode === null ? ALL : officeName(permission.officeCode);
  }

  // Starts with the visible text (WCAG 2.5.3 Label in Name) and names the permission, so a user's
  // Remove buttons can be told apart out of context: "...: Trial Attorney, Region 2 - Manhattan".
  function removeLabel(user: CamsUserReference, permission: UserRoleAssignment) {
    const role = CamsRoleLabels[permission.role];
    const name = `Remove Permission from ${user.name}: ${role}`;
    if (isUnscopedRole(permission.role)) return name;
    const office = permission.officeCode ? officeNames.get(permission.officeCode) : undefined;
    return `${name}, ${scopeLabel(permission, office)}`;
  }

  async function afterRemoval(userId: string) {
    // The Remove button that opened the modal is gone; focus the row's Add Permission, or the
    // heading when adding is unavailable. If the reload fails, loadPage has already moved focus to
    // the heading.
    if (!(await loadPage(offset))) return;
    const add = document.getElementById(`add-permission-${userId}`) as HTMLButtonElement | null;
    if (add && !add.disabled) add.focus();
    else headingRef.current?.focus();
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
      <h2 id="cams-users-count" className="cams-users__count" ref={headingRef} tabIndex={-1}>
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
          <CamsTable id="cams-users-table" className="cams-users-table" aria-label="CAMS Users">
            <CamsTableHeader>
              <CamsTableHeaderCell className="col-name">Name</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-email">Email</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-role">Role</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-region">Region</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-office">Office</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-actions">
                <span className="usa-sr-only">Actions</span>
              </CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              {page.data.flatMap((user) => {
                // One row per permission, as on the Trustees list; a user with none still gets one.
                const rows: (UserRoleAssignment | null)[] =
                  user.permissions.length > 0 ? user.permissions : [null];
                return rows.map((permission, index) => {
                  const first = index === 0;
                  return (
                    <CamsTableRow
                      // The first row keeps the user's key, so its Add Permission button survives
                      // a reload that removes the user's first permission, and can keep focus.
                      key={first ? user.id : permission!.id}
                      data-testid={
                        first ? `cams-user-row-${user.id}` : `cams-user-row-${user.id}-${index}`
                      }
                      className={[
                        first ? '' : 'cams-users__row--continued',
                        permission ? '' : 'cams-users__row--no-permissions',
                        index < rows.length - 1 ? 'cams-users__row--continues' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {first ? (
                        <>
                          <CamsTableCell className="col-name" data-cell="Name">
                            {user.name}
                          </CamsTableCell>
                          <CamsTableCell className="col-email" data-cell="Email">
                            <EmailText email={user.email} />
                          </CamsTableCell>
                        </>
                      ) : (
                        <>
                          <CamsTableCell className="col-name">
                            {/* Says whose permission this row is when moving through the table. */}
                            <span className="usa-sr-only">{user.name}</span>
                          </CamsTableCell>
                          <CamsTableCell className="col-email">
                            <span aria-hidden="true"></span>
                          </CamsTableCell>
                        </>
                      )}
                      <CamsTableCell className="col-role" data-cell="Role">
                        {permission ? CamsRoleLabels[permission.role] : ''}
                      </CamsTableCell>
                      <CamsTableCell className="col-region" data-cell="Region">
                        {permission ? (permission.regionId ?? ALL) : ''}
                      </CamsTableCell>
                      <CamsTableCell className="col-office" data-cell="Office">
                        {permission ? officeLabel(permission) : ''}
                      </CamsTableCell>
                      <CamsTableCell className="col-actions" data-cell="">
                        <div className="cams-users__actions">
                          {permission && user.id !== signedInUserId && (
                            <Button
                              id={`remove-permission-${permission.id}`}
                              uswdsStyle={UswdsButtonStyle.Unstyled}
                              className="cams-users__remove-permission"
                              aria-label={removeLabel(user, permission)}
                              onClick={() =>
                                removeModalRef.current?.show(
                                  { id: user.id, name: user.name },
                                  permission,
                                )
                              }
                            >
                              <IconLabel icon="close" label="Remove Permission" />
                            </Button>
                          )}
                          {first && (
                            <Button
                              id={`add-permission-${user.id}`}
                              uswdsStyle={UswdsButtonStyle.Unstyled}
                              className="cams-users__add-permission"
                              aria-label={`Add Permission to ${user.name}`}
                              disabled={officesFailed}
                              onClick={() =>
                                modalRef.current?.show({ id: user.id, name: user.name })
                              }
                            >
                              <IconLabel icon="add_circle" label="Add Permission" />
                            </Button>
                          )}
                        </div>
                      </CamsTableCell>
                    </CamsTableRow>
                  );
                });
              })}
            </CamsTableBody>
          </CamsTable>
          {(page.pagination.totalPages ?? 1) > 1 && (
            <Pagination<PagePredicate>
              paginationValues={page.pagination}
              searchPredicate={{ limit: PERMISSIONS_PAGE_SIZE, offset }}
              retrievePage={(predicate) => loadPage(predicate.offset ?? 0, true)}
            />
          )}
        </>
      )}
      <RemovePermissionModal
        ref={removeModalRef}
        modalId="remove-permission-modal"
        offices={offices}
        onSuccess={afterRemoval}
      />
      <AddPermissionModal
        ref={modalRef}
        modalId="add-permission-modal"
        offices={offices}
        onSuccess={() => loadPage(offset)}
      />
    </div>
  );
}
