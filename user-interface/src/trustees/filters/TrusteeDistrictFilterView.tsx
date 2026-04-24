import './TrusteeDistrictFilter.scss';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

function TrusteeDistrictFilterView(props: TrusteeDistrictFilterViewProps) {
  const { viewModel } = props;

  return (
    <section className="trustee-district-filter" aria-label="District filter controls">
      <div className="filter-header">
        <Button
          uswdsStyle={UswdsButtonStyle.Unstyled}
          className="filter-toggle-button"
          onClick={viewModel.handleToggleExpanded}
          aria-expanded={viewModel.isExpanded}
          aria-controls="district-filter-content"
        >
          <span className="filter-toggle-text">Filters</span>
          <Icon name={viewModel.isExpanded ? 'remove' : 'add'} />
        </Button>
      </div>

      {/* Selected district pills - visible when collapsed */}
      {!viewModel.isExpanded && viewModel.selectedDistricts.length > 0 && (
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

      {viewModel.isExpanded && (
        <div id="district-filter-content" className="filter-content">
          {viewModel.districts.length > 0 && !viewModel.districtsError && (
            <div className="filter-control">
              <ComboBox
                id="district-filter"
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
      )}
    </section>
  );
}

export default TrusteeDistrictFilterView;
