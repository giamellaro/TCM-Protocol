// app.js
import { getMeta, setMeta, upsertEvent, getEvent, listEvents } from './db.js';

/**
 * TCM Event Logger (offline-first PWA)
 * - Active event pinned; editable as codes “evolve”
 * - Multi-select for relevance/move/purpose/origin (no mutual exclusivity)
 * - Hierarchical domain picker (Domain > Group > Item)
 * - Domain-colored tags (base color; sub-tags lighter via CSS using --dc)
 * - Auto-close after inactivity (configurable)
 * - CSV/JSON export
 */

/** ✅ Tweak #3: keep event open longer */
const AUTO_CLOSE_MS = 120000; // 120s inactivity -> auto-close

const nowIso = () => new Date().toISOString();

// --------------------- CODEBOOK STRUCTURE ---------------------
// Add/adjust colors as you like (hex).
const DOMAINS = [
  {
    key: 'people',
    label: 'People',
    color: '#2a5bd7',
    groups: [
      { label: 'Scientist', items: ['A specific scientist', 'Generalized scientist'] },
      { label: 'Self', items: ["Teacher’s own experience"] },
      {
        label: 'Student(s)',
        items: ['Experience outside school', 'Experience in school', 'As scientists']
      },
      { label: 'People impacted by the topic', items: ['(general)'] },
      { label: 'Other', items: ['Any other people'] }
    ]
  },
  {
    key: 'culture',
    label: 'Culture / Linguistics',
    color: '#d07a2f',
    groups: [
      {
        label: 'Language',
        items: [
          'Translanguaging (place/species/other names)',
          'Mnemonic device',
          'Analogy or metaphor',
          'Classroom / “fun” language',
          'Connect science words to everyday language'
        ]
      },
      {
        label: 'Culture',
        items: [
          'Place-based cultural references',
          'Pop culture, media',
          'Knowledge system outside science',
          'Science as culture',
          'Diversity (ideas, people)',
          'Other cultural references'
        ]
      }
    ]
  },
  {
    key: 'science_practices',
    label: 'Science Practices',
    color: '#2fa86a',
    groups: [
      {
        label: 'Science Practices',
        items: [
          'Research questions',
          'Models (not data models)',
          'Investigations or methods',
          'Explanations & Arguments',
          'Surfacing assumptions',
          'Specific scientific phenomenon',
          'Consensus model(s) or ideas'
        ]
      }
    ]
  },
  {
    key: 'data',
    label: 'Data',
    color: '#7a4fd3',
    groups: [
      {
        label: 'Data',
        items: [
          'Data',
          'Data collection',
          'Data analysis',
          'Graphs/tables/other data models',
          'Local data',
          'Limitations of data',
          'Data points as phenomena in real contexts',
          'Bias and variable interpretation',
          'Sources of error'
        ]
      }
    ]
  },
  {
    key: 'place_time',
    label: 'Physical Setting / Time',
    color: '#2f9ea6',
    groups: [
      {
        label: 'Physical setting / geography',
        items: [
          'Specific place',
          'Multiple places/environments',
          'Maps',
          'Specific organisms',
          'Geographical relationship',
          'Abiotic characteristics',
          'Other physical/environmental detail',
          'Affective response (awe/wonder/fear/etc.)',
          'Other sense of place'
        ]
      },
      { label: 'Time', items: ['Passage of time, deep time'] }
    ]
  },
  {
    key: 'society',
    label: 'Society / Events / Values',
    color: '#c84b62',
    groups: [
      { label: 'Historical', items: ['event', 'issue'] },
      { label: 'Current local', items: ['event', 'issue'] },
      { label: 'Current non-local', items: ['event', 'issue'] },
      {
        label: 'Values or ethics',
        items: ['scenario', 'teacher judgement', 'student judgement']
      },
      { label: 'Activism', items: ['Student Agency', "Others’ activism"] }
    ]
  },
  {
    key: 'other_academic',
    label: 'Other Academic Subjects',
    color: '#8e8e93',
    groups: [{ label: 'Other academic subjects', items: ['Other science', 'Non-science'] }]
  }
];

const RELEVANCE = [
  { key: 'D', label: 'Direct' },
  { key: 'A', label: 'Associated' },
  { key: 'H', label: 'Hypothetic' },
  { key: 'U', label: 'Unrelated' },
  { key: 'O', label: 'Other' }
];

const MOVES = [
  { key: 'R', label: 'Reference' },
  { key: 'E', label: 'Explanation' },
  { key: 'S', label: 'Story' },
  { key: 'A', label: 'Analogy' },
  { key: 'V', label: 'Visualization' },
  { key: 'RP', label: 'Role Play' }
];

const PURPOSE = [
  { key: 'H', label: 'Humanizing' },
  { key: 'R', label: 'Relevance' },
  { key: 'E', label: 'Elaboration' },
  { key: 'T', label: 'Transfer' },
  { key: 'U', label: 'Unsure' }
];

const MEDIA = [
  { key: 'P', label: 'Picture' },
  { key: 'V', label: 'Video' },
  { key: 'A', label: 'Audio' },
  { key: 'CT', label: 'Chart/Table' },
  { key: 'DM', label: 'Digital Model' },
  { key: 'PM', label: 'Physical Model' }
];

const ORIGIN = [
  { key: 'S', label: "Scientists’" },
  { key: 'T', label: "Teacher’s" },
  { key: 'U', label: "Students’" }
];

// --------------------- UI REFERENCES ---------------------
const lessonMeta = document.getElementById('lessonMeta');
const btnStartLesson = document.getElementById('btnStartLesson');
const btnEndLesson = document.getElementById('btnEndLesson');
const btnInstall = document.getElementById('btnInstall');
const lessonIdInput = document.getElementById('lessonIdInput');
const btnNewEvent = document.getElementById('btnNewEvent');
const btnCloseActive = document.getElementById('btnCloseActive');
const btnUndo = document.getElementById('btnUndo');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnExportJson = document.getElementById('btnExportJson');

const activeEventEl = document.getElementById('activeEvent');
const editorEl = document.getElementById('editor');
const eventsListEl = document.getElementById('eventsList');

const domainButtonsEl = document.getElementById('domainButtons');
const domainPickerEl = document.getElementById('domainPicker');

const relevanceChipsEl = document.getElementById('relevanceChips');
const moveChipsEl = document.getElementById('moveChips');
const purposeChipsEl = document.getElementById('purposeChips');
const mediaChipsEl = document.getElementById('mediaChips');
const originBlockEl = document.getElementById('originBlock');
const originChipsEl = document.getElementById('originChips');

const notesEl = document.getElementById('notes');
const btnSaveNotes = document.getElementById('btnSaveNotes');

// --------------------- STATE ---------------------
let lesson = null; // { id, startedAt }
let activeEventId = null;
let undoStack = [];
let autoCloseTimer = null;
let editNoClock = false; // true only when using the list "Edit" button
let pickerDomainKey = null; // which domain picker is currently open
// --------------------- HELPERS ---------------------
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
}

function lessonRelativeSeconds(isoTime) {
  if (!lesson?.startedAt) return null;
  const t0 = new Date(lesson.startedAt).getTime();
  const t = new Date(isoTime).getTime();
  return Math.max(0, Math.round((t - t0) / 1000));
}

function chip(label, isOn, onClick) {
  const b = document.createElement('button');
  b.className = 'chip' + (isOn ? ' on' : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function tag(text, isOn = false) {
  const span = document.createElement('span');
  span.className = 'tag' + (isOn ? ' on' : '');
  span.textContent = text;
  return span;
}

function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Defensive normalization so older test events don’t break after upgrades */
function normalizeEvent(ev) {
  if (!ev) return ev;

  // multi-select fields: ensure arrays
  const toArr = (v) => {
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    if (typeof v === 'string' && v.length) return [v];
    return [];
  };

  ev.relevance = toArr(ev.relevance);
  ev.move = toArr(ev.move);
  ev.purpose = toArr(ev.purpose);
  ev.origin = toArr(ev.origin);
  ev.media = toArr(ev.media);
  
  // domains: ensure array
  if (!Array.isArray(ev.domains)) ev.domains = [];

  // if no science practices domain, clear origin
  const hasSP = ev.domains.some((d) => d.domainKey === 'science_practices');
  if (!hasSP) ev.origin = [];

  return ev;
}

function pushUndo(snapshot) {
  undoStack.push(structuredClone(snapshot));
  if (undoStack.length > 50) undoStack.shift();
}

// --------------------- AUTO-CLOSE ---------------------
function setAutoClose() {
  clearTimeout(autoCloseTimer);
  if (!activeEventId) return;
  autoCloseTimer = setTimeout(async () => {
    const ev = normalizeEvent(await getEvent(activeEventId));
    if (!ev) return;
    if (ev.status === 'closed') return;

    ev.status = 'closed';
    ev.closedAt = nowIso();
    await upsertEvent(ev);
    await refresh();
  }, AUTO_CLOSE_MS);
}

// --------------------- LESSON META ---------------------
async function loadLesson() {
  lesson = await getMeta('lesson');
  if (!lesson) {
    lessonMeta.textContent = 'Lesson: not started';
    return;
  }
  if (lessonIdInput) lessonIdInput.value = lesson.userLessonId || '';
const shortId = (lesson?.id ?? '').toString().slice(0, 8);
lessonMeta.textContent = `Lesson started ${new Date(lesson.startedAt).toLocaleString()} (id: ${shortId})`;
}

async function startLesson() {
  const userLessonId = (lessonIdInput?.value ?? '').trim();

  lesson = {
  id: uid(),                  // keep internal id stable/unique
  userLessonId: userLessonId.length ? userLessonId : '',  // store what user typed
  startedAt: nowIso()
};

  await setMeta('lesson', lesson);
  if (lessonIdInput) lessonIdInput.value = lesson.userLessonId ?? '';
  await setMeta('eventCounter', 0);
  activeEventId = null;
  await setMeta('activeEventId', null);
  undoStack = [];
  await refresh();
}

async function endLesson() {
  if (!lesson) return;

  const confirmEnd = confirm('End this lesson? This will close any active event.');
  if (!confirmEnd) return;

  // Close active event if needed
  if (activeEventId) {
    const ev = normalizeEvent(await getEvent(activeEventId));
    if (ev && ev.status !== 'closed') {
      ev.status = 'closed';
      ev.closedAt = nowIso();
      await upsertEvent(ev);
    }
  }

  // Clear active state
  activeEventId = null;
  await setMeta('activeEventId', null);

  // Clear lesson (this is key)
  lesson = null;
  await setMeta('lesson', null);

  undoStack = [];

  await refresh();
}
// --------------------- EVENT CRUD ---------------------
async function nextEventNumber() {
  const counter = await getMeta('eventCounter');
  const next = (counter ?? 0) + 1;
  await setMeta('eventCounter', next);
  return next;
}

async function newEvent() {
  resetDomainPickerUI();

  editNoClock = false;
  
  if (!lesson) await startLesson();

  // close previous active event if still open (you can re-open from list)
  if (activeEventId) {
    const prev = normalizeEvent(await getEvent(activeEventId));
    if (prev && prev.status !== 'closed') {
      prev.status = 'closed';
      prev.closedAt = nowIso();
      await upsertEvent(prev);
    }
  }

  const createdAt = nowIso();
  const ev = normalizeEvent({
    id: uid(),
    lessonId: lesson.id,
    n: await nextEventNumber(),
    createdAt,
    createdRelSec: lessonRelativeSeconds(createdAt),
    lastEditAt: createdAt,
    lastEditRelSec: lessonRelativeSeconds(createdAt),
    status: 'active',

    // domains: multi-tag
    domains: [],

    /** ✅ Tweak #4: multi-select (no mutual exclusivity) */
    relevance: [],
    move: [],
    purpose: [],
    origin: [],

    notes: ''
  });

  await upsertEvent(ev);
  activeEventId = ev.id;
  await setMeta('activeEventId', activeEventId);
  undoStack = [];
  setAutoClose();
  await refresh();
}

async function closeActive() {
  resetDomainPickerUI();
  editNoClock = false;
  if (!activeEventId) return;
  const ev = normalizeEvent(await getEvent(activeEventId));
  if (!ev) return;

  if (ev.status !== 'closed') {
    ev.status = 'closed';
    ev.closedAt = nowIso();
    await upsertEvent(ev);
  }

  activeEventId = null;
  await setMeta('activeEventId', null);
  undoStack = [];
  await refresh();
}

async function setActive(id) {
  editNoClock = false;
  const ev = normalizeEvent(await getEvent(id));
  if (!ev) return;

  // re-open for editing (common in real-time coding)
  ev.status = 'active';
  ev.lastEditAt = nowIso();
  ev.lastEditRelSec = lessonRelativeSeconds(ev.lastEditAt);
  await upsertEvent(ev);

  activeEventId = id;
  await setMeta('activeEventId', activeEventId);
  undoStack = [];
  setAutoClose();
  await refresh();
}
async function editWithoutReopen(id) {
  const ev = normalizeEvent(await getEvent(id));
  if (!ev) return;

  editNoClock = true;   // ✅ enable silent edit mode

  activeEventId = id;

  // DO NOT persist as active event
  // await setMeta('activeEventId', activeEventId);

  clearTimeout(autoCloseTimer); // ✅ no auto-close ticking

  await refresh(false); // ✅ do not reload activeEventId from meta
}
async function updateActive(mutator) {
  if (!activeEventId) return;
  const ev = normalizeEvent(await getEvent(activeEventId));
  if (!ev) return;

  pushUndo(ev);
  mutator(ev);

  // re-normalize after mutation
  normalizeEvent(ev);

  if (!editNoClock) {
  ev.lastEditAt = nowIso();
  ev.lastEditRelSec = lessonRelativeSeconds(ev.lastEditAt);
}

await upsertEvent(ev);

if (!editNoClock) setAutoClose();

await refresh(false);
}

async function undo() {
  if (!activeEventId) return;
  if (undoStack.length === 0) return;

  const prev = normalizeEvent(undoStack.pop());
  prev.lastEditAt = nowIso();
  prev.lastEditRelSec = lessonRelativeSeconds(prev.lastEditAt);

  await upsertEvent(prev);
  await refresh(false);
}
function resetDomainPickerUI() {
  pickerDomainKey = null;
  domainPickerEl.classList.add('hidden');
  domainPickerEl.classList.remove('tinted');
  domainPickerEl.innerHTML = '';
  document.querySelector('.editor-grid')?.classList.remove('picker-open');
  originBlockEl.style.display = 'none';
}
function setOriginVisibility(ev) {
  const hasSPSelection = (ev?.domains ?? []).some(
    (d) => d.domainKey === 'science_practices'
  );

  const isSciencePickerOpen =
    pickerDomainKey === 'science_practices' &&
    !domainPickerEl.classList.contains('hidden');

  originBlockEl.style.display =
    hasSPSelection && isSciencePickerOpen ? 'block' : 'none';
}
// --------------------- RENDERING ---------------------
function renderDomainButtons() {
  domainButtonsEl.innerHTML = '';
  for (const d of DOMAINS) {
    const b = chip(d.label, false, async () => await openDomainPicker(d));
    b.classList.add('domain-btn');
    if (d.color) b.style.setProperty('--dc', d.color);
    domainButtonsEl.appendChild(b);
  }
}
async function openDomainPicker(domain) {
  pickerDomainKey = domain.key;

  domainPickerEl.classList.remove('hidden');
  domainPickerEl.innerHTML = '';
  domainPickerEl.classList.add('tinted');
  if (domain.color) domainPickerEl.style.setProperty('--dc', domain.color);
  document.querySelector('.editor-grid')?.classList.add('picker-open');

  const title = document.createElement('div');
  title.className = 'gtitle';
  title.textContent = `${domain.label} – choose`;
  domainPickerEl.appendChild(title);

  // pull current selections for this domain (so chips show ON correctly)
  const ev = activeEventId ? normalizeEvent(await getEvent(activeEventId)) : null;
  setOriginVisibility(ev);

  const selected = new Set(
    (ev?.domains ?? [])
      .filter((x) => x.domainKey === domain.key)
      .map((x) => x.subLabel)
  );

  const groups = domain.groups ?? [{ label: domain.label, items: domain.subs ?? [] }];

  for (const g of groups) {
    const section = document.createElement('div');
    section.className = 'group';

    const gtitle = document.createElement('div');
    gtitle.className = 'gtitle';
    gtitle.textContent = g.label;
    section.appendChild(gtitle);

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'chips';

    for (const item of g.items) {
      const subLabel = `${g.label} > ${item}`;

      const c = chip(item, selected.has(subLabel), async () => {
        await updateActive((ev2) => {
          const idx = ev2.domains.findIndex(
            (x) => x.domainKey === domain.key && x.subLabel === subLabel
          );

          if (idx >= 0) {
            ev2.domains.splice(idx, 1);
            c.classList.remove('on');
            selected.delete(subLabel);
          } else {
            ev2.domains.push({
              domainKey: domain.key,
              domainLabel: domain.label,
              subLabel
            });
            c.classList.add('on');
            selected.add(subLabel);
          }

          const hasSP = ev2.domains.some((x) => x.domainKey === 'science_practices');
          if (!hasSP) ev2.origin = [];
        });

        const evNow = activeEventId ? normalizeEvent(await getEvent(activeEventId)) : null;
        setOriginVisibility(evNow);

        // ✅ do NOT close picker
      });

      chipsWrap.appendChild(c);
    }

    section.appendChild(chipsWrap);
    domainPickerEl.appendChild(section);
  }

  const closeRow = document.createElement('div');
  closeRow.className = 'row';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn done-btn';
  closeBtn.textContent = 'Done';
  closeBtn.onclick = async () => {
    resetDomainPickerUI(); // hides picker + removes picker-open class
    const evNow = activeEventId ? normalizeEvent(await getEvent(activeEventId)) : null;
    setOriginVisibility(evNow); // update origin visibility after closing picker
  };

  closeRow.appendChild(closeBtn);
  domainPickerEl.appendChild(closeRow);
}

function renderMultiChoiceChips(container, options, currentArr, onToggle, familyClass) {
  container.innerHTML = '';
  const set = new Set(currentArr ?? []);

  for (const o of options) {
    const on = set.has(o.key);
    const c = chip(o.label, on, () => {
  resetDomainPickerUI();
  onToggle(o.key);
});
    if (familyClass) c.classList.add(familyClass);
    container.appendChild(c);
  }
}

async function renderActive() {
  if (!activeEventId) {
    activeEventEl.className = 'card empty';
    activeEventEl.innerHTML = `<div class="muted">No active event. Tap <b>New Event</b>.</div>`;
    editorEl.classList.add('hidden');
    return;
  }

  const ev = normalizeEvent(await getEvent(activeEventId));
  if (!ev) return;

  editorEl.classList.remove('hidden');
  activeEventEl.className = 'card';

  const start = new Date(ev.createdAt);
  const rel = ev.createdRelSec ?? '';
  const status = ev.status;

  // header
  activeEventEl.innerHTML = `
    <div class="top">
      <div><b>Event #${ev.n}</b> <span class="muted">(${status})</span></div>
      <div class="muted">${start.toLocaleTimeString()} ${rel !== '' ? `• t+${rel}s` : ''}</div>
    </div>
    <div class="muted">Last edit: ${new Date(ev.lastEditAt).toLocaleTimeString()} ${ev.lastEditRelSec != null ? `• t+${ev.lastEditRelSec}s` : ''}</div>
  `;

  // tags
  const tagsWrap = document.createElement('div');
  tagsWrap.className = 'tags';

  /** ✅ Tweak #2: domain-colored tags + lighter subdomain tags */
  for (const d of ev.domains) {
    const t = tag(`${d.domainLabel}: ${d.subLabel}`);
    t.classList.add('domain', 'sub');
    t.style.cursor = 'pointer';
    t.title = 'Tap to remove';

    const def = DOMAINS.find((x) => x.key === d.domainKey);
    if (def?.color) t.style.setProperty('--dc', def.color);

    t.onclick = async () => {
      await updateActive((evv) => {
        evv.domains = evv.domains.filter(
          (x) => !(x.domainKey === d.domainKey && x.subLabel === d.subLabel)
        );
        const hasSP = evv.domains.some((x) => x.domainKey === 'science_practices');
        if (!hasSP) evv.origin = [];
      });
    };

    tagsWrap.appendChild(t);
  }

  if (ev.relevance?.length) tagsWrap.appendChild(tag(`Data Nugget Relevance: ${ev.relevance.join('+')}`, true));
  if (ev.move?.length) tagsWrap.appendChild(tag(`Move: ${ev.move.join('+')}`, true));
  if (ev.purpose?.length) tagsWrap.appendChild(tag(`Purpose: ${ev.purpose.join('+')}`, true));
  if (ev.media?.length) tagsWrap.appendChild(tag(`Media: ${ev.media.join('+')}`, true));
  if (ev.origin?.length) tagsWrap.appendChild(tag(`Origin: ${ev.origin.join('+')}`, true));
  if (status === 'closed') tagsWrap.appendChild(tag('CLOSED'));

  activeEventEl.appendChild(tagsWrap);

  // notes editor
  notesEl.value = ev.notes ?? '';

  // origin only if any science practices domain
  setOriginVisibility(ev);

  // chips: multi-select toggles
renderMultiChoiceChips(
  relevanceChipsEl,
  RELEVANCE,
  ev.relevance,
  (k) =>
    updateActive((e) => {
      e.relevance = e.relevance ?? [];
      e.relevance = e.relevance.includes(k)
        ? e.relevance.filter((x) => x !== k)
        : [...e.relevance, k];
    }),
  'relevance'
);

renderMultiChoiceChips(
  moveChipsEl,
  MOVES,
  ev.move,
  (k) =>
    updateActive((e) => {
      e.move = e.move ?? [];
      e.move = e.move.includes(k)
        ? e.move.filter((x) => x !== k)
        : [...e.move, k];
    }),
  'move'
);

 renderMultiChoiceChips(
  purposeChipsEl,
  PURPOSE,
  ev.purpose,
  (k) =>
    updateActive((e) => {
      e.purpose = e.purpose ?? [];
      e.purpose = e.purpose.includes(k)
        ? e.purpose.filter((x) => x !== k)
        : [...e.purpose, k];
    }),
  'purpose'
);

renderMultiChoiceChips(
  mediaChipsEl,
  MEDIA,
  ev.media,
  (k) =>
    updateActive((e) => {
      e.media = e.media ?? [];
      e.media = e.media.includes(k)
        ? e.media.filter((x) => x !== k)
        : [...e.media, k];
    }),
  'media'
);

  renderMultiChoiceChips(
  originChipsEl,
  ORIGIN,
  ev.origin,
  (k) =>
    updateActive((e) => {
      e.origin = e.origin ?? [];
      e.origin = e.origin.includes(k)
        ? e.origin.filter((x) => x !== k)
        : [...e.origin, k];
    }),
  'origin'
);

  renderDomainButtons();
}

async function renderList() {
  eventsListEl.innerHTML = '';
  if (!lesson) {
    eventsListEl.innerHTML = `<div class="muted">Start a lesson to begin.</div>`;
    return;
  }

  const events = (await listEvents(lesson.id)).map(normalizeEvent);
  if (events.length === 0) {
    eventsListEl.innerHTML = `<div class="muted">No events yet.</div>`;
    return;
  }

  for (const ev of events.slice(0, 100)) {
    const div = document.createElement('div');
    div.className = 'item';
    div.onclick = () => setActive(ev.id);

    const t = new Date(ev.createdAt);
    div.innerHTML = `
      <div class="top">
        <div>
          <b>#${ev.n}</b>
          <span class="muted">${ev.status === 'closed' ? '(closed)' : '(active)'}</span>
        </div>

        <div class="row" style="gap:8px; align-items:center;">
          <div class="muted">
            ${t.toLocaleTimeString()}
            ${ev.createdRelSec != null ? `• t+${ev.createdRelSec}s` : ''}
          </div>
          <button type="button" class="btn btn-mini" data-edit="${ev.id}">Edit</button>
        </div>
      </div>
    `;

    const tags = document.createElement('div');
    tags.className = 'tags';

    // show up to 2 domain tags
    for (const d of ev.domains.slice(0, 2)) {
      const def = DOMAINS.find((x) => x.key === d.domainKey);
      const ttag = tag(d.domainLabel);
      if (def?.color) {
        ttag.classList.add('domain', 'sub');
        ttag.style.setProperty('--dc', def.color);
      }
      tags.appendChild(ttag);
    }

    if (ev.domains.length > 2) {
      tags.appendChild(tag(`+${ev.domains.length - 2} more`));
    }

    if (ev.relevance?.length) {
      tags.appendChild(tag(`Rel ${ev.relevance.join('+')}`, true));
    }
    if (ev.move?.length) {
      tags.appendChild(tag(`Move ${ev.move.join('+')}`, true));
    }
    if (ev.purpose?.length) {
      tags.appendChild(tag(`Purp ${ev.purpose.join('+')}`, true));
    }

    // Attach Edit button handler (does NOT restart clock)
    const editBtn = div.querySelector('[data-edit]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editWithoutReopen(ev.id);
      });
    }

    div.appendChild(tags);
    eventsListEl.appendChild(div);
  }
}
// --------------------- EXPORT ---------------------
function toCsvValue(v) {
  const s = (v ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
async function exportJson() {
  if (!lesson) return;

  // The user-entered lesson id (falls back to internal id if blank)
  const userLessonId = (lessonIdInput?.value ?? '').trim() || lesson.id;

  // Safe filename version
  const safeLessonId = String(userLessonId)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 60);

  const events = (await listEvents(lesson.id)).map(normalizeEvent);

  const payload = {
    lesson: {
      ...lesson,              // keeps internal UUID id
      userLessonId            // adds readable label
    },
    exportedAt: nowIso(),
    events
  };

  downloadText(
    `tcm_lesson_${safeLessonId}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

async function exportCsv() {
  if (!lesson) return;
  const safeLessonId = (lesson.id ?? 'lesson')
  .toString()
  .trim()
  .replace(/[^a-z0-9_-]/gi, '_')
  .slice(0, 60);
  const events = (await listEvents(lesson.id)).map(normalizeEvent);

 const header = [
  'userLessonId',
  'lessonId',
  'eventId',
  'eventN',
  'status',
  'createdAt',
  'createdRelSec',
  'lastEditAt',
  'lastEditRelSec',
  'closedAt',
  'domains',
  'relevance',
  'move',
  'purpose',
  'media',
  'origin',
  'notes'
];

  const rows = [header.join(',')];

  for (const ev of events.slice().sort((a, b) => a.n - b.n)) {
    const domains = (ev.domains ?? [])
      .map((d) => `${d.domainLabel}::${d.subLabel}`)
      .join(' | ');

   const userLessonId = (lessonIdInput?.value ?? '').trim() || lesson.id;

   rows.push(
  [
    userLessonId,
    ev.lessonId,
    ev.id,
    ev.n,
        ev.status,
        ev.createdAt,
        ev.createdRelSec,
        ev.lastEditAt,
        ev.lastEditRelSec,
        ev.closedAt ?? '',
        domains,
        (ev.relevance ?? []).join('+'),
        (ev.move ?? []).join('+'),
        (ev.purpose ?? []).join('+'),
        (ev.media ?? []).join('+'),
        (ev.origin ?? []).join('+'),
        ev.notes ?? ''
      ]
        .map(toCsvValue)
        .join(',')
    );
  }

  downloadText(`tcm_lesson_${safeLessonId}.csv`, rows.join('\n'), 'text/csv');
}

// --------------------- WIRES ---------------------
// --------------------- INSTALL (PWA) ---------------------
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (btnInstall) btnInstall.classList.remove('hidden');
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    btnInstall.classList.add('hidden');
  });
}
if (btnStartLesson) btnStartLesson.addEventListener('click', startLesson);
if (btnEndLesson) btnEndLesson.addEventListener('click', endLesson);
if (btnNewEvent) btnNewEvent.addEventListener('click', newEvent);
if (btnCloseActive) btnCloseActive.addEventListener('click', closeActive);
if (btnUndo) btnUndo.addEventListener('click', undo);
if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsv);
if (btnExportJson) btnExportJson.addEventListener('click', exportJson);

if (btnSaveNotes) {
  btnSaveNotes.addEventListener('click', async () => {
    await updateActive((ev) => {
      ev.notes = notesEl.value ?? '';
    });
  });
}

// ✅ Auto-save notes (crash protection)
function debounce(fn, ms = 450) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const autosaveNotes = debounce(async () => {
  if (!activeEventId) return;
  await updateActive((ev) => {
    ev.notes = notesEl.value ?? '';
  });
}, 450);

if (notesEl) {
  notesEl.addEventListener('input', autosaveNotes);

  // Save immediately when the user leaves the box
  notesEl.addEventListener('blur', async () => {
    if (!activeEventId) return;
    await updateActive((ev) => {
      ev.notes = notesEl.value ?? '';
    });
  });
}

// Save immediately when app is backgrounded (tab switch, iPad multitask, etc.)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'hidden') return;
  if (!activeEventId) return;

  try {
    await updateActive((ev) => {
      ev.notes = notesEl.value ?? '';
    });
  } catch {
    // best-effort only
  }
});

// --------------------- SERVICE WORKER ---------------------
async function registerSw() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js');

    // If a new SW is waiting, activate it immediately
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload once when the new SW takes control (one-time)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (e) {
    console.warn('SW register failed:', e);
  }
}

// --------------------- REFRESH ---------------------
async function refresh(reloadActiveId = true) {
  await loadLesson();
  if (reloadActiveId) {
    activeEventId = await getMeta('activeEventId');
  }
  await renderActive();
  await renderList();
}

// boot
(async () => {
  await registerSw();
  await refresh();
})();
