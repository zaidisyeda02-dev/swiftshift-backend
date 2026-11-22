"use strict";

/* End to end check for the SwiftShift Movers backend rebuild. Run the
   server first (node server.js), then run: node scripts/verify.js
   It uses only the public API and pages, the same way a visitor and
   the owner would. It exits non-zero if any check fails. Run it on a
   clean database so the first quote is SS-1001. */

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

async function req(path, options) {
  const res = await fetch(BASE + path, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}

async function main() {
  const health = await req("/api/health");
  check("health endpoint", health.status === 200 && health.json && health.json.ok === true && health.json.app === "swiftshift-backend", health.text.slice(0, 100));

  const home = await req("/");
  check("home page loads", home.status === 200 && home.text.indexOf('id="app"') !== -1 && home.text.indexOf('src="/app.js"') !== -1, "status " + home.status);
  check("home page has Admin Panel link", home.text.indexOf("Admin Panel") !== -1);
  check("home page has no cart or checkout", home.text.toLowerCase().indexOf("checkout") === -1 && home.text.toLowerCase().indexOf("add to bag") === -1);
  check("home page has no em dash", home.text.indexOf("—") === -1);

  const adminPage = await req("/admin.html");
  check("admin page loads", adminPage.status === 200 && adminPage.text.indexOf("Admin Panel") !== -1, "status " + adminPage.status);

  const services = await req("/api/services");
  check("services endpoint returns 4", services.status === 200 && Array.isArray(services.json) && services.json.length === 4, services.status + " count " + (services.json && services.json.length));
  const byId = {};
  if (Array.isArray(services.json)) {
    for (const s of services.json) byId[s.id] = s;
  }
  check("4 service names match Design 03",
    byId["home-shifting"] && byId["home-shifting"].name === "Home Shifting" &&
    byId["office-shifting"] && byId["office-shifting"].name === "Office Shifting" &&
    byId["packing-and-unpacking"] && byId["packing-and-unpacking"].name === "Packing and Unpacking" &&
    byId["loading-and-transport"] && byId["loading-and-transport"].name === "Loading and Transport");
  check("every service has image, gallery of 3, film, poster, description and includes list",
    Array.isArray(services.json) && services.json.every((s) =>
      s.image && s.image.indexOf("/images/") === 0 && s.focal && s.description &&
      Array.isArray(s.gallery) && s.gallery.length === 3 &&
      Array.isArray(s.includes) && s.includes.length >= 3 && s.goodToKnow &&
      s.film && s.film.indexOf("/videos/") === 0 && s.poster));

  const detail = await req("/api/services/loading-and-transport");
  check("service detail endpoint", detail.status === 200 && detail.json && detail.json.name === "Loading and Transport");
  check("unknown service returns 404", (await req("/api/services/no-such-service")).status === 404);

  const steps = await req("/api/steps");
  check("steps endpoint returns 4", steps.status === 200 && Array.isArray(steps.json) && steps.json.length === 4, steps.status + " count " + (steps.json && steps.json.length));
  const sById = {};
  if (Array.isArray(steps.json)) {
    for (const s of steps.json) sById[s.id] = s;
  }
  check("4 step names and numbers match Design 03",
    sById["book-a-quote"] && sById["book-a-quote"].number === "01" && sById["book-a-quote"].name === "Book a Quote" &&
    sById["we-pack-and-load"] && sById["we-pack-and-load"].number === "02" &&
    sById["safe-transport"] && sById["safe-transport"].number === "03" &&
    sById["unpack-and-settle-in"] && sById["unpack-and-settle-in"].number === "04" && sById["unpack-and-settle-in"].name === "Unpack and Settle In");
  check("every step has image, description, happens list and a known related service",
    Array.isArray(steps.json) && steps.json.every((s) =>
      s.image && s.description && Array.isArray(s.happens) && s.happens.length >= 3 && byId[s.relatedService]));
  check("unknown step returns 404", (await req("/api/steps/no-such-step")).status === 404);

  const images = [
    "/images/hero.jpg", "/images/home-shifting.jpg", "/images/office-shifting.jpg",
    "/images/packing.jpg", "/images/loading.jpg", "/images/about.jpg",
    "/images/step-book.jpg", "/images/step-pack.jpg", "/images/step-transport.jpg", "/images/step-unpack.jpg",
    "/images/poster-about.jpg", "/images/poster-home.jpg", "/images/poster-office.jpg",
    "/images/poster-packing.jpg", "/images/poster-loading.jpg",
  ];
  for (const img of images) {
    const r = await req(img);
    check("image serves " + img, r.status === 200 && r.text.length > 5000, "status " + r.status + " bytes " + r.text.length);
  }

  const films = ["/videos/film-about.mp4", "/videos/film-home.mp4", "/videos/film-office.mp4", "/videos/film-packing.mp4", "/videos/film-loading.mp4"];
  for (const film of films) {
    const res = await fetch(BASE + film, { headers: { Range: "bytes=0-1023" } });
    check("film serves " + film, (res.status === 200 || res.status === 206), "status " + res.status);
  }

  const quoteBody = {
    name: "Verify Test",
    phone: "03001234567",
    movingFrom: "Karachi Clifton",
    movingTo: "Karachi DHA",
    movingDate: "2026-12-05",
    serviceId: "home-shifting",
  };
  const quote = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quoteBody),
  });
  check("quote saves a request", quote.status === 201 && quote.json && /^SS-\d+$/.test(quote.json.quoteNumber), quote.status + " " + quote.text.slice(0, 120));
  check("quote number is SS-1001 on a clean database", quote.json && quote.json.quoteNumber === "SS-1001", "got " + (quote.json && quote.json.quoteNumber));
  check("quote returns the booked service name", quote.json && quote.json.serviceName === "Home Shifting");

  const badService = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, quoteBody, { serviceId: "no-such-service" })),
  });
  check("unknown service is rejected with 400", badService.status === 400);
  const badPhone = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, quoteBody, { phone: "123" })),
  });
  check("short phone is rejected with 400", badPhone.status === 400);
  const badDate = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, quoteBody, { movingDate: "05-12-2026" })),
  });
  check("bad date format is rejected with 400", badDate.status === 400);
  const fakeDate = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, quoteBody, { movingDate: "2026-02-30" })),
  });
  check("impossible date is rejected with 400", fakeDate.status === 400);
  const noFrom = await req("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, quoteBody, { movingFrom: "" })),
  });
  check("missing moving from is rejected with 400", noFrom.status === 400);

  const newsEmail = "verify-" + Date.now() + "@example.com";
  const news = await req("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: newsEmail }),
  });
  check("newsletter saves", news.status === 200 && news.json && news.json.subscribed);
  const newsAgain = await req("/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: newsEmail }),
  });
  check("newsletter duplicate is reported, not an error", newsAgain.status === 200 && newsAgain.json && newsAgain.json.already === true);

  const contact = await req("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Verify Test", contact: "verify@example.com", message: "This is a verification message." }),
  });
  check("contact message saves", contact.status === 201 && contact.json && contact.json.saved);

  const status = await req("/api/admin/status");
  check("admin status endpoint", status.status === 200 && typeof status.json.hasAdmin === "boolean", JSON.stringify(status.json));

  const email = "admin-" + Date.now() + "@example.com";
  let token = null;
  if (status.json && !status.json.hasAdmin) {
    const shortPass = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "short" }),
    });
    check("admin setup with a short password is refused", shortPass.status === 400);
    const setup = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "verify-pass-123" }),
    });
    check("admin first use setup", setup.status === 201 && setup.json && setup.json.token, setup.status + " " + setup.text.slice(0, 120));
    token = setup.json && setup.json.token;
    const second = await req("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "other@example.com", password: "verify-pass-123" }),
    });
    check("second admin setup is refused", second.status === 409);
  } else {
    console.log("NOTE  admin already exists in this database, setup checks skipped");
  }

  const wrong = await req("/api/admin/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  if (token) check("wrong admin password is rejected", wrong.status === 401);

  if (token) {
    const ok = await req("/api/admin/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "verify-pass-123" }),
    });
    check("correct admin password signs in", ok.status === 200 && ok.json && ok.json.token);
    token = ok.json.token;
  }

  const noAuth = await req("/api/admin/data");
  check("admin data without a token is refused", noAuth.status === 401);

  if (token) {
    const data = await req("/api/admin/data", {
      headers: { Authorization: "Bearer " + token },
    });
    check("admin data loads", data.status === 200 && data.json && data.json.stats, data.status);
    check("admin stats count the saved quote, message and subscriber",
      data.json && data.json.stats.quotes >= 1 && data.json.stats.messages >= 1 && data.json.stats.subscribers >= 1,
      JSON.stringify(data.json && data.json.stats));
    const firstQuote = data.json && data.json.quotes && data.json.quotes[0];
    check("admin data lists the SS-1001 quote", firstQuote && firstQuote.quote_number === "SS-1001");
    check("admin quote row carries the route and service",
      firstQuote && firstQuote.moving_from === "Karachi Clifton" && firstQuote.moving_to === "Karachi DHA" && firstQuote.service_name === "Home Shifting");
    if (firstQuote) {
      const patch = await req("/api/admin/quotes/" + firstQuote.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: "Contacted" }),
      });
      check("quote status change saves", patch.status === 200);
      const again = await req("/api/admin/data", {
        headers: { Authorization: "Bearer " + token },
      });
      const same = again.json.quotes.find((a) => a.id === firstQuote.id);
      check("quote status change persists", same && same.status === "Contacted");
    }
    const firstMessage = data.json && data.json.messages && data.json.messages[0];
    if (firstMessage) {
      const patch = await req("/api/admin/messages/" + firstMessage.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: "Read" }),
      });
      check("message status change saves", patch.status === 200);
    }
    const signout = await req("/api/admin/signout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({}),
    });
    check("admin sign out works", signout.status === 200);
    const afterOut = await req("/api/admin/data", {
      headers: { Authorization: "Bearer " + token },
    });
    check("signed out token is refused", afterOut.status === 401);
  }

  console.log("\n" + checks + " checks, " + failures + " failed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("Verify run failed:", err.message);
  process.exit(1);
});
