import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import DistrictDivisionComboBox from './DistrictDivisionComboBox';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

const mockCourts: CourtDivisionDetails[] = [
  {
    officeName: 'Manhattan',
    officeCode: '081',
    courtId: 'NYSB',
    courtName: 'Southern District of New York',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'New York Region',
  },
  {
    officeName: 'White Plains',
    officeCode: '087',
    courtId: 'NYSB',
    courtName: 'Southern District of New York',
    courtDivisionCode: '087',
    courtDivisionName: 'White Plains',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'New York Region',
  },
  {
    officeName: 'Rutland',
    officeCode: '088',
    courtId: 'VTB',
    courtName: 'District of Vermont',
    courtDivisionCode: '088',
    courtDivisionName: 'Rutland',
    groupDesignator: 'VT',
    regionId: '01',
    regionName: 'Boston Region',
  },
];

function renderComboBox(
  onDivisionCodesChange = vi.fn(),
  initialDivisionCodes?: string[],
  onSelectionsChange = vi.fn(),
) {
  return render(
    <DistrictDivisionComboBox
      id="test-district-division"
      onDivisionCodesChange={onDivisionCodesChange}
      initialDivisionCodes={initialDivisionCodes}
      onSelectionsChange={onSelectionsChange}
    />,
  );
}

describe('DistrictDivisionComboBox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockCourts, meta: { self: '' } });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  describe('initialization', () => {
    test('renders District (Division) combobox when courts are loaded', async () => {
      renderComboBox();
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /district \(division\)/i }),
        ).toBeInTheDocument();
      });
    });

    test('does not render combobox and shows error message when courts fetch fails', async () => {
      vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('network error'));
      renderComboBox();
      await waitFor(() => {
        expect(
          screen.queryByRole('combobox', { name: /district \(division\)/i }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByText(
            'Unable to load district filter options. Please try refreshing the page.',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('default selections', () => {
    test('applies user default divisions from session when no initialDivisionCodes', async () => {
      const session = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [
            {
              officeCode: '081',
              officeName: 'Manhattan',
              idpGroupName: 'Manhattan',
              regionId: '02',
              regionName: 'New York Region',
              groups: [
                {
                  groupDesignator: 'NY',
                  divisions: [
                    {
                      divisionCode: '081',
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const onDivisionCodesChange = vi.fn();
      renderComboBox(onDivisionCodesChange);
      await waitFor(() => {
        expect(onDivisionCodesChange).toHaveBeenCalledWith(expect.arrayContaining(['081']));
      });
    });

    test('does not apply user defaults when initialDivisionCodes already provided', async () => {
      const session = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [
            {
              officeCode: '081',
              officeName: 'Manhattan',
              idpGroupName: 'Manhattan',
              regionId: '02',
              regionName: 'New York Region',
              groups: [
                {
                  groupDesignator: 'NY',
                  divisions: [
                    {
                      divisionCode: '081',
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const onDivisionCodesChange = vi.fn();
      renderComboBox(onDivisionCodesChange, ['088']);
      await waitFor(() =>
        expect(onDivisionCodesChange).not.toHaveBeenCalledWith(expect.arrayContaining(['081'])),
      );
    });

    test('restores selected divisions from initialDivisionCodes and calls onSelectionsChange', async () => {
      const onSelectionsChange = vi.fn();
      renderComboBox(vi.fn(), ['081'], onSelectionsChange);
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /district \(division\)/i }),
        ).toBeInTheDocument();
      });
      // initialDivisionCodes restores state internally — combobox should reflect it
      const combo = screen.getByRole('combobox', { name: /district \(division\)/i });
      expect(combo).toHaveValue('Southern District of New York (Manhattan)');
    });

    test('does not call onDivisionCodesChange on mount when session has no offices', async () => {
      const onDivisionCodesChange = vi.fn();
      renderComboBox(onDivisionCodesChange);
      await screen.findByRole('combobox', { name: /district \(division\)/i });
      expect(onDivisionCodesChange).not.toHaveBeenCalled();
    });
  });

  describe('default options separator', () => {
    test('places user default divisions at the top of the options list with a divider', async () => {
      const session = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [
            {
              officeCode: '088',
              officeName: 'Rutland',
              idpGroupName: 'Rutland',
              regionId: '01',
              regionName: 'Boston Region',
              groups: [
                {
                  groupDesignator: 'VT',
                  divisions: [
                    {
                      divisionCode: '088',
                      court: { courtId: 'VTB', courtName: 'District of Vermont' },
                      courtOffice: { courtOfficeCode: '088', courtOfficeName: 'Rutland' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const user = userEvent.setup();
      renderComboBox();
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      const options = await screen.findAllByRole('option');
      // Vermont (Rutland) is the user's default — it should appear first
      expect(options[0]).toHaveTextContent(/rutland/i);
    });
  });

  describe('selection behavior', () => {
    test('calls onDivisionCodesChange with specific code when a division is selected', async () => {
      const onDivisionCodesChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(onDivisionCodesChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      expect(onDivisionCodesChange).toHaveBeenCalledWith(expect.arrayContaining(['081']));
    });

    test('calls onSelectionsChange with ComboOption when a division is selected', async () => {
      const onSelectionsChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(vi.fn(), undefined, onSelectionsChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      expect(onSelectionsChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ value: 'NYSB|081' })]),
      );
    });

    test('calls onDivisionCodesChange with all division codes when All is selected for a court', async () => {
      const onDivisionCodesChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(onDivisionCodesChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (All)', { selector: 'li span' }),
      );
      expect(onDivisionCodesChange).toHaveBeenCalledWith(expect.arrayContaining(['081', '087']));
    });

    test('calls onDivisionCodesChange with undefined when all divisions are cleared', async () => {
      const onDivisionCodesChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(onDivisionCodesChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      onDivisionCodesChange.mockClear();
      const clearAll = screen.getByRole('button', { name: /Clear all District \(Division\)/i });
      await user.click(clearAll);
      expect(onDivisionCodesChange).toHaveBeenCalledWith(undefined);
    });

    test('selecting All removes specific divisions for that court (resolveCombinedSelections)', async () => {
      const onSelectionsChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(vi.fn(), undefined, onSelectionsChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      onSelectionsChange.mockClear();
      await user.click(
        await screen.findByText('Southern District of New York (All)', { selector: 'li span' }),
      );
      const lastCall = onSelectionsChange.mock.calls.at(-1)![0] as ComboOption[];
      expect(lastCall.find((s) => s.value === 'NYSB|081')).toBeUndefined();
      expect(lastCall.find((s) => s.value === 'NYSB|ALL')).toBeDefined();
    });

    test('selecting a specific division removes All for that court', async () => {
      const onSelectionsChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(vi.fn(), undefined, onSelectionsChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (All)', { selector: 'li span' }),
      );
      onSelectionsChange.mockClear();
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      const lastCall = onSelectionsChange.mock.calls.at(-1)![0] as ComboOption[];
      expect(lastCall.find((s) => s.value === 'NYSB|ALL')).toBeUndefined();
      expect(lastCall.find((s) => s.value === 'NYSB|081')).toBeDefined();
    });

    test('mutual exclusion applies per-court only — selecting All for one court does not affect another court', async () => {
      const onSelectionsChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(vi.fn(), undefined, onSelectionsChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('District of Vermont (Rutland)', { selector: 'li span' }),
      );
      await user.click(
        await screen.findByText('Southern District of New York (All)', { selector: 'li span' }),
      );
      const lastCall = onSelectionsChange.mock.calls.at(-1)![0] as ComboOption[];
      // Vermont upgrades to All (single division court); NYSB All also present
      expect(lastCall.find((s) => s.value === 'VTB|ALL')).toBeDefined();
      expect(lastCall.find((s) => s.value === 'NYSB|ALL')).toBeDefined();
    });

    test('auto-upgrades to All when all divisions in a court are individually selected', async () => {
      const onSelectionsChange = vi.fn();
      const user = userEvent.setup();
      renderComboBox(vi.fn(), undefined, onSelectionsChange);
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /manhattan/i }));
      await user.click(await screen.findByRole('option', { name: /white plains/i }));
      await waitFor(() => {
        const lastCall = onSelectionsChange.mock.calls.at(-1)![0] as ComboOption[];
        expect(lastCall.find((s) => s.value === 'NYSB|081')).toBeUndefined();
        expect(lastCall.find((s) => s.value === 'NYSB|087')).toBeUndefined();
        expect(lastCall.find((s) => s.value === 'NYSB|ALL')).toBeDefined();
      });
    });
  });

  describe('screen reader accessibility', () => {
    test('aria-live region is initially empty', async () => {
      renderComboBox();
      await screen.findByRole('combobox', { name: /district \(division\)/i });
      const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toHaveTextContent('');
    });

    test('announces the specific district label when auto-upgrade to All occurs', async () => {
      const user = userEvent.setup();
      renderComboBox();
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /manhattan/i }));
      await user.click(await screen.findByRole('option', { name: /white plains/i }));
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
        expect(liveRegion).toHaveTextContent('Southern District of New York (All)');
      });
    });

    test('aria-live region is empty when a division is selected but no upgrade occurs', async () => {
      const user = userEvent.setup();
      renderComboBox();
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /manhattan/i }));
      const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toHaveTextContent('');
    });

    test('aria-live region resets to empty before re-announcing so NVDA sees a change when the same district upgrades twice', async () => {
      const announcements: string[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        const liveRegion = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
        if (liveRegion) announcements.push(liveRegion.textContent ?? '');
        cb(0);
        if (liveRegion) announcements.push(liveRegion.textContent ?? '');
        return 0;
      });
      const user = userEvent.setup();
      renderComboBox();
      const combo = await screen.findByRole('combobox', { name: /district \(division\)/i });

      // First upgrade: select both NYSB divisions
      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /manhattan/i }));
      await user.click(await screen.findByRole('option', { name: /white plains/i }));
      await waitFor(() =>
        expect(
          document.querySelector('[aria-live="polite"][aria-atomic="true"]'),
        ).toHaveTextContent('Southern District of New York (All)'),
      );

      // Clear all to reset, then upgrade again
      const clearAll = screen.getByRole('button', { name: /Clear all District \(Division\)/i });
      await user.click(clearAll);

      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /manhattan/i }));
      await user.click(await screen.findByRole('option', { name: /white plains/i }));

      // The empty-then-set pattern must have occurred
      expect(announcements).toContain('');
      await waitFor(() =>
        expect(
          document.querySelector('[aria-live="polite"][aria-atomic="true"]'),
        ).toHaveTextContent('Southern District of New York (All)'),
      );
    });

    test('combobox is reachable by accessible name "District (Division)"', async () => {
      renderComboBox();
      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /district \(division\)/i }),
        ).toBeInTheDocument();
      });
    });

    test('ComboBox label is visible and provides the accessible name', async () => {
      renderComboBox();
      await screen.findByRole('combobox', { name: /district \(division\)/i });
      const label = document.querySelector('#test-district-division-label');
      expect(label).toBeInTheDocument();
      expect(label).not.toHaveAttribute('aria-hidden', 'true');
    });
  });
});
