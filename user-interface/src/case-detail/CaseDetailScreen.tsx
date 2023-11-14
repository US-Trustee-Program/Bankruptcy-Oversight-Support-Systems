import './CaseDetailScreen.scss';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  Chapter15CaseDetailsResponseData,
} from '@/lib/type-declarations/chapter-15';
import CaseDetailHeader from './panels/CaseDetailHeader';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import CaseDetailContent from './panels/CaseDetailContent';

interface CaseDetailProps {
  caseDetail?: CaseDetailType;
}

function showReopenDate(reOpenDate: string | undefined, closedDate: string | undefined) {
  if (reOpenDate) {
    if (closedDate && reOpenDate > closedDate) {
      return true;
    }
  }
  return false;
}
export const CaseDetail = (props: CaseDetailProps) => {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const [caseDetail, setCaseDetail] = useState<CaseDetailType>();

  const fetchCaseDetail = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      setCaseDetail(response.body?.caseDetails);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    if (props.caseDetail) {
      setCaseDetail(props.caseDetail);
    } else if (!isLoading) {
      fetchCaseDetail();
    }
  }, [caseDetail !== undefined]);

  if (isLoading) {
    return (
      <div className="case-detail">
        <CaseDetailHeader isLoading={isLoading} caseId={caseId} />
        <LoadingIndicator />
      </div>
    );
  } else {
    return (
      caseDetail && (
        <div className="case-detail">
          <CaseDetailHeader isLoading={false} caseId={caseDetail.caseId} caseDetail={caseDetail} />
          <CaseDetailContent
            caseDetail={caseDetail}
            showReopenDate={showReopenDate(caseDetail.reopenedDate, caseDetail.closedDate)}
          />
        </div>
      )
    );
  }
};
