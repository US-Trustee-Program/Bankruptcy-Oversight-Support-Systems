declare module BrowserExperimental {
  export interface WindowExperimental extends window {
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
