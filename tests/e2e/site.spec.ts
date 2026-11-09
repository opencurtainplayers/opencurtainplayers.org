import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { navigation, organization } from "../../src/data/site";
import { ticketEmbedUrl, ticketUrl } from "../../src/lib/tickets.mjs";

const pages = [
  ...navigation.map(({ href }) => href),
  "/accessibility/",
  "/404.html",
];

test.beforeEach(async ({ page }) => {
  // First-party checks are deterministic; the real provider is audited separately.
  await page.route("https://opencurtainplayers.ludus.com/**", (route) =>
    route.abort(),
  );
});

for (const path of pages) {
  test(`${path} renders, supports keyboard navigation, and fits the viewport`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute(
      "href",
      `https://opencurtainplayers.org${path}`,
    );

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const { href, label } of navigation) {
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("href", href);
    }
    if (navigation.some(({ href }) => href === path)) {
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
        "href",
        path,
      );
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    const logo = page.getByRole("link", { name: "Open Curtain Players home" });
    expect(
      await logo
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test(`${path} has no detected first-party WCAG 2.1 A/AA violations`, async ({
    page,
  }, testInfo) => {
    await page.goto(path);
    const builder = new AxeBuilder({ page }).withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
    ]);
    if (path === "/tickets/") builder.exclude("#ludusWidget");
    const results = await builder.analyze();
    await testInfo.attach("first-party-wcag21-results", {
      body: JSON.stringify(
        {
          scope: "First-party rendered page; Ludus iframe excluded",
          path,
          viewport: page.viewportSize(),
          violations: results.violations,
          incomplete: results.incomplete,
          passes: results.passes.map(({ id }) => id),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    expect(results.violations).toEqual([]);
  });
}

test("navigation opens real pages and internal links resolve", async ({
  page,
}) => {
  await page.goto("/");
  for (const { href, label } of navigation) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  }
  const visited = new Set<string>();
  for (const path of pages) {
    await page.goto(path);
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute("href")!)
          .filter((href) => href.startsWith("/")),
      );
    for (const href of hrefs) {
      const url = new URL(href, "http://127.0.0.1:4321");
      if (url.hash) {
        await page.goto(href);
        await expect(page.locator(url.hash)).toHaveCount(1);
      }
      if (visited.has(url.pathname)) continue;
      visited.add(url.pathname);
      expect((await page.request.get(url.pathname)).status()).toBe(200);
    }
  }
});

test("contact details and registration provenance remain visible", async ({
  page,
}) => {
  await page.goto("/contact/");
  const main = page.getByRole("main");
  await expect(main).toContainText(organization.street);
  await expect(main).toContainText(organization.ein);
  await expect(main).toContainText(organization.charityRegistration);
  await expect(main).toContainText(
    "501(c)(3) public charity (organization-reported)",
  );
  await expect(main).toContainText("not a performance venue");
  await expect(main).toContainText("Independent verification");
  await expect(
    main.getByRole("link", { name: organization.email }),
  ).toHaveAttribute("href", `mailto:${organization.email}`);
  await expect(
    main.getByRole("link", { name: organization.phone, exact: true }),
  ).toHaveAttribute("href", organization.phoneHref);
});

test("Ludus configuration, booking fallback, and trusted resizing work", async ({
  page,
}) => {
  await page.goto("/tickets/");
  const frame = page.locator("#ludusWidget");
  await expect(frame).toHaveAttribute("src", ticketEmbedUrl);
  await expect(frame).toHaveAttribute("title", /tickets provided by Ludus/);
  await expect(
    page.getByRole("link", { name: "Book directly on Ludus" }),
  ).toHaveAttribute("href", ticketUrl);
  await expect(
    page.getByRole("link", { name: "contact our team for assistance" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#ludusWidget")!;
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://opencurtainplayers.ludus.com",
        source: frame.contentWindow,
        data: "resize::900",
      }),
    );
  });
  await expect(frame).toHaveCSS("height", "900px");
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#ludusWidget")!;
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://untrusted.example",
        source: frame.contentWindow,
        data: "resize::1200",
      }),
    );
  });
  await expect(frame).toHaveCSS("height", "900px");
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#ludusWidget")!;
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://opencurtainplayers.ludus.com",
        source: frame.contentWindow,
        data: "windowResize::",
      }),
    );
  });
  await expect(frame).toHaveCSS(
    "height",
    `${Math.max(350, page.viewportSize()!.height)}px`,
  );
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>("#ludusWidget")!;
    window.scrollTo(0, 0);
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://opencurtainplayers.ludus.com",
        source: frame.contentWindow,
        data: "scroll::",
      }),
    );
  });
  await expect(frame).toBeInViewport();
});

test("content and booking alternatives work without JavaScript", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: "http://127.0.0.1:4321",
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  await page.route("https://opencurtainplayers.ludus.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/tickets/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Book directly on Ludus" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Mission", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Theater without barriers.",
  );
  await context.close();
});

test("320px reflow and reduced motion preserve access", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of pages) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.goto("/");
  await expect(page.locator(".hero-copy")).toHaveCSS("animation-name", "none");
});
