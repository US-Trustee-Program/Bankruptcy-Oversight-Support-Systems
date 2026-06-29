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
};

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
        const allOptions = getDistrictDivisionComboOptions(allCourts) as ComboOption[];

        let defaults: ComboOption[] = [];
        if (initialDivisionCodes?.length) {
          defaults = allOptions.filter((opt) => {
            const [, code] = opt.value.split('|');
            return code !== 'ALL' && initialDivisionCodes.includes(code);
          });
          if (defaults.length > 0) {
            const codes = encodeDivisionCodes(defaults, allCourts);
            setSelectedDivisions(defaults);
            previousSelectionsRef.current = defaults;
            onDivisionCodesChange?.(codes);
            onSelectionsChange?.(defaults);
          }
        } else {
          const userCodes = getUserDivisionCodes(LocalStorage.getSession());
          if (userCodes.size > 0) {
            defaults = allOptions.filter((opt) => {
              const [, code] = opt.value.split('|');
              return code !== 'ALL' && userCodes.has(code);
            });
            if (defaults.length > 0) {
              const codes = encodeDivisionCodes(defaults, allCourts);
              setSelectedDivisions(defaults);
              previousSelectionsRef.current = defaults;
              onDivisionCodesChange?.(codes);
              onSelectionsChange?.(defaults);
            }
          }
        }

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
