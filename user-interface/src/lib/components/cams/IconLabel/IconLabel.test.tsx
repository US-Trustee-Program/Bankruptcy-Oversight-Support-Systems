import { render } from '@testing-library/react';

import { IconLabel } from './IconLabel';

describe('Tests for IconLabel component', () => {
  test('should render icon on left side of text by default', () => {
    render(<IconLabel icon="info" label="test label"></IconLabel>);

    const camsIconLabelSpan = document.querySelector('span.cams-icon-label');
    expect(camsIconLabelSpan!.children[0].tagName.toLowerCase()).toEqual('svg');
    expect(camsIconLabelSpan!.children[1].tagName.toLowerCase()).toEqual('span');
  });

  test('should render icon on right side of text when location = right', () => {
    render(<IconLabel icon="info" label="test label" location="right"></IconLabel>);

    const camsIconLabelSpan = document.querySelector('span.cams-icon-label');
    expect(camsIconLabelSpan!.children[0].tagName.toLowerCase()).toEqual('span');
    expect(camsIconLabelSpan!.children[1].tagName.toLowerCase()).toEqual('svg');
  });
});
