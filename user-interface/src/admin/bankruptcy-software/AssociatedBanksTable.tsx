import { type RefObject, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { SoftwareBankAssociation } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';
import Api2 from '@/lib/models/api2';
import {
  AddAssociatedBankConfirmModal,
  AddAssociatedBankConfirmModalRef,
} from './AddAssociatedBankConfirmModal';

interface AssociatedBanksTableProps {
  softwareId: string;
  associations: SoftwareBankAssociation[];
  allBanks: BankProfile[];
  onAddBank: (bankId: string, bankName: string) => void;
  onEditStatus: (bankId: string, bankName: string, currentStatus: 'active' | 'inactive') => void;
}

export function AssociatedBanksTable({
  softwareId,
  associations,
  allBanks,
  onAddBank,
  onEditStatus,
}: Readonly<AssociatedBanksTableProps>) {
  const confirmModalRef = useRef<AddAssociatedBankConfirmModalRef>(null);
  const comboBoxRef = useRef<ComboBoxRef>(null);
  const [selectedBank, setSelectedBank] = useState<ComboOption | null>(null);
  const [trusteeCounts, setTrusteeCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  useEffect(() => {
    if (associations.length === 0) {
      setCountsLoaded(true);
      return;
    }

    let isCancelled = false;

    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        associations.map(async (association) => {
          try {
            const response = await Api2.getSoftwareBankTrustees(
              softwareId,
              association.bankId,
              1,
              0,
            );
            if (!isCancelled) counts[association.bankId] = response.pagination?.totalCount ?? 0;
          } catch {
            if (!isCancelled) counts[association.bankId] = 0;
          }
        }),
      );
      if (!isCancelled) {
        setTrusteeCounts((prev) => ({ ...prev, ...counts }));
        setCountsLoaded(true);
      }
    };

    void fetchCounts();
    return () => {
      isCancelled = true;
    };
  }, [softwareId, associations]);

  const associatedBankIds = new Set(associations.map((a) => a.bankId));
  const availableBanks: ComboOption[] = allBanks
    .filter((bank) => bank.status === 'active' && !associatedBankIds.has(bank.id))
    .map((bank) => ({ value: bank.id, label: bank.name }));

  function handleSelectionChange(options: ComboOption[]) {
    setSelectedBank(options.length > 0 ? options[0] : null);
  }

  function handleAddBankClick() {
    if (!selectedBank) return;
    confirmModalRef.current?.show(selectedBank.value, selectedBank.label);
  }

  function handleConfirm(bankId: string, bankName: string) {
    onAddBank(bankId, bankName);
    setSelectedBank(null);
    comboBoxRef.current?.clearSelections();
  }

  if (!countsLoaded) {
    return (
      <div className="associated-banks-section">
        <LoadingSpinner caption="Loading..." />
      </div>
    );
  }

  return (
    <div className="associated-banks-section">
      <CamsTable id="associated-banks-table" aria-label="Associated banks">
        <CamsTableHeader>
          <CamsTableHeaderCell>Associated Bank Name</CamsTableHeaderCell>
          <CamsTableHeaderCell>Trustees</CamsTableHeaderCell>
          <CamsTableHeaderCell>Status</CamsTableHeaderCell>
          <CamsTableHeaderCell className="text-right"></CamsTableHeaderCell>
        </CamsTableHeader>
        <CamsTableBody>
          {associations.length === 0 && (
            <CamsTableRow>
              <CamsTableCell data-cell="">
                <span data-testid="no-associated-banks">No banks associated yet.</span>
              </CamsTableCell>
            </CamsTableRow>
          )}
          {associations.map((association) => {
            const count = trusteeCounts[association.bankId];
            return (
              <CamsTableRow key={association.bankId} data-testid={`bank-row-${association.bankId}`}>
                <CamsTableCell data-cell="Associated Bank">
                  <Link
                    to={`/admin/banks/${association.bankId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${association.bankName} (opens in new tab)`}
                  >
                    {association.bankName}
                  </Link>
                </CamsTableCell>
                <CamsTableCell data-cell="Trustees">
                  {count !== undefined && count > 0 ? (
                    <NewTabLink
                      to={`/admin/bankruptcy-software/${softwareId}/banks/${association.bankId}/trustees`}
                      label={String(count)}
                    />
                  ) : (
                    <span data-testid={`trustee-count-${association.bankId}`}>{count ?? '—'}</span>
                  )}
                </CamsTableCell>
                <CamsTableCell data-cell="Status">
                  {association.status === 'active' ? 'Active' : 'Inactive'}
                </CamsTableCell>
                <CamsTableCell data-cell="" className="text-right">
                  <Button
                    id={`edit-status-${association.bankId}`}
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    onClick={() =>
                      onEditStatus(association.bankId, association.bankName, association.status)
                    }
                  >
                    <IconLabel icon="edit" label="Edit Status" />
                  </Button>
                </CamsTableCell>
              </CamsTableRow>
            );
          })}
        </CamsTableBody>
      </CamsTable>

      <div className="associated-banks-toolbar">
        <ComboBox
          ref={comboBoxRef as RefObject<ComboBoxRef>}
          id="add-bank-combobox"
          className="add-bank-combobox"
          label="Bank"
          options={availableBanks}
          onUpdateSelection={handleSelectionChange}
          placeholder="- Select a bank -"
        />
        <Button
          id="add-bank-button"
          className="add-bank-button"
          onClick={handleAddBankClick}
          disabled={!selectedBank || availableBanks.length === 0}
        >
          Add Bank
        </Button>
      </div>

      <AddAssociatedBankConfirmModal
        ref={confirmModalRef}
        modalId="add-associated-bank-confirm-modal"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
