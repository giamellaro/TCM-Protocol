// app.js
import { getMeta, setMeta, addObservation as addObservationDB, listObservationsByLesson } from './db.js';

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

async function addObservation({ family, group, code, label, text }) {
  if (!lesson) return;

  const ts = nowIso();

  const obs = {
    id: uid(),
    lessonId: lesson.id,
    ts,
    relSec: lessonRelativeSeconds(ts),
    family,
    group,
    code,
    label,
    text
  };

  await addObservationDB(obs);
}

async function addNote() {
  if (!lesson) return;
  if (!noteInputEl) return;

  const text = noteInputEl.value.trim();
  if (!text) return;

  await addObservation({
    family: 'note',
    group: 'Notes',
    code: 'note',
    label: 'Note',
    text
  });

  noteInputEl.value = '';
}

async function getDomainCounts(domainLabel) {
  if (!lesson) return {};

  const observations = await listObservationsByLesson(lesson.id);
  const counts = {};

  for (const obs of observations) {
    if (obs.family === 'domain' && obs.group === domainLabel) {
      counts[obs.code] = (counts[obs.code] || 0) + 1;
    }
  }

  return counts;
}

async function getFamilyCounts(family) {
  if (!lesson) return {};

  const observations = await listObservationsByLesson(lesson.id);
  const counts = {};

  for (const obs of observations) {
    if (obs.family === family) {
      counts[obs.code] = (counts[obs.code] || 0) + 1;
    }
  }

  return counts;
}

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
const btnExportCsv = document.getElementById('btnExportCsv');
const btnExportJson = document.getElementById('btnExportJson');

const editorEl = document.getElementById('editor');

const relevanceChipsEl = document.getElementById('relevanceChips');
const moveChipsEl = document.getElementById('moveChips');
const purposeChipsEl = document.getElementById('purposeChips');
const mediaChipsEl = document.getElementById('mediaChips');
const originBlockEl = document.getElementById('originBlock');
const originChipsEl = document.getElementById('originChips');

const noteInputEl = document.getElementById('noteInput');
const btnAddNote = document.getElementById('btnAddNote');

// --------------------- STATE ---------------------
let lesson = null; // { id, userLessonId, startedAt }

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

  const doExport = confirm('Would you like to export CSV before ending the lesson?');
  if (doExport) {
    await exportCsv();
  }

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

  // Clear lesson
  lesson = null;
  await setMeta('lesson', null);

  undoStack = [];

  // Clear lesson ID field in the UI
  if (lessonIdInput) lessonIdInput.value = '';

  await refresh(false);
}


// --------------------- RENDERING ---------------------

async function renderDomain(domainKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const domain = DOMAINS.find((d) => d.key === domainKey);
  if (!domain) return;

  const counts = await getDomainCounts(domain.label);

  for (const group of domain.groups) {
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'gtitle';
    sectionTitle.textContent = group.label;
    container.appendChild(sectionTitle);

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'chips';

    for (const item of group.items) {
      const label = `${group.label} > ${item}`;
      const count = counts[label] || 0;

      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = `${item} (${count})`;

      btn.addEventListener('click', async () => {
        await addObservation({
          family: 'domain',
          group: domain.label,
          code: label,
          label
        });

        await refresh();
      });

      chipsWrap.appendChild(btn);
    }

    container.appendChild(chipsWrap);
  }
}

async function renderAllDomains() {
  await renderDomain('people', 'domain_people');
  await renderDomain('culture', 'domain_culture');
  await renderDomain('science_practices', 'domain_science_practices');
  await renderDomain('data', 'domain_data');
  await renderDomain('place_time', 'domain_place_time');
  await renderDomain('society', 'domain_society');
  await renderDomain('other_academic', 'domain_other_academic');
}

async function renderFamilyChips({ containerId, family, options, familyClass, groupLabel }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const counts = await getFamilyCounts(family);

  for (const opt of options) {
    const count = counts[opt.key] || 0;

    const btn = document.createElement('button');
    btn.className = 'chip';
    if (familyClass) btn.classList.add(familyClass);
    btn.textContent = `${opt.label} (${count})`;

    btn.addEventListener('click', async () => {
      await addObservation({
        family,
        group: groupLabel,
        code: opt.key,
        label: opt.label
      });

      await renderAllRightColumn();
    });

    container.appendChild(btn);
  }
}

async function renderAllRightColumn() {
  await renderFamilyChips({
    containerId: 'relevanceChips',
    family: 'relevance',
    options: RELEVANCE,
    familyClass: 'relevance',
    groupLabel: 'Data Nugget Relevance'
  });

  await renderFamilyChips({
    containerId: 'moveChips',
    family: 'move',
    options: MOVES,
    familyClass: 'move',
    groupLabel: 'Instructional Move'
  });

  await renderFamilyChips({
    containerId: 'purposeChips',
    family: 'purpose',
    options: PURPOSE,
    familyClass: 'purpose',
    groupLabel: 'Perceived Purpose'
  });

  await renderFamilyChips({
    containerId: 'mediaChips',
    family: 'media',
    options: MEDIA,
    familyClass: 'media',
    groupLabel: 'Media'
  });

  await renderFamilyChips({
    containerId: 'originChips',
    family: 'origin',
    options: ORIGIN,
    familyClass: 'origin',
    groupLabel: 'Origin'
  });
}


// --------------------- EXPORT ---------------------
function toCsvValue(v) {
  const s = (v ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
async function exportJson() {
  if (!lesson) return;

  const userLessonId =
    (lesson.userLessonId ?? '').trim() ||
    (lessonIdInput?.value ?? '').trim() ||
    lesson.id;

  const safeLessonId = String(userLessonId)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 60);

  const observations = await listObservationsByLesson(lesson.id);

  const payload = {
    lesson: {
      ...lesson,
      userLessonId
    },
    exportedAt: nowIso(),
    observations: observations.slice().sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      return ta - tb;
    })
  };

  downloadText(
    `tcm_observations_${safeLessonId}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

async function exportCsv() {
  if (!lesson) return;

  const userLessonId =
    (lesson.userLessonId ?? '').trim() ||
    (lessonIdInput?.value ?? '').trim() ||
    lesson.id;

  const safeLessonId = String(userLessonId)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 60);

  const observations = await listObservationsByLesson(lesson.id);

  const header = [
    'userLessonId',
    'lessonId',
    'observationId',
    'ts',
    'relSec',
    'family',
    'group',
    'code',
    'label',
    'text'
  ];

  const rows = [header.join(',')];

  const sorted = observations.slice().sort((a, b) => {
    const ta = new Date(a.ts).getTime();
    const tb = new Date(b.ts).getTime();
    return ta - tb;
  });

  for (const obs of sorted) {
    rows.push(
      [
        userLessonId,
        obs.lessonId ?? '',
        obs.id ?? '',
        obs.ts ?? '',
        obs.relSec ?? '',
        obs.family ?? '',
        obs.group ?? '',
        obs.code ?? '',
        obs.label ?? '',
        obs.text ?? ''
      ]
        .map(toCsvValue)
        .join(',')
    );
  }

  downloadText(`tcm_observations_${safeLessonId}.csv`, rows.join('\n'), 'text/csv');
}

// --------------------- WIRES ---------------------
if (btnStartLesson) btnStartLesson.addEventListener('click', startLesson);
if (btnEndLesson) btnEndLesson.addEventListener('click', endLesson);
if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsv);
if (btnExportJson) btnExportJson.addEventListener('click', exportJson);
if (btnAddNote) btnAddNote.addEventListener('click', addNote);

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
if (btnAddNote) btnAddNote.addEventListener('click', addNote);


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
async function refresh() {
  await loadLesson();
  await renderAllDomains();
  await renderAllRightColumn();
}

// boot
(async () => {
  await registerSw();
  await refresh();
})();
