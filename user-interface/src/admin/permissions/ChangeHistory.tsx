import './ChangeHistory.scss';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Api2 from '@/lib/models/api2';
import {
  CamsTable,
  CamsTableBody,
  CamsTableCell,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
} from '@/lib/components/cams/CamsTable';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { formatDate } from '@/lib/utils/datetime';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { CamsRoleLabels } from '@common/cams/roles';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  isUnscopedRole,
  PermissionChange,
  PermissionSnapshot,
  scopeLabel,
} from '@common/cams/user-access';
import { PagePredicate, PERMISSIONS_PAGE_SIZE } from './permissions-paging';

// The changes endpoint always counts the rows and pages; the shared Pagination type leaves them optional.
type ChangesPagination = PaginationModel &
  Required<Pick<PaginationModel, 'totalCount' | 'totalPages'>>;
type ChangesPage = { data: PermissionChange[]; pagination: ChangesPagination };

function countLabel(totalCount: number) {
  return `${totalCount} ${totalCount === 1 ? 'permission change' : 'permission changes'}`;
}

export function ChangeHistory() {
  const [page, setPage] = useState<ChangesPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // The offset of the page that failed to load, so Try again asks for it again.
  const [failedOffset, setFailedOffset] = useState<number | null>(null);
  const [offices, setOffices] = useState<UstpOfficeDetails[]>([]);
  // Office names label each permission, so the table waits for them rather than flashing codes.
  const [officesLoaded, setOfficesLoaded] = useState(false);
  const [officesFailed, setOfficesFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Each load takes a ticket; only the latest load may update the table.
  const loadTicketRef = useRef(0);

  const loadPage = useCallback(async (pageOffset: number, focusHeading = false) => {
    const ticket = ++loadTicketRef.current;
    setIsLoading(true);
    setFailedOffset(null);
    try {
      const response = await Api2.getPermissionChanges({
        limit: PERMISSIONS_PAGE_SIZE,
        offset: pageOffset,
      });
      if (ticket !== loadTicketRef.current) return;
      setPage({ data: response.data, pagination: response.pagination as ChangesPagination });
      setOffset(pageOffset);
      // A page change replaces the rows the user was on; start them at the top of the new page.
      if (focusHeading) headingRef.current?.focus();
    } catch {
      if (ticket === loadTicketRef.current) {
        // The table and pagination unmount on failure; the heading stays, so focus lands there.
        setFailedOffset(pageOffset);
        headingRef.current?.focus();
      }
    } finally {
      if (ticket === loadTicketRef.current) setIsLoading(false);
    }
  }, []);

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

  // 'Trial Attorney,' 'Region 2 -' 'Manhattan': the pieces a permission may wrap between, so it
  // breaks only after its comma or a dash, never inside a role or office name. Super User has no
  // scope.
  function permissionParts(permission: PermissionSnapshot): string[] {
    const role = CamsRoleLabels[permission.role];
    if (isUnscopedRole(permission.role)) return [role];
    const office = permission.officeCode ? officeNames.get(permission.officeCode) : undefined;
    return [`${role},`, ...scopeLabel(permission, office).split(/(?<= -) /)];
  }

  // A missing side - a grant's Previous, a removal's New - reads '(none)'.
  function sideText(permission: PermissionSnapshot | null) {
    const parts = permission ? permissionParts(permission) : ['(none)'];
    return parts.map((part, index) => (
      <Fragment key={part}>
        {index > 0 && ' '}
        <span className="change-history__part">{part}</span>
      </Fragment>
    ));
  }

  const loadFailed = failedOffset !== null;
  const isReady = officesLoaded && page !== null;
  const isWorking = isLoading || !officesLoaded;
  let status = '';
  if (isWorking) status = 'Loading change history...';
  else if (isReady && !loadFailed) status = countLabel(page.pagination.totalCount);

  return (
    <div className="change-history" data-testid="change-history-panel">
      <h2
        id="change-history-heading"
        className="change-history__heading"
        ref={headingRef}
        tabIndex={-1}
      >
        Change History
      </h2>
      <div className="usa-sr-only" role="status" data-testid="change-history-status">
        {status}
      </div>
      {isWorking && (
        <LoadingSpinner
          id="change-history-loading"
          data-testid="change-history-loading"
          caption="Loading..."
          aria-hidden="true"
        />
      )}
      {loadFailed && (
        <>
          <Alert
            id="change-history-load-error"
            message="Unable to load change history. Please try again."
            type={UswdsAlertStyle.Error}
            show={true}
            inline={true}
          />
          <Button
            id="change-history-try-again"
            uswdsStyle={UswdsButtonStyle.Outline}
            onClick={() => loadPage(failedOffset, true)}
          >
            Try again
          </Button>
        </>
      )}
      {officesFailed && (
        <Alert
          id="change-history-offices-error"
          message="Unable to load office names. Offices are shown by code."
          type={UswdsAlertStyle.Warning}
          show={true}
          inline={true}
        />
      )}
      {isReady && !loadFailed && page.data.length === 0 && (
        <p id="change-history-empty">No permission changes yet.</p>
      )}
      {isReady && !loadFailed && page.data.length > 0 && (
        <>
          <CamsTable
            id="change-history-table"
            className="change-history-table"
            aria-label="Change History"
          >
            <CamsTableHeader>
              <CamsTableHeaderCell className="col-user">User</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-previous">Previous</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-new">New</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-changed-by">Changed by</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-date">Date</CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              {page.data.map((change) => (
                <CamsTableRow key={change.auditId} data-testid={`change-row-${change.auditId}`}>
                  <CamsTableCell className="col-user" data-cell="User">
                    {change.userName}
                  </CamsTableCell>
                  <CamsTableCell className="col-previous" data-cell="Previous">
                    {sideText(change.previous)}
                  </CamsTableCell>
                  <CamsTableCell className="col-new" data-cell="New">
                    {sideText(change.next)}
                  </CamsTableCell>
                  <CamsTableCell className="col-changed-by" data-cell="Changed by">
                    {change.performedByName}
                  </CamsTableCell>
                  <CamsTableCell className="col-date" data-cell="Date">
                    {formatDate(change.performedAt)}
                  </CamsTableCell>
                </CamsTableRow>
              ))}
            </CamsTableBody>
          </CamsTable>
          {page.pagination.totalPages > 1 && (
            <Pagination<PagePredicate>
              paginationValues={page.pagination}
              searchPredicate={{ limit: PERMISSIONS_PAGE_SIZE, offset }}
              retrievePage={(predicate) => loadPage(predicate.offset, true)}
            />
          )}
        </>
      )}
    </div>
  );
}
