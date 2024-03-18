import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("First a11y test", async ({ page }) => {
  await page.goto("");

  const results = await new AxeBuilder({ page })
    .withTags("best-practice")
    .analyze();
  expect(results.violations).toEqual([]);
  console.log(results.violations);
});
