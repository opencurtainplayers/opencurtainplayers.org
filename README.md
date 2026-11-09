# Open Curtain Players

An Astro static multipage frontend for Open Curtain Players Inc. Node is used for
development, tests, and builds; production needs only static hosting.

## Development

Use Node 24 (or Node >=22.23.4).

```sh
npm ci
npm run dev
```

Pages: Home, Mission, History, Programs & Projects, Tickets, Contact & Transparency,
Accessibility, and a custom 404. Content is rendered as HTML and navigation works
without JavaScript. Shared organization and program content is in
`src/data/site.ts`; page content is in `src/pages/`.

The original logo is served from `public/images/logo.png`. Legacy Jekyll source
files (`index.md`, `_config.yml`, and `_layouts/`) are retained for reference and
to preserve existing uncommitted changes, but Astro does not build them.

## Checks and test suites

```sh
npm run format:check
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:tickets:live
```

The browser suite checks the production build at `127.0.0.1:4321`, using desktop
and mobile Chromium. It covers rendered pages, navigation, internal links and
anchors, organization details, keyboard skip links, 320px reflow, reduced motion,
JavaScript-disabled access, ticket fallback links, and trusted widget resizing.
Node tests cover malformed resize messages and origin/source checks.

The first-party axe suite scans every rendered page (including the custom 404)
with `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`. JSON attachments include
violations and incomplete/manual-review findings. View `playwright-report/` with
`npx playwright show-report`. The deterministic suite blocks external Ludus
requests and excludes only its iframe from axe; it does not claim to test the
provider or checkout.

The separate live ticket suite loads the real iframe without network mocks,
attempts a full-page/frame audit, records provider HTTP failures, and writes
`artifacts/ludus-accessibility.json`, `artifacts/tickets-live.png`, and an HTML
report under `artifacts/live-report/`. It fails if the provider is blocked, the
audit cannot run, or violations are detected. A blocked or uninspectable provider
is a coverage gap, not an accessibility pass. This external service check is
deliberately separate from the deterministic deployment gate.

Ludus currently sends a `frame-ancestors` Content Security Policy allowing
`https://opencurtainplayers.org`, `https://*.opencurtainplayers.org`, and the
equivalent `.com` domains, but not localhost. A local live check therefore fails
with `net::ERR_BLOCKED_BY_RESPONSE` even when the response status is 200.
The test checks request failures and actual frame content rather than treating a
200 or an empty axe result as success. Do not remove the provider's security
headers or disable browser security to make the test pass.

After deployment, run the real embedded-content check against its allowed origin:

```sh
LIVE_SITE_URL=https://opencurtainplayers.org npm run test:tickets:live
```

This uses the deployed pages, not the local preview. The initial local scan of
all eight first-party pages at desktop and mobile sizes detected no WCAG 2.1
A/AA violations. The Ludus content audit remains blocked locally; it is not
counted as a pass. Evidence and headers are in the live audit JSON.

### Remaining accessibility review

Automated results are not WCAG certification. Before claiming conformance, review
incomplete axe findings and manually test screen readers (including VoiceOver and
NVDA), logical keyboard order and visible focus, text zoom, 400% browser zoom,
text spacing overrides, and the complete third-party booking/checkout flow.
Never submit purchases during automated checks. Escalate Ludus-owned findings to
the provider; retain the direct booking and team-contact alternatives.

## Ticket integration

`src/lib/tickets.mjs` preserves Ludus show `200545825`, `sections=events`, and
`hideNav=true` from the original widget. The iframe uses the same public Ludus
embed endpoint instead of `document.write`, has a descriptive title, allows
scrolling, and validates both the origin and source of resize messages. The
direct booking link remains available when the embed or JavaScript fails.

## Content verification and application blockers

Organization details were supplied by the site owner on November 9, 2026.
The [official Florida corporation record](https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&aggregateId=domnp-n26000004678-0c0189bd-f16d-4492-850d-9d231575cf79)
corroborates the legal entity, active state nonprofit corporation status,
March 31, 2026 incorporation date, and principal/office street address.
That record currently lists no FEI/EIN. State incorporation does not verify
federal exemption.

The site labels EIN `41-5381676`, charity registration `CH83070`, and 501(c)(3)
public-charity status as organization-provided/reported. No IRS determination
letter or Florida charitable registration document was provided for publication.
Email and phone are owner-supplied; delivery and ownership were not independently
tested. Do not remove the verification notice or claim the application criteria
are fully satisfied until the following are completed:

- Confirm the IRS record/determination letter against the legal name and EIN.
- Confirm Florida charitable registration `CH83070` and publish approved evidence.
- Confirm public email and phone operation and obtain any required address proof.
- Confirm the opening date, venue, ticket availability, and actual accommodations
  with Ludus; do not imply the office is a performance venue.
- Add approved program schedules and history milestones as they become available.
- Complete the remaining manual and third-party accessibility review.

There are no invented historical productions, partner names, attendance figures,
enrollment schedules, or blanket tax-deductibility promises.

## Deployment

`.github/workflows/pages.yml` replaces the Jekyll workflow. Pull requests run
formatting, type, unit, production-build, functional, and first-party accessibility
checks. Pushes to `main` and manual runs also deploy `dist/` after successful
checks. Select **GitHub Actions** as the repository's Pages source.

`astro.config.mjs` and `public/CNAME` target `https://opencurtainplayers.org` at
the domain root. Retain the existing custom-domain DNS settings. For a different
domain or repository-subpath deployment, update the site/base configuration and
internal link/asset prefixes together. Local changes do not publish until pushed
and deployed.
