import { Link } from 'react-router-dom';
import Icon from '@/lib/components/uswds/Icon';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';

export interface CaseDetailHeaderProps {
  isLoading: boolean;
  caseId: string | undefined;
  caseDetail?: CaseDetailType;
}

export default function CaseDetailHeader(props: CaseDetailHeaderProps) {
  return (
    <>
      <div className="grid-row">
        <div className="grid-col-12">
          <Link className="back-button" to="/case-assignment">
            <Icon name="arrow_back"></Icon>
            Back to Case List
          </Link>
        </div>
      </div>

      <div className="grid-row">
        <div className="grid-col-12">
          <h1 data-testid="case-detail-heading">
            {props.isLoading && <>Loading Case Details...</>}
            {!props.isLoading && props.caseDetail?.caseTitle}
          </h1>
        </div>
      </div>

      {props.isLoading && (
        <h2>
          <span className="case-number" title="Case Number">
            {getCaseNumber(props.caseId)}
          </span>
        </h2>
      )}
      {!props.isLoading && (
        <div className="grid-row">
          <div className="grid-col-2">
            <h2>
              <span className="case-number" title="Case Number">
                {getCaseNumber(props.caseId)}
              </span>
            </h2>
          </div>
          <div className="grid-col-8">
            <h2>
              <span
                className="court-name"
                title="Court Name and Distrct"
                data-testid="court-name-and-district"
              >
                {props.caseDetail?.courtName} - {props.caseDetail?.courtDivisionName}
              </span>
            </h2>
          </div>
          <div className="grid-col-2">
            <h2>
              <span className="case-chapter" title="Case Chapter" data-testid="case-chapter">
                Chapter {props.caseDetail?.chapter}
              </span>
            </h2>
          </div>
        </div>
      )}
    </>
  );
}
