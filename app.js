// app.js
import { getMeta, setMeta, addObservation as addObservationDB, listObservationsByLesson, deleteObservation } from './db.js';


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

async function openNotesPanel() {
  await renderNotesPanel();
  if (notesPanelEl) notesPanelEl.classList.remove('hidden');
}

function closeNotesPanel() {
  if (notesPanelEl) notesPanelEl.classList.add('hidden');
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
        label: '',
        items: [
          'Research questions',
          'Models (not data models)',
          'Investigations or methods',
          'Explanations & Arguments (CER)',
          'Background Info/Assumptions',
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
        label: '',
        items: [
          'Specific Data',
          'Collecting data',
          'Analyzing data',
          'Graphs/tables/other data models',
          'Local data',
          'Limitations of data',
          'Data as phenomena in real contexts',
          'Bias & variable interpretation',
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
      label: '',
      items: [
        'Specific place',
        'Multiple places/environments',
        'Maps',
        'Specific organisms',
        'Geographical relationship',
        'Abiotic characteristics',
        'Other physical/environmental detail',
        'Affective response (awe/wonder/fear/etc.)',
        'Other sense of place',
        'Passage of time, deep time'
      ]
    }
  ]
},
  
  {
  key: 'society',
  label: 'Issues & Society',
  color: '#a21caf',
  groups: [
    {
      label: '',
      items: [
        'Issue',
        'Event',
        'Current',
        'Historical',
        'Local',
        'Non-local',
        'Ethic/judgement',
        'Activism'
      ]
    }
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
  { key: 'U', label: 'Unrelated' },
];

const MOVES = [
  { key: 'R', label: 'Simple Reference' },
  { key: 'E', label: 'Explanation' },
  { key: 'S', label: 'Story' },
  { key: 'A', label: 'Analogy' },
  { key: 'V', label: 'Visualization' },
  { key: 'RP', label: 'Role Play' }
];

const MEDIA = [
  { key: 'P', label: 'Picture' },
  { key: 'V', label: 'Video' },
  { key: 'A', label: 'Audio' },
  { key: 'CT', label: 'Chart/Table' },
  { key: 'DM', label: 'Digital Model' },
  { key: 'PM', label: 'Physical Model' }
];

// --------------------- UI REFERENCES ---------------------
const lessonMeta = document.getElementById('lessonMeta');
const btn = document.getElementById('btn');
const btnEndLesson = document.getElementById('btnEndLesson');
const btnInstall = document.getElementById('btnInstall');
const lessonIdInput = document.getElementById('lessonIdInput');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnExportJson = document.getElementById('btnExportJson');
const btnRecent = document.getElementById('btnRecent');
const btnViewNotes = document.getElementById('btnViewNotes');
const btnCloseNotesPanel = document.getElementById('btnCloseNotesPanel');
const btnCloseRecentPanel = document.getElementById('btnCloseRecentPanel');
const notesListEl = document.getElementById('notesList');
const recentListEl = document.getElementById('recentList');

const editorEl = document.getElementById('editor');

const relevanceChipsEl = document.getElementById('relevanceChips');
const moveChipsEl = document.getElementById('moveChips');
const mediaChipsEl = document.getElementById('mediaChips');

const noteInputEl = document.getElementById('noteInput');
const btnAddNote = document.getElementById('btnAddNote');
const notesPanelEl = document.getElementById('notesPanel');
const recentPanelEl = document.getElementById('recentPanel');
const btnPastLessons = document.getElementById('btnPastLessons');
const btnClosePastLessonsPanel = document.getElementById('btnClosePastLessonsPanel');
const pastLessonsListEl = document.getElementById('pastLessonsList');
const pastLessonsPanelEl = document.getElementById('pastLessonsPanel');

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

function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  if (lesson) {
    const confirmReplace = confirm(
      'Starting a new lesson will replace the current lesson in the app. Export current data first if you want to keep it. Continue?'
    );
    if (!confirmReplace) return;

    const doExport = confirm('Would you like to export CSV and JSON before starting the new lesson?');
    if (doExport) {
      await exportCsv();
      await exportJson();
    }
  }

  const userLessonId = (lessonIdInput?.value ?? '').trim();

  lesson = {
    id: uid(),
    userLessonId: userLessonId.length ? userLessonId : '',
    startedAt: nowIso()
  };

  await setMeta('lesson', lesson);

  if (lessonIdInput) lessonIdInput.value = lesson.userLessonId ?? '';

  await refresh();
}

async function endLesson() {
  if (!lesson) return;

  const confirmEnd = confirm('End this lesson?');
  if (!confirmEnd) return;

 const doExport = confirm('Export data (CSV & JSON) before ending lesson?');
if (doExport) {
  await exportCsv();
  await exportJson();
}

  lesson = null;
  await setMeta('lesson', null);

  if (lessonIdInput) lessonIdInput.value = '';

  await refresh();
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
    if (group.label) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'gtitle';
      sectionTitle.textContent = group.label;
      container.appendChild(sectionTitle);
    }

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'chips';

    for (const item of group.items) {
      const label = group.label ? `${group.label} > ${item}` : item;
      const count = counts[label] || 0;

      const btn = document.createElement('button');
      btn.className = 'chip';

      if (domain.key === 'science_practices') btn.classList.add('domain-science-practices');
      if (domain.key === 'data') btn.classList.add('domain-data');
      if (domain.key === 'place_time') btn.classList.add('domain-place-time');
      if (domain.key === 'society') btn.classList.add('domain-society');
      if (domain.key === 'other_academic') btn.classList.add('domain-other-academic');
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

async function renderPeopleSubgroup(groupKey, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const domain = DOMAINS.find((d) => d.key === 'people');
  if (!domain) return;

  const counts = await getDomainCounts(domain.label);

  let itemsToRender = [];

  if (groupKey === '(People) Others') {
    const scientistGroup = domain.groups.find((g) => g.label === 'Scientist');
    if (scientistGroup) {
      for (const item of scientistGroup.items) {
        itemsToRender.push({
          groupLabel: '(People) Others',
          item
        });
      }
    }

    itemsToRender.push({
      groupLabel: '(People) Others',
      item: 'Teacher experience'
    });

    itemsToRender.push({
      groupLabel: '(People) Others',
      item: 'Any other people'
    });
  }

  if (groupKey === '(People) Students') {
    const group = domain.groups.find((g) => g.label === 'Student(s)');
    if (group) {
      itemsToRender = group.items.map((item) => ({
        groupLabel: '(People) Students',
        item
      }));
    }
  }

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'chips';

  for (const entry of itemsToRender) {
    const label = `${entry.groupLabel} > ${entry.item}`;
    const count = counts[label] || 0;

    const btn = document.createElement('button');
    btn.className = 'chip';
 
    if (groupKey === '(People) Students') btn.classList.add('domain-students');
    if (groupKey === '(People) Others') btn.classList.add('domain-scientist');
    
    btn.textContent = `${entry.item} (${count})`;

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

async function renderCultureSubgroup(groupLabel, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const domain = DOMAINS.find((d) => d.key === 'culture');
  if (!domain) return;

  const group = domain.groups.find((g) => g.label === groupLabel);
  if (!group) return;

  const counts = await getDomainCounts(domain.label);

  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'chips';

  for (const item of group.items) {
    const label = `${group.label} > ${item}`;
    const count = counts[label] || 0;

    const btn = document.createElement('button');
    btn.className = 'chip';

    if (groupLabel === 'Language') btn.classList.add('domain-language');
    if (groupLabel === 'Culture') btn.classList.add('domain-culture');
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

async function renderAllDomains() {
  await renderDomain('science_practices', 'domain_science_practices');
  await renderDomain('data', 'domain_data');

  await renderPeopleSubgroup('(People) Students', 'domain_people_students');
  await renderPeopleSubgroup('(People) Others', 'domain_people_adults');
  
  await renderDomain('place_time', 'domain_place_time');
  await renderCultureSubgroup('Language', 'domain_culture_language');
  await renderCultureSubgroup('Culture', 'domain_culture_culture');
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

      await refresh();
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
    containerId: 'mediaChips',
    family: 'media',
    options: MEDIA,
    familyClass: 'media',
    groupLabel: 'Media'
  });
}

async function renderNotesPanel() {
  if (!notesListEl) return;

  notesListEl.innerHTML = '';

  if (!lesson) {
    notesListEl.innerHTML = `<div class="muted">No active lesson.</div>`;
    return;
  }

  const observations = await listObservationsByLesson(lesson.id);
  const notes = observations
    .filter((obs) => obs.family === 'note')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (notes.length === 0) {
    notesListEl.innerHTML = `<div class="muted">No notes submitted yet.</div>`;
    return;
  }

  for (const note of notes) {
    const item = document.createElement('div');
    item.className = 'note-item';

    const time = document.createElement('div');
    time.className = 'note-time';
    time.textContent = `t+${note.relSec ?? ''}s • ${new Date(note.ts).toLocaleTimeString()}`;

    const text = document.createElement('div');
    text.className = 'note-text';
    text.textContent = note.text ?? '';

    item.appendChild(time);
    item.appendChild(text);
    notesListEl.appendChild(item);
  }
}

async function renderRecentPanel() {
  if (!recentListEl) return;

  recentListEl.innerHTML = '';

  if (!lesson) {
    recentListEl.innerHTML = `<div class="muted">No active lesson.</div>`;
    return;
  }

  const observations = await listObservationsByLesson(lesson.id);
  const recent = observations
    .slice()
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 8);

  if (recent.length === 0) {
    recentListEl.innerHTML = `<div class="muted">No codes logged yet.</div>`;
    return;
  }

  for (const obs of recent) {
    const item = document.createElement('div');
    item.className = 'note-item';

    const time = document.createElement('div');
    time.className = 'note-time';
    time.textContent = `t+${obs.relSec ?? ''}s • ${new Date(obs.ts).toLocaleTimeString()}`;

    const text = document.createElement('div');
    text.className = 'note-text';

    if (obs.family === 'note') {
      text.textContent = `Note: ${obs.text ?? ''}`;
    } else {
      text.textContent = `${obs.group}: ${obs.label}`;
    }

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '8px';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn end-btn';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';

    delBtn.addEventListener('click', async () => {
      const ok = confirm('Delete this code?');
      if (!ok) return;

      await deleteObservation(obs.id);
      await renderRecentPanel();
      await refresh();
    });

    row.appendChild(delBtn);

    item.appendChild(time);
    item.appendChild(text);
    item.appendChild(row);

    recentListEl.appendChild(item);
  }
}

async function renderPastLessonsPanel() {
  if (!pastLessonsListEl) return;

  pastLessonsListEl.innerHTML = '';

  const lessonIds = await getLessonIds();

  if (!lessonIds.length) {
    pastLessonsListEl.innerHTML = `<div class="muted">No stored lessons found.</div>`;
    return;
  }

  const allObservations = await listAllObservations();

  for (const lessonId of lessonIds) {
    const lessonObs = allObservations
      .filter((obs) => obs.lessonId === lessonId)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const item = document.createElement('div');
    item.className = 'note-item';

    const time = document.createElement('div');
    time.className = 'note-time';

    const firstTs = lessonObs[0]?.ts ? new Date(lessonObs[0].ts).toLocaleString() : 'Unknown time';
    time.textContent = `${lessonId} • ${lessonObs.length} observations • ${firstTs}`;

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '8px';

    const csvBtn = document.createElement('button');
    csvBtn.className = 'btn';
    csvBtn.type = 'button';
    csvBtn.textContent = 'Download CSV';
    csvBtn.addEventListener('click', async () => {
      await downloadLessonCsvById(lessonId);
    });

    const jsonBtn = document.createElement('button');
    jsonBtn.className = 'btn';
    jsonBtn.type = 'button';
    jsonBtn.textContent = 'Download JSON';
    jsonBtn.addEventListener('click', async () => {
      await downloadLessonJsonById(lessonId);
    });

    row.appendChild(csvBtn);
    row.appendChild(jsonBtn);

    item.appendChild(time);
    item.appendChild(row);

    pastLessonsListEl.appendChild(item);
  }
}

async function openPastLessonsPanel() {
  await renderPastLessonsPanel();
  if (pastLessonsPanelEl) pastLessonsPanelEl.classList.remove('hidden');
}

function closePastLessonsPanel() {
  if (pastLessonsPanelEl) pastLessonsPanelEl.classList.add('hidden');
}

async function openRecentPanel() {
  await renderRecentPanel();
  if (recentPanelEl) recentPanelEl.classList.remove('hidden');
}

function closeRecentPanel() {
  if (recentPanelEl) recentPanelEl.classList.add('hidden');
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

async function downloadLessonCsvById(lessonId) {
  const observations = await listObservationsByLesson(lessonId);

  if (!observations.length) return;

  const safeLessonId = String(lessonId)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 60);

  const header = [
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

async function downloadLessonJsonById(lessonId) {
  const observations = await listObservationsByLesson(lessonId);

  if (!observations.length) return;

  const safeLessonId = String(lessonId)
    .replace(/[^\w-]+/g, '_')
    .slice(0, 60);

  const payload = {
    lesson: {
      id: lessonId
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
// --------------------- WIRES ---------------------
if (btnStartLesson) btnStartLesson.addEventListener('click', startLesson);
if (btnEndLesson) btnEndLesson.addEventListener('click', endLesson);
if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsv);
if (btnExportJson) btnExportJson.addEventListener('click', exportJson);
if (btnAddNote) btnAddNote.addEventListener('click', addNote);
if (btnRecent) btnRecent.addEventListener('click', openRecentPanel);
if (btnPastLessons) btnPastLessons.addEventListener('click', openPastLessonsPanel);
if (btnViewNotes) btnViewNotes.addEventListener('click', openNotesPanel);
if (btnCloseNotesPanel) btnCloseNotesPanel.addEventListener('click', closeNotesPanel);
if (btnCloseRecentPanel) btnCloseRecentPanel.addEventListener('click', closeRecentPanel);
if (btnClosePastLessonsPanel) btnClosePastLessonsPanel.addEventListener('click', closePastLessonsPanel);

if (notesPanelEl) {
  notesPanelEl.addEventListener('click', (e) => {
    if (e.target === notesPanelEl) closeNotesPanel();
  });
}

if (recentPanelEl) {
  recentPanelEl.addEventListener('click', (e) => {
    if (e.target === recentPanelEl) closeRecentPanel();
  });
}

if (pastLessonsPanelEl) {
  pastLessonsPanelEl.addEventListener('click', (e) => {
    if (e.target === pastLessonsPanelEl) closePastLessonsPanel();
  });
}

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
