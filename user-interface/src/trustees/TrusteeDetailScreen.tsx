import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import '@/styles/left-navigation-pane.scss';
import { JSX, useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useNavigate, useParams, Routes, Route, useLocation } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import TrusteeDetailHeader from './TrusteeDetailHeader';
import TrusteeDetailProfile from './panels/TrusteeDetailProfile';
import TrusteeDetailAuditHistory from './panels/TrusteeDetailAuditHistory';
import TrusteeDetailNavigation, { mapTrusteeDetailNavState } from './TrusteeDetailNavigation';
import TrusteeOtherInfoForm from './forms/TrusteeOtherInfoForm';
import NotFound from '@/lib/components/NotFound';
import TrusteeAssignedStaff from './panels/TrusteeAssignedStaff';
import TrusteeAppointments from './panels/TrusteeAppointments';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { BankruptcySoftwareList } from '@common/cams/lists';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';
import TrusteeInternalContactForm from './forms/TrusteeInternalContactForm';
import TrusteeAssistantForm from './forms/TrusteeAssistantForm';
import TrusteeAppointmentForm from './forms/TrusteeAppointmentForm';
import EditTrusteeAppointment from './forms/EditTrusteeAppointment';
import TrusteeMeetingOfCreditorsInfoForm from './forms/TrusteeMeetingOfCreditorsInfoForm';
import Notes from '@/lib/components/cams/Notes/Notes';
import { NoteInput } from '@/lib/components/cams/Notes/types';
import { TrusteeNote } from '@common/cams/trustee-notes';
import { getCamsUserReference } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import Actions from '@common/cams/actions';

type TrusteeHeaderProps = JSX.IntrinsicElements['div'] & {
  trustee: Trustee | null;
  isLoading: boolean;
  subHeading: string;
};

function TrusteeHeader({ trustee, isLoading, subHeading, children }: TrusteeHeaderProps) {
  return (
    <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
      <TrusteeDetailHeader trustee={trustee} isLoading={isLoading} subHeading={subHeading} />
      <div className="trustee-detail-screen-content-container">{children}</div>
    </div>
  );
}

const transformSoftwareList = (items: BankruptcySoftwareList): ComboOption[] => {
  return items.map((item: { key: string; value: string }) => ({
    value: item.key,
    label: item.value,
  }));
};

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const location = useLocation();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [navState, setNavState] = useState<number>(mapTrusteeDetailNavState(location.pathname));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [softwareOptions, setSoftwareOptions] = useState<ComboOption[]>([]);
  const [trusteeNotes, setTrusteeNotes] = useState<TrusteeNote[]>([]);
  const [areNotesLoading, setAreNotesLoading] = useState<boolean>(false);

  const navigate = useNavigate();
  const globalAlert = useGlobalAlert();

  function openEditPublicProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/public`);
  }

  function openEditInternalProfile() {
    navigate(`/trustees/${trusteeId}/contact/edit/internal`);
  }

  function openAddAssistant() {
    navigate(`/trustees/${trusteeId}/assistant/create`);
  }

  function openEditAssistant(assistantId: string) {
    navigate(`/trustees/${trusteeId}/assistant/edit/${assistantId}`);
  }

  function openEditOtherInformation() {
    navigate(`/trustees/${trusteeId}/other/edit`);
  }

  function openEditZoomInfo() {
    navigate(`/trustees/${trusteeId}/zoom/edit`);
  }

  async function fetchTrusteeNotes() {
    if (!trusteeId) return;

    setAreNotesLoading(true);
    try {
      const response = await Api2.getTrusteeNotes(trusteeId);
      setTrusteeNotes(response.data ?? []);
    } catch (_error) {
      globalAlert?.error('Could not load trustee notes');
      setTrusteeNotes([]);
    } finally {
      setAreNotesLoading(false);
    }
  }

  async function handleCreateNote(noteData: NoteInput) {
    if (!trusteeId) return;

    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.postTrusteeNote({
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
    } catch (error) {
      globalAlert?.error('Failed to create note');
      throw error;
    }
  }

  async function handleUpdateNote(noteId: string, noteData: NoteInput) {
    if (!trusteeId) return;

    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.putTrusteeNote({
        id: noteId,
        trusteeId,
        title: noteData.title,
        content: noteData.content,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
    } catch (error) {
      globalAlert?.error('Failed to update note');
      throw error;
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!trusteeId) return;

    const session = LocalStorage.getSession();
    if (!session?.user) {
      globalAlert?.error('User session not found');
      return;
    }

    try {
      await Api2.deleteTrusteeNote({
        id: noteId,
        trusteeId,
        updatedBy: getCamsUserReference(session.user),
      });
      await fetchTrusteeNotes();
    } catch (error) {
      globalAlert?.error('Failed to delete note');
      throw error;
    }
  }

  useEffect(() => {
    const fetchSoftwareOptions = async () => {
      try {
        const response = await Api2.getBankruptcySoftwareList();
        if (response?.data) {
          const transformedOptions = transformSoftwareList(response.data as BankruptcySoftwareList);
          setSoftwareOptions(transformedOptions);
        }
      } catch (e) {
        console.log('Failed to fetch software options', (e as Error).message);
      }
    };

    fetchSoftwareOptions();
  }, []);

  useEffect(() => {
    if (!trusteeId) return;

    setIsLoading(true);
    setNavState(mapTrusteeDetailNavState(location.pathname));

    Api2.getTrustee(trusteeId)
      .then((trusteeResponse) => {
        setTrustee(trusteeResponse.data);
      })
      .catch(() => {
        globalAlert?.error('Could not get trustee details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [location.pathname, trusteeId, globalAlert]);

  useEffect(() => {
    if (trusteeId) {
      fetchTrusteeNotes();
    }
  }, [trusteeId]);

  if (!trusteeId || (!isLoading && !trustee)) {
    return (
      <MainContent className="record-detail" data-testid="record-detail">
        <DocumentTitle name="Trustee Detail" />
        <NotFound />
      </MainContent>
    );
  }

  if (!trustee || isLoading) {
    return (
      <MainContent className="record-detail" data-testid="record-detail">
        <DocumentTitle name="Trustee Detail" />
        <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
          <TrusteeDetailHeader trustee={null} isLoading={isLoading} />
        </div>
      </MainContent>
    );
  }

  const routeConfigs = [
    {
      path: '/',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeDetailProfile
              trustee={trustee}
              onEditPublicProfile={openEditPublicProfile}
              onEditInternalProfile={openEditInternalProfile}
              onAddAssistant={openAddAssistant}
              onEditAssistant={openEditAssistant}
              onEditOtherInformation={openEditOtherInformation}
              onEditZoomInfo={openEditZoomInfo}
            />
          </div>
        </div>
      ),
    },
    {
      path: 'contact/edit/public',
      subHeading: 'Edit Trustee Profile (Public)',
      content: (
        <TrusteePublicContactForm
          trusteeId={trusteeId}
          trustee={trustee}
          action="edit"
          cancelTo={`/trustees/${trusteeId}`}
        />
      ),
    },
    {
      path: 'contact/edit/internal',
      subHeading: 'Edit Trustee Profile (USTP Internal)',
      content: (
        <TrusteeInternalContactForm
          trusteeId={trusteeId}
          trustee={trustee}
          cancelTo={`/trustees/${trusteeId}`}
        />
      ),
    },
    {
      path: 'assistant/create',
      subHeading: 'Create Trustee Assistant (USTP Internal)',
      content: <TrusteeAssistantForm trusteeId={trusteeId} />,
    },
    {
      path: 'assistant/edit/:assistantId',
      subHeading: 'Edit Trustee Assistant (USTP Internal)',
      content: <TrusteeAssistantForm trusteeId={trusteeId} trustee={trustee} />,
    },
    {
      path: 'other/edit',
      subHeading: 'Edit Other Trustee Information',
      content: (
        <TrusteeOtherInfoForm
          banks={trustee.banks}
          software={trustee.software}
          trusteeId={trustee.trusteeId}
          softwareOptions={softwareOptions}
        />
      ),
    },
    {
      path: 'zoom/edit',
      subHeading: 'Edit 341 Meeting Information',
      content: <TrusteeMeetingOfCreditorsInfoForm trustee={trustee} />,
    },
    {
      path: 'appointments',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeAppointments trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'appointments/create',
      subHeading: 'Add Trustee Appointment',
      content: <TrusteeAppointmentForm trusteeId={trusteeId} />,
    },
    {
      path: 'appointments/:appointmentId/edit',
      subHeading: 'Edit Trustee Appointment',
      content: <EditTrusteeAppointment />,
    },
    {
      path: 'assigned-staff',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeAssignedStaff trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'audit-history',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <TrusteeDetailAuditHistory trusteeId={trusteeId} />
          </div>
        </div>
      ),
    },
    {
      path: 'notes',
      subHeading: 'Trustee',
      content: (
        <div className="trustee-detail-screen-info-container">
          <div className="left-navigation-pane-container">
            <TrusteeDetailNavigation trusteeId={trusteeId} initiallySelectedNavLink={navState} />
          </div>
          <div className="main-content-area">
            <Notes
              entityId={trusteeId}
              title="Trustee Notes"
              notes={trusteeNotes.map((note) => ({ ...note, entityId: note.trusteeId }))}
              isLoading={areNotesLoading}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              createDraftKey={`trustee-notes-${trusteeId}`}
              editDraftKeyPrefix={`trustee-notes-${trusteeId}`}
              editAction={Actions.EditTrusteeNote}
              removeAction={Actions.RemoveTrusteeNote}
              emptyMessage="No notes exist for this trustee."
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainContent className="record-detail" data-testid="record-detail">
      <DocumentTitle name="Trustee Detail" />

      <Routes>
        {routeConfigs.map(({ path, subHeading, content }) => (
          <Route
            key={path}
            path={path}
            element={
              <TrusteeHeader trustee={trustee} isLoading={isLoading} subHeading={subHeading}>
                {content}
              </TrusteeHeader>
            }
          />
        ))}
      </Routes>
    </MainContent>
  );
}
