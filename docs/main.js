// ---- Config -------------------------------------------------------------

const GITHUB_USER = "nikpcenicni";

// FormSubmit relays the form to this address with no signup. The very first
// submission sends an activation email to it; click the link and you're live.
// To use Formspree instead, set this to "https://formspree.io/f/<your-id>".
const FORM_ENDPOINT = "https://formsubmit.co/ajax/nik@pcenicni.dev";

// Repos never shown on the site.
const HIDDEN = new Set(["nikpcenicni"]);

// Forks are hidden unless listed here (some of my real projects are forks).
const INCLUDE_FORKS = new Set(["SpoolmanScale", "MMM-iCloud-Client"]);

// Hand-written blurbs and ordering. Anything not listed here still shows up,
// using its GitHub description; listed repos are sorted to the top.
const FEATURED = {
  Nikflix: { emoji: "🎬", blurb: "My whole homelab as code — Talos + Kubernetes on Proxmox, wired up with Terraform, Ansible and ArgoCD, with a self-hosted media stack on top. GitOps all the way down." },
  SpoolmanScale: { emoji: "⚖️", blurb: "An ESP32 filament scale with an NFC reader and a touchscreen. Plop a spool on it, it knows what it is and how much is left." },
  DashPlay: { emoji: "🚗", blurb: "Fullscreen playback from custom media sources in the Tesla browser. Because the car should be a cinema when parked." },
  "jellyfin-restart": { emoji: "🩺", blurb: "A macOS watchdog that notices when Jellyfin stops responding and turns it off and on again, so I don't have to." },
  "cf-ddns": { emoji: "🌩️", blurb: "Cloudflare dynamic DNS in a shell script. My ISP changes my IP; I change nothing." },
  "MMM-iCloud-Client": { emoji: "🪞", blurb: "MagicMirror² module that turns iCloud contacts into a birthday calendar. The mirror remembers so I don't have to." },
  tetris: { emoji: "🧱", blurb: "The rite of passage." },
  Netflix: { emoji: "📺", blurb: "A clone, long before the homelab made it real (see: Nikflix)." },
  FinalFrontier: { emoji: "🚀", blurb: "C# in space." },
  nachos: { emoji: "🧠", blurb: "Building an OS in Java, as one does in school." },
  "Twitter-Dataminer": { emoji: "🐦", blurb: "From when it was still called Twitter." },
  "Dhar-Mann-TikTok-Bot": { emoji: "🎭", blurb: "No further questions." },
  "npx-card": { emoji: "💳", blurb: "Business card, but make it a terminal command." },
};

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Shell: "#89e051",
  HCL: "#844FBA", C: "#555555", "C#": "#178600", Java: "#b07219", Go: "#00ADD8",
  HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d", Rust: "#dea584",
};

// ---- Hero typing --------------------------------------------------------

const LINES = [
  "Homelab gremlin 🧪",
  "I run Kubernetes at home. On purpose.",
  "kubectl get pods --all-namespaces 👀",
];

function typeLoop(el) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = LINES[1];
    return;
  }
  let line = 0, i = 0, deleting = false;
  const tick = () => {
    const text = [...LINES[line]];
    i += deleting ? -1 : 1;
    el.textContent = text.slice(0, i).join("");
    let delay = deleting ? 30 : 60;
    if (!deleting && i === text.length) { deleting = true; delay = 1800; }
    else if (deleting && i === 0) { deleting = false; line = (line + 1) % LINES.length; delay = 400; }
    setTimeout(tick, delay);
  };
  tick();
}

// ---- Projects -----------------------------------------------------------

const CACHE_KEY = "repos-cache-v1";
const CACHE_TTL = 60 * 60 * 1000; // unauthenticated API allows 60 req/hr per IP

async function fetchRepos() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.at < CACHE_TTL) return cached.repos;
  } catch {}

  const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`);
  if (!res.ok) {
    // Fall back to stale cache rather than an empty page when rate-limited.
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)).repos; } catch {}
    throw new Error(`GitHub API returned ${res.status}`);
  }
  const repos = (await res.json()).map((r) => ({
    name: r.name, url: r.html_url, description: r.description, language: r.language,
    stars: r.stargazers_count, forks: r.forks_count, homepage: r.homepage,
    archived: r.archived, fork: r.fork, pushed: r.pushed_at, topics: r.topics || [],
  }));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos })); } catch {}
  return repos;
}

const featuredOrder = Object.keys(FEATURED);
const rank = (r) => { const i = featuredOrder.indexOf(r.name); return i === -1 ? Infinity : i; };

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function card(r) {
  const f = FEATURED[r.name] || {};
  const blurb = f.blurb || r.description || "No description yet.";
  const updated = new Date(r.pushed).toLocaleDateString(undefined, { year: "numeric", month: "short" });
  const homepage = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : r.homepage ? `https://${r.homepage}` : null;
  return `
    <article class="card">
      <h4>${f.emoji ? `<span aria-hidden="true">${f.emoji}</span>` : ""}<a href="${r.url}" target="_blank" rel="noopener">${escapeHTML(r.name)}</a>
        ${r.fork ? '<span class="badge">fork</span>' : ""}</h4>
      <p>${escapeHTML(blurb)}</p>
      <div class="meta">
        ${r.language ? `<span><span class="dot" style="background:${LANG_COLORS[r.language] || "var(--muted)"}"></span>${escapeHTML(r.language)}</span>` : ""}
        ${r.stars ? `<span>★ ${r.stars}</span>` : ""}
        <span>${updated}</span>
        ${homepage ? `<a href="${escapeHTML(homepage)}" target="_blank" rel="noopener">live ↗</a>` : ""}
      </div>
    </article>`;
}

function initProjects() {
  const activeEl = document.getElementById("active");
  const archivedEl = document.getElementById("archived");
  const searchEl = document.getElementById("search");
  const langsEl = document.getElementById("langs");
  let repos = [];
  let lang = null;

  const render = () => {
    const q = searchEl.value.trim().toLowerCase();
    const match = (r) =>
      (!lang || r.language === lang) &&
      (!q || [r.name, r.description, FEATURED[r.name]?.blurb, ...r.topics].join(" ").toLowerCase().includes(q));
    const shown = repos.filter(match);
    const active = shown.filter((r) => !r.archived);
    const archived = shown.filter((r) => r.archived);
    activeEl.innerHTML = active.map(card).join("") || '<p class="muted">Nothing matches.</p>';
    archivedEl.innerHTML = archived.map(card).join("") || '<p class="muted">Nothing matches.</p>';
    archivedEl.classList.add("archived");
  };

  fetchRepos()
    .then((all) => {
      repos = all
        .filter((r) => !HIDDEN.has(r.name) && (!r.fork || INCLUDE_FORKS.has(r.name)))
        .sort((a, b) => rank(a) - rank(b) || new Date(b.pushed) - new Date(a.pushed));

      const langs = [...new Set(repos.map((r) => r.language).filter(Boolean))].sort();
      langsEl.innerHTML = ["All", ...langs]
        .map((l) => `<button type="button" class="chip" aria-pressed="${l === "All"}" data-lang="${escapeHTML(l)}">${escapeHTML(l)}</button>`)
        .join("");
      langsEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        lang = btn.dataset.lang === "All" ? null : btn.dataset.lang;
        langsEl.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === btn));
        render();
      });
      searchEl.addEventListener("input", render);
      render();
    })
    .catch((err) => {
      console.error(err);
      activeEl.innerHTML = `<p class="muted">Couldn't load repos right now — <a href="https://github.com/${GITHUB_USER}?tab=repositories">browse them on GitHub</a>.</p>`;
    });
}

// ---- Contact form -------------------------------------------------------

function initContact() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "";
    status.textContent = "";

    let valid = true;
    for (const field of form.querySelectorAll("[required]")) {
      const ok = field.checkValidity() && field.value.trim() !== "";
      field.setAttribute("aria-invalid", !ok);
      valid &&= ok;
    }
    if (!valid) {
      status.className = "err";
      status.textContent = "Please fill in every field with a valid email.";
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    if (data._honey) return; // bot

    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...data, _subject: `Portfolio message from ${data.name}`, _template: "box" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === "false" || body.success === false) throw new Error(body.message || res.status);
      form.reset();
      status.className = "ok";
      status.textContent = "Sent! I'll get back to you soon.";
    } catch (err) {
      console.error(err);
      status.className = "err";
      status.innerHTML = 'Something went wrong. Email me directly at <a href="mailto:nik@pcenicni.dev">nik@pcenicni.dev</a>.';
    } finally {
      button.disabled = false;
      button.textContent = "Send message";
    }
  });
}

// ---- Boot ---------------------------------------------------------------

document.getElementById("year").textContent = new Date().getFullYear();
typeLoop(document.getElementById("typed"));
initProjects();
initContact();
