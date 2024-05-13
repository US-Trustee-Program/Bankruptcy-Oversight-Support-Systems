import { render } from '@testing-library/react';
import { CaseSelection } from './CaseSelection';

describe('Test CaseSelection component', () => {
  function renderWithProps(props: { region1: string; region2: string }) {
    render(
      <CaseSelection
        fromCourt={{
          region: props.region1,
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: props.region2,
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  test('Should display message as expected using toCourt and fromCourt', async () => {
    renderWithProps({ region1: '1', region2: '002' });

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion 1 - Division Name 1toRegion 2 - Division Name 2',
    );
  });

  test('Should properly display region as a non-numeric string when one is supplied', async () => {
    renderWithProps({ region1: 'ABC', region2: 'BCD' });

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion ABC - Division Name 1toRegion BCD - Division Name 2',
    );
  });
});
