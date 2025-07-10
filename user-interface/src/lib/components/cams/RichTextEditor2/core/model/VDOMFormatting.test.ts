import { describe, it, expect } from 'vitest';
import { toggleBold, toggleBoldInSelection } from './VDOMFormatting';
import { VDOMNode, VDOMSelection } from '../types';

describe('VDOMFormatting', () => {
  describe('toggleBold', () => {
    it('should wrap plain text in strong tag', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'text',
              path: [0, 0],
              content: 'Hello world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0], offset: 0 },
        end: { node: vdom[0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello',
          },
        ],
      });
      expect(result.vdom[0].children![1]).toEqual({
        type: 'text',
        path: [0, 1],
        content: ' world',
      });
    });

    it('should unwrap text from strong tag', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0].children![0], offset: 0 },
        end: { node: vdom[0].children![0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'text',
        path: [0, 0],
        content: 'Hello',
      });
    });

    it('should merge adjacent strong tags', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
            {
              type: 'text',
              path: [0, 1],
              content: ' ',
            },
            {
              type: 'strong',
              path: [0, 2],
              children: [
                {
                  type: 'text',
                  path: [0, 2, 0],
                  content: 'world',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![1], offset: 0 },
        end: { node: vdom[0].children![1], offset: 1 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children!.length).toBe(1);
      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello world',
          },
        ],
      });
    });

    it('should expand cursor selection to word boundaries', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'text',
              path: [0, 0],
              content: 'Hello world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0], offset: 2 },
        end: { node: vdom[0].children![0], offset: 2 },
        isCollapsed: true,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello',
          },
        ],
      });
      expect(result.vdom[0].children![1]).toEqual({
        type: 'text',
        path: [0, 1],
        content: ' world',
      });
    });

    it('should consolidate nested strong tags', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello ',
                },
                {
                  type: 'strong',
                  path: [0, 0, 1],
                  children: [
                    {
                      type: 'text',
                      path: [0, 0, 1, 0],
                      content: 'nested',
                    },
                  ],
                },
                {
                  type: 'text',
                  path: [0, 0, 2],
                  content: ' world',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0].children![1].children![0], offset: 0 },
        end: { node: vdom[0].children![0].children![1].children![0], offset: 6 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello nested world',
          },
        ],
      });
    });

    it('should wrap selection in strong when not in strong node', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'text',
              path: [0, 0],
              content: 'Hello world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0], offset: 0 },
        end: { node: vdom[0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello',
          },
        ],
      });
    });

    it('should unwrap text from strong node when fully selected', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0].children![0], offset: 0 },
        end: { node: vdom[0].children![0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'text',
        path: [0, 0],
        content: 'Hello',
      });
    });

    it('should wrap entire selection in strong when partially in strong', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
            {
              type: 'text',
              path: [0, 1],
              content: ' world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0].children![0], offset: 3 },
        end: { node: vdom[0].children![1], offset: 3 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello wor',
          },
        ],
      });
    });

    it('should expand cursor to word boundaries when selection is collapsed', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'text',
              path: [0, 0],
              content: 'Hello world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0], offset: 2 },
        end: { node: vdom[0].children![0], offset: 2 },
        isCollapsed: true,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello',
          },
        ],
      });
    });

    it('should merge adjacent strong nodes', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
            {
              type: 'text',
              path: [0, 1],
              content: ' ',
            },
            {
              type: 'strong',
              path: [0, 2],
              children: [
                {
                  type: 'text',
                  path: [0, 2, 0],
                  content: 'world',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![1], offset: 0 },
        end: { node: vdom[0].children![1], offset: 1 },
        isCollapsed: false,
      };

      const result = toggleBold(vdom, selection);

      expect(result.vdom[0].children).toHaveLength(1);
      expect(result.vdom[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello world',
          },
        ],
      });
    });
  });

  describe('toggleBoldInSelection', () => {
    it('should return newVDOM and newSelection with the correct shape', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'text',
              path: [0, 0],
              content: 'Hello world',
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0], offset: 0 },
        end: { node: vdom[0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBoldInSelection(vdom, selection);

      // Test shape of return value matches FSM requirements
      expect(result).toHaveProperty('newVDOM');
      expect(result).toHaveProperty('newSelection');
      expect(Array.isArray(result.newVDOM)).toBe(true);
      expect(result.newSelection).toHaveProperty('start');
      expect(result.newSelection).toHaveProperty('end');
      expect(result.newSelection).toHaveProperty('isCollapsed');

      // Test actual transformation
      expect(result.newVDOM[0].children![0]).toEqual({
        type: 'strong',
        path: [0, 0],
        children: [
          {
            type: 'text',
            path: [0, 0, 0],
            content: 'Hello',
          },
        ],
      });
    });

    it('should handle selection inside strong tag', () => {
      const vdom: VDOMNode[] = [
        {
          type: 'paragraph',
          path: [0],
          children: [
            {
              type: 'strong',
              path: [0, 0],
              children: [
                {
                  type: 'text',
                  path: [0, 0, 0],
                  content: 'Hello',
                },
              ],
            },
          ],
        },
      ];

      const selection: VDOMSelection = {
        start: { node: vdom[0].children![0].children![0], offset: 0 },
        end: { node: vdom[0].children![0].children![0], offset: 5 },
        isCollapsed: false,
      };

      const result = toggleBoldInSelection(vdom, selection);

      // Should unwrap from strong
      expect(result.newVDOM[0].children![0]).toEqual({
        type: 'text',
        path: [0, 0],
        content: 'Hello',
      });
    });
  });
});
