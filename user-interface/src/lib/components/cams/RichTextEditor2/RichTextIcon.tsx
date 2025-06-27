import Icon from '@/lib/components/uswds/Icon';

export interface RichTextIconProps {
  name: string;
}

export function RichTextIcon(props: RichTextIconProps) {
  const { name } = props;

  return iconMap[name] ?? '';
}

const iconMap: Record<string, JSX.Element> = {
  'numbered-list': <img src="/numbered-list.svg" alt="numbered list icon" />,
  'bulleted-list': <img src="/bullet-list.svg" alt="bulleted list icon" />,
  link: <Icon name="link"></Icon>,
};
