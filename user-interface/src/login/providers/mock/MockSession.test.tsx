import { describe } from 'vitest';
import { MockSession } from './MockSession';
import { render, screen } from '@testing-library/react';
import { CamsUser } from '../../login-library';
import * as sessionModule from '../../Session';
import { BrowserRouter } from 'react-router-dom';

describe('MockSession', () => {
  test('should pass a mapped CamsUser, provider, and children to the Session component', () => {
    const user: CamsUser = { name: 'First Last' };
    const testId = 'child-div';
    const childText = 'TEST';

    const sessionSpy = vi.spyOn(sessionModule, 'Session');
    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <MockSession user={user}>{children}</MockSession>
      </BrowserRouter>,
    );

    const childDiv = screen.queryByTestId(testId);
    expect(childDiv).toBeInTheDocument();
    expect(childDiv).toHaveTextContent(childText);

    expect(sessionSpy).toHaveBeenCalledWith({ children: children, provider: 'mock', user }, {});
  });
});
