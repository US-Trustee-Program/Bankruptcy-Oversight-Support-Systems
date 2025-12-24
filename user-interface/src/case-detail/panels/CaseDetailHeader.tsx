import './CaseDetailHeader.scss';
import { useEffect } from 'react';
import useFixedPosition from '@/lib/hooks/UseFixedPosition';
import { CaseDetail, isChildCase, isLeadCase, isTransferredCase } from '@common/cams/cases';
import { copyCaseNumber, getCaseNumber } from '@/lib/utils/caseNumber';
import CopyButton from '@/lib/components/cams/CopyButton';
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import {
  GavelIcon,
  LeadCaseIcon,
  MemberCaseIcon,
  TransferredCaseIcon,
} from '@/lib/components/cams/RawSvgIcon';

export interface CaseDetailHeaderProps {
  isLoading: boolean;
  caseId: string | undefined;
  caseDetail?: CaseDetail;
}

export default function CaseDetailHeader(props: Readonly<CaseDetailHeaderProps>) {
  const { isFixed, fix, loosen } = useFixedPosition();
  const courtInformation = `${props.caseDetail?.courtName} (${props.caseDetail?.courtDivisionName})`;

  const chapterInformationParts = [];
  if (props.caseDetail?.petitionLabel) {
    chapterInformationParts.push(props.caseDetail?.petitionLabel);
  }
  if (props.caseDetail?.chapter) {
    chapterInformationParts.push('Chapter', props.caseDetail?.chapter);
  }
  const chapterInformation = chapterInformationParts.join(' ');

  const judgeInformation = props.caseDetail?.judgeName;
  const appEl = document.querySelector('.App');
  const camsHeader = document.querySelector('.cams-header');
  const featureFlags = useFeatureFlags();

  const modifyHeader = () => {
    if (camsHeader) {
      const caseDetailHeader = document.querySelector('.case-detail-header.fixed');
      const caseDetailH1 = document.querySelector('.case-detail-header h1');
      if (caseDetailH1 && caseDetailH1.getBoundingClientRect().top < 0) {
        fix();
      } else if (
        caseDetailHeader &&
        camsHeader.getBoundingClientRect().bottom > caseDetailHeader.getBoundingClientRect().bottom
      ) {
        loosen();
      }
    }
  };

  function printH1() {
    return (
      <h1 data-testid="case-detail-heading">
        Case Details{' '}
        <span data-testid="case-detail-heading-title"> - {props.caseDetail?.caseTitle}</span>
      </h1>
    );
  }

  function printH2() {
    return (
      <h2 className="case-number text-no-wrap" title="Case ID" aria-label="Case ID">
        {props.caseId}{' '}
        <CopyButton
          id="header-case-id"
          onClick={() => copyCaseNumber(props.caseId)}
          title="Copy Case ID to clipboard"
        />
      </h2>
    );
  }

  function renderHeader() {
    if (featureFlags[VIEW_TRUSTEE_ON_CASE]) {
      return (
        <div className="record-detail-header" data-testid="case-detail-header">
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-12">
              {props.isLoading && (
                <h1 data-testid="case-detail-heading">Loading Case Details...</h1>
              )}
              {!props.isLoading && props.caseDetail && (
                <div className="display-flex flex-align-center">
                  {isLeadCase(props.caseDetail) && <LeadCaseIcon />}
                  {isChildCase(props.caseDetail) && <MemberCaseIcon />}
                  {isTransferredCase(props.caseDetail) && <TransferredCaseIcon />}
                  <h1
                    className="case-number text-no-wrap display-inline-block margin-right-1"
                    title="Case ID"
                    aria-label={`Case ID ${props.caseId}`}
                    data-testid="case-detail-heading"
                  >
                    {props.caseId}{' '}
                    <CopyButton
                      id="header-case-id"
                      className="copy-button"
                      onClick={() => copyCaseNumber(props.caseId)}
                      title="Copy Case ID to clipboard"
                    />
                  </h1>
                  <div className="tag-list">
                    <Tag
                      uswdsStyle={UswdsTagStyle.Primary}
                      title="Court Name and District"
                      id="court-name-and-district"
                    >
                      {courtInformation}
                    </Tag>
                    {judgeInformation && (
                      <Tag title="Judge" id="case-judge">
                        <GavelIcon />
                        {judgeInformation}
                      </Tag>
                    )}
                    <Tag
                      // className="text-ink"
                      uswdsStyle={UswdsTagStyle.Warm}
                      title="Case Chapter"
                      id="case-chapter"
                    >
                      {chapterInformation}
                    </Tag>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="h2-with-case-info">
              <div className="grid-col">
                <h2
                  className="case-number text-no-wrap"
                  title="Case title"
                  aria-label={`Case title ${props.caseDetail?.caseTitle}`}
                  data-testid="case-detail-heading-title"
                >
                  {props.caseDetail?.caseTitle}
                </h2>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="case-detail-header" data-testid="case-detail-header">
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-12">
              {props.isLoading && (
                <h1 data-testid="case-detail-heading">Loading Case Details...</h1>
              )}
              {!props.isLoading && props.caseDetail && printH1()}
            </div>
          </div>

          {props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="loading-h2">
              <div className="grid-col-12">{printH2()}</div>
            </div>
          )}

          {!props.isLoading && (
            <div className="grid-row grid-gap-lg" data-testid="h2-with-case-info">
              <div className="grid-col-3">{printH2()}</div>
              <div className="grid-col-5">
                <h2
                  className="court-name"
                  title="Court Name and District"
                  data-testid="court-name-and-district"
                >
                  {courtInformation}
                </h2>
              </div>
              <div className="grid-col-3">
                <h2 className="case-chapter" title="Case Chapter" data-testid="case-chapter">
                  {chapterInformation}
                </h2>
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  useEffect(() => {
    if (!props.isLoading && appEl && camsHeader) {
      appEl.addEventListener('scroll', modifyHeader);
    }
    return () => {
      const appEl = document.querySelector('.App');
      appEl?.removeEventListener('scroll', modifyHeader);
    };
  }, [props.isLoading == false]);

  return (
    <>
      {isFixed && (
        <>
          <div className="case-detail-header fixed" data-testid="case-detail-fixed-header">
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-4">
                <h3
                  data-testid="case-detail-heading"
                  title={`Case Title: ${props.caseDetail?.caseTitle}`}
                >
                  {props.caseDetail?.caseTitle}
                </h3>
              </div>
              <div className="grid-col-1">
                <h3
                  className="case-number text-no-wrap"
                  title={`Case Number: ${getCaseNumber(props.caseId)}`}
                >
                  {getCaseNumber(props.caseId)}
                </h3>
              </div>
              <div className="grid-col-4">
                <h3
                  className="court-name"
                  title={`Court Name and District: ${courtInformation}`}
                  data-testid="court-name-and-district"
                >
                  {courtInformation}
                </h3>
              </div>
              <div className="grid-col-3">
                <h3
                  className="case-chapter"
                  title={`Case Chapter: ${chapterInformation}`}
                  data-testid="case-chapter"
                >
                  {chapterInformation}
                </h3>
              </div>
            </div>
          </div>
          <div className="spacer-fixer"></div>
        </>
      )}
      {!isFixed && renderHeader()}
    </>
  );
}
