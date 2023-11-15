import './CaseDetailScreen.scss';
import { lazy, Suspense, useState, useEffect } from 'react';
import { Route, useParams, Outlet, Routes } from 'react-router-dom';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  Chapter15CaseDetailsResponseData,
} from '@/lib/type-declarations/chapter-15';
const LoadingIndicator = lazy(() => import('@/lib/components/LoadingIndicator'));
const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailContent = lazy(() => import('./panels/CaseDetailContent'));
const CaseDetailNavigation = lazy(() => import('./panels/CaseDetailNavigation'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

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
  }, []);
  //}, [caseDetail !== undefined]);

  return (
    <>
      <div className="case-detail">
        {isLoading && (
          <>
            <CaseDetailHeader isLoading={isLoading} caseId={caseId} />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <LoadingIndicator />
              </div>
              <div className="grid-col-1"></div>
            </div>
          </>
        )}
        {!isLoading && caseDetail && (
          <>
            <CaseDetailHeader
              isLoading={false}
              caseId={caseDetail.caseId}
              caseDetail={caseDetail}
            />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation caseId={caseDetail.caseId} />
              </div>
              <div className="grid-col-8">
                <Suspense fallback={<LoadingIndicator />}>
                  <Routes>
                    <Route
                      index
                      element={
                        <CaseDetailContent
                          caseDetail={caseDetail}
                          showReopenDate={showReopenDate(
                            caseDetail?.reopenedDate,
                            caseDetail?.closedDate,
                          )}
                        />
                      }
                    />
                    <Route path="court-docket" element={<CaseDetailCourtDocket />} />
                  </Routes>
                </Suspense>
                <Outlet />
              </div>
              <div className="grid-col-1"></div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CaseDetail;
