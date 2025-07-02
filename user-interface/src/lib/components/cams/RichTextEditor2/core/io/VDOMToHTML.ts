import { VDOMNode, VDOM_NODE_TYPES } from '../types';

export function vdomToHTML(vdom: VDOMNode[]): string {
  return vdom.map(nodeToHTML).join('');
}

function nodeToHTML(node: VDOMNode): string {
  const html = node.children ? node.children.map(nodeToHTML).join('') : '';
  switch (node.type) {
    case VDOM_NODE_TYPES.TEXT:
      return node.content || '';

    case VDOM_NODE_TYPES.BR:
      return '<br>';

    case VDOM_NODE_TYPES.PARAGRAPH:
      return `<p>${html}</p>`;

    case VDOM_NODE_TYPES.STRONG:
      return `<strong>${html}</strong>`;

    case VDOM_NODE_TYPES.EM:
      return `<em>${html}</em>`;

    case VDOM_NODE_TYPES.U:
      return `<u>${html}</u>`;

    default:
      return html;
  }
}
