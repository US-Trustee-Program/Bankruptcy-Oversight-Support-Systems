import './TrusteeDistrictFilter.scss';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Icon from '@/lib/components/uswds/Icon';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

function TrusteeDistrictFilterView(props: TrusteeDistrictFilterViewProps) {
  const { viewModel } = props;

  return (
    <section className="trustee-district-filter" aria-label="District filter controls">
      <AccordionGroup>
        <Accordion id="district-filter" onExpand={() => viewModel.handleToggleExpanded()}>
          <span>Filters</span>
          <div id="district-filter-content" className="filter-content">
            {viewModel.districts.length > 0 && !viewModel.districtsError && (
              <div className="filter-control">
                <ComboBox
                  id="district-combobox"
                  label="District (Division)"
                  options={viewModel.districtsToComboOptions(viewModel.districts)}
                  selections={viewModel.selectedDistricts}
                  onUpdateSelection={viewModel.handleFilterChange}
                  multiSelect={true}
                  wrapPills={true}
                  pluralLabel="districts"
                  singularLabel="district"
                  placeholder="- Select one or more -"
                  ref={viewModel.districtFilterRef}
                />
              </div>
            )}

            {viewModel.districtsError && (
              <div className="usa-alert usa-alert--error usa-alert--slim" role="alert">
                <div className="usa-alert__body">
                  <p className="usa-alert__text">
                    Unable to load district filter options. Please try refreshing the page.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Accordion>
      </AccordionGroup>

      {viewModel.selectedDistricts.length > 0 && (
        <div className="filter-pills-container">
          {viewModel.selectedDistricts.map((district) => (
            <span key={district.value} className="usa-tag filter-pill">
              {district.label}
              <button
                type="button"
                className="usa-tag__remove-button"
                onClick={() => viewModel.handleRemovePill(district)}
                aria-label={`Remove ${district.label} filter`}
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default TrusteeDistrictFilterView;
