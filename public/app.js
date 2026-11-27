import { BLOK_START, COURSES, GOALS, UNDERSTANDING } from "./data.js";

/* ---------- state ---------- */
const CACHE_KEY = "examendossier:v1";
const PENDING_KEY = "examendossier:pending";

let progress = {};
let tasks = [];
let pending = {};
let tab = "overzicht";
let editing = null; // key being renamed
let editingPages = null;
let addingSection = null;

try {
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  if (cached) ({ progress = {}, tasks = [] } = cached);
  pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
  Object.assign(progress, pending);
  for (const [k, v] of Object.entries(pending)) if (v === null) delete progress[k];
} catch {}

const persistCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ progress, tasks }));
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {}
};

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const course = (id) => COURSES.find((c) => c.id === id);

const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const today = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
const daysUntil = (s) => Math.round((parseDate(s) - today()) / 86400000);
const fmtDay = (s, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("nl-BE", opts).format(parseDate(s));
const daysLabel = (n) => (n > 1 ? `nog ${n} dagen` : n === 1 ? "morgen" : n === 0 ? "vandaag" : "voorbij");

const isOn = (key) => progress[key] === "1";
const partKey = (c, m, p) => `p:${c.id}:${m.id}:${p.id}`;
const begripKey = (c, m) => `b:${c.id}:${m.id}`;
const labelKey = (c, m) => `l:${c.id}:${m.id}`;
const moduleRecordKey = (c, id) => `module:${c.id}:${id}`;
const removedModuleKey = (c, id) => `removed:${c.id}:${id}`;
const pagesKey = (c, m) => `pages:${c.id}:${m.id}`;
const titleOf = (c, m) => progress[labelKey(c, m)] || m.title;
const pageCountOf = (c, m) => Number(progress[pagesKey(c, m)] || m.pages) || 0;

const sectionsOf = (c) =>
  c.sections.map((section, sectionIndex) => {
    const defaults = section.modules.filter((m) => progress[removedModuleKey(c, m.id)] !== "1");
    const prefix = `module:${c.id}:`;
    const added = Object.entries(progress).flatMap(([key, value]) => {
      if (!key.startsWith(prefix)) return [];
      try {
        const record = JSON.parse(value);
        if (!record || record.section !== sectionIndex || typeof record.title !== "string" || typeof record.num !== "string") return [];
        return [{ id: key.slice(prefix.length), ...record, custom: true }];
      } catch (error) {
        console.error(`Ongeldige opgeslagen module: ${key}`, error);
        return [];
      }
    });
    return { ...section, modules: [...defaults, ...added] };
  });

const modulesOf = (c) =>
  sectionsOf(c).flatMap((s) => s.modules.map((m) => ({ ...m, parts: s.parts || c.parts })));

const statusOf = (c, m) => {
  const done = m.parts.filter((p) => isOn(partKey(c, m, p))).length;
  if (done === 0) return "todo";
  return done === m.parts.length ? "done" : "busy";
};
const STATUS = { todo: "Nog niet gestart", busy: "In behandeling", done: "Afgerond" };

const courseStats = (c) => {
  const mods = modulesOf(c);
  const s = { total: mods.length, done: 0, busy: 0, todo: 0, goed: 0, herhalen: 0, niks: 0, parts: 0, partsDone: 0 };
  for (const m of mods) {
    s[statusOf(c, m)]++;
    const b = progress[begripKey(c, m)];
    if (b in s) s[b]++;
    s.parts += m.parts.length;
    s.partsDone += m.parts.filter((p) => isOn(partKey(c, m, p))).length;
  }
  return s;
};

const goalItems = () =>
  GOALS.flatMap((g) => {
    const c = course(g.course);
    return modulesOf(c).flatMap((m) => g.columns.filter((col) => !col.optional).map((col) => col.key(m)));
  });

/* ---------- sync ---------- */
const syncEl = $("#sync");
const setSync = (state, label) => {
  syncEl.dataset.state = state;
  syncEl.querySelector(".sync-label").textContent = label;
};

let toastTimer;
const toast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

let flushing = false;
async function flush() {
  if (flushing) return;
  const entries = Object.entries(pending);
  if (!entries.length) return setSync("ok", "Opgeslagen");
  flushing = true;
  setSync("saving", "Opslaan…");
  try {
    for (const [key, value] of entries) {
      await api("/api/progress", { method: "PUT", body: { key, value } });
      if (pending[key] === value) delete pending[key];
    }
    persistCache();
    setSync("ok", "Opgeslagen");
  } catch {
    setSync("error", "Niet opgeslagen");
    toast("Opslaan lukt niet. Je wijzigingen worden opnieuw verstuurd zodra je weer online bent.");
  } finally {
    flushing = false;
    if (Object.keys(pending).length && navigator.onLine && syncEl.dataset.state !== "error") flush();
  }
}

function setKeys(changes) {
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete progress[key];
    else progress[key] = value;
    pending[key] = value;
  }
  persistCache();
  render();
  flush();
}

const setKey = (key, value) => setKeys({ [key]: value });

async function load() {
  try {
    await flush();
    const data = await api("/api/state");
    progress = { ...data.progress };
    for (const [k, v] of Object.entries(pending)) v === null ? delete progress[k] : (progress[k] = v);
    tasks = data.tasks;
    persistCache();
    if (!Object.keys(pending).length) setSync("ok", "Opgeslagen");
  } catch {
    setSync("error", "Offline");
  }
  render();
}

/* ---------- header + tabs ---------- */
function renderHeader() {
  const d = daysUntil(BLOK_START);
  const next = COURSES.map((c) => ({ c, d: daysUntil(c.exam.date) })).find((x) => x.d >= 0);
  $("#countdown").innerHTML = `
    <div class="cd">
      <span class="cd-num">${d > 0 ? d : "0"}</span>
      <span class="cd-txt">${d > 0 ? `dagen tot de blok<br><b>zo 20 december</b>` : `De blok is<br><b>begonnen</b>`}</span>
    </div>
    ${next ? `<div class="cd cd-next" style="--c:${next.c.color}">
      <span class="cd-num">${next.d}</span>
      <span class="cd-txt">dagen tot ${esc(next.c.short)}<br><b>${fmtDay(next.c.exam.date)} · ${next.c.exam.time}</b></span>
    </div>` : ""}`;
}

function renderTabs() {
  const items = [
    { id: "overzicht", label: "Overzicht", color: "#1f2433" },
    { id: "blok", label: "Voor de blok", color: "#1f2433", badge: "20/12" },
    ...COURSES.map((c) => ({ id: c.id, label: c.tab, color: c.color, badge: fmtDay(c.exam.date, { day: "numeric", month: "numeric" }) })),
  ];
  $("#tabs").innerHTML = items
    .map(
      (t) => `<button role="tab" class="tab" style="--c:${t.color}" data-tab="${t.id}" aria-selected="${t.id === tab}">
        <span>${esc(t.label)}</span>${t.badge ? `<small>${esc(t.badge)}</small>` : ""}
      </button>`
    )
    .join("");
}

/* ---------- views ---------- */
function viewOverview() {
  const rows = COURSES.map((c) => ({ c, s: courseStats(c) }));
  const tot = rows.reduce(
    (a, { s }) => {
      for (const k of Object.keys(a)) a[k] += s[k];
      return a;
    },
    { total: 0, done: 0, busy: 0, todo: 0, goed: 0, herhalen: 0, niks: 0 }
  );
  const goals = goalItems();
  const goalsDone = goals.filter(isOn).length;

  return `
  <section class="intro">
    <h2>Overzicht</h2>
    <p>Vijf examens tussen 9 en 29 januari. Vink in elk vak-tabblad af wat je gedaan hebt en geef aan hoe goed je het kent.</p>
  </section>

  <section class="exams">
    ${COURSES.map((c, i) => {
      const s = courseStats(c);
      const d = daysUntil(c.exam.date);
      const p = pct(s.partsDone, s.parts);
      return `<button class="exam-card" style="--c:${c.color};--i:${i}" data-tab="${c.id}">
        <div class="exam-date">
          <span class="wd">${fmtDay(c.exam.date, { weekday: "short" })}</span>
          <span class="day">${fmtDay(c.exam.date, { day: "numeric" })}</span>
          <span class="mo">${fmtDay(c.exam.date, { month: "short" })}</span>
        </div>
        <div class="exam-body">
          <h3>${esc(c.short)}</h3>
          <p class="exam-meta">${c.exam.time}${c.exam.room ? ` · ${esc(c.exam.room)}` : ""}${c.sp ? ` · ${c.sp} SP` : ""}</p>
          <div class="bar"><i style="width:${p}%"></i></div>
          <p class="exam-foot"><b>${p}%</b> van de onderdelen gedaan <span>${daysLabel(d)}</span></p>
        </div>
      </button>`;
    }).join("")}
  </section>

  <button class="goal-strip" data-tab="blok">
    <span class="gs-label">Doelen voor de blok</span>
    <span class="bar big"><i style="width:${pct(goalsDone, goals.length)}%"></i></span>
    <span class="gs-num">${goalsDone}/${goals.length}</span>
    <span class="gs-go">Bekijk →</span>
  </button>

  <section class="card table-card">
    <div class="table-scroll">
    <table class="overview">
      <thead>
        <tr class="group">
          <th></th><th></th>
          <th colspan="3">Voortgang <span>% van de onderdelen</span></th>
          <th colspan="3">Begrip <span>aantal onderdelen</span></th>
        </tr>
        <tr>
          <th class="l">Vak</th><th>Aantal</th>
          <th>Afgerond</th><th>In behandeling</th><th>Nog niet gestart</th>
          <th>Goed gekend</th><th>Te herhalen</th><th>Snap er niks van</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            ({ c, s }) => `<tr data-tab="${c.id}" style="--c:${c.color}">
            <td class="l"><span class="swatch"></span>${esc(c.short)}</td>
            <td>${s.total}</td>
            <td class="pc done">${pct(s.done, s.total)}%</td>
            <td class="pc busy">${pct(s.busy, s.total)}%</td>
            <td class="pc todo">${pct(s.todo, s.total)}%</td>
            <td class="n goed">${s.goed}</td>
            <td class="n herhalen">${s.herhalen}</td>
            <td class="n niks">${s.niks}</td>
          </tr>`
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td class="l">Totaal</td><td>${tot.total}</td>
          <td>${pct(tot.done, tot.total)}%</td><td>${pct(tot.busy, tot.total)}%</td><td>${pct(tot.todo, tot.total)}%</td>
          <td>${tot.goed}</td><td>${tot.herhalen}</td><td>${tot.niks}</td>
        </tr>
      </tfoot>
    </table>
    </div>
    <p class="legend">Een onderdeel is <b>afgerond</b> als alles (bv. theorie + werkcollege + oefeningen) is afgevinkt, <b>in behandeling</b> als een deel is afgevinkt.</p>
  </section>`;
}

function viewBlok() {
  const d = daysUntil(BLOK_START);
  const goals = goalItems();
  const done = goals.filter(isOn).length;
  const openOwn = tasks.filter((t) => !t.done).length;
  const left = goals.length - done + openOwn;
  const perDay = d > 0 ? Math.ceil(left / d) : left;
  const courseOptions = COURSES.map((c) => `<option value="${c.id}">${esc(c.short)}</option>`).join("");

  return `
  <section class="blok-hero">
    <div>
      <p class="eyebrow">Voor de blok begint · zondag 20 december</p>
      <h2>${d > 0 ? `Nog <em>${d}</em> dagen` : "De blok is begonnen"}</h2>
      <p>Markten en prijzen: elk werkcollege opnieuw + schema. Statistiek: elk hoofdstuk al eens gezien. Wiskunde: elk werkcollege gemaakt.</p>
    </div>
    <div class="ring" style="--p:${pct(done, goals.length)}">
      <div><b>${pct(done, goals.length)}%</b><span>${done} van ${goals.length}</span></div>
    </div>
    ${left > 0 && d > 0 ? `<p class="pace">Nog <b>${left}</b> ${left === 1 ? "taak" : "taken"} open — gemiddeld zo'n <b>${perDay}</b> per dag.</p>` : left === 0 ? `<p class="pace">Alles afgevinkt. Goed bezig!</p>` : ""}
  </section>

  <div class="goal-grid">
    ${GOALS.map((g, gi) => {
      const c = course(g.course);
      const mods = modulesOf(c);
      const req = mods.flatMap((m) => g.columns.filter((x) => !x.optional).map((x) => x.key(m)));
      const n = req.filter(isOn).length;
      return `<section class="card goal" style="--c:${c.color};--i:${gi}">
        <header>
          <div>
            <p class="eyebrow">${esc(c.short)}</p>
            <h3>${esc(g.title)}</h3>
          </div>
          <span class="count">${n}/${req.length}</span>
        </header>
        <div class="bar"><i style="width:${pct(n, req.length)}%"></i></div>
        <table class="goal-table">
          <thead><tr><th class="l"></th>${g.columns.map((col) => `<th>${esc(col.label)}${col.optional ? "<small>optioneel</small>" : ""}</th>`).join("")}</tr></thead>
          <tbody>
            ${mods
              .map(
                (m) => `<tr>
                <td class="l"><span class="num">${esc(m.num)}</span>${esc(titleOf(c, m))}</td>
                ${g.columns
                  .map((col) => {
                    const k = col.key(m);
                    return `<td><button class="check ${isOn(k) ? "on" : ""}" data-toggle="${k}" aria-pressed="${isOn(k)}" aria-label="${esc(col.label)} – ${esc(titleOf(c, m))}"></button></td>`;
                  })
                  .join("")}
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </section>`;
    }).join("")}

    <section class="card goal own" style="--c:#1f2433;--i:3">
      <header>
        <div>
          <p class="eyebrow">Alles wat er nog bij komt</p>
          <h3>Eigen taken</h3>
        </div>
        <span class="count">${tasks.filter((t) => t.done).length}/${tasks.length}</span>
      </header>
      <form id="task-form" class="task-form">
        <input name="title" placeholder="Bv. samenvatting H3 ICTS afwerken" maxlength="300" required autocomplete="off" />
        <select name="course" aria-label="Vak"><option value="">Geen vak</option>${courseOptions}</select>
        <button type="submit">Toevoegen</button>
      </form>
      ${
        tasks.length
          ? `<ul class="tasks">${tasks
              .map((t) => {
                const c = course(t.course);
                return `<li class="${t.done ? "done" : ""}">
                  <button class="check ${t.done ? "on" : ""}" data-task-toggle="${t.id}" aria-pressed="${t.done}" aria-label="Afvinken"></button>
                  <span class="t">${esc(t.title)}</span>
                  ${c ? `<span class="tag" style="--c:${c.color}">${esc(c.short)}</span>` : ""}
                  <button class="del" data-task-del="${t.id}" aria-label="Verwijderen">×</button>
                </li>`;
              })
              .join("")}</ul>`
          : `<p class="empty">Nog geen eigen taken. Voeg hierboven iets toe wat je vóór 20/12 af wil hebben.</p>`
      }
    </section>
  </div>`;
}

function viewCourse(c) {
  const s = courseStats(c);
  const d = daysUntil(c.exam.date);
  const p = pct(s.partsDone, s.parts);

  return `
  <section class="course-head" style="--c:${c.color}">
    <div>
      <p class="eyebrow">${fmtDay(c.exam.date, { weekday: "long", day: "numeric", month: "long" })} · ${c.exam.time}${c.sp ? ` · ${c.sp} studiepunten` : ""}</p>
      <h2>${esc(c.name)}</h2>
      <p class="room">${c.exam.room ? esc(c.exam.room) : "Lokaal nog niet bekend"} — <b>${daysLabel(d)}</b></p>
    </div>
    <div class="head-stats">
      <div class="stat"><b>${p}%</b><span>gedaan</span></div>
      <div class="stat goed"><b>${s.goed}</b><span>goed gekend</span></div>
      <div class="stat herhalen"><b>${s.herhalen}</b><span>te herhalen</span></div>
      <div class="stat niks"><b>${s.niks}</b><span>snap niks</span></div>
    </div>
    <div class="bar big"><i style="width:${p}%"></i></div>
  </section>

  ${sectionsOf(c)
    .map((sec, si) => {
      const parts = sec.parts || c.parts;
      return `<section class="card section" style="--c:${c.color};--i:${si}">
        <header class="sec-head">
          <div>
            <h3>${esc(sec.title)}</h3>
            ${sec.hint ? `<p class="hint">${esc(sec.hint)}</p>` : ""}
          </div>
          <button class="add-module" data-add-module="${c.id}:${si}">+ Toevoegen</button>
        </header>
        ${
          addingSection === `${c.id}:${si}`
            ? `<form class="module-form" data-module-form="${c.id}:${si}">
                <input name="title" placeholder="Naam van module of hoofdstuk" maxlength="120" required autocomplete="off" />
                <input name="pages" type="number" min="1" max="10000" step="1" placeholder="Pagina's" aria-label="Aantal pagina's (optioneel)" />
                <button type="submit">Toevoegen</button>
                <button type="button" class="cancel-module" data-cancel-module>Annuleren</button>
              </form>`
            : ""
        }
        <ol class="modules">
          ${sec.modules
            .map((m0) => {
              const m = { ...m0, parts };
              const st = statusOf(c, m);
              const bk = begripKey(c, m);
              const lk = labelKey(c, m);
              const pk = pagesKey(c, m);
              const title = titleOf(c, m);
              const pageCount = pageCountOf(c, m);
              return `<li class="module st-${st}">
                <span class="num">${esc(m.num)}</span>
                <div class="m-main">
                  <div class="module-title-row">
                    ${
                      editing === lk
                        ? `<input class="rename" data-rename="${lk}" value="${esc(title)}" maxlength="120" aria-label="Nieuwe naam" />`
                        : `<h4>${esc(title)}<button class="pen" data-edit="${lk}" aria-label="Naam wijzigen" title="Naam wijzigen">✎</button></h4>`
                    }
                    <button class="module-remove" data-remove-module="${c.id}:${m.id}" aria-label="Module verwijderen" title="Module verwijderen">×</button>
                  </div>
                  <div class="module-pages">
                    ${
                      editingPages === pk
                        ? `<input class="page-rename" data-page-rename="${pk}" type="number" min="1" max="10000" step="1" value="${pageCount || ""}" aria-label="Aantal pagina's" />`
                        : pageCount ? `<small>${pageCount} p.</small>` : ""
                    }
                    <button class="page-edit" data-edit-pages="${pk}" aria-label="${pageCount ? "Aantal pagina's wijzigen" : "Pagina's toevoegen"}" title="${pageCount ? "Aantal pagina's wijzigen" : "Pagina's toevoegen"}">✎</button>
                  </div>
                  ${m.desc ? `<p class="desc">${esc(m.desc)}</p>` : ""}
                  <div class="parts">
                    ${parts
                      .map((pt) => {
                        const k = partKey(c, m, pt);
                        return `<button class="chip ${isOn(k) ? "on" : ""}" data-toggle="${k}" aria-pressed="${isOn(k)}"><span class="tick"></span>${esc(pt.label)}</button>`;
                      })
                      .join("")}
                  </div>
                </div>
                <div class="m-side">
                  <span class="status">${STATUS[st]}</span>
                  <div class="begrip" role="group" aria-label="Begrip">
                    ${UNDERSTANDING.map(
                      (u) => `<button class="b-${u.id} ${progress[bk] === u.id ? "on" : ""}" data-begrip="${bk}" data-val="${u.id}" aria-pressed="${progress[bk] === u.id}" title="${u.label}">${u.short}</button>`
                    ).join("")}
                  </div>
                </div>
              </li>`;
            })
            .join("")}
        </ol>
      </section>`;
    })
    .join("")}`;
}

/* ---------- render ---------- */
function render(animate = false) {
  renderHeader();
  renderTabs();
  const view = $("#view");
  const c = course(tab);
  view.style.setProperty("--c", c ? c.color : "#1f2433");
  view.dataset.view = c ? "course" : tab;
  view.innerHTML = tab === "overzicht" ? viewOverview() : tab === "blok" ? viewBlok() : c ? viewCourse(c) : viewOverview();
  if (animate) {
    view.classList.remove("enter");
    void view.offsetWidth;
    view.classList.add("enter");
  }
  const input = view.querySelector(".rename, .page-rename, .module-form input[name='title']");
  if (input) {
    input.focus();
    input.select();
  }
}

function go(id) {
  if (id === tab) return;
  tab = id;
  editing = null;
  editingPages = null;
  addingSection = null;
  history.replaceState(null, "", `#${id}`);
  render(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- events ---------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, tr[data-tab]");
  if (!t) return;

  if (t.dataset.tab) return go(t.dataset.tab);

  if (t.dataset.addModule) {
    addingSection = t.dataset.addModule;
    return render();
  }

  if (t.dataset.cancelModule !== undefined) {
    addingSection = null;
    return render();
  }

  if (t.dataset.editPages) {
    editingPages = t.dataset.editPages;
    return render();
  }

  if (t.dataset.removeModule) {
    const [courseId, moduleId] = t.dataset.removeModule.split(":");
    const c = course(courseId);
    const m = c && modulesOf(c).find((item) => item.id === moduleId);
    if (c && m && window.confirm(`Verwijder "${titleOf(c, m)}" en de bijbehorende voortgang?`)) {
      removeModule(c, m);
    }
    return;
  }

  if (t.dataset.toggle) return setKey(t.dataset.toggle, isOn(t.dataset.toggle) ? null : "1");

  if (t.dataset.begrip) {
    const k = t.dataset.begrip;
    return setKey(k, progress[k] === t.dataset.val ? null : t.dataset.val);
  }

  if (t.dataset.edit) {
    editing = t.dataset.edit;
    return render();
  }

  if (t.dataset.taskToggle) {
    const task = tasks.find((x) => x.id === Number(t.dataset.taskToggle));
    if (!task) return;
    task.done = !task.done;
    render();
    try {
      setSync("saving", "Opslaan…");
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { done: task.done } });
      persistCache();
      setSync("ok", "Opgeslagen");
    } catch {
      task.done = !task.done;
      render();
      setSync("error", "Niet opgeslagen");
      toast("Kon de taak niet bijwerken. Probeer opnieuw.");
    }
    return;
  }

  if (t.dataset.taskDel) {
    const id = Number(t.dataset.taskDel);
    const before = tasks;
    tasks = tasks.filter((x) => x.id !== id);
    render();
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      persistCache();
    } catch {
      tasks = before;
      render();
      toast("Kon de taak niet verwijderen. Probeer opnieuw.");
    }
  }
});

document.addEventListener("submit", async (e) => {
  const moduleForm = e.target.closest?.("[data-module-form]");
  if (moduleForm) {
    e.preventDefault();
    addModule(moduleForm);
    return;
  }

  if (e.target.id !== "task-form") return;
  e.preventDefault();
  const form = e.target;
  const title = form.elements.title.value.trim();
  if (!title) return;
  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    setSync("saving", "Opslaan…");
    const task = await api("/api/tasks", { method: "POST", body: { title, course: form.elements.course.value } });
    tasks.push(task);
    persistCache();
    setSync("ok", "Opgeslagen");
    render();
    $("#task-form input")?.focus();
  } catch {
    btn.disabled = false;
    setSync("error", "Niet opgeslagen");
    toast("Kon de taak niet toevoegen. Ben je online?");
  }
});

const commitRename = (input) => {
  const key = input.dataset.rename;
  const val = input.value.trim();
  editing = null;
  const current = progress[key] || "";
  if (val === current) return render();
  setKey(key, val || null);
};
const commitPages = (input) => {
  const key = input.dataset.pageRename;
  const value = input.value.trim();
  if (value && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000)) {
    input.focus();
    toast("Vul een aantal pagina's tussen 1 en 10000 in.");
    return;
  }
  editingPages = null;
  const current = progress[key] || "";
  const normalized = value ? String(Number(value)) : "";
  if (normalized === current) return render();
  setKey(key, normalized || null);
};

function addModule(form) {
  const [courseId, sectionValue] = form.dataset.moduleForm.split(":");
  const c = course(courseId);
  const sectionIndex = Number(sectionValue);
  const title = form.elements.title.value.trim();
  const pageValue = form.elements.pages.value.trim();
  const pageCount = pageValue ? Number(pageValue) : null;
  if (!c || !Number.isInteger(sectionIndex) || !sectionsOf(c)[sectionIndex] || !title) return;
  if (pageValue && (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 10000)) {
    toast("Vul een aantal pagina's tussen 1 en 10000 in.");
    return;
  }

  const sectionModules = sectionsOf(c)[sectionIndex].modules;
  const lastNum = String(sectionModules.at(-1)?.num || "");
  const match = lastNum.match(/^(.*?)(\d+)$/);
  const prefix = match?.[1] || "";
  const matchingNumbers = modulesOf(c)
    .map((m) => String(m.num).match(/^(.*?)(\d+)$/))
    .filter((numberMatch) => numberMatch?.[1] === prefix);
  const nextNumber = Math.max(0, ...matchingNumbers.map((numberMatch) => Number(numberMatch[2]))) + 1;
  const timestamp = Date.now().toString(36);
  let suffix = 0;
  let id = `u${timestamp}`;
  while (progress[moduleRecordKey(c, id)]) id = `u${timestamp}${++suffix}`;
  const record = JSON.stringify({ section: sectionIndex, num: `${prefix}${nextNumber}`, title });
  if (record.length > 200) {
    toast("De modulegegevens zijn te lang om op te slaan.");
    return;
  }

  const changes = { [moduleRecordKey(c, id)]: record };
  if (pageCount !== null) changes[pagesKey(c, { id })] = String(pageCount);
  addingSection = null;
  setKeys(changes);
}

function removeModule(c, m) {
  const changes = {
    [m.custom ? moduleRecordKey(c, m.id) : removedModuleKey(c, m.id)]: m.custom ? null : "1",
    [labelKey(c, m)]: null,
    [pagesKey(c, m)]: null,
    [begripKey(c, m)]: null,
  };
  for (const part of m.parts) changes[partKey(c, m, part)] = null;
  for (const goal of GOALS.filter((item) => item.course === c.id)) {
    for (const column of goal.columns) changes[column.key(m)] = null;
  }
  editing = null;
  editingPages = null;
  setKeys(changes);
}

document.addEventListener("keydown", (e) => {
  const input = e.target.closest?.(".rename");
  const pageInput = e.target.closest?.(".page-rename");
  if (pageInput) {
    if (e.key === "Enter") commitPages(pageInput);
    if (e.key === "Escape") {
      editingPages = null;
      render();
    }
    return;
  }
  if (!input) return;
  if (e.key === "Enter") commitRename(input);
  if (e.key === "Escape") {
    editing = null;
    render();
  }
});
document.addEventListener(
  "blur",
  (e) => {
    if (e.target.classList?.contains("rename") && editing) commitRename(e.target);
    if (e.target.classList?.contains("page-rename") && editingPages) commitPages(e.target);
  },
  true
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !editing && !editingPages) load();
});
window.addEventListener("online", () => flush());

/* ---------- start ---------- */
const initial = location.hash.slice(1);
if (initial && (initial === "overzicht" || initial === "blok" || course(initial))) tab = initial;
render(true);
load();
