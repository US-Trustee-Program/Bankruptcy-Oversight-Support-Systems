import './CaseDetailScreen.scss';
import { lazy, Suspense, useState, useEffect } from 'react';
import { Route, useParams, Outlet, Routes } from 'react-router-dom';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  CaseDocketEntry,
  Chapter15CaseDetailsResponseData,
} from '@/lib/type-declarations/chapter-15';
const LoadingIndicator = lazy(() => import('@/lib/components/LoadingIndicator'));
const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailBasicInfo = lazy(() => import('./panels/CaseDetailBasicInfo'));
const CaseDetailNavigation = lazy(() => import('./panels/CaseDetailNavigation'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

interface CaseDetailProps {
  caseDetail?: CaseDetailType;
  caseDocketEntries?: CaseDocketEntry[];
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
  const [caseBasicInfo, setCaseBasicInfo] = useState<CaseDetailType>();
  const [caseDocketEntries, setCaseDocketEntries] = useState<CaseDocketEntry[]>();

  const fetchCaseBasicInfo = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      setCaseBasicInfo(response.body?.caseDetails);
      setIsLoading(false);
    });
  };

  const fetchCaseDocketEntries = async () => {
    const docketEntries = [
      {
        sequenceNumber: 2,
        documentNumber: 2,
        dateFiled: '05/07/2023',
        summaryText: 'Add Judge',
        fullText:
          'Id articulus vesper conduco. Adiuvo usus solvo decipio suppono suspendo. Verbum voluptatem cruciamentum tabella aut amo copia caute. Amissio uredo sodalitas autus amaritudo defetiscor statua desino torrens conturbo. Cursus suppellex viridis asper vindico suus adulatio tertius careo. Deludo laudantium adversus ante. Earum tunc concedo terra ocer. Theca blanditiis absum decerno timidus dolorem aeternus delectus agnosco vester. Territo voluptate admoneo cotidie.',
      },
      {
        sequenceNumber: 3,
        documentNumber: 3,
        dateFiled: '05/08/2023',
        summaryText: 'Judge 2',
        fullText:
          'Id Adiuvo usus solvo decipio suppono suspendo. Verbum voluptatem cruciamentum tabella aut amo copia caute. Amissio uredo sodalitas autus amaritudo defetiscor statua desino torrens conturbo. Cursus suppellex viridis asper vindico suus adulatio tertius careo. Deludo laudantium adversus ante. Earum tunc concedo terra ocer. Theca blanditiis absum decerno timidus dolorem aeternus delectus agnosco vester. Territo voluptate admoneo cotidie.',
      },
      {
        sequenceNumber: 4,
        dateFiled: '06/07/2023',
        summaryText: 'Judge 3',
        fullText:
          'Id articulus vesper conduco. Suppono suspendo. Verbum voluptatem cruciamentum tabella aut amo copia caute. Amissio uredo sodalitas autus amaritudo defetiscor statua desino torrens conturbo. Cursus suppellex viridis asper vindico suus adulatio tertius careo. Deludo laudantium adversus ante. Earum tunc concedo terra ocer. Theca blanditiis absum decerno timidus dolorem aeternus delectus agnosco vester. Territo voluptate admoneo cotidie.',
      },
    ];
    setCaseDocketEntries(docketEntries);
  };

  useEffect(() => {
    if (props.caseDetail) {
      setCaseBasicInfo(props.caseDetail);
    } else if (!isLoading) {
      fetchCaseBasicInfo();
    }
  }, []);

  useEffect(() => {
    if (props.caseDocketEntries) {
      setCaseDocketEntries(props.caseDocketEntries);
    } else {
      fetchCaseDocketEntries();
    }
  }, []);

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
        {!isLoading && caseBasicInfo && (
          <>
            <CaseDetailHeader
              isLoading={false}
              caseId={caseBasicInfo.caseId}
              caseDetail={caseBasicInfo}
            />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation caseId={caseId} />
              </div>
              <div className="grid-col-6">
                <Suspense fallback={<LoadingIndicator />}>
                  <Routes>
                    <Route
                      index
                      element={
                        <CaseDetailBasicInfo
                          caseDetail={caseBasicInfo}
                          showReopenDate={showReopenDate(
                            caseBasicInfo?.reopenedDate,
                            caseBasicInfo?.closedDate,
                          )}
                        />
                      }
                    />
                    <Route
                      path="court-docket"
                      element={
                        <CaseDetailCourtDocket
                          caseId={caseBasicInfo.caseId}
                          docketEntries={caseDocketEntries}
                        />
                      }
                    />
                  </Routes>
                </Suspense>
                <Outlet />
              </div>
              <div className="grid-col-2"></div>
              <div className="grid-col-1"></div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CaseDetail;
