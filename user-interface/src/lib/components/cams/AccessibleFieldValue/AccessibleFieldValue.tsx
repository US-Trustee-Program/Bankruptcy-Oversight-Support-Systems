export type AccessibleFieldValueProps = {
  label: string;
  className?: string;
  children: React.ReactNode;
};

// Adds a visually-hidden field label (e.g. "Phone: ") ahead of a value so screen reader
// users get the same field context sighted users get for free from layout (a column header,
// a form label, position within a card). The visible rendering is unchanged - only the
// accessible name gains the label.
export function AccessibleFieldValue({
  label,
  className,
  children,
}: Readonly<AccessibleFieldValueProps>) {
  return (
    <div className={className}>
      <span className="usa-sr-only">{label}: </span>
      {children}
    </div>
  );
}
