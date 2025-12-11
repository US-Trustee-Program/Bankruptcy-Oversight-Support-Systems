import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

/**
 * Shared constants for accessibility tests
 */

/**
 * Base URL for the application under test
 */
export const BASE_URL = 'http://localhost:3000';

/**
 * Delay in milliseconds to wait for any transitions to complete
 * before running accessibility analysis to minimize false failures
 */
export const ANALYZE_DELAY = 1000;

/**
 * Test timeout in milliseconds for complex tests with multiple interactions
 */
export const COMPLEX_TEST_TIMEOUT = 60000;

/**
 * Test timeout in milliseconds for standard tests
 */
export const STANDARD_TEST_TIMEOUT = 30000;

/**
 * Custom viewport size for tests requiring larger screen dimensions
 * (e.g., complex layouts, data tables, etc.)
 */
export const LARGE_VIEWPORT = {
  width: 1536,
  height: 864,
};

/**
 * Accessibility rules that are temporarily disabled across all tests
 * See KNOWN_ISSUES.md for details on each disabled rule
 */
export const DISABLED_A11Y_RULES = [
  'heading-order', // Temporarily disabled due to <h3>Filters</h3> without proper hierarchy
  'label-title-only', // Temporarily disabled due to radio buttons using only title attribute for label
];

/**
 * Helper function to construct full URLs
 */
export function getUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * Creates an AxeBuilder instance with standardized configuration
 * including temporarily disabled rules
 */
export function createAxeBuilder(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).disableRules(DISABLED_A11Y_RULES);
}
