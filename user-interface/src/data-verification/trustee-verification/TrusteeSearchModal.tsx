import './TrusteeSearchModal.scss';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useDebounce from '@/lib/hooks/UseDebounce';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { CourtDivisionDetails } from '@common/cams/courts';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { formatChapterType } from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';

interface TrusteeSearchModalProps {
  id: string;
  dxtrTrusteeName: string;
  courtId?: string;
  onConfirm: (result: TrusteeSearchResult) => void;
  onCancel?: () => void;
}

export type TrusteeSearchModalImperative = {
  show: () => void;
  hide: () => void;
};

function TrusteeSearchModal_(
  props: TrusteeSearchModalProps,
  ref: React.Ref<TrusteeSearchModalImperative>,
) {
  const { id, courtId, onConfirm, onCancel } = props;
  const modalRef = useRef<ModalRefType>(null);
  const [searchResults, setSearchResults] = useState<TrusteeSearchResult[]>([]);
  const [selectedTrustee, setSelectedTrustee] = useState<TrusteeSearchResult | null>(null);
  const [courts, setCourts] = useState<CourtDivisionDetails[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string | undefined>(courtId);
  const debounce = useDebounce();

  useEffect(() => {
    Api2.getCourts()
      .then((response) => {
        const seen = new Set<string>();
        const unique = response.data.filter((c) => {
          if (seen.has(c.courtId)) return false;
          seen.add(c.courtId);
          return true;
        });
        setCourts(unique);
      })
      .catch(() => {
        // courts list is optional; search still works without it
      });
  }, []);

  function show() {
    setSearchResults([]);
    setSelectedTrustee(null);
    setSelectedCourtId(courtId);
    modalRef.current?.show({});
  }

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({ show, hide }));

  // Match the selected court by courtId first, then fall back to courtDivisionCode.
  // order.courtId may be stored in either format depending on the data source.
  const selectedCourtEntry = selectedCourtId
    ? (courts.find((c) => c.courtId === selectedCourtId) ??
      courts.find((c) => c.courtDivisionCode === selectedCourtId))
    : undefined;

  function handleFilterChange(value: string) {
    if (!value || value.length < 2) {
      setSearchResults([]);
      return;
    }
    debounce(async () => {
      try {
        const response = await Api2.searchTrustees(value, selectedCourtEntry?.courtId);
        setSearchResults(response.data);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }

  function handleCourtSelection(options: ComboOption[]) {
    setSelectedCourtId(options.length > 0 ? options[0].value : undefined);
    setSearchResults([]);
  }

  function handleSelection(options: ComboOption[]) {
    if (options.length > 0) {
      const selected = searchResults.find((r) => r.trusteeId === options[0].value);
      setSelectedTrustee(selected ?? null);
    } else {
      setSelectedTrustee(null);
    }
  }

  const courtOptions: ComboOption[] = courts.map((c) => ({
    value: c.courtId,
    label: c.courtName,
  }));

  const courtSelection: ComboOption[] = selectedCourtEntry
    ? courtOptions.filter((o) => o.value === selectedCourtEntry.courtId)
    : [];

  const comboOptions: ComboOption[] = searchResults.map((r) => ({
    value: r.trusteeId,
    label: r.matchType === 'phonetic' ? `${r.name} (similar name)` : r.name,
  }));

  const addressLines = selectedTrustee?.address
    ? [
        selectedTrustee.address.address1,
        selectedTrustee.address.address2,
        selectedTrustee.address.address3,
        [
          selectedTrustee.address.city,
          [selectedTrustee.address.state, selectedTrustee.address.zipCode]
            .filter(Boolean)
            .join(' '),
        ]
          .filter(Boolean)
          .join(', '),
      ].filter(Boolean)
    : [];

  const appointmentLines =
    selectedTrustee?.appointments.map((appt) => {
      const courtName =
        courts.find((c) => c.courtId === appt.courtId)?.courtName ?? appt.courtName ?? appt.courtId;
      const division = appt.courtDivisionName ? ` (${appt.courtDivisionName})` : '';
      return `${courtName}${division}: Chap ${formatChapterType(appt.chapter)} - ${formatAppointmentStatus(appt.status)}`;
    }) ?? [];

  const actionButtonGroup = {
    modalId: `trustee-search-modal-${id}`,
    modalRef,
    submitButton: {
      label: 'Confirm Appointment',
      disabled: !selectedTrustee,
      onClick: () => {
        if (selectedTrustee) {
          onConfirm(selectedTrustee);
          hide();
        }
      },
    },
    cancelButton: {
      label: 'Cancel',
      onClick: () => {
        if (onCancel) onCancel();
        hide();
      },
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={`trustee-search-modal-${id}`}
      className="trustee-search-modal"
      heading="Search for Trustee"
      data-testid={`trustee-search-modal-${id}`}
      content={
        <>
          <ComboBox
            id={`trustee-district-combobox-${id}`}
            label="Trustee District"
            options={courtOptions}
            selections={courtSelection}
            onUpdateSelection={handleCourtSelection}
            autoComplete="off"
          />
          <ComboBox
            id={`trustee-search-combobox-${id}`}
            label="Trustee Name"
            options={comboOptions}
            onUpdateFilter={handleFilterChange}
            onUpdateSelection={handleSelection}
            autoComplete="off"
            placeholder="- Search Trustee name -"
          />
          {selectedTrustee && (
            <div className="trustee-details">
              <NewTabLink
                to={`/trustees/${selectedTrustee.trusteeId}`}
                label={selectedTrustee.name}
              />
              {addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {selectedTrustee.phone && <div>{selectedTrustee.phone.number}</div>}
              {selectedTrustee.email && <div>{selectedTrustee.email}</div>}
              {appointmentLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const TrusteeSearchModal = forwardRef(TrusteeSearchModal_);
export default TrusteeSearchModal;
