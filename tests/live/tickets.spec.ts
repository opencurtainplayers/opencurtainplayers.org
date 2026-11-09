import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { ticketOrigin } from "../../src/lib/tickets.mjs";

test("audit the real Ludus embed and report third-party coverage honestly", async ({
  page,
}, testInfo) => {
  const responses: {
    url: string;
    status: number;
    headers: Record<string, string>;
  }[] = [];
  const failures: { url: string; error: string | null }[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().startsWith(ticketOrigin)) {
      responses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
      });
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(ticketOrigin)) {
      failures.push({
        url: request.url(),
        error: request.failure()?.errorText ?? null,
      });
    }
  });
  const response = await page.goto("/tickets/");
  expect(response?.status(), "The deployed tickets page must exist").toBe(200);
  await expect(page.locator("#ludusWidget")).toBeVisible();
  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});
  const ludusFrame = page
    .frames()
    .find((frame) => frame.url().startsWith(ticketOrigin));
  const frameText = ludusFrame
    ? await ludusFrame
        .locator("body")
        .innerText({ timeout: 10000 })
        .catch(() => "")
    : "";
  const embedResponse = responses.find(({ url }) =>
    url.includes("/embed/index.php"),
  );
  const providerBlocked =
    !embedResponse ||
    embedResponse.status >= 400 ||
    failures.some(({ url }) => url.includes("/embed/index.php")) ||
    !frameText.trim() ||
    /access denied|request blocked|forbidden|verify you are human|just a moment/i.test(
      frameText,
    );

  let audit;
  let auditError = null;
  try {
    audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
  } catch (error) {
    auditError = String(error);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    pageUrl: page.url(),
    scope:
      "Rendered tickets page with live Ludus iframe; no purchases or checkout submissions",
    providerBlocked,
    ticketContentAuditStatus: providerBlocked
      ? "BLOCKED: no accessibility conclusion about Ludus content"
      : auditError
        ? "ERROR: audit could not complete"
        : "Rendered initial ticket content scanned; checkout not tested",
    providerContentSample: frameText.slice(0, 1200),
    responses,
    failures,
    consoleErrors,
    auditError,
    violations: audit?.violations ?? [],
    incomplete: audit?.incomplete ?? [],
    passes: audit?.passes.map(({ id }) => id) ?? [],
    limitation:
      "A blocked iframe or incomplete frame rule is not a successful ticket-content audit. Checkout and manual assistive-technology testing remain outstanding.",
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/ludus-accessibility.json",
    JSON.stringify(report, null, 2),
  );
  await page.screenshot({ path: "artifacts/tickets-live.png", fullPage: true });
  await testInfo.attach("live-ludus-audit", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  console.log(
    JSON.stringify({
      providerBlocked,
      violations: report.violations.map(({ id, impact }) => ({ id, impact })),
      incomplete: report.incomplete.map(({ id }) => id),
      auditError,
    }),
  );
  expect(auditError, "See artifacts/ludus-accessibility.json").toBeNull();
  expect(
    providerBlocked,
    "Live Ludus content was not available; see the report",
  ).toBe(false);
  expect(
    report.violations,
    "Third-party findings require provider remediation",
  ).toEqual([]);
});
