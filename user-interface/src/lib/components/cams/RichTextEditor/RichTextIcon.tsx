export interface RichTextIconProps {
  name: string;
}

export function RichTextIcon(props: RichTextIconProps) {
  const { name } = props;

  return iconMap[name] ?? '';
}

const iconMap: Record<string, JSX.Element> = {
  'numbered-list': (
    <path
      fill="currentColor"
      d="M4 6h1V4H4v1h.5v1H4v1h1V6H4zm1.5 5H4v1h1v1H4v1h1.5v-1H5v-1h.5v-1zm0 5H4v1h1v1H4v1h1.5v-1H5v-1h.5v-1zM9 5h12v2H9V5zm0 6h12v2H9v-2zm0 6h12v2H9v-2z"
    />
  ),
  'test-list': (
    <path
      fill="currentColor"
      d="M32 64h384v64H32zm0 128h384v64H32zm0 128h384v64H32zM56 384h24v-8h-16v-8h16v-8h-16v-8h24v-16H40v64h16v-8zm0-192h8v8H56v-8zm0 16h8v8H56v-8zm0 16h8v8H56v-8z"
    />
  ),
  'bulleted-list': (
    <path
      fill="currentColor"
      d="M4 6h2v2H4V6zm0 6h2v2H4v-2zm0 6h2v2H4v-2zm5-12h11v2H9V6zm0 6h11v2H9v-2zm0 6h11v2H9v-2z"
    />
  ),
};
