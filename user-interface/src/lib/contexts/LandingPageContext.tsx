import React, { createContext, useContext, useState, useEffect } from 'react';

type LandingPage = 'case-search' | 'my-cases' | null;

interface LandingPageContextType {
  landingPage: LandingPage;
  setLandingPage: (page: LandingPage) => void;
  landingTimestamp: number | null;
}

const LandingPageContext = createContext<LandingPageContextType | undefined>(undefined);

export function LandingPageProvider({ children }: { children: React.ReactNode }) {
  const [landingPage, setLandingPageState] = useState<LandingPage>(null);
  const [landingTimestamp, setLandingTimestamp] = useState<number | null>(null);

  const setLandingPage = (page: LandingPage) => {
    if (!landingPage) {
      // Only set once per session
      setLandingPageState(page);
      setLandingTimestamp(Date.now());
    }
  };

  // Clear landing page on mount (new session)
  useEffect(() => {
    setLandingPageState(null);
    setLandingTimestamp(null);
  }, []);

  return (
    <LandingPageContext.Provider value={{ landingPage, setLandingPage, landingTimestamp }}>
      {children}
    </LandingPageContext.Provider>
  );
}

export function useLandingPageContext(): LandingPageContextType {
  const context = useContext(LandingPageContext);
  if (!context) {
    throw new Error('useLandingPageContext must be used within a LandingPageProvider');
  }
  return context;
}
