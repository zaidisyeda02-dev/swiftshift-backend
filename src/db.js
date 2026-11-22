"use strict";

/* MySQL access for SwiftShift Movers. Credentials come only from
   environment variables, never from code. On Hostinger these are set
   in the Node Web App settings. Locally they come from a .env file
   or the shell. */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function config() {
  const dbName = env("DB_NAME", "");
  if (!dbName) {
    throw new Error(
      "DB_NAME is not set. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME before starting."
    );
  }
  return {
    host: env("DB_HOST", "127.0.0.1"),
    port: Number(env("DB_PORT", "3306")),
    user: env("DB_USER", ""),
    password: env("DB_PASSWORD", ""),
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

let pool = null;

function getPool() {
  if (!pool) pool = mysql.createPool(config());
  return pool;
}

async function query(sql, params) {
  const rows = await getPool().execute(sql, params || []);
  return rows[0];
}

/* Create the tables if they do not exist, then seed the 4 services
   and 4 steps from db/seed-services.json when those tables are empty.
   Production starts empty for quote requests, subscribers, messages
   and admins. Safe to call again: existing tables and rows are kept. */
async function initDb() {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await getPool().query(statement);
  }
  const seedPath = path.join(__dirname, "..", "db", "seed-services.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const serviceCount = await query("SELECT COUNT(*) AS n FROM services");
  if (serviceCount[0].n === 0) {
    for (let i = 0; i < seed.services.length; i++) {
      const s = seed.services[i];
      await query(
        "INSERT INTO services (id, name, short, description, includes, good_to_know, image, gallery, film, poster, focal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          s.id,
          s.name,
          s.short,
          s.description,
          JSON.stringify(s.includes),
          s.goodToKnow,
          s.image,
          JSON.stringify(s.gallery),
          s.film,
          s.poster,
          s.focal,
          i + 1,
        ]
      );
    }
  }
  const stepCount = await query("SELECT COUNT(*) AS n FROM steps");
  if (stepCount[0].n === 0) {
    for (let i = 0; i < seed.steps.length; i++) {
      const st = seed.steps[i];
      await query(
        "INSERT INTO steps (id, number, name, short, description, happens, image, related_service, focal, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          st.id,
          st.number,
          st.name,
          st.short,
          st.description,
          JSON.stringify(st.happens),
          st.image,
          st.relatedService,
          st.focal,
          i + 1,
        ]
      );
    }
  }
}

/* Self heal: if a host loaded this module without the setup finishing
   (or the seed was lost), the first data request runs setup again
   when the services list is empty, then re-reads before answering. */
let initPromise = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = initDb().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function ensureSeeded() {
  await ensureInit();
  const rows = await query("SELECT COUNT(*) AS n FROM services");
  if (rows[0].n === 0) {
    initPromise = null;
    await ensureInit();
  }
}

/* mysql2 already parses JSON columns into values, while a stored JSON
   string would need parsing. Accept both so the code works either way. */
function asArray(value) {
  return Array.isArray(value) ? value : JSON.parse(value);
}

function rowToService(row) {
  return {
    id: row.id,
    name: row.name,
    short: row.short,
    description: row.description,
    includes: asArray(row.includes),
    goodToKnow: row.good_to_know,
    image: row.image,
    gallery: asArray(row.gallery),
    film: row.film,
    poster: row.poster,
    focal: row.focal,
  };
}

function rowToStep(row) {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    short: row.short,
    description: row.description,
    happens: asArray(row.happens),
    image: row.image,
    relatedService: row.related_service,
    focal: row.focal,
  };
}

async function getServices() {
  await ensureSeeded();
  const rows = await query("SELECT * FROM services ORDER BY sort_order ASC");
  return rows.map(rowToService);
}

async function getService(id) {
  await ensureSeeded();
  const rows = await query("SELECT * FROM services WHERE id = ?", [id]);
  return rows.length ? rowToService(rows[0]) : null;
}

async function getSteps() {
  await ensureSeeded();
  const rows = await query("SELECT * FROM steps ORDER BY sort_order ASC");
  return rows.map(rowToStep);
}

async function getStep(id) {
  await ensureSeeded();
  const rows = await query("SELECT * FROM steps WHERE id = ?", [id]);
  return rows.length ? rowToStep(rows[0]) : null;
}

/* Save a quote request. The service is always read from the database,
   never trusted from the request, so a changed service in the browser
   cannot book a service that does not exist. Quote numbers are
   SS-1001, SS-1002 and so on, from the row id. */
async function createQuote(quote) {
  const service = await getService(quote.serviceId);
  if (!service) throw new Error("Unknown service: " + quote.serviceId);
  const inserted = await query(
    "INSERT INTO quote_requests (name, phone, moving_from, moving_to, moving_date, service_id, service_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'New')",
    [
      quote.name,
      quote.phone,
      quote.movingFrom,
      quote.movingTo,
      quote.movingDate,
      service.id,
      service.name,
    ]
  );
  const id = inserted.insertId;
  const quoteNumber = "SS-" + (1000 + id);
  await query("UPDATE quote_requests SET quote_number = ? WHERE id = ?", [
    quoteNumber,
    id,
  ]);
  return { quoteNumber, serviceName: service.name };
}

async function subscribe(email) {
  try {
    await query("INSERT INTO subscribers (email) VALUES (?)", [email]);
    return { subscribed: true, already: false };
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return { subscribed: true, already: true };
    }
    throw err;
  }
}

async function saveMessage(name, contact, message) {
  await query(
    "INSERT INTO messages (name, contact, message, status) VALUES (?, ?, ?, 'New')",
    [name, contact, message]
  );
  return { saved: true };
}

async function getAdminData() {
  const statsRows = await query(
    "SELECT (SELECT COUNT(*) FROM quote_requests) AS quotes, (SELECT COUNT(*) FROM messages) AS messages, (SELECT COUNT(*) FROM subscribers) AS subscribers"
  );
  const quotes = await query(
    "SELECT id, quote_number, name, phone, moving_from, moving_to, moving_date, service_id, service_name, status, created_at FROM quote_requests ORDER BY id DESC"
  );
  const messages = await query(
    "SELECT id, name, contact, message, status, created_at FROM messages ORDER BY id DESC"
  );
  const subscribers = await query(
    "SELECT id, email, created_at FROM subscribers ORDER BY id DESC"
  );
  return {
    stats: {
      quotes: statsRows[0].quotes,
      messages: statsRows[0].messages,
      subscribers: statsRows[0].subscribers,
    },
    quotes,
    messages,
    subscribers,
  };
}

async function setQuoteStatus(id, status) {
  const allowed = ["New", "Contacted", "Quoted", "Booked", "Cancelled"];
  if (allowed.indexOf(status) === -1) throw new Error("Bad quote status");
  await query("UPDATE quote_requests SET status = ? WHERE id = ?", [status, id]);
}

async function setMessageStatus(id, status) {
  const allowed = ["New", "Read", "Replied"];
  if (allowed.indexOf(status) === -1) throw new Error("Bad message status");
  await query("UPDATE messages SET status = ? WHERE id = ?", [status, id]);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  config,
  query,
  initDb,
  ensureInit,
  getServices,
  getService,
  getSteps,
  getStep,
  createQuote,
  subscribe,
  saveMessage,
  getAdminData,
  setQuoteStatus,
  setMessageStatus,
  close,
};
