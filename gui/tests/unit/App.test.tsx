import 'jsdom-global/register';
import ReactDOM from 'react-dom/client';
import { expect } from 'chai';
import { BrowserRouter } from 'react-router-dom';
import App from '../../src/App';

let rootContainer: HTMLDivElement;
let root: ReactDOM.Root;

before(() => {
  rootContainer = document.createElement('div');
  root = ReactDOM.createRoot(rootContainer);
});

describe('Test default route', () => {
  it('Show display a list of cases', (): void => {
    root.render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const h1 = document.querySelector('h1');
    if (h1) {
      expect(h1).to.not.be.null;
      expect((h1 as HTMLHeadingElement).textContent).to.equal('Case List');
    }
  });
});
