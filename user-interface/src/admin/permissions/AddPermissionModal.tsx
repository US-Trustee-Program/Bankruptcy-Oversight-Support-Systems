import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import TextArea from '@/lib/components/uswds/TextArea';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import Api2 from '@/lib/models/api2';
import { CamsRole, CamsRoleLabels, CamsRoleType } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import {
  ALL_SCOPE,
  grantableRoles,
  PermissionScope,
  ROLE_ASSIGNMENT_REASON_MAX_LENGTH,
  RoleAssignmentGrantRequest,
  scopeLabel,
  UserRoleAssignment,
} from '@common/cams/user-access';

export type AddPermissionModalRef = {
  show: (user: CamsUserReference) => void;
};

export type AddPermissionModalProps = {
  modalId: string;
  offices: UstpOfficeDetails[];
  onSuccess: () => void;
};

const SAVE_FAILED_MESSAGE = 'Unable to save permission. Please try again';

const ROLE_OPTIONS: ComboOption[] = grantableRoles
  .map((role) => ({ value: role, label: CamsRoleLabels[role] }))
  .sort((a, b) => a.label.localeCompare(b.label));

type ScopeOption = ComboOption & { scope: { regionId: string; officeCode: string } };

/**
 * "All regions", then each region in number order: "N - All offices" when the region has more than
 * one office, followed by its offices by name. Each option carries the grant's path segments.
 */
function toScopeOptions(offices: UstpOfficeDetails[]): ScopeOption[] {
  const byRegion = new Map<string, UstpOfficeDetails[]>();
  for (const office of offices) {
    byRegion.set(office.regionId, [...(byRegion.get(office.regionId) ?? []), office]);
  }
  const regionIds = [...byRegion.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const options: ScopeOption[] = [
    {
      value: ALL_SCOPE,
      label: 'All regions',
      scope: { regionId: ALL_SCOPE, officeCode: ALL_SCOPE },
    },
  ];
  for (const regionId of regionIds) {
    const regionOffices = [...byRegion.get(regionId)!].sort((a, b) =>
      a.officeName.localeCompare(b.officeName),
    );
    if (regionOffices.length > 1) {
      options.push({
        value: `region-${regionId}`,
        label: `${regionId} - All offices`,
        scope: { regionId, officeCode: ALL_SCOPE },
      });
    }
    for (const office of regionOffices) {
      options.push({
        value: office.officeCode,
        label: `${regionId} - ${office.officeName}`,
        scope: { regionId, officeCode: office.officeCode },
      });
    }
  }
  return options;
}

function successMessage(
  userName: string,
  permission: PermissionScope,
  replaced: UserRoleAssignment[],
  officeNames: Map<string, string>,
) {
  const added = `New permission successfully added to ${userName}.`;
  if (replaced.length === 0) return added;
  const label = (scope: PermissionScope) =>
    scopeLabel(scope, scope.officeCode ? officeNames.get(scope.officeCode) : undefined);
  // Wording for three or more replaced permissions isn't designed yet (Katie Cissell to confirm).
  const list = new Intl.ListFormat('en-US', { type: 'conjunction' }).format(replaced.map(label));
  const noun = replaced.length === 1 ? 'permission was' : 'permissions were';
  return `${added} Their existing ${list} ${noun} replaced by ${label(permission)}.`;
}

export const AddPermissionModal = forwardRef<AddPermissionModalRef, AddPermissionModalProps>(
  function AddPermissionModal({ modalId, offices, onSuccess }, ref) {
    const modalRef = useRef<ModalRefType>(null);
    const roleRef = useRef<ComboBoxRef>(null);
    const officeRef = useRef<ComboBoxRef>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    // Tracks whether the modal is still open when a save finishes; it can be closed mid-save.
    const isOpenRef = useRef(false);
    // Counts openings, so a save that finishes after the modal was opened again leaves it alone.
    const openingRef = useRef(0);
    const globalAlert = useGlobalAlert();

    const [user, setUser] = useState<CamsUserReference | null>(null);
    const [role, setRole] = useState<CamsRoleType | null>(null);
    const [scopeValue, setScopeValue] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    const scopeOptions = useMemo(() => toScopeOptions(offices), [offices]);
    const officeNames = useMemo(
      () => new Map(offices.map((office) => [office.officeCode, office.officeName])),
      [offices],
    );
    // Super User has no region or office.
    const isSuperUser = role === CamsRole.SuperUser;
    const scope = isSuperUser
      ? { regionId: ALL_SCOPE, officeCode: ALL_SCOPE }
      : scopeOptions.find((option) => option.value === scopeValue)?.scope;
    const trimmedReason = reason.trim();
    const pending =
      user && role && scope && trimmedReason
        ? {
            user,
            request: {
              userId: user.id,
              role,
              regionId: scope.regionId,
              officeCode: scope.officeCode,
              reason: trimmedReason,
            },
          }
        : null;

    // Save is disabled while it saves, which strands focus; move it to the explanation instead.
    useEffect(() => {
      if (saveFailed) errorRef.current?.focus();
    }, [saveFailed]);

    function resetForm() {
      roleRef.current?.clearSelections();
      officeRef.current?.clearSelections();
      setRole(null);
      setScopeValue(null);
      setReason('');
      setIsSaving(false);
      setSaveFailed(false);
    }

    useImperativeHandle(ref, () => ({
      show(userToGrant: CamsUserReference) {
        resetForm();
        setUser(userToGrant);
        isOpenRef.current = true;
        openingRef.current += 1;
        modalRef.current?.show({});
      },
    }));

    async function handleSave(grantee: CamsUserReference, request: RoleAssignmentGrantRequest) {
      const opening = openingRef.current;
      const isSameOpening = () => opening === openingRef.current;
      setIsSaving(true);
      setSaveFailed(false);
      try {
        const response = await Api2.grantPermission(request);
        if (isSameOpening()) {
          isOpenRef.current = false;
          modalRef.current?.hide();
        }
        const { permission, replaced } = response.data;
        globalAlert?.success(successMessage(grantee.name, permission, replaced, officeNames));
        onSuccess();
      } catch (error) {
        getAppInsights()?.appInsights?.trackException({ exception: error as Error });
        if (isSameOpening() && isOpenRef.current) {
          setSaveFailed(true);
        } else {
          globalAlert?.error(`Unable to save permission for ${grantee.name}. Please try again.`);
        }
      } finally {
        if (isSameOpening()) setIsSaving(false);
      }
    }

    const actionButtonGroup = {
      modalId,
      modalRef,
      submitButton: {
        label: 'Save',
        onClick: pending ? () => handleSave(pending.user, pending.request) : undefined,
        closeOnClick: false,
        disabled: !pending || isSaving,
      },
      cancelButton: {
        label: 'Cancel',
      },
    };

    return (
      <Modal
        ref={modalRef}
        modalId={modalId}
        heading={`Add Permission to ${user?.name ?? ''}`}
        actionButtonGroup={actionButtonGroup}
        onClose={() => {
          isOpenRef.current = false;
        }}
        footerContent={
          <>
            {isSaving && (
              <LoadingSpinner
                id={`${modalId}-saving`}
                caption="Adding permission..."
                aria-hidden="true"
              />
            )}
            {/* Present before saving starts, so screen readers announce the change. */}
            <div className="usa-sr-only" role="status" data-testid={`${modalId}-status`}>
              {isSaving ? 'Adding permission...' : ''}
            </div>
          </>
        }
        content={
          <div>
            <FormRequirementsNotice />
            <div id={`${modalId}-error-container`} ref={errorRef} tabIndex={-1}>
              {saveFailed && (
                <Alert
                  id={`${modalId}-error`}
                  message={SAVE_FAILED_MESSAGE}
                  type={UswdsAlertStyle.Error}
                  role="alert"
                  show={true}
                  inline={true}
                  slim={true}
                />
              )}
            </div>
            <ComboBox
              id={`${modalId}-role`}
              ref={roleRef}
              label="Role"
              required
              options={ROLE_OPTIONS}
              multiSelect={false}
              onUpdateSelection={(selections) => {
                const selected = (selections[0]?.value as CamsRoleType) ?? null;
                // The Region and Office field goes away for Super User and comes back empty.
                if (selected === CamsRole.SuperUser) setScopeValue(null);
                setRole(selected);
              }}
            />
            {!isSuperUser && (
              <ComboBox
                id={`${modalId}-office`}
                ref={officeRef}
                label="Region and Office"
                required
                options={scopeOptions}
                multiSelect={false}
                onUpdateSelection={(selections) => setScopeValue(selections[0]?.value ?? null)}
              />
            )}
            <TextArea
              id={`${modalId}-reason`}
              label="Reason"
              required
              maxLength={ROLE_ASSIGNMENT_REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        }
      />
    );
  },
);
