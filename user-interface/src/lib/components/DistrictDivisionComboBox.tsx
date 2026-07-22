import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CourtDivisionDetails } from '@common/cams/courts';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import {
  autoUpgradeToAll,
  encodeDivisionCodes,
  getDistrictDivisionComboOptions,
  getUserDivisionCodes,
  resolveCombinedSelections,
  separateDefaultOptions,
} from '@/lib/utils/court-utils';

export type DistrictDivisionComboBoxRef = {
  setSelections: (selections: ComboOption[]) => void;
  disable: (value: boolean) => void;
};

type DistrictDivisionComboBoxProps = {
  id: string;
  initialDivisionCodes?: string[];
  onDivisionCodesChange?: (codes: string[] | undefined) => void;
  onSelectionsChange?: (selections: ComboOption[]) => void;
  onCourtsLoaded?: (courts: CourtDivisionDetails[]) => void;
  onDefaultsApplied?: () => void;
  hideInternalLabel?: boolean;
  wrapPills?: boolean;
  // Opt-in: when provided, restricts the option set to these division codes
  // (and any per-district "All" option only when it covers every division in
  // the allow list) instead of the full national court list, and defaults the
  // selection to the full allow list rather than the user's own office divisions.
  divisionCodeAllowList?: string[];
};

type DivisionOptionMeta = {
  courtId: string;
  code: string;
  isAll: boolean;
};

function parseDivisionOptionValue(value: string): DivisionOptionMeta {
  const [courtId, code] = value.split('|');
  return { courtId, code, isAll: code === 'ALL' };
}

function filterOptionsToAllowList(
  allOptions: { value: string; label: string; selectedLabel?: string }[],
  allCourts: CourtDivisionDetails[],
  allowList: string[],
): { value: string; label: string; selectedLabel?: string }[] {
  const allowSet = new Set(allowList);
  const divisionsByCourtId = new Map<string, Set<string>>();
  for (const court of allCourts) {
    if (!divisionsByCourtId.has(court.courtId)) {
      divisionsByCourtId.set(court.courtId, new Set());
    }
    divisionsByCourtId.get(court.courtId)!.add(court.courtDivisionCode);
  }

  return allOptions.filter((opt) => {
    const { courtId, code, isAll } = parseDivisionOptionValue(opt.value);
    if (isAll) {
      const allDivisionsForCourt = divisionsByCourtId.get(courtId);
      return (
        !!allDivisionsForCourt &&
        allDivisionsForCourt.size > 0 &&
        [...allDivisionsForCourt].every((divisionCode) => allowSet.has(divisionCode))
      );
    }
    return allowSet.has(code);
  });
}

function computeInitialDivisionDefaults(
  allOptions: ComboOption[],
  initialDivisionCodes: string[] | undefined,
): ComboOption[] {
  if (!initialDivisionCodes?.length) return [];
  return allOptions.filter((opt) => {
    const { code, isAll } = parseDivisionOptionValue(opt.value);
    return !isAll && initialDivisionCodes.includes(code);
  });
}

function computeAllowListDefaults(
  allOptions: ComboOption[],
  divisionCodeAllowList: string[] | undefined,
): ComboOption[] {
  if (!divisionCodeAllowList) return [];
  return allOptions.filter((opt) => !parseDivisionOptionValue(opt.value).isAll);
}

function computeUserOfficeDefaults(allOptions: ComboOption[]): ComboOption[] {
  const userCodes = getUserDivisionCodes(LocalStorage.getSession());
  if (userCodes.size === 0) return [];
  return allOptions.filter((opt) => {
    const { code, isAll } = parseDivisionOptionValue(opt.value);
    return !isAll && userCodes.has(code);
  });
}

const DistrictDivisionComboBox_ = (
  {
    id,
    initialDivisionCodes,
    onDivisionCodesChange,
    onSelectionsChange,
    onCourtsLoaded,
    onDefaultsApplied,
    hideInternalLabel,
    wrapPills,
    divisionCodeAllowList,
  }: DistrictDivisionComboBoxProps,
  ref: React.Ref<DistrictDivisionComboBoxRef>,
) => {
  const [courts, setCourts] = useState<CourtDivisionDetails[]>([]);
  const [courtsError, setCourtsError] = useState(false);
  const [selectedDivisions, setSelectedDivisions] = useState<ComboOption[]>([]);
  const [divisionComboOptions, setDivisionComboOptions] = useState<ComboOption[]>([]);
  const [upgradeAnnouncement, setUpgradeAnnouncement] = useState('');
  const previousSelectionsRef = useRef<ComboOption[]>([]);
  const comboBoxRef = useRef<ComboBoxRef>(null);

  useImperativeHandle(ref, () => ({
    setSelections: (selections: ComboOption[]) => {
      previousSelectionsRef.current = selections;
      setSelectedDivisions(selections);
    },
    disable: (value: boolean) => comboBoxRef.current?.disable(value),
  }));

  useEffect(() => {
    Api2.getCourts()
      .then((r) => {
        const allCourts = r.data;
        setCourts(allCourts);
        onCourtsLoaded?.(allCourts);
        const nationalOptions = getDistrictDivisionComboOptions(allCourts) as ComboOption[];
        const allOptions = divisionCodeAllowList
          ? (filterOptionsToAllowList(
              nationalOptions,
              allCourts,
              divisionCodeAllowList,
            ) as ComboOption[])
          : nationalOptions;

        const applyDefaults = (defaults: ComboOption[]) => {
          if (defaults.length > 0) {
            const codes = encodeDivisionCodes(defaults, allCourts);
            setSelectedDivisions(defaults);
            previousSelectionsRef.current = defaults;
            onDivisionCodesChange?.(codes);
            onSelectionsChange?.(defaults);
          }
        };

        let defaults: ComboOption[];
        if (initialDivisionCodes?.length) {
          defaults = computeInitialDivisionDefaults(allOptions, initialDivisionCodes);
        } else if (divisionCodeAllowList) {
          defaults = computeAllowListDefaults(allOptions, divisionCodeAllowList);
        } else {
          defaults = computeUserOfficeDefaults(allOptions);
        }
        applyDefaults(defaults);

        const defaultOptionValues = new Set(defaults.map((d) => d.value));
        setDivisionComboOptions(
          separateDefaultOptions(allOptions, defaultOptionValues) as ComboOption[],
        );
        onDefaultsApplied?.();
      })
      .catch((e: Error) => {
        setCourtsError(true);
        getAppInsights()?.appInsights?.trackException({ exception: e });
      });
    // stable props — only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDivisionChange = (selections: ComboOption[]) => {
    const resolved = resolveCombinedSelections(previousSelectionsRef.current, selections);
    const upgraded = autoUpgradeToAll(resolved, courts);
    // Announce auto-upgrades before updating the ref so we can diff against the previous set.
    // Reset to '' first so NVDA always sees a content change even if the same district upgrades twice.
    const previousValues = new Set(previousSelectionsRef.current.map((d) => d.value));
    const newAllSelections = upgraded.filter(
      (d) => d.value.endsWith('|ALL') && !previousValues.has(d.value),
    );
    if (newAllSelections.length > 0) {
      const labels = newAllSelections.map((d) => d.label).join(', ');
      setUpgradeAnnouncement('');
      requestAnimationFrame(() => setUpgradeAnnouncement(labels));
    } else {
      setUpgradeAnnouncement('');
    }
    previousSelectionsRef.current = upgraded;
    setSelectedDivisions(upgraded);
    const codes = encodeDivisionCodes(upgraded, courts);
    onDivisionCodesChange?.(codes);
    onSelectionsChange?.(upgraded);
  };

  if (courtsError) {
    return (
      <div className="usa-alert usa-alert--error usa-alert--slim" role="alert">
        <div className="usa-alert__body">
          <p className="usa-alert__text">
            Unable to load district filter options. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  if (divisionComboOptions.length === 0) return null;

  return (
    <>
      <span className="screen-reader-only" aria-live="polite" aria-atomic="true">
        {upgradeAnnouncement}
      </span>
      <ComboBox
        id={id}
        label="District (Division)"
        hideInternalLabel={hideInternalLabel}
        options={divisionComboOptions}
        selections={selectedDivisions}
        onUpdateSelection={handleDivisionChange}
        multiSelect={true}
        wrapPills={wrapPills}
        pluralLabel="divisions"
        singularLabel="division"
        placeholder="- Select one or more -"
        ref={comboBoxRef}
      />
    </>
  );
};

const DistrictDivisionComboBox = forwardRef(DistrictDivisionComboBox_);
export default DistrictDivisionComboBox;
