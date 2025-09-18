import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { useEffect, useState } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useLocation, useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { TrusteeFormState } from './TrusteeForm';
import TrusteeDetailHeader from './TrusteeDetailHeader';
import TrusteeDetailProfile from './panels/TrusteeDetailProfile';
import TrusteeDetailAuditHistory from './panels/TrusteeDetailAuditHistory';
import TrusteeDetailNavigation, { mapTrusteeDetailNavState } from './TrusteeDetailNavigation';

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const location = useLocation();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [navState, setNavState] = useState<number>(mapTrusteeDetailNavState(location.pathname));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [districtLabels, setDistrictLabels] = useState<string[]>([]);

  const navigate = useNavigate();

  const globalAlert = useGlobalAlert();
  const api = useApi2();

  function openEditPublicProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee || undefined,
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'public',
    };
    navigate(`/trustees/${trusteeId}/edit`, { state });
  }

  function openEditInternalProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee || undefined,
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'internal',
    };
    navigate(`/trustees/${trusteeId}/edit`, { state });
  }

  useEffect(() => {
    if (trusteeId) {
      setIsLoading(true);
      Promise.all([api.getTrustee(trusteeId), api.getCourts()])
        .then(([trusteeResponse, courtsResponse]) => {
          setTrustee(trusteeResponse.data);
          const trusteeDistricts: string[] = [];
          trusteeResponse.data.districts?.map((district: string) => {
            const court = courtsResponse.data.find((court) => court.courtDivisionCode === district);
            if (court) {
              trusteeDistricts.push(`${court.courtName} (${court.courtDivisionName})`);
            }
          });
          setDistrictLabels(trusteeDistricts);
        })
        .catch(() => {
          globalAlert?.error('Could not get trustee details');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [trusteeId]);

  useEffect(() => {
    setNavState(mapTrusteeDetailNavState(location.pathname));
  }, [location]);

  return (
    <MainContent className="record-detail" data-testid="record-detail">
      <DocumentTitle name="Trustee Detail" />
      <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
        <TrusteeDetailHeader
          trustee={trustee}
          isLoading={isLoading}
          districtLabels={districtLabels}
        />
        {!!trustee && !isLoading && (
          <div className="trustee-detail-screen-content-container">
            <div className="left-navigation-pane-container">
              <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
            </div>
            <Routes>
              <Route
                path="/"
                element={
                  <TrusteeDetailProfile
                    trustee={trustee}
                    districtLabels={districtLabels}
                    onEditPublicProfile={openEditPublicProfile}
                    onEditInternalProfile={openEditInternalProfile}
                  />
                }
              />
              <Route
                path="/audit-history"
                element={<TrusteeDetailAuditHistory trusteeId={trusteeId || ''} />}
              />
            </Routes>
          </div>
        )}
      </div>
    </MainContent>
  );
}
