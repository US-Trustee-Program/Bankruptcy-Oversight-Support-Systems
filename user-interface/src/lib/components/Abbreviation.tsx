import React from 'react';

export interface AbbreviationProps {
  children: string;
}

/**
 * Renders an abbreviation with proper screen reader pronunciation.
 *
 * For abbreviations like "TIR" that are pronounced as a word by screen readers
 * instead of letter-by-letter, this component renders the abbreviation visibly
 * while providing spelled-out text for screen readers.
 *
 * Visible output: "TIR"
 * Screen reader: "T I R" (from hidden screen-reader-only text)
 */
export default function Abbreviation({ children }: Readonly<AbbreviationProps>) {
  // Create the spaced-out pronunciation: "TIR" → "T I R"
  const pronunciation = children.split('').join(' ');

  return (
    <>
      <span aria-hidden="true">{children}</span>
      <span className="usa-sr-only">{pronunciation}</span>
    </>
  );
}
