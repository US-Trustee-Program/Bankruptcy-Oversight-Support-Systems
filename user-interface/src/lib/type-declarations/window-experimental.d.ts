declare module BrowserExperimental {
  export interface windowExperimental extends window {
    CSS: {
      highlights?: {
        set: (name: string, highlight: Highlight) => void;
        clear: () => void;
      };
    };
  }

  declare class Highlight {
    constructor(...Range);
  }
}
