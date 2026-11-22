"use strict";

/* SwiftShift Movers backend. Express serves the movers frontend from
   public/ and provides the JSON API the site and the Admin Panel use.
   The same app serves the pages and the API, so a Hostinger Node Web
   App runs it as one process. Entry file: server.js. Start:
   node server.js. */

require("dotenv").config();

const path = require("path");
const express = require("express");
const db = require("./src/db");
const auth = require("./src/auth");

const app = express();
const PORT = Number(process.env.PORT || "3000");

/* Table creation and seeding run on module load, not only when this
   file is run directly, because a host can load the server as a
   module and a direct run guard would then leave the tables
   uncreated. The promise is shared and idempotent, and the first
   data request re-checks the seed (see src/db.js ensureSeeded). */
const ready = db.ensureInit();
ready.catch((err) => {
  // eslint-disable-next-line no-console
  console.error("SwiftShift Movers database setup failed:", err.message);
});

app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

function isEmail(value) {
  return typeof value === "string" && value.indexOf("@") > 0 && value.indexOf(".") > value.indexOf("@");
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function sendError(res, err) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

/* Wait for the module load setup before any data route answers. */
app.use("/api", async (req, res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "swiftshift-backend" });
});

app.get("/api/services", async (req, res) => {
  try {
    res.json(await db.getServices());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/services/:id", async (req, res) => {
  try {
    const service = await db.getService(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/steps", async (req, res) => {
  try {
    res.json(await db.getSteps());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/steps/:id", async (req, res) => {
  try {
    const step = await db.getStep(req.params.id);
    if (!step) return res.status(404).json({ error: "Step not found" });
    res.json(step);
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/quotes", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const movingFrom = String(body.movingFrom || "").trim();
    const movingTo = String(body.movingTo || "").trim();
    const movingDate = String(body.movingDate || "").trim();
    const serviceId = String(body.serviceId || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (phone.replace(/[^0-9]/g, "").length < 7) return res.status(400).json({ error: "Please enter a phone number." });
    if (movingFrom.length < 2) return res.status(400).json({ error: "Please tell us where you are moving from." });
    if (movingTo.length < 2) return res.status(400).json({ error: "Please tell us where you are moving to." });
    if (!isRealDate(movingDate)) return res.status(400).json({ error: "Please choose a valid moving date." });
    if (!serviceId) return res.status(400).json({ error: "Please choose a service." });
    const saved = await db.createQuote({ name, phone, movingFrom, movingTo, movingDate, serviceId });
    res.status(201).json(saved);
  } catch (err) {
    if (err && /Unknown service/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    res.json(await db.subscribe(email));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const contact = String(body.contact || "").trim();
    const message = String(body.message || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (message.length < 4) return res.status(400).json({ error: "Please write a short message." });
    res.status(201).json(await db.saveMessage(name, contact, message));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/status", async (req, res) => {
  try {
    res.json({ hasAdmin: await auth.hasAdmin() });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/setup", async (req, res) => {
  try {
    const body = req.body || {};
    const token = await auth.setupAdmin(
      String(body.email || "").trim().toLowerCase(),
      String(body.password || "")
    );
    res.status(201).json({ token });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/signin", async (req, res) => {
  try {
    const body = req.body || {};
    const token = await auth.signIn(
      String(body.email || "").trim().toLowerCase(),
      String(body.password || "")
    );
    res.json({ token });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/admin/signout", auth.requireAdmin, async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    await auth.signOut(header.slice(7));
    res.json({ signedOut: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/admin/data", auth.requireAdmin, async (req, res) => {
  try {
    res.json(await db.getAdminData());
  } catch (err) {
    sendError(res, err);
  }
});

app.patch("/api/admin/quotes/:id", auth.requireAdmin, async (req, res) => {
  try {
    await db.setQuoteStatus(Number(req.params.id), String((req.body || {}).status || ""));
    res.json({ updated: true });
  } catch (err) {
    if (err && /Bad quote status/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

app.patch("/api/admin/messages/:id", auth.requireAdmin, async (req, res) => {
  try {
    await db.setMessageStatus(Number(req.params.id), String((req.body || {}).status || ""));
    res.json({ updated: true });
  } catch (err) {
    if (err && /Bad message status/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sendError(res, err);
  }
});

/* Site pages are rendered by the single page app, so any other page
   request serves the site. API routes above are matched first. */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  await ready;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log("SwiftShift Movers backend listening on port " + PORT);
  });
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("SwiftShift Movers backend could not start:", err.message);
    process.exit(1);
  });
}

module.exports = app;
