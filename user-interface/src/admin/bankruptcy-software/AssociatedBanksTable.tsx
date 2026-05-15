import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { SoftwareBankAssociation } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';
import {
  AddAssociatedBankConfirmModal,
  AddAssociatedBankConfirmModalRef,
} from './AddAssociatedBankConfirmModal';

interface AssociatedBanksTableProps {
  associations: SoftwareBankAssociation[];
  allBanks: BankProfile[];
  onAddBank: (bankId: string, bankName: string) => void;
  onEditStatus: (bankId: string, bankName: string, currentStatus: 'active' | 'inactive') => void;
}

export function AssociatedBanksTable({
  associations,
  allBanks,
  onAddBank,
  onEditStatus,
}: Readonly<AssociatedBanksTableProps>) {
  const confirmModalRef = useRef<AddAssociatedBankConfirmModalRef>(null);
  const [selectedBank, setSelectedBank] = useState<ComboOption | null>(null);

  const associatedBankIds = new Set(associations.map((a) => a.bankId));
  const availableBanks: ComboOption[] = allBanks
    .filter((bank) => bank.status === 'active' && !associatedBankIds.has(bank.id))
    .map((bank) => ({ value: bank.id, label: bank.name }));

  function handleSelectionChange(options: ComboOption[]) {
    setSelectedBank(options.length > 0 ? options[0] : null);
  }

  function handleAddBankClick() {
    if (selectedBank) {
      confirmModalRef.current?.show(selectedBank.value, selectedBank.label);
    }
  }

  function handleConfirm(bankId: string, bankName: string) {
    onAddBank(bankId, bankName);
    setSelectedBank(null);
  }

  return (
    <div data-testid="associated-banks-section">
      <h3>Associated Banks</h3>
      <CamsTable id="associated-banks-table" aria-label="Associated banks">
        <CamsTableHeader>
          <CamsTableHeaderCell>Associated Bank</CamsTableHeaderCell>
          <CamsTableHeaderCell>Status</CamsTableHeaderCell>
          <CamsTableHeaderCell></CamsTableHeaderCell>
        </CamsTableHeader>
        <CamsTableBody>
          {associations.map((association) => (
            <CamsTableRow key={association.bankId} data-testid={`bank-row-${association.bankId}`}>
              <CamsTableCell data-cell="Associated Bank">
                <Link to={`/admin/banks/${association.bankId}`}>{association.bankName}</Link>
              </CamsTableCell>
              <CamsTableCell data-cell="Status">
                {association.status === 'active' ? 'Active' : 'Inactive'}
              </CamsTableCell>
              <CamsTableCell data-cell="">
                <Button
                  id={`edit-status-${association.bankId}`}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  onClick={() =>
                    onEditStatus(association.bankId, association.bankName, association.status)
                  }
                >
                  Edit Status
                </Button>
              </CamsTableCell>
            </CamsTableRow>
          ))}
        </CamsTableBody>
      </CamsTable>

      <div className="grid-row grid-gap-sm margin-top-2">
        <div className="grid-col-auto">
          <ComboBox
            id="add-bank-combobox"
            label="Bank"
            options={availableBanks}
            onUpdateSelection={handleSelectionChange}
            placeholder="- Select a bank -"
          />
        </div>
        <div className="grid-col-auto display-flex flex-align-end">
          <Button
            id="add-bank-button"
            onClick={handleAddBankClick}
            disabled={!selectedBank || availableBanks.length === 0}
          >
            Add Bank
          </Button>
        </div>
      </div>

      <AddAssociatedBankConfirmModal
        ref={confirmModalRef}
        modalId="add-associated-bank-confirm-modal"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
