import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("Experiment with a11y tests", () => {
  test("First a11y test", async ({ page }) => {
    await page.goto("");

    const results = await new AxeBuilder({ page })
      .withTags("best-practice")
      .analyze();
    expect(results.violations).toEqual([]);
    console.log(results.violations);
  });

  test("Navigate to different page and use multiple tags", async ({ page }) => {
    await page.goto("/data-verification");
    expect(
      page.getByRole("heading", { name: "Data Verification" })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags("wcag2a")
      .withTags("best-practice")
      .analyze();

    expect(results.violations).toEqual([]);
    console.log(results.violations);
  });
});
