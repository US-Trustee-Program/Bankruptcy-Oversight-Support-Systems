import { AxeBuilder } from "@axe-core/playwright";
// import playwright from "playwright";
import { test } from "@playwright/test";

test("should reset multiple input fields when Cancel is clicked", async ({
  page,
}) => {
  await page.goto('');

  try {
    const results = await new AxeBuilder({ page }).analyze();
    console.log(results);
  } catch (e) {
    console.error(e);
  }
});
