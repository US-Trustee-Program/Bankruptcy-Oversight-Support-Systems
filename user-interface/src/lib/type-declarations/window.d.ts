// Global type declarations for the window object used in tests and runtime
declare global {
  interface Window {
    CAMS_CONFIGURATION: Record<string, string>;
    crypto: Crypto;
  }
}

export {};
