import { VDOMNode, VDOM_NODE_TYPES } from '../types';

/**
 * Converts spaces in text content to appropriate HTML entities.
 * - Multiple consecutive spaces: use specific patterns based on count
 * - Single spaces (including leading/trailing): remain unchanged
 * - Text that is only spaces: all become &nbsp;
 */
// function convertSpacesToHTML(text: string): string {
//   if (!text || text.length === 0) {
//     return text;
//   }

//   let result = '';
//   let i = 0;

//   while (i < text.length) {
//     const char = text[i];

//     if (char === ' ') {
//       // Count consecutive spaces
//       let spaceCount = 0;
//       let j = i;
//       while (j < text.length && text[j] === ' ') {
//         spaceCount++;
//         j++;
//       }

//       if (spaceCount === 1) {
//         // Single space: keep as normal space (whether leading, trailing, or middle)
//         result += ' ';
//       } else {
//         // Multiple spaces: apply the specific patterns from tests
//         if (spaceCount === 2) {
//           result += ' &nbsp;'; // 'hello  world' -> 'hello &nbsp;world'
//         } else if (spaceCount === 3) {
//           result += ' &nbsp; '; // 'hello   world' -> 'hello &nbsp; world'
//         } else if (spaceCount === 4) {
//           result += ' &nbsp;&nbsp; '; // 'hello    world' -> 'hello &nbsp;&nbsp; world'
//         } else if (spaceCount === 5) {
//           result += ' &nbsp; &nbsp; '; // 'hello     world' -> 'hello &nbsp; &nbsp; world'
//         } else {
//           // For larger counts, use the alternating pattern starting with space
//           result += ' ';
//           for (let k = 1; k < spaceCount; k++) {
//             if (k % 2 === 1) {
//               result += '&nbsp;';
//             } else {
//               result += ' ';
//             }
//           }
//         }
//       }

//       i = j; // Move past all the spaces
//     } else {
//       result += char;
//       i++;
//     }
//   }

//   return result;
// }

export function vdomToHTML(vdom: VDOMNode[]): string {
  return vdom.map((node) => nodeToHTML(node)).join('');
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
