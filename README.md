# SwiftShift Movers, backend rebuild

A portable Express and MySQL rebuild of the SwiftShift Movers
shifting service landing page, ready to deploy as a live website with
a real backend and Admin Panel.

## Design

Design 03, Dark Charcoal and Yellow Road-and-Truck, from the
SwiftShift Movers design stage: dark charcoal page, safety yellow
road markings, chevrons and dashed route lines, dusk truck hero,
hero line "On the Road to Your New Home", and How It Works as four
yellow diamond road signs.

The landing page has 7 sections in order:

1. Hero and Homepage, "On the Road to Your New Home", Book a Shift button
2. Our Services, 4 services: Home Shifting, Office Shifting, Packing and Unpacking, Loading and Transport
3. How It Works, 4 steps as yellow diamond road signs: 01 Book a Quote, 02 We Pack and Load, 03 Safe Transport, 04 Unpack and Settle In
4. About Us, "We Move Your World With Care", with the About film visible in the section
5. Customer Testimonials, "What Our Clients Say", 3 cards, clearly marked as sample placeholder quotes
6. Get a Quote Form, yellow panel "Get a Free Quote": Name, Phone, Moving From, Moving To, Moving Date, Service Type
7. Contact, "Get in Touch" message form, footer with newsletter signup, Admin Panel link and Interlinkz branding

Every service has a full detail page (big photo, 3 picture gallery,
its own film, includes list, step links, Get a Quote with that
service preselected) and every How It Works step has a full detail
page (photo, description, what happens list, related service, quote
button). There are also dedicated About and How It Works pages.
Navigation is state first: a click sets the page in app state and
renders at once, and the URL is only mirrored with pushState, never
hash only routing. Opening animation with "by Interlinkz" and Skip
intro. Interlinkz appears on the opening animation, the footer brand
block and the bottom strip ("SwiftShift Movers by Interlinkz").
Header search covers service name and description with live photo
suggestions, and an empty search lists all 4 services. Content is
fully visible on load, animations are never gated on
prefers-reduced-motion, and there is no em dash anywhere and no
banned filler phrases.

Contact phone, email and address were Not provided yet by the client
and are shown only as clearly marked placeholders, never as real
details. Testimonials are sample placeholder quotes, marked as such.
No prices, ratings or statistics are shown, because none were
provided.

## Photo and film provenance

The 15 photos (hero, 4 services, About, 4 steps, 5 film posters) are
stock photos and film frames sourced for the same subjects they
show. See `PHOTO-SOURCES.md` for every source. They are not photos of
the real business, crew or customers, and they will not be
byte-identical to the Muse artifact photos, because matching stock
photos and frames were sourced for this rebuild instead.

The 5 films use real stock footage (Pexels and Mixkit) for the same
subjects as the canonical site films. Each MP4 carries its OWN
distinct synthesized soundtrack inside the file, composed with
`scripts/make-soundtracks.py`. Each film is declared as video/mp4
with a typed source, a poster, play and pause, Sound On and Off
(Sound On unmutes and starts the film) and a volume slider that
defaults to 80 percent.

Measured on the final MP4 files, 2026-11-22 (audio extracted and
measured after AAC encoding):

| Film | Duration | Soundtrack | RMS | Peak | Energy 400 to 2000 Hz | Below 150 Hz |
|---|---|---|---|---|---|---|
| About | 13.1 s | Calm track | -15.1 dB | -2.4 dB | 96.4% | 0.02% |
| Home Shifting | 6.9 s | Friendly light track | -15.0 dB | -2.5 dB | 84.2% | 0.08% |
| Office Shifting | 14.0 s | Calm professional track | -15.0 dB | -3.8 dB | 86.0% | 0.00% |
| Packing and Unpacking | 11.3 s | Warm steady rhythm | -15.0 dB | -1.3 dB | 96.7% | 0.05% |
| Loading and Transport | 7.8 s | Road feel track | -15.0 dB | -2.5 dB | 97.1% | 0.03% |

A headless check cannot hear audio, so audibility rests on these
measured numbers plus verified unmuted state. The owner should
listen to each film herself to confirm the tracks sound distinct.

## Backend

Node.js with Express and MySQL (mysql2). The frontend is served from
`public/`, and the API is at `/api/*`.

MySQL tables, in `db/schema.sql`:

- `services`: the 4 services, seeded from `db/seed-services.json`
- `steps`: the 4 How It Works steps, seeded from `db/seed-services.json`
- `quote_requests`: quote form submissions, numbers SS-1001 onward
- `subscribers`: newsletter signups
- `messages`: contact form messages
- `admins`: Admin Panel accounts, scrypt salted password hashes
- `sessions`: 30 day admin session tokens

Table creation and seeding run on module load (server.js calls the
shared setup as soon as it is required, not only under a direct run
guard), the setup is idempotent, and the first data request
re-checks the seed if the services list is empty (self heal in
`src/db.js`).

API endpoints:

- `GET /api/health` (returns ok true and app swiftshift-backend)
- `GET /api/services`, `GET /api/services/:id`
- `GET /api/steps`, `GET /api/steps/:id`
- `POST /api/quotes` (name, phone, moving from, moving to, moving date YYYY-MM-DD, service type, all server validated, invalid returns 400)
- `POST /api/newsletter`
- `POST /api/contact`
- `GET /api/admin/status`, `POST /api/admin/setup`, `POST /api/admin/signin`, `POST /api/admin/signout`
- `GET /api/admin/data`, `PATCH /api/admin/quotes/:id`, `PATCH /api/admin/messages/:id`

Admin Panel is at `/admin.html`. First use, the owner sets her own
email and password (at least 8 characters). A second setup is
refused, a wrong password is rejected. The panel shows live stats
for Quote Requests, Messages and Subscribers, with tabs for each,
and quote and message status changes persist.

## Environment

All credentials come from environment variables only, never from
hardcoded values. Copy `.env.example` to `.env` and fill it in.

- `PORT` (default 3002)
- `DB_HOST` (default 127.0.0.1)
- `DB_PORT` (default 3306)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

`.env` is gitignored and must not be committed.

## Run locally

```bash
npm install
cp .env.example .env   # fill in your own database user and password
mysql -u root -e "CREATE DATABASE IF NOT EXISTS swiftshift CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
node server.js
```

Then open http://127.0.0.1:3002 and http://127.0.0.1:3002/admin.html.

## Verify

```bash
node scripts/verify.js    # API end to end check against the running server
node scripts/dom-check.js # jsdom DOM execution check against the running server
```

Results on 2026-11-22, local MariaDB 10.11, clean database, server
on port 3002:

- verify.js: 62 checks, 0 failed.
- dom-check.js: 51 checks, 0 failed.
- Module load test: requiring server.js without starting it created
  the tables and seeded 4 services and 4 steps on its own.

Local test data was cleared after verification: 0 quote requests, 0
messages, 0 subscribers, 0 admins, and the local `.env` was removed.

## Deploy to Hostinger

1. Push this project to a GitHub repo named `swiftshift-backend`
   (the repo must be created first if it does not exist).
2. In Hostinger hPanel, create a Web App with Node.js 22, pointing at
   the repo, start command `node server.js`, on a new temporary
   domain.
3. Create a MySQL database and user in hPanel, then set the
   environment variables in the Web App: `PORT`, `DB_HOST`,
   `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
4. After the first deploy, open the live site and the Admin Panel,
   submit a test quote and check the Admin Panel shows it, then
   clear the test data.

## Still open

- Real rendered browser check at 390px on the live site, after the
  Hostinger deploy (the jsdom DOM check and the API check above cover
  this build locally; neither replaces the owner real phone check).
- GitHub push, Hostinger Web App and MySQL setup, then a live end to
  end verification before any link is sent.
