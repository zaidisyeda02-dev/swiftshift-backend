"use strict";

/* DOM execution check for the SwiftShift Movers backend rebuild. Runs
   the real frontend (public/app.js) in jsdom against the running
   server, the way a visitor would use it. Run the server first
   (node server.js), then run: node scripts/dom-check.js
   It submits one quote, one message, one newsletter signup and
   creates one admin account, so run it on a test database and clear
   the data afterwards. It exits non-zero if any check fails. */

const { JSDOM, VirtualConsole, ResourceLoader } = require("jsdom");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3002";

let failures = 0;
let checks = 0;

function check(name, ok, detail) {
  checks++;
  if (ok) {
    console.log("PASS  " + name);
  } else {
    failures++;
    console.log("FAIL  " + name + (detail ? "  " + detail : ""));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (fn()) return true;
    } catch (e) {}
    await sleep(100);
  }
  console.log("TIMEOUT waiting for: " + label);
  return false;
}

function setInput(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function submitForm(window, form) {
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
}

function click(window, el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

/* Only same-origin resources (the app's own scripts). Google Fonts and
   any other outside URL is blocked, so the check does not depend on it. */
class SameOriginLoader extends ResourceLoader {
  fetch(url, options) {
    if (url.startsWith(BASE)) return super.fetch(url, options);
    return Promise.resolve(Buffer.alloc(0));
  }
}

async function makeDom(path) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on("jsdomError", (err) => {
    const msg = String((err && err.message) || err);
    if (/Could not load|not implemented/i.test(msg)) return;
    errors.push(msg);
    console.log("jsdom error: " + msg);
  });
  const dom = new JSDOM(html, {
    url: BASE + path,
    runScripts: "dangerously",
    resources: new SameOriginLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.scrollTo = function () {};
      if (window.Element && window.Element.prototype) {
        window.Element.prototype.scrollIntoView = function () {};
      }
      window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input.url;
        const full = url.indexOf("/") === 0 ? BASE + url : url;
        return fetch(full, init);
      };
    },
  });
  dom.errors = errors;
  return dom;
}

async function main() {
  const dom = await makeDom("/");
  const window = dom.window;
  const document = window.document;

  await waitFor(() => !!document.getElementById("intro-skip"), 2000, "intro Skip button to appear");
  check("intro shows with Skip intro and by Interlinkz", !!document.getElementById("intro-skip") && document.getElementById("intro-root").textContent.indexOf("by Interlinkz") !== -1);

  const skip = document.getElementById("intro-skip");
  if (skip) click(window, skip);
  await waitFor(() => !document.getElementById("intro-root").textContent.trim(), 3000, "intro to lift");
  check("Skip intro dismisses the intro", document.getElementById("intro-root").textContent.trim() === "");

  await waitFor(() => document.getElementById("app").textContent.indexOf("On the Road") !== -1, 5000, "hero to render");
  check("hero On the Road to Your New Home renders", document.getElementById("app").textContent.indexOf("On the Road") !== -1 && document.getElementById("app").textContent.indexOf("New Home") !== -1);
  check("hero has a Book a Shift button", document.getElementById("app").textContent.indexOf("Book a Shift") !== -1);
  check("hero photo loads", !!document.querySelector(".hero-bg") && document.querySelector(".hero-bg").getAttribute("src") === "/images/hero.jpg");

  const serviceNames = ["Home Shifting", "Office Shifting", "Packing and Unpacking", "Loading and Transport"];
  check("home shows all 4 services", serviceNames.every((n) => document.getElementById("app").textContent.indexOf(n) !== -1));
  check("home shows the 4 How It Works steps", ["Book a Quote", "We Pack and Load", "Safe Transport", "Unpack and Settle In"].every((n) => document.getElementById("app").textContent.indexOf(n) !== -1));
  check("home shows 4 step diamonds", document.querySelectorAll("[data-open-step]").length >= 4, "found " + document.querySelectorAll("[data-open-step]").length);
  check("home shows the About film in the About section", !!document.querySelector('#about [data-film="about"] video') && document.querySelector('#about [data-film="about"] source').getAttribute("type") === "video/mp4");
  check("home shows the 3 sample testimonials marked as placeholders", document.getElementById("app").textContent.indexOf("sample placeholder quotes") !== -1 && document.getElementById("app").textContent.indexOf("handled everything with absolute care") !== -1);
  check("home shows the quote form", !!document.getElementById("quote-form"));
  check("quote form service dropdown lists all 4 services", document.querySelectorAll("#q-service option").length === 4, "found " + document.querySelectorAll("#q-service option").length);
  check("footer shows SwiftShift Movers by Interlinkz", document.body.textContent.indexOf("SwiftShift Movers by Interlinkz") !== -1);
  check("contact details are marked Not provided yet", (document.body.textContent.match(/Not provided yet/g) || []).length >= 3);

  // Every service detail page, by direct click (state first).
  const serviceIds = ["home-shifting", "office-shifting", "packing-and-unpacking", "loading-and-transport"];
  const filmKeys = { "home-shifting": "home", "office-shifting": "office", "packing-and-unpacking": "packing", "loading-and-transport": "loading" };
  for (const id of serviceIds) {
    const btn = document.querySelector('.card-links [data-open-service="' + id + '"]');
    check("service card has a View Details button for " + id, !!btn);
    if (!btn) continue;
    click(window, btn);
    const name = serviceNames[serviceIds.indexOf(id)];
    await waitFor(() => document.getElementById("app").textContent.indexOf("What is included") !== -1, 3000, "detail page for " + id);
    const appText = document.getElementById("app").textContent;
    const ok = appText.indexOf(name) !== -1 &&
      appText.indexOf("What is included") !== -1 &&
      appText.indexOf("Home") !== -1 &&
      !!document.querySelector(".detail-banner img") &&
      document.querySelectorAll(".gallery img").length === 3 &&
      !!document.querySelector('[data-film="' + filmKeys[id] + '"] video');
    check("service detail page opens in full for " + name + " (photo, gallery of 3, film, includes)", ok);
    check("detail page URL is mirrored with pushState for " + id, window.location.pathname === "/service/" + id, window.location.pathname);
    const back = document.querySelector("[data-back]");
    if (back) click(window, back);
    await waitFor(() => !!document.getElementById("quote-form"), 3000, "back to home after " + id);
  }

  // Every step detail page, by clicking the homepage diamonds.
  const stepIds = ["book-a-quote", "we-pack-and-load", "safe-transport", "unpack-and-settle-in"];
  const stepNames = ["Book a Quote", "We Pack and Load", "Safe Transport", "Unpack and Settle In"];
  for (let i = 0; i < stepIds.length; i++) {
    const diamond = document.querySelector('[data-open-step="' + stepIds[i] + '"]');
    check("home has a diamond for step " + stepIds[i], !!diamond);
    if (!diamond) continue;
    click(window, diamond);
    await waitFor(() => document.getElementById("app").textContent.indexOf("What happens") !== -1, 3000, "step page for " + stepIds[i]);
    const appText = document.getElementById("app").textContent;
    check("step detail page opens in full for " + stepNames[i], appText.indexOf(stepNames[i]) !== -1 && appText.indexOf("What happens") !== -1 && appText.indexOf("Related service") !== -1 && !!document.querySelector(".detail-banner img"));
    const backHow = document.querySelector("[data-back-how]");
    if (backHow) click(window, backHow);
    await waitFor(() => document.getElementById("app").textContent.indexOf("How It Works") !== -1, 3000, "how page after " + stepIds[i]);
    const homeCrumb = document.querySelector("[data-nav-home]");
    if (homeCrumb) click(window, homeCrumb);
    await waitFor(() => !!document.getElementById("quote-form"), 3000, "home after step " + stepIds[i]);
  }

  // Header search: empty lists all 4 services.
  click(window, document.getElementById("search-toggle-btn"));
  await waitFor(() => document.getElementById("search-bar").classList.contains("open"), 2000, "search bar to open");
  check("search toggle opens the search bar", document.getElementById("search-bar").classList.contains("open"));
  await waitFor(() => document.querySelectorAll("#search-results .search-hit").length === 4, 3000, "empty search suggestions");
  check("empty search lists all 4 services with photos", document.querySelectorAll("#search-results .search-hit").length === 4 && !!document.querySelector("#search-results img"));
  setInput(window, document.getElementById("site-search"), "office");
  await waitFor(() => document.getElementById("search-results").textContent.indexOf("Office Shifting") !== -1 && document.querySelectorAll("#search-results .search-hit").length === 1, 3000, "office suggestion");
  check("search office filters to exactly Office Shifting", document.querySelectorAll("#search-results .search-hit").length === 1 && document.getElementById("search-results").textContent.indexOf("Office Shifting") !== -1);
  submitForm(window, document.getElementById("site-search-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Showing 1 result") !== -1, 3000, "search results page");
  check("search page shows 1 result for office", document.getElementById("app").textContent.indexOf("Showing 1 result") !== -1);

  // A search suggestion opens the full detail page.
  const hit = document.querySelector('#app [data-open-service="office-shifting"]');
  if (hit) click(window, hit);
  await waitFor(() => document.getElementById("app").textContent.indexOf("What is included") !== -1, 3000, "office detail from search");
  check("search result opens the Office Shifting detail page", document.getElementById("app").textContent.indexOf("What is included") !== -1);
  const back2 = document.querySelector("[data-back]");
  if (back2) click(window, back2);
  await waitFor(() => !!document.getElementById("quote-form"), 3000, "back home for quote");

  // Quote form: preselect from a detail page first.
  const ltBtn = document.querySelector('.card-links [data-open-service="loading-and-transport"]');
  if (ltBtn) click(window, ltBtn);
  await waitFor(() => !!document.querySelector('[data-goto-quote="loading-and-transport"]'), 3000, "loading detail quote button");
  click(window, document.querySelector('[data-goto-quote="loading-and-transport"]'));
  await waitFor(() => !!document.getElementById("quote-form"), 3000, "quote form after detail");
  check("detail page Get a Quote preselects Loading and Transport", document.getElementById("q-service").value === "loading-and-transport", document.getElementById("q-service").value);
  document.getElementById("q-service").value = "home-shifting";
  setInput(window, document.getElementById("q-name"), "DOM Test");
  setInput(window, document.getElementById("q-phone"), "03001234567");
  setInput(window, document.getElementById("q-from"), "DOM From Street");
  setInput(window, document.getElementById("q-to"), "DOM To Street");
  document.getElementById("q-date").value = "2026-12-06";
  submitForm(window, document.getElementById("quote-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Quote requested") !== -1, 5000, "quote confirmation");
  check("quote form saves and shows Quote requested", document.getElementById("app").textContent.indexOf("Quote requested") !== -1);
  check("quote confirmation shows an SS reference", /SS-\d+/.test(document.getElementById("app").textContent));

  // Contact form.
  setInput(window, document.getElementById("ct-name"), "DOM Test");
  setInput(window, document.getElementById("ct-contact"), "dom-test@example.com");
  setInput(window, document.getElementById("ct-message"), "This is a DOM verification message.");
  submitForm(window, document.getElementById("contact-form"));
  await waitFor(() => document.getElementById("app").textContent.indexOf("Message sent") !== -1, 5000, "contact sent");
  check("contact form shows Message sent", document.getElementById("app").textContent.indexOf("Message sent") !== -1);

  // Newsletter.
  setInput(window, document.getElementById("newsletter-email"), "dom-news-" + Date.now() + "@example.com");
  submitForm(window, document.getElementById("newsletter-form"));
  await waitFor(() => document.getElementById("newsletter-done").textContent.indexOf("You are on the list") !== -1, 5000, "newsletter confirmation");
  check("newsletter shows You are on the list", document.getElementById("newsletter-done").textContent.indexOf("You are on the list") !== -1);

  // About page through its button.
  const aboutBtn = document.querySelector('[data-nav-page="about"]');
  if (aboutBtn) click(window, aboutBtn);
  await waitFor(() => document.getElementById("app").textContent.indexOf("We Move Your World With Care") !== -1, 3000, "about page");
  check("About page shows We Move Your World With Care, its film and by Interlinkz", document.getElementById("app").textContent.indexOf("We Move Your World With Care") !== -1 && !!document.querySelector('[data-film="about"] video') && document.getElementById("app").textContent.indexOf("by Interlinkz") !== -1);

  // Mobile menu drawer.
  click(window, document.getElementById("menu-open-btn"));
  await waitFor(() => document.getElementById("drawer").classList.contains("open"), 2000, "drawer opens");
  const drawerText = (document.querySelector(".drawer-panel") || {}).textContent || "";
  check("menu drawer lists About Us, Get a Quote, Contact and Admin Panel", drawerText.indexOf("About Us") !== -1 && drawerText.indexOf("Get a Quote") !== -1 && drawerText.indexOf("Contact") !== -1 && drawerText.indexOf("Admin Panel") !== -1);

  check("no jsdom errors were recorded", dom.errors.length === 0, dom.errors.join("; "));

  window.close();

  // Admin Panel in its own DOM.
  const adminDom = await makeDom("/admin.html");
  const aWindow = adminDom.window;
  const aDocument = aWindow.document;
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Set up the Admin Panel") !== -1, 5000, "admin setup form");
  check("Admin Panel shows first-use setup", aDocument.getElementById("admin-root").textContent.indexOf("Set up the Admin Panel") !== -1);
  aDocument.getElementById("admin-email").value = "dom-admin@example.com";
  aDocument.getElementById("admin-password").value = "dom-pass-123";
  submitForm(aWindow, aDocument.getElementById("admin-auth-form"));
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Quote Requests") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Messages") !== -1, 5000, "admin dashboard");
  check("Admin Panel dashboard shows Quote Requests, Messages and Subscribers stats", aDocument.getElementById("admin-root").textContent.indexOf("Quote Requests") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Messages") !== -1 && aDocument.getElementById("admin-root").textContent.indexOf("Subscribers") !== -1);
  check("Admin Panel dashboard lists the saved quote", /SS-\d+/.test(aDocument.getElementById("admin-root").textContent));

  // Wrong password is rejected on the sign in form.
  click(aWindow, aDocument.getElementById("sign-out-btn"));
  await waitFor(() => aDocument.getElementById("admin-root").textContent.indexOf("Admin sign in") !== -1, 5000, "admin sign in form");
  aDocument.getElementById("admin-email").value = "dom-admin@example.com";
  aDocument.getElementById("admin-password").value = "wrong-password";
  submitForm(aWindow, aDocument.getElementById("admin-auth-form"));
  await waitFor(() => {
    const err = aDocument.getElementById("admin-error");
    return err && err.style.display !== "none" && err.textContent.length > 0;
  }, 5000, "wrong password error");
  check("Admin Panel shows an error for a wrong password", (aDocument.getElementById("admin-error") || {}).textContent.indexOf("Wrong email or password") !== -1);
  aWindow.close();

  console.log("\n" + checks + " checks, " + failures + " failed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("DOM check failed:", err.message);
  process.exit(1);
});
