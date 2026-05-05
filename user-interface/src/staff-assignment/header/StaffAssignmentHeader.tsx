import { CamsTableHeader, CamsTableHeaderCell } from '@/lib/components/cams/CamsTable';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function StaffAssignmentHeader(_props: SearchResultsHeaderProps) {
  return (
    <CamsTableHeader>
      <CamsTableHeaderCell className="col-case-number">Case Number (Division)</CamsTableHeaderCell>
      <CamsTableHeaderCell className="col-case-title">Case Title</CamsTableHeaderCell>
      <CamsTableHeaderCell className="col-chapter">Chapter</CamsTableHeaderCell>
      <CamsTableHeaderCell className="col-date-filed">Case Filed</CamsTableHeaderCell>
      <CamsTableHeaderCell className="col-staff-assignment">Staff Assignment</CamsTableHeaderCell>
    </CamsTableHeader>
  );
}
