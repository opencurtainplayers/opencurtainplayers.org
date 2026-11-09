import assert from "node:assert/strict";
import test from "node:test";
import {
  getTicketHeight,
  isTicketMessage,
  ticketOrigin,
} from "../../src/lib/tickets.mjs";

test("accepts bounded Ludus resize messages", () => {
  assert.equal(getTicketHeight("resize::350"), 350);
  assert.equal(getTicketHeight("resize::1800"), 1800);
  assert.equal(getTicketHeight("resize::12000"), 12000);
});

test("rejects malformed, non-string, and out-of-range widget messages", () => {
  for (const data of [
    null,
    {},
    ["resize::700"],
    700,
    "resize::349",
    "resize::12001",
    "resize::-10",
    "resize::2.5",
    "resize::700px",
    "prefix resize::700",
    "windowResize::",
  ]) {
    assert.equal(getTicketHeight(data), null, JSON.stringify(data));
  }
});

test("only trusts messages from the Ludus origin and the embedded frame", () => {
  const frameWindow = {};
  assert.equal(
    isTicketMessage({ origin: ticketOrigin, source: frameWindow }, frameWindow),
    true,
  );
  assert.equal(
    isTicketMessage(
      { origin: "https://example.com", source: frameWindow },
      frameWindow,
    ),
    false,
  );
  assert.equal(
    isTicketMessage({ origin: ticketOrigin, source: {} }, frameWindow),
    false,
  );
  assert.equal(
    isTicketMessage({ origin: ticketOrigin, source: null }, null),
    false,
  );
});
