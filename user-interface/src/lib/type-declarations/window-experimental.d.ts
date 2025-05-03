declare namespace BrowserExperimental {
  export interface WindowExperimental extends window {
    CSS: {
      highlights?: {
        clear: () => void;
        set: (name: string, highlight: Highlight) => void;
      };
    };
  }

  declare class Highlight {
    constructor(...Range);
  }
}
