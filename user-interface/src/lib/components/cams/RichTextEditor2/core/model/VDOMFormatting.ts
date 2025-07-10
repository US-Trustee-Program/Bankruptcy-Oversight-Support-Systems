import { VDOMNode, VDOMSelection } from '../types';

interface ToggleResult {
  vdom: VDOMNode[];
  selection: VDOMSelection;
}

function findWordBoundaries(text: string, offset: number): { start: number; end: number } {
  const beforeText = text.slice(0, offset);
  const afterText = text.slice(offset);

  const beforeMatch = beforeText.match(/\w+\s*$/);
  const afterMatch = afterText.match(/^\s*\w+/);

  const start = beforeMatch ? offset - beforeMatch[0].length : offset;
  const end = afterMatch ? offset + afterMatch[0].length : offset;

  return { start, end };
}

function expandSelectionToWord(selection: VDOMSelection): VDOMSelection {
  if (!selection.isCollapsed || selection.start.node.type !== 'text') {
    return selection;
  }

  const { start, end } = findWordBoundaries(selection.start.node.content, selection.start.offset);

  return {
    start: { ...selection.start, offset: start },
    end: { ...selection.end, offset: end },
    isCollapsed: false,
  };
}

function findAncestorStrong(node: VDOMNode, vdom: VDOMNode[]): VDOMNode | null {
  function findInChildren(nodes: VDOMNode[], target: VDOMNode): VDOMNode | null {
    for (const n of nodes) {
      if (
        n.type === 'strong' &&
        n.children?.some((child) => child === target || findInChildren([child], target))
      ) {
        return n;
      }
      if (n.children) {
        const found = findInChildren(n.children, target);
        if (found) return found;
      }
    }
    return null;
  }

  return findInChildren(vdom, node);
}

function mergeAdjacentStrong(nodes: VDOMNode[]): VDOMNode[] {
  const result: VDOMNode[] = [];
  let currentStrong: VDOMNode | null = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === 'strong') {
      if (currentStrong) {
        // Merge with current strong
        currentStrong.children = [...currentStrong.children!, ...node.children!].map(
          (child, index) => ({
            ...child,
            path: [...currentStrong!.path, index],
          }),
        );
      } else {
        currentStrong = node;
        result.push(currentStrong);
      }
    } else if (node.type === 'text' && node.content.trim() === '') {
      // For whitespace, check if we're between two strong tags
      const nextNode = nodes[i + 1];
      if (currentStrong && nextNode && nextNode.type === 'strong') {
        currentStrong.children!.push({
          ...node,
          path: [...currentStrong.path, currentStrong.children!.length],
        });
        continue;
      }
      currentStrong = null;
      result.push(node);
    } else {
      currentStrong = null;
      result.push(node);
    }
  }

  return result;
}

function consolidateNestedStrong(node: VDOMNode): VDOMNode {
  if (node.type !== 'strong' || !node.children) {
    return node;
  }

  // Flatten nested strong tags and merge text nodes
  const flattenedChildren: VDOMNode[] = [];
  let currentText = '';

  function processNode(n: VDOMNode) {
    if (n.type === 'text') {
      currentText += n.content;
    } else if (n.type === 'strong' && n.children) {
      n.children.forEach(processNode);
    } else {
      if (currentText) {
        flattenedChildren.push({
          type: 'text',
          path: [...node.path, flattenedChildren.length],
          content: currentText,
        });
        currentText = '';
      }
      flattenedChildren.push({
        ...n,
        path: [...node.path, flattenedChildren.length],
      });
    }
  }

  node.children.forEach(processNode);

  if (currentText) {
    flattenedChildren.push({
      type: 'text',
      path: [...node.path, flattenedChildren.length],
      content: currentText,
    });
  }

  return {
    ...node,
    children: flattenedChildren,
  };
}

function wrapInStrong(node: VDOMNode, parentPath: number[] = []): VDOMNode {
  return {
    type: 'strong',
    path: parentPath,
    children: [{ ...node, path: [...parentPath, 0] }],
  };
}

function unwrapFromStrong(node: VDOMNode): VDOMNode[] {
  if (node.type !== 'strong' || !node.children) {
    return [node];
  }
  return node.children.map((child, index) => ({
    ...child,
    path: [...node.path.slice(0, -1), index],
  }));
}

function getNodesInRange(startNode: VDOMNode, endNode: VDOMNode, vdom: VDOMNode[]): VDOMNode[] {
  const result: VDOMNode[] = [];
  let inRange = false;

  function traverse(nodes: VDOMNode[]) {
    for (const node of nodes) {
      if (node === startNode) {
        inRange = true;
      }

      if (inRange) {
        result.push(node);
      }

      if (node.children) {
        traverse(node.children);
      }

      if (node === endNode) {
        inRange = false;
      }
    }
  }

  traverse(vdom);
  return result;
}

export function toggleBold(vdom: VDOMNode[], selection: VDOMSelection): ToggleResult {
  // If selection is collapsed, expand to word boundaries
  const expandedSelection = selection.isCollapsed ? expandSelectionToWord(selection) : selection;

  const startStrong = findAncestorStrong(expandedSelection.start.node, vdom);
  const endStrong = findAncestorStrong(expandedSelection.end.node, vdom);

  // Get all nodes in selection range
  const nodesInRange = getNodesInRange(
    expandedSelection.start.node,
    expandedSelection.end.node,
    vdom,
  );

  let newVdom = [...vdom];

  if (!startStrong && !endStrong) {
    // Case 1: Not in strong -> Wrap in strong
    nodesInRange.forEach((node) => {
      const path = node.path.slice(0, -1);
      const index = node.path[node.path.length - 1];
      const parent = path.reduce((acc, i) => acc[i].children!, newVdom);
      parent[index] = wrapInStrong(node, [...path, index]);
    });
  } else if (startStrong === endStrong) {
    // Case 2: Inside strong -> Remove strong
    const strongNode = startStrong;
    const path = strongNode.path.slice(0, -1);
    const index = strongNode.path[strongNode.path.length - 1];
    const parent = path.reduce((acc, i) => acc[i].children!, newVdom);
    parent.splice(index, 1, ...unwrapFromStrong(strongNode));
  } else {
    // Case 3: Partially in strong -> Wrap entire selection
    nodesInRange.forEach((node) => {
      if (!findAncestorStrong(node, vdom)) {
        const path = node.path.slice(0, -1);
        const index = node.path[node.path.length - 1];
        const parent = path.reduce((acc, i) => acc[i].children!, newVdom);
        parent[index] = wrapInStrong(node, [...path, index]);
      }
    });
  }

  // Process each container node to merge adjacent strong tags and consolidate nested ones
  function processContainer(nodes: VDOMNode[]): VDOMNode[] {
    return mergeAdjacentStrong(
      nodes.map((node) => {
        if (node.children) {
          return {
            ...node,
            children: processContainer(node.children),
          };
        }
        return node;
      }),
    ).map((node) => (node.type === 'strong' ? consolidateNestedStrong(node) : node));
  }

  newVdom = newVdom.map((node) => {
    if (node.children) {
      return {
        ...node,
        children: processContainer(node.children),
      };
    }
    return node;
  });

  return {
    vdom: newVdom,
    selection: expandedSelection,
  };
}

export function toggleBoldInSelection(
  vdom: VDOMNode[],
  selection: VDOMSelection,
): { newVDOM: VDOMNode[]; newSelection: VDOMSelection } {
  const result = toggleBold(vdom, selection);
  return {
    newVDOM: result.vdom,
    newSelection: result.selection,
  };
}
