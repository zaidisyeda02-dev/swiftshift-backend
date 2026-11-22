"use strict";

/* SwiftShift Movers frontend. Single page app for the Design 03
   landing page: hero, services, how it works, about, testimonials,
   quote form and contact. Services and steps load from the API.
   Navigation is state first: a click sets the page in app state and
   renders at once, and the URL is only mirrored with pushState, so a
   detail page never depends on a hash change reaching the app.
   All storage access is guarded so the page can never crash on a
   blocked storage read. */

var INTRO_KEY = "swiftshift-intro-seen";

function storageGet(key) {
  try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { window.sessionStorage.setItem(key, value); } catch (e) {}
}

var services = [];
var steps = [];
var dataPromise = null;
var currentRoute = { page: "home" };
var pendingAnchor = null;
var pendingService = null;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(message) {
  var root = document.getElementById("toast-root");
  if (!root) return;
  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  root.appendChild(el);
  window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
}

function api(path, options) {
  var opts = options || {};
  opts.headers = { "Content-Type": "application/json" };
  return fetch(path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (body) {
      if (!r.ok) throw new Error(body.error || "Request failed");
      return body;
    });
  });
}

function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetch("/api/services").then(function (r) { return r.json(); }),
    fetch("/api/steps").then(function (r) { return r.json(); })
  ]).then(function (parts) {
    services = Array.isArray(parts[0]) ? parts[0] : [];
    steps = Array.isArray(parts[1]) ? parts[1] : [];
  }).catch(function () {
    services = [];
    steps = [];
  });
  return dataPromise;
}

function serviceById(id) {
  for (var i = 0; i < services.length; i++) if (services[i].id === id) return services[i];
  return null;
}
function stepById(id) {
  for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return steps[i];
  return null;
}

/* ---------- intro ---------- */
function showIntro() {
  var root = document.getElementById("intro-root");
  if (!root) return;
  if (storageGet(INTRO_KEY)) return;
  root.innerHTML =
    '<div class="intro" id="intro">' +
    '<p class="intro-word">SWIFTSHIFT<span>MOVERS</span></p>' +
    '<div class="intro-line"></div>' +
    '<p class="intro-tag">On the Road to Your New Home</p>' +
    '<p class="intro-by">by Interlinkz</p>' +
    '<button type="button" class="intro-skip" id="intro-skip">Skip intro</button>' +
    "</div>";
  var done = false;
  function dismiss() {
    if (done) return;
    done = true;
    storageSet(INTRO_KEY, "1");
    var el = document.getElementById("intro");
    if (el) {
      el.classList.add("lift");
      window.setTimeout(function () { root.innerHTML = ""; }, 650);
    } else {
      root.innerHTML = "";
    }
  }
  var skip = document.getElementById("intro-skip");
  if (skip) skip.addEventListener("click", dismiss);
  window.setTimeout(dismiss, 2600);
  window.setTimeout(function () { if (!done) dismiss(); }, 5000);
}

/* ---------- state first routing ---------- */
function scrollToTop() {
  var top = document.getElementById("top");
  if (top && top.scrollIntoView) top.scrollIntoView();
  try { window.scrollTo(0, 0); } catch (e) {}
  var main = document.getElementById("app");
  if (main) main.scrollTop = 0;
}

function pathFor(route) {
  if (route.page === "service") return "/service/" + route.id;
  if (route.page === "step") return "/step/" + route.id;
  if (route.page === "about") return "/about";
  if (route.page === "how") return "/how-it-works";
  if (route.page === "search") return "/search?q=" + encodeURIComponent(route.q || "");
  return "/";
}

function routeFromPath() {
  var path = window.location.pathname;
  var m = path.match(/^\/service\/([\w-]+)$/);
  if (m) return { page: "service", id: m[1] };
  m = path.match(/^\/step\/([\w-]+)$/);
  if (m) return { page: "step", id: m[1] };
  if (path === "/about") return { page: "about" };
  if (path === "/how-it-works") return { page: "how" };
  if (path === "/search") return { page: "search", q: new URLSearchParams(window.location.search).get("q") || "" };
  return { page: "home" };
}

function go(route, anchor) {
  currentRoute = route;
  pendingAnchor = anchor || null;
  try { window.history.pushState({}, "", pathFor(route)); } catch (e) {}
  render();
}

function goHome(anchor) {
  go({ page: "home" }, anchor || null);
}

/* ---------- films ---------- */
var FILMS = {
  about: { src: "/videos/film-about.mp4", poster: "/images/poster-about.jpg", name: "About film: movers loading a truck", track: "Calm track" },
  home: { src: "/videos/film-home.mp4", poster: "/images/poster-home.jpg", name: "Home Shifting film", track: "Friendly light track" },
  office: { src: "/videos/film-office.mp4", poster: "/images/poster-office.jpg", name: "Office Shifting film", track: "Calm professional track" },
  packing: { src: "/videos/film-packing.mp4", poster: "/images/poster-packing.jpg", name: "Packing and Unpacking film", track: "Warm steady rhythm" },
  loading: { src: "/videos/film-loading.mp4", poster: "/images/poster-loading.jpg", name: "Loading and Transport film", track: "Road feel track" }
};
var SERVICE_FILM = {
  "home-shifting": "home",
  "office-shifting": "office",
  "packing-and-unpacking": "packing",
  "loading-and-transport": "loading"
};

function filmHtml(key) {
  var f = FILMS[key];
  if (!f) return "";
  return '<div class="film" data-film="' + key + '">' +
    '<video preload="metadata" muted playsinline poster="' + f.poster + '" data-film-video>' +
    '<source src="' + f.src + '" type="video/mp4" /></video>' +
    '<div class="film-bar">' +
    '<button type="button" class="film-btn" data-film-play>Play</button>' +
    '<button type="button" class="film-btn" data-film-sound>Sound On</button>' +
    '<span class="film-name">' + esc(f.name) + '</span>' +
    '<label class="film-vol">Volume <input type="range" min="0" max="100" value="80" data-film-volume aria-label="Film volume" /></label>' +
    "</div>" +
    '<p class="film-note">Stock atmosphere footage. Soundtrack: ' + esc(f.track) + ', inside the film.</p></div>';
}

function wireFilms(scope) {
  scope.querySelectorAll("[data-film]").forEach(function (box) {
    var video = box.querySelector("[data-film-video]");
    var playBtn = box.querySelector("[data-film-play]");
    var soundBtn = box.querySelector("[data-film-sound]");
    var vol = box.querySelector("[data-film-volume]");
    if (!video) return;
    video.volume = 0.8;
    video.addEventListener("play", function () { playBtn.textContent = "Pause"; });
    video.addEventListener("pause", function () { playBtn.textContent = "Play"; });
    playBtn.addEventListener("click", function () {
      if (video.paused) { video.play(); } else { video.pause(); }
    });
    soundBtn.addEventListener("click", function () {
      if (video.muted) {
        video.muted = false;
        if (video.volume === 0) { video.volume = 0.8; vol.value = 80; }
        soundBtn.textContent = "Sound Off";
        if (video.paused) video.play();
      } else {
        video.muted = true;
        soundBtn.textContent = "Sound On";
      }
    });
    vol.addEventListener("input", function () {
      video.volume = Number(vol.value) / 100;
      if (video.volume > 0 && video.muted) {
        video.muted = false;
        soundBtn.textContent = "Sound Off";
        if (video.paused) video.play();
      }
      if (video.volume === 0) {
        video.muted = true;
        soundBtn.textContent = "Sound On";
      }
    });
  });
}

/* ---------- cards ---------- */
var SERVICE_ICONS = {
  "home-shifting": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 3l9 8.5" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-6h4v6" /></svg>',
  "office-shifting": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h3a1 1 0 0 1 1 1v11" /><path d="M2.5 21h19" /><path d="M7.5 7h3M7.5 11h3M7.5 15h3" /></svg>',
  "packing-and-unpacking": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></svg>',
  "loading-and-transport": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h12v11h-12z" /><path d="M14.5 10h4l3 3.5V17h-7" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></svg>'
};

function serviceCard(s) {
  return '<article class="card" data-open-service="' + esc(s.id) + '">' +
    '<div class="card-photo"><img src="' + esc(s.image) + '" alt="' + esc(s.name) + '" loading="lazy" style="object-position:' + esc(s.focal || "center 40%") + '" /></div>' +
    '<div class="card-body"><span class="card-ico" aria-hidden="true">' + (SERVICE_ICONS[s.id] || "") + "</span>" +
    "<h3>" + esc(s.name) + "</h3><p>" + esc(s.short) + "</p>" +
    '<div class="card-links"><button type="button" class="btn btn-yellow" data-open-service="' + esc(s.id) + '">View Details</button></div></div></article>';
}

function diamondHtml(st) {
  return '<button type="button" class="diamond-btn" data-open-step="' + esc(st.id) + '">' +
    '<span class="diamond"><span class="diamond-in"><span class="num">' + esc(st.number) + '</span><span class="nm">' + esc(st.name) + "</span></span></span>" +
    '<span class="step-open">Step details</span></button>';
}

var TESTIMONIALS = [
  "Fast, professional, and handled everything with absolute care.",
  "The team was incredible from start to finish.",
  "Outstanding service, they made our move completely stress free."
];

function homeHtml() {
  var serviceCards = services.map(serviceCard).join("");
  var diamonds = steps.map(diamondHtml).join("");
  var tCards = TESTIMONIALS.map(function (q) {
    return '<article class="tcard"><span class="mark" aria-hidden="true">&ldquo;</span><p>' + esc(q) + "</p></article>";
  }).join("");
  var serviceOptions = services.map(function (s) {
    var sel = pendingService === s.id ? " selected" : "";
    return '<option value="' + esc(s.id) + '"' + sel + ">" + esc(s.name) + "</option>";
  }).join("");
  return '' +
  '<div class="hero"><img class="hero-bg" src="/images/hero.jpg" alt="Yellow truck on the road at dusk" />' +
    '<div class="hero-shade"></div><div class="wrap"><div class="hero-inner ss-fade-up">' +
    '<h1><span class="y">On the Road</span> to<br />Your <span class="y">New Home</span></h1>' +
    '<p class="lead">Home and office shifting, packed, loaded and moved with care, from your old door to your new one.</p>' +
    '<button type="button" class="btn btn-yellow" data-goto-quote>Book a Shift</button>' +
    "</div></div></div>" +
  '<div class="road-line" aria-hidden="true"></div>' +
  '<section class="block" id="services"><div class="wrap"><h2 class="sec-title">Our Services</h2>' +
  '<p class="sec-sub">Four services, one careful crew.</p><div class="route-dash" aria-hidden="true"></div>' +
  '<div class="grid cols-4 ss-stagger">' + serviceCards + "</div></div></section>" +
  '<section class="block" id="how" style="background:var(--coal-2)"><div class="wrap"><h2 class="sec-title">How It Works</h2>' +
  '<p class="sec-sub">Four stops on the road to your new place. Select any sign for the full step page.</p>' +
  '<p class="chevrons" aria-hidden="true">&raquo;&raquo;&raquo;</p>' +
  '<div class="steps-row ss-stagger">' + diamonds + "</div>" +
  '<p style="text-align:center;margin-top:1.8rem"><button type="button" class="btn btn-outline" data-nav-page="how">How It Works in full</button></p>' +
  "</div></section>" +
  '<section class="block" id="about"><div class="wrap about-inner">' +
    '<div class="about-copy"><h2>About Us</h2><h3>We Move Your World With Care</h3>' +
    '<p>SwiftShift Movers is a home and office shifting service by Interlinkz. We pack, load, move and unpack houses, flats and offices, and we treat every box as if it were our own.</p>' +
    '<p>Every move starts with the quote form, so the crew, the truck and the plan are right before moving day begins.</p>' +
    '<button type="button" class="btn btn-outline" data-nav-page="about">More About Us</button></div>' +
    '<div><div class="about-photo"><img src="/images/about.jpg" alt="Mover carrying a box inside a moving truck" loading="lazy" /></div>' +
    '<p class="caption">Our crew at work, stock atmosphere photo.</p>' + filmHtml("about") + "</div>" +
  "</div></section>" +
  '<section class="block" id="stories" style="background:var(--coal-2)"><div class="wrap"><h2 class="sec-title">What Our Clients Say</h2>' +
  '<p class="sec-sub">Words from the road.</p>' +
  '<div class="grid cols-3 ss-stagger">' + tCards + "</div>" +
  '<p class="fine-note">These are sample placeholder quotes shown for layout. Real customer reviews have not been provided yet.</p>' +
  "</div></section>" +
  '<section class="block" id="quote"><div class="wrap"><div class="quote-panel">' +
  "<h2>Get a Free Quote</h2>" +
  '<p class="qsub">Tell us about your move and we will come back with a clear quote.</p>' +
  '<form id="quote-form" novalidate><div class="form-grid two">' +
  '<div><label class="field-label" for="q-name">Name</label><input id="q-name" class="field-input" type="text" autocomplete="name" /></div>' +
  '<div><label class="field-label" for="q-phone">Phone</label><input id="q-phone" class="field-input" type="tel" autocomplete="tel" /></div>' +
  '<div><label class="field-label" for="q-from">Moving From</label><input id="q-from" class="field-input" type="text" /></div>' +
  '<div><label class="field-label" for="q-to">Moving To</label><input id="q-to" class="field-input" type="text" /></div>' +
  '<div><label class="field-label" for="q-date">Moving Date</label><input id="q-date" class="field-input" type="date" /></div>' +
  '<div><label class="field-label" for="q-service">Service Type</label><select id="q-service" class="field-input">' + serviceOptions + "</select></div>" +
  "</div>" +
  '<p id="quote-error" class="form-error" role="alert" style="display:none"></p>' +
  '<button type="submit" class="btn btn-dark" style="width:100%;margin-top:1rem">Get My Quote</button>' +
  '<div id="quote-done" style="display:none"></div>' +
  "</form></div></div></section>" +
  '<section class="block" id="contact-sec"><div class="wrap"><h2 class="sec-title">Get in Touch</h2>' +
  '<div class="contact-details"><p>Phone: Not provided yet</p><p>Email: Not provided yet</p><p>Address: Not provided yet</p></div>' +
  '<div class="contact-box"><p style="text-align:center;color:var(--mut);margin-top:0">Send us a message</p>' +
  '<form id="contact-form" novalidate><div class="form-grid">' +
  '<div><label class="field-label" for="ct-name">Name</label><input id="ct-name" class="field-input" type="text" autocomplete="name" /></div>' +
  '<div><label class="field-label" for="ct-contact">Phone or email</label><input id="ct-contact" class="field-input" type="text" /></div>' +
  '<div><label class="field-label" for="ct-message">Message</label><textarea id="ct-message" class="field-input" rows="4" placeholder="Type your message..."></textarea></div>' +
  '<p id="contact-error" class="form-error" role="alert" style="display:none"></p>' +
  '<button type="submit" class="btn btn-yellow">Submit</button>' +
  '<p id="contact-done" style="display:none"></p>' +
  "</div></form></div></div></section>";
}

function galleryHtml(s) {
  var caps = ["On the job", "Film still", "Part of the move"];
  var figs = s.gallery.map(function (g, i) {
    return '<figure><img src="' + esc(g) + '" alt="' + esc(s.name) + " photo " + (i + 1) + '" loading="lazy" /><figcaption>' + esc(s.name) + ", " + caps[i % caps.length].toLowerCase() + ".</figcaption></figure>";
  }).join("");
  return '<div class="gallery">' + figs + "</div>";
}

function stepLinksHtml() {
  return '<div class="step-links">' + steps.map(function (st) {
    return '<button type="button" class="step-chip" data-open-step="' + esc(st.id) + '">' + esc(st.number) + " " + esc(st.name) + "</button>";
  }).join("") + "</div>";
}

function serviceDetailHtml(s) {
  var includes = s.includes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  var related = services.filter(function (x) { return x.id !== s.id; }).slice(0, 3).map(serviceCard).join("");
  return '<div class="wrap"><p class="crumbs"><button type="button" data-nav-home>Home</button> / <button type="button" data-nav-anchor="services">Services</button> / ' + esc(s.name) + "</p>" +
    '<div class="detail-banner"><img src="' + esc(s.image) + '" alt="' + esc(s.name) + '" style="object-position:' + esc(s.focal || "center 40%") + '" /></div>' +
    '<p class="caption">' + esc(s.name) + ", stock atmosphere photo.</p>" +
    '<div class="detail-body"><h1>' + esc(s.name) + "</h1><p>" + esc(s.description) + "</p>" +
    "<h2>What is included</h2><ul>" + includes + "</ul>" +
    "<h2>Good to know</h2><p>" + esc(s.goodToKnow) + "</p>" +
    "<h2>Watch it in action</h2>" + filmHtml(SERVICE_FILM[s.id] || "about") +
    "<h2>Pictures</h2>" + galleryHtml(s) +
    "<h2>How it works</h2>" + stepLinksHtml() +
    '<p style="margin-top:1.6rem"><button type="button" class="btn btn-yellow" data-goto-quote="' + esc(s.id) + '">Get a Quote</button> ' +
    '<button type="button" class="back-link" data-back>Back to Services</button></p>' +
    '<h2 style="margin-top:2rem">Other services</h2></div>' +
    '<div class="grid cols-3 ss-stagger" style="padding-bottom:2.5rem">' + related + "</div></div>";
}

function stepDetailHtml(st) {
  var happens = st.happens.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  var rel = serviceById(st.relatedService);
  return '<div class="wrap"><p class="crumbs"><button type="button" data-nav-home>Home</button> / <button type="button" data-nav-page="how">How It Works</button> / ' + esc(st.name) + "</p>" +
    '<div class="detail-banner"><img src="' + esc(st.image) + '" alt="' + esc(st.name) + '" style="object-position:' + esc(st.focal || "center 40%") + '" /></div>' +
    '<p class="caption">Step ' + esc(st.number) + ", stock atmosphere photo.</p>" +
    '<div class="detail-body"><p class="head-font" style="color:var(--yellow);font-weight:800;margin:0">Step ' + esc(st.number) + "</p>" +
    "<h1>" + esc(st.name) + "</h1><p>" + esc(st.description) + "</p>" +
    "<h2>What happens</h2><ul>" + happens + "</ul>" +
    (rel ? "<h2>Related service</h2><p>" + esc(rel.name) + ": " + esc(rel.short) + "</p>" : "") +
    '<p style="margin-top:1.6rem"><button type="button" class="btn btn-yellow" data-goto-quote="' + esc(st.relatedService) + '">Get a Quote</button> ' +
    '<button type="button" class="back-link" data-back-how>Back to How It Works</button></p></div>' +
    (rel ? '<div style="padding-bottom:2.5rem"><div class="grid cols-3 ss-stagger">' + serviceCard(rel) + "</div></div>" : "") +
    "</div>";
}

function aboutHtml() {
  var serviceCards = services.map(serviceCard).join("");
  return '<div class="wrap"><p class="crumbs"><button type="button" data-nav-home>Home</button> / About Us</p>' +
    '<div class="detail-banner"><img src="/images/about.jpg" alt="Mover carrying a box inside a moving truck" style="object-position:center 40%" /></div>' +
    '<p class="caption">Our crew at work, stock atmosphere photo.</p>' +
    '<div class="detail-body"><h1>About Us</h1>' +
    "<h2>We Move Your World With Care</h2>" +
    "<p>SwiftShift Movers is a home and office shifting service by Interlinkz. We pack, load, move and unpack houses, flats and offices, and we treat every box as if it were our own.</p>" +
    "<p>Every move starts with the quote form, so the crew, the truck and the plan are right before moving day begins. On the day, the crew packs room by room, labels every box, secures the load for the road and sets your furniture back in place at the other end.</p>" +
    "<h2>Watch the crew at work</h2>" + filmHtml("about") +
    "<h2>Contact details</h2><p>Phone: Not provided yet<br />Email: Not provided yet<br />Address: Not provided yet</p>" +
    '<p style="margin-top:1.4rem"><button type="button" class="btn btn-yellow" data-goto-quote>Get a Quote</button> ' +
    '<button type="button" class="back-link" data-back>Back to Home</button></p></div>' +
    '<h2 class="head-font" style="color:var(--yellow)">Our Services</h2>' +
    '<div class="grid cols-4 ss-stagger" style="padding-bottom:2.5rem">' + serviceCards + "</div></div>";
}

function howHtml() {
  var blocks = steps.map(function (st) {
    return '<div class="detail-body" style="border-top:1px solid var(--line)">' +
      '<p class="head-font" style="color:var(--yellow);font-weight:800;margin:0">Step ' + esc(st.number) + "</p>" +
      "<h2 style='margin-top:.3rem'>" + esc(st.name) + "</h2>" +
      '<div class="about-photo"><img src="' + esc(st.image) + '" alt="' + esc(st.name) + '" loading="lazy" /></div>' +
      "<p>" + esc(st.description) + "</p>" +
      '<button type="button" class="btn btn-outline" data-open-step="' + esc(st.id) + '">Open full step page</button></div>';
  }).join("");
  return '<div class="wrap"><p class="crumbs"><button type="button" data-nav-home>Home</button> / How It Works</p>' +
    '<div class="detail-body" style="padding-bottom:0"><h1>How It Works</h1>' +
    "<p>Four steps take your move from the first quote to the first evening in the new place.</p></div>" +
    blocks +
    '<p style="text-align:center;padding-bottom:2.5rem"><button type="button" class="btn btn-yellow" data-goto-quote>Get a Quote</button></p></div>';
}

function searchItems(q) {
  var needle = q.trim().toLowerCase();
  var out = [];
  services.forEach(function (s) {
    var hay = (s.name + " " + s.short + " " + s.description).toLowerCase();
    if (!needle || hay.indexOf(needle) !== -1) {
      out.push({ title: s.name, sub: s.short, img: s.image, focal: s.focal, id: s.id });
    }
  });
  return out;
}

function searchHtml(q) {
  var items = searchItems(q);
  var list = items.map(function (it) {
    return '<li><button type="button" class="search-hit" data-open-service="' + esc(it.id) + '"><img src="' + esc(it.img) + '" alt="" style="object-position:' + esc(it.focal || "center 40%") + '" /><span><span class="t">' + esc(it.title) + '</span><br /><span class="s">Service - ' + esc(it.sub) + "</span></span></button></li>";
  }).join("");
  return '<div class="wrap"><p class="crumbs"><button type="button" data-nav-home>Home</button> / Search</p>' +
    '<div class="detail-body"><h1>Search results for &ldquo;' + esc(q) + "&rdquo;</h1>" +
    (items.length === 0
      ? '<p class="empty">No services match that search. Try a service name such as Packing, or leave the search empty to see all four services.</p>'
      : "<p>Showing " + items.length + " result" + (items.length === 1 ? "" : "s") + ".</p>") +
    "</div>" +
    (items.length ? '<div class="search-results" style="padding-bottom:1rem"><ul>' + list + "</ul></div>" : "") +
    '<p style="padding-bottom:2.5rem"><button type="button" class="back-link" data-back>Back to Home</button></p></div>';
}

function renderSearchBar(q) {
  var box = document.getElementById("search-results");
  if (!box) return;
  var items = searchItems(q);
  if (!q.trim()) {
    box.innerHTML = items.length ? "<ul>" + items.map(hitHtml).join("") + "</ul>" : "";
    return;
  }
  box.innerHTML = items.length ? "<ul>" + items.slice(0, 6).map(hitHtml).join("") + "</ul>" : '<p class="empty">No matches. Press Search to see the full results page.</p>';
}

function hitHtml(it) {
  return '<li><button type="button" class="search-hit" data-open-service="' + esc(it.id) + '"><img src="' + esc(it.img) + '" alt="" style="object-position:' + esc(it.focal || "center 40%") + '" /><span><span class="t">' + esc(it.title) + '</span><br /><span class="s">Service - ' + esc(it.sub) + "</span></span></button></li>";
}

function wirePage() {
  var app = document.getElementById("app");
  app.querySelectorAll("[data-open-service]").forEach(function (el) {
    el.addEventListener("click", function () { closeSearch(); go({ page: "service", id: el.getAttribute("data-open-service") }); });
  });
  app.querySelectorAll("[data-open-step]").forEach(function (el) {
    el.addEventListener("click", function () { go({ page: "step", id: el.getAttribute("data-open-step") }); });
  });
  app.querySelectorAll("[data-back]").forEach(function (el) {
    el.addEventListener("click", function () { goHome("services"); });
  });
  app.querySelectorAll("[data-back-how]").forEach(function (el) {
    el.addEventListener("click", function () { go({ page: "how" }); });
  });
  app.querySelectorAll("[data-nav-home]").forEach(function (el) {
    el.addEventListener("click", function () { goHome(null); });
  });
  app.querySelectorAll("[data-nav-anchor]").forEach(function (el) {
    el.addEventListener("click", function () { goHome(el.getAttribute("data-nav-anchor")); });
  });
  app.querySelectorAll("[data-nav-page]").forEach(function (el) {
    el.addEventListener("click", function () { go({ page: el.getAttribute("data-nav-page") }); });
  });
  app.querySelectorAll("[data-goto-quote]").forEach(function (el) {
    el.addEventListener("click", function () {
      var sid = el.getAttribute("data-goto-quote");
      if (sid) pendingService = sid;
      goHome("quote");
    });
  });
  wireFilms(app);
  var quote = document.getElementById("quote-form");
  if (quote) {
    quote.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("quote-error");
      var done = document.getElementById("quote-done");
      err.style.display = "none";
      var body = {
        name: document.getElementById("q-name").value.trim(),
        phone: document.getElementById("q-phone").value.trim(),
        movingFrom: document.getElementById("q-from").value.trim(),
        movingTo: document.getElementById("q-to").value.trim(),
        movingDate: document.getElementById("q-date").value,
        serviceId: document.getElementById("q-service").value
      };
      if (body.name.length < 2) { err.textContent = "Please enter your name."; err.style.display = "block"; return; }
      if (body.phone.replace(/[^0-9]/g, "").length < 7) { err.textContent = "Please enter a phone number."; err.style.display = "block"; return; }
      if (body.movingFrom.length < 2) { err.textContent = "Please tell us where you are moving from."; err.style.display = "block"; return; }
      if (body.movingTo.length < 2) { err.textContent = "Please tell us where you are moving to."; err.style.display = "block"; return; }
      if (!body.movingDate) { err.textContent = "Please choose a moving date."; err.style.display = "block"; return; }
      api("/api/quotes", { method: "POST", body: JSON.stringify(body) })
        .then(function (res) {
          done.innerHTML = '<div class="form-ok"><strong>Quote requested</strong>Your reference is ' + esc(res.quoteNumber) + " for " + esc(res.serviceName) + ". We will come back with your quote.</div>";
          done.style.display = "block";
          quote.reset();
          toast("Quote requested");
        })
        .catch(function (e2) { err.textContent = e2.message; err.style.display = "block"; });
    });
  }
  var contact = document.getElementById("contact-form");
  if (contact) {
    contact.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = document.getElementById("contact-error");
      var done = document.getElementById("contact-done");
      err.style.display = "none";
      var body = {
        name: document.getElementById("ct-name").value.trim(),
        contact: document.getElementById("ct-contact").value.trim(),
        message: document.getElementById("ct-message").value.trim()
      };
      api("/api/contact", { method: "POST", body: JSON.stringify(body) })
        .then(function () {
          done.innerHTML = '<div class="form-ok"><strong>Message sent</strong>Thank you. We will get back to you.</div>';
          done.style.display = "block";
          contact.reset();
        })
        .catch(function (e2) { err.textContent = e2.message; err.style.display = "block"; });
    });
  }
}

function render() {
  var app = document.getElementById("app");
  var r = currentRoute;
  loadData().then(function () {
    if (r.page === "service") {
      var s = serviceById(r.id);
      app.innerHTML = s ? serviceDetailHtml(s) : '<p class="empty">That service was not found.</p><p style="text-align:center"><button type="button" class="back-link" data-back>Back to Home</button></p>';
    } else if (r.page === "step") {
      var st = stepById(r.id);
      app.innerHTML = st ? stepDetailHtml(st) : '<p class="empty">That step was not found.</p><p style="text-align:center"><button type="button" class="back-link" data-back>Back to Home</button></p>';
    } else if (r.page === "about") {
      app.innerHTML = aboutHtml();
    } else if (r.page === "how") {
      app.innerHTML = howHtml();
    } else if (r.page === "search") {
      app.innerHTML = searchHtml(r.q);
    } else {
      app.innerHTML = homeHtml();
    }
    wirePage();
    if (pendingAnchor) {
      var target = document.getElementById(pendingAnchor);
      pendingAnchor = null;
      if (target) { target.scrollIntoView(); return; }
    }
    scrollToTop();
  });
}

function closeSearch() {
  var bar = document.getElementById("search-bar");
  if (bar) bar.classList.remove("open");
  var box = document.getElementById("search-results");
  if (box) box.innerHTML = "";
}

function closeDrawer() {
  var d = document.getElementById("drawer");
  if (d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
}

function wireChrome() {
  document.querySelectorAll("[data-nav]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var href = el.getAttribute("href") || "";
      e.preventDefault();
      closeDrawer();
      closeSearch();
      if (href.indexOf("/#") === 0) {
        goHome(href.slice(2));
        return;
      }
      goHome(null);
    });
  });
  var toggle = document.getElementById("search-toggle-btn");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var bar = document.getElementById("search-bar");
      bar.classList.toggle("open");
      if (bar.classList.contains("open")) {
        renderSearchBar(document.getElementById("site-search").value || "");
        var input = document.getElementById("site-search");
        if (input) input.focus();
      }
    });
  }
  var input = document.getElementById("site-search");
  if (input) {
    input.addEventListener("input", function () { renderSearchBar(input.value); });
  }
  var form = document.getElementById("site-search-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = document.getElementById("site-search").value;
      closeSearch();
      go({ page: "search", q: q });
    });
  }
  var searchBox = document.getElementById("search-results");
  if (searchBox) {
    searchBox.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-open-service]") : null;
      if (el) {
        closeSearch();
        go({ page: "service", id: el.getAttribute("data-open-service") });
      }
    });
  }
  var news = document.getElementById("newsletter-form");
  if (news) {
    news.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("newsletter-email").value.trim();
      var done = document.getElementById("newsletter-done");
      api("/api/newsletter", { method: "POST", body: JSON.stringify({ email: email }) })
        .then(function () {
          done.textContent = "You are on the list. Thank you.";
          news.reset();
        })
        .catch(function (e2) { done.textContent = e2.message; });
    });
  }
}

function wireDrawer() {
  var open = document.getElementById("menu-open-btn");
  var close = document.getElementById("drawer-close");
  var back = document.getElementById("drawer-back");
  var drawer = document.getElementById("drawer");
  if (open) open.addEventListener("click", function () {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
  });
  if (close) close.addEventListener("click", closeDrawer);
  if (back) back.addEventListener("click", closeDrawer);
}

window.addEventListener("popstate", function () {
  currentRoute = routeFromPath();
  var hash = window.location.hash;
  pendingAnchor = hash ? hash.slice(1) : null;
  render();
});

currentRoute = routeFromPath();
if (window.location.hash) pendingAnchor = window.location.hash.slice(1);
showIntro();
wireChrome();
wireDrawer();
render();
