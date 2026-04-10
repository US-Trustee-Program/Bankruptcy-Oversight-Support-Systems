import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

interface TrusteeSearchModalProps {
  id: string;
  dxtrTrusteeName: string;
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
  const { id, dxtrTrusteeName, onConfirm, onCancel } = props;
  const modalRef = useRef<ModalRefType>(null);
  const [searchResults, setSearchResults] = useState<TrusteeSearchResult[]>([]);
  const [selectedTrustee, setSelectedTrustee] = useState<TrusteeSearchResult | null>(null);

  function show() {
    setSearchResults([]);
    setSelectedTrustee(null);
    modalRef.current?.show({});
  }

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({ show, hide }));

  async function handleFilterChange(value: string) {
    if (!value || value.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await Api2.searchTrustees(value);
      setSearchResults(response.data);
    } catch {
      setSearchResults([]);
    }
  }

  function handleSelection(options: ComboOption[]) {
    if (options.length > 0) {
      const selected = searchResults.find((r) => r.trusteeId === options[0].value);
      setSelectedTrustee(selected ?? null);
    } else {
      setSelectedTrustee(null);
    }
  }

  const comboOptions: ComboOption[] = searchResults.map((r) => ({
    value: r.trusteeId,
    label: r.name,
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

  const actionButtonGroup = {
    modalId: `trustee-search-modal-${id}`,
    modalRef,
    submitButton: {
      label: 'Confirm',
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
          <div className="dxtr-context">
            <span className="dxtr-label">DXTR Name: </span>
            <span className="dxtr-name">{dxtrTrusteeName}</span>
          </div>
          <ComboBox
            id={`trustee-search-combobox-${id}`}
            label="Trustee Name"
            options={comboOptions}
            onUpdateFilter={handleFilterChange}
            onUpdateSelection={handleSelection}
            autoComplete="off"
            placeholder="Type a name to search..."
          />
          {selectedTrustee && (
            <div className="trustee-details">
              {addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {selectedTrustee.phone && <div className="phone">{selectedTrustee.phone.number}</div>}
              {selectedTrustee.email && <div className="email">{selectedTrustee.email}</div>}
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
