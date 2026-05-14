/* ═══════════════════════════════════════════════════════════════
   tabs/settings.js
   Settings tab — manage habits, sections, alert time,
   Firebase sync status, factory reset.
   Depends on: core/state.js, core/utils.js, core/firebase.js
═══════════════════════════════════════════════════════════════ */

'use strict';

import {
  state,
  /* flags */
  settingsFilter,       setSettingsFilter,
  _settingsNeedRebuild, setSettingsNeedRebuild
} from '../core/state.js';

import {
  sanitizeHTML,
  showToast,
  validateTimeString,
  formatTime12,
  getSectionEmoji,
  getHabitIconHtml
} from '../core/utils.js';

import {
  debouncedSave,
  forceSyncAll
} from '../core/firebase.js';

/* ─────────────────────────────────────────────────────────────
   MISSED TASKS ALERT TIME
───────────────────────────────────────────────────────────────*/

/**
 * Updates the alert time display and input from state.
 */
export function updateMissedAlertDisplay() {
  let val = state.missedTasksAlertTime || '21:00';
  if (!validateTimeString(val)) val = '21:00';

  const disp = document.getElementById('missed-alert-display');
  const inp  = document.getElementById('missed-alert-time');
  if (disp) disp.textContent = formatTime12(val);
  if (inp)  inp.value        = val;

  _highlightActiveAlertPreset(val);
}

/**
 * Saves a new alert time from the time input.
 */
export function saveMissedAlertTime(val) {
  if (!val || !validateTimeString(val)) return;
  state.missedTasksAlertTime = val;
  updateMissedAlertDisplay();
  debouncedSave();
  showToast('Alert set for ' + formatTime12(val));

  import('../tabs/today.js').then(m => {
    if (m.checkMissedTasksBanner) m.checkMissedTasksBanner();
  });
}

/**
 * Sets the alert time from a preset button.
 */
export function setMissedAlertPreset(val) {
  if (!validateTimeString(val)) return;
  state.missedTasksAlertTime = val;

  const inp = document.getElementById('missed-alert-time');
  if (inp)  inp.value = val;

  updateMissedAlertDisplay();
  debouncedSave();
  showToast('Alert set for ' + formatTime12(val));

  import('../tabs/today.js').then(m => {
    if (m.checkMissedTasksBanner) m.checkMissedTasksBanner();
  });
}

function _highlightActiveAlertPreset(val) {
  document.querySelectorAll('.alert-preset-btn').forEach(btn => {
    const t = btn.dataset.time;
    if (t) btn.classList.toggle('active-preset', t === val);
  });
}

/* ─────────────────────────────────────────────────────────────
   SETTINGS PAGE — MAIN BUILDER
───────────────────────────────────────────────────────────────*/

/**
 * Builds or refreshes the settings page.
 * Skips the full rebuild if _settingsNeedRebuild is false —
 * only updates the hero chips and alert display.
 */
export function buildSettingsPage() {
  if (!_settingsNeedRebuild) {
    _updateSettingsHero();
    updateMissedAlertDisplay();
    return;
  }

  setSettingsNeedRebuild(false);

  _updateSettingsHero();
  _buildSectionLabels();
  _buildSettingsHabitList();
  _buildSettingsSectionsList();
  _populateNewHabitSectionSelect();
  updateMissedAlertDisplay();
  _buildSettingsStars();
}

/* ─────────────────────────────────────────────────────────────
   HERO CHIPS
───────────────────────────────────────────────────────────────*/
function _updateSettingsHero() {
  const totalPts = (state.habits || []).reduce((s, h) => s + (h.pts || 0), 0);
  const hc = document.getElementById('sh-habits-chip');
  const pc = document.getElementById('sh-pts-chip');
  const sc = document.getElementById('sh-sections-chip');
  if (hc) hc.textContent = (state.habits  || []).length + ' Habits';
  if (pc) pc.textContent = totalPts + ' XP total';
  if (sc) sc.textContent = (state.sections || []).filter(s => s.tag !== 'special').length + ' sections';
}

/* ─────────────────────────────────────────────────────────────
   SECTION FILTER LABELS
───────────────────────────────────────────────────────────────*/
function _buildSectionLabels() {
  const w = document.getElementById('settings-section-labels');
  if (!w) return;

  w.innerHTML = '';

  /* "All" label */
  const all = document.createElement('span');
  all.className = 'slabel' + (settingsFilter === 'all' ? ' active' : '');
  all.textContent = 'All';
  all.setAttribute('role',       'button');
  all.setAttribute('tabindex',   '0');
  all.setAttribute('aria-pressed', settingsFilter === 'all' ? 'true' : 'false');
  all.onclick   = () => { setSettingsFilter('all'); setSettingsNeedRebuild(true); buildSettingsPage(); };
  all.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') all.click(); };
  w.appendChild(all);

  /* One label per non-special section */
  (state.sections || []).forEach(sec => {
    if (sec.tag === 'special') return;
    const btn = document.createElement('span');
    btn.className = 'slabel' + (settingsFilter === sec.id ? ' active' : '');
    btn.textContent = getSectionEmoji(sec.id, sec.icon) + ' ' + sec.name;
    btn.setAttribute('role',       'button');
    btn.setAttribute('tabindex',   '0');
    btn.setAttribute('aria-pressed', settingsFilter === sec.id ? 'true' : 'false');
    btn.onclick   = () => { setSettingsFilter(sec.id); setSettingsNeedRebuild(true); buildSettingsPage(); };
    btn.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') btn.click(); };
    w.appendChild(btn);
  });
}

/* ─────────────────────────────────────────────────────────────
   HABIT LIST
───────────────────────────────────────────────────────────────*/
function _buildSettingsHabitList() {
  const w = document.getElementById('settings-habit-list');
  if (!w) return;

  w.innerHTML = '';

  const filtered = (state.habits || [])
    .filter(h => settingsFilter === 'all' || h.section === settingsFilter)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!filtered.length) {
    const e = document.createElement('div');
    e.className   = 'tempty';
    e.textContent = 'No habits here yet.';
    w.appendChild(e);
    return;
  }

  /* Group by section */
  const grouped = {};
  filtered.forEach(h => {
    if (!grouped[h.section]) grouped[h.section] = [];
    grouped[h.section].push(h);
  });

  Object.keys(grouped).forEach(secId => {
    const sec        = (state.sections || []).find(s => s.id === secId);
    const secClass   = _getSectionHeaderClass(secId);
    const secDesc    = _getSectionHeaderDesc(secId, sec ? sec.name : secId);
    const habitCount = grouped[secId].length;

    /* Section header */
    const headerDiv = document.createElement('div');
    headerDiv.className = 'settings-sec-header ' + secClass;
    headerDiv.setAttribute('role',         'button');
    headerDiv.setAttribute('tabindex',     '0');
    headerDiv.setAttribute('aria-expanded','true');

    headerDiv.innerHTML =
      '<div>' +
        '<div class="settings-sec-label">' +
          sanitizeHTML(sec ? sec.name.toUpperCase() : secId.toUpperCase()) +
        '</div>' +
        '<div class="settings-sec-desc">' + sanitizeHTML(secDesc) + '</div>' +
      '</div>' +
      '<span class="settings-sec-badge">' +
        habitCount + ' habit' + (habitCount !== 1 ? 's' : '') +
      '</span>';

    /* Collapse toggle */
    headerDiv.onclick = () => {
      const listDiv = headerDiv.nextElementSibling;
      if (!listDiv) return;
      const isHidden = listDiv.style.display === 'none';
      listDiv.style.display = isHidden ? '' : 'none';
      headerDiv.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    };
    headerDiv.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); headerDiv.click(); }
    };

    w.appendChild(headerDiv);

    /* Habit rows inside this section */
    const listDiv = document.createElement('div');
    listDiv.style.borderTop = '1px solid rgba(139,92,246,.06)';

    grouped[secId].forEach(h => {
      const iconContent = getHabitIconHtml(h);
      const safeName    = sanitizeHTML(h.name || '');
      const safeNote    = sanitizeHTML(h.note || '');

      const row = document.createElement('div');
      row.className = 'habit-item';

      row.innerHTML =
        /* Icon (click to open picker) */
        '<div class="habit-icon-wrap" ' +
          'data-action="open-icon-picker" data-id="' + h.id + '" ' +
          'role="button" tabindex="0" ' +
          'aria-label="Change icon for ' + safeName + '" ' +
          'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' +
            'event.preventDefault();openIconPicker(\'' + h.id + '\')}' +
          '">' +
          iconContent +
          '<div class="habit-icon-edit-dot" aria-hidden="true">✏</div>' +
        '</div>' +

        /* Name + note */
        '<div class="habit-info">' +
          '<div class="habit-name">' + safeName + '</div>' +
          (safeNote ? '<div class="habit-meta">' + safeNote + '</div>' : '') +
        '</div>' +

        /* Points badge */
        '<span class="habit-pts-badge">+' + h.pts + ' pts</span>' +

        /* Action buttons */
        '<div class="habit-actions">' +
          '<button class="habit-edit-btn" aria-label="Move up" ' +
            'data-action="move-up" data-id="' + h.id + '">▲</button>' +
          '<button class="habit-edit-btn" aria-label="Move down" ' +
            'data-action="move-down" data-id="' + h.id + '">▼</button>' +
          '<button class="habit-edit-btn" aria-label="Edit" ' +
            'data-action="edit-habit" data-id="' + h.id + '">Edit</button>' +
          '<button class="habit-del-btn" aria-label="Delete" ' +
            'data-action="delete-habit" data-id="' + h.id + '">×</button>' +
        '</div>';

      listDiv.appendChild(row);
    });

    w.appendChild(listDiv);
  });
}

/* ─────────────────────────────────────────────────────────────
   SECTIONS LIST
───────────────────────────────────────────────────────────────*/
function _buildSettingsSectionsList() {
  const w = document.getElementById('settings-sections-list');
  if (!w) return;

  w.innerHTML = '';

  (state.sections || []).forEach(sec => {
    const hc  = (state.habits || []).filter(h => h.section === sec.id).length;
    const row = document.createElement('div');
    row.className = 'habit-item';

    row.innerHTML =
      '<span class="si" aria-hidden="true">' + getSectionEmoji(sec.id, sec.icon) + '</span>' +
      '<div class="habit-info">' +
        '<div class="habit-name">' + sanitizeHTML(sec.name || '') + '</div>' +
        '<div class="habit-meta">' +
          hc + ' habit' + (hc !== 1 ? 's' : '') +
          (sec.tag && sec.tag !== 'special' ? ' · ' + sanitizeHTML(sec.tag) : '') +
        '</div>' +
      '</div>' +
      (sec.tag === 'special'
        ? '<span style="font-size:10px;color:var(--text-muted);">built-in</span>'
        : '<button class="habit-del-btn" ' +
            'aria-label="Delete section ' + sanitizeHTML(sec.name || '') + '" ' +
            'data-action="delete-section" data-id="' + sec.id + '">×</button>');

    w.appendChild(row);
  });
}

/* ─────────────────────────────────────────────────────────────
   NEW HABIT SECTION SELECT
───────────────────────────────────────────────────────────────*/
function _populateNewHabitSectionSelect() {
  const sel = document.getElementById('new-habit-section');
  if (!sel) return;

  const saved = sel.value;
  sel.innerHTML = '';

  (state.sections || []).forEach(sec => {
    if (sec.tag === 'special') return;
    const opt     = document.createElement('option');
    opt.value     = sec.id;
    opt.textContent = getSectionEmoji(sec.id, sec.icon) + ' ' + sec.name;
    sel.appendChild(opt);
  });

  /* Restore previous selection if still valid */
  if (saved && sel.querySelector('option[value="' + saved + '"]'))
    sel.value = saved;
}

/* ─────────────────────────────────────────────────────────────
   SECTION HEADER HELPERS
───────────────────────────────────────────────────────────────*/
function _getSectionHeaderClass(secId) {
  if (secId === 'night')                                    return 'sth-night';
  if (['morning','skin_am','breakfast'].includes(secId))    return 'sth-morning';
  if (secId === 'prep')                                     return 'sth-prep';
  return 'sth-default';
}

function _getSectionHeaderDesc(secId, secName) {
  const map = {
    night:     'Wind down and prepare for deep rest',
    skin_am:   'Start glowing every morning',
    morning:   'Start strong, start intentional',
    breakfast: 'Fuel your body right',
    lunch:     'Midday nourishment',
    dinner:    'Light and healthy evenings',
    prep:      'Set yourself up for a great morning',
    water:     'Stay hydrated all day',
    evening:   'Evening wind-down'
  };
  return map[secId] || secName + ' habits';
}

/* ─────────────────────────────────────────────────────────────
   DECORATIVE STARS
───────────────────────────────────────────────────────────────*/
function _buildSettingsStars() {
  const c = document.getElementById('settings-hero-stars');
  if (!c || c.children.length > 0) return;

  [
    [8,22,1,0.6],[20,48,1.5,0.5],[35,15,1,0.7],[52,38,1.2,0.6],
    [68,20,1.5,0.5],[82,45,1,0.7],[90,18,2,0.6],[96,55,1,0.5],
    [14,72,1,0.4],[44,78,1.5,0.5],[72,68,1,0.4]
  ].forEach(a => {
    const s = document.createElement('div');
    s.className = 'settings-hero-star';
    s.style.cssText =
      'left:'   + a[0] + '%;' +
      'top:'    + a[1] + '%;' +
      'width:'  + (a[2] * 2) + 'px;' +
      'height:' + (a[2] * 2) + 'px;' +
      'opacity:'+ a[3] + ';' +
      'position:absolute;border-radius:50%;background:#fff;';
    c.appendChild(s);
  });
}

/* ─────────────────────────────────────────────────────────────
   SCROLL TO ADD HABIT FORM
───────────────────────────────────────────────────────────────*/
export function scrollToAddHabit() {
  const el = document.getElementById('add-habit-form-wrap');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ─────────────────────────────────────────────────────────────
   PAGE SHELL BUILDER
   Builds the static HTML shell once. Dynamic content
   is injected by buildSettingsPage().
───────────────────────────────────────────────────────────────*/
export function buildSettingsPageShell() {
  const page = document.getElementById('page-settings');
  if (!page || page.children.length > 0) return;

  _injectSettingsCSS();

  page.innerHTML = `

    <!-- Hero -->
    <div class="settings-hero" role="banner">
      <div class="settings-hero-stars" id="settings-hero-stars" aria-hidden="true"></div>
      <div class="settings-hero-icon" aria-hidden="true">⚙️</div>
      <div class="settings-hero-label">MANAGE YOUR HABITS</div>
      <div class="settings-hero-title">Settings</div>
      <div class="settings-hero-sub">Customize routines, points and daily structure</div>
      <div class="settings-hero-chips">
        <span class="settings-hero-chip"      id="sh-habits-chip">0 Habits</span>
        <span class="settings-hero-chip gold" id="sh-pts-chip">0 XP total</span>
        <span class="settings-hero-chip"      id="sh-sections-chip">0 sections</span>
      </div>
      <button class="settings-add-btn" onclick="scrollToAddHabit()">
        + Add New Habit
      </button>
    </div>

    <!-- Missed tasks alert time -->
    <div class="alert-time-card">
      <div class="alert-time-header">
        <div class="alert-time-header-icon" aria-hidden="true">⏰</div>
        <span class="alert-time-header-text">Missed Tasks Alert Time</span>
      </div>
      <div class="alert-time-body">
        <p class="alert-time-desc">
          Set exactly when the <strong>missed tasks banner</strong> appears each day.
        </p>
        <div class="alert-time-row">
          <div class="alert-time-input-wrap">
            <span class="alert-time-label">Pick your alert time</span>
            <input type="time" id="missed-alert-time"
                   class="alert-time-input"
                   onchange="saveMissedAlertTime(this.value)"
                   aria-label="Missed tasks alert time"/>
          </div>
          <div class="alert-active-wrap">
            <span class="alert-active-label">Active setting</span>
            <div class="alert-active-pill" id="missed-alert-display"
                 aria-live="polite">9:00 PM</div>
          </div>
        </div>
        <div class="alert-presets-label">Quick Presets</div>
        <div class="alert-presets-grid" id="alert-presets-grid"
             role="group" aria-label="Alert time presets">
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="19:00">7:00 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="19:30">7:30 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="20:00">8:00 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="20:30">8:30 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="21:00">9:00 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="21:30">9:30 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="22:00">10:00 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="22:30">10:30 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="23:00">11:00 PM</button>
          <button class="alert-preset-btn" data-action="set-alert-preset" data-time="23:30">11:30 PM</button>
        </div>
      </div>
    </div>

    <!-- Manage routines card -->
    <div class="sc">
      <div class="sh">
        <span class="si">⚙️</span>
        <span class="st">Manage Routines</span>
      </div>
      <div style="padding:9px 16px 5px;font-size:12px;color:var(--text-muted);">
        Add, edit, reorder or delete tasks instantly.
      </div>

      <!-- Section filter labels -->
      <div class="section-labels" id="settings-section-labels"
           role="group" aria-label="Filter by section"></div>

      <!-- Habit list (dynamic) -->
      <div id="settings-habit-list" role="list"></div>

      <!-- Add new habit form -->
      <div class="add-habit-form" id="add-habit-form-wrap">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">
          Add new habit
        </div>
        <input class="settings-input" id="new-habit-name"
               placeholder="Habit name" maxlength="80"
               aria-label="New habit name"/>
        <input class="settings-note" id="new-habit-note"
               placeholder="Sub-note (optional)" maxlength="100"
               aria-label="New habit sub-note"/>
        <div class="settings-row">
          <select class="settings-select" id="new-habit-section"
                  aria-label="Section for new habit"></select>
          <input class="settings-pts" id="new-habit-pts"
                 type="number" min="1" max="20" value="3"
                 placeholder="pts" aria-label="Points (1-20)"/>
        </div>
        <button class="add-habit-btn" onclick="addNewHabit()">Add Habit</button>
      </div>
    </div>

    <!-- Manage sections card -->
    <div class="sc">
      <div class="sh">
        <span class="si">🗂️</span>
        <span class="st">Manage Sections</span>
      </div>
      <div id="settings-sections-list" role="list"></div>
      <div class="add-habit-form">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">
          Add new section
        </div>
        <div class="settings-row">
          <input class="settings-input" id="new-section-name"
                 placeholder="Section name" maxlength="40"
                 aria-label="New section name"/>
          <input class="settings-note" id="new-section-icon"
                 placeholder="Icon" style="width:64px;" maxlength="4"
                 aria-label="Section icon emoji"/>
        </div>
        <button class="add-habit-btn" onclick="addNewSection()"
                style="margin-top:4px;">Add Section</button>
      </div>
    </div>

    <!-- Firebase sync card -->
    <div class="sc">
      <div class="sh">
        <span class="si">☁️</span>
        <span class="st">Firebase Sync</span>
      </div>
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:12px;color:var(--text-muted);">
          Connected to: <strong>shared_tracker</strong>
        </div>
        <div style="display:flex;align-items:center;gap:9px;"
             role="status" aria-live="polite">
          <div class="fb-dot" id="settings-fb-dot"></div>
          <span style="font-size:12px;font-weight:500;"
                id="settings-fb-text">Checking...</span>
        </div>
        <button class="rbtn"
                onclick="forceSyncAll()"
                style="background:var(--purple-100);
                       border-color:var(--purple-200);
                       color:var(--purple-600);
                       font-weight:700;">
          Force Sync Now
        </button>
      </div>
    </div>

    <!-- Reset today -->
    <div class="reset-row">
      <button class="rbtn" onclick="resetToday()">
        Reset today's checklist
      </button>
    </div>

    <!-- Factory reset -->
    <div class="reset-row" style="padding-top:0;">
      <button class="rbtn danger" onclick="confirmFactoryReset()">
        Factory reset all data
      </button>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   CSS INJECTOR
───────────────────────────────────────────────────────────────*/
function _injectSettingsCSS() {
  if (document.getElementById('settings-css')) return;
  const s = document.createElement('style');
  s.id    = 'settings-css';
  s.textContent = `
    .settings-hero {
      background: linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#4c1d95 100%);
      border-radius: var(--r-xl);
      padding: 20px 18px 16px;
      position: relative;
      overflow: hidden;
      margin-bottom: 16px;
      box-shadow: 0 8px 32px rgba(79,70,229,0.35);
    }
    .settings-hero-stars { position: absolute; inset: 0; pointer-events: none; }
    .settings-hero-icon {
      width: 50px; height: 50px;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 10px;
    }
    .settings-hero-label {
      font-size: 9px; font-weight: 700; color: #a5b4fc;
      letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px;
    }
    .settings-hero-title {
      font-size: 24px; font-weight: 900; color: #fff;
      letter-spacing: -0.5px; margin-bottom: 4px;
    }
    .settings-hero-sub {
      font-size: 11px; font-weight: 500; color: #818cf8; margin-bottom: 12px;
    }
    .settings-hero-chips {
      display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 12px;
    }
    .settings-hero-chip {
      background: rgba(255,255,255,0.12);
      border-radius: var(--r-pill);
      padding: 4px 12px;
      font-size: 10px; font-weight: 700; color: #e0e7ff;
    }
    .settings-hero-chip.gold { color: #fde68a; }
    .settings-add-btn {
      width: 100%; padding: 11px;
      background: linear-gradient(90deg,#6366f1,#8b5cf6);
      color: #fff; border: none; border-radius: var(--r-pill);
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: var(--font); transition: opacity .2s, transform .1s;
    }
    .settings-add-btn:hover { opacity: .9; transform: translateY(-1px); }
    .alert-time-card {
      background: var(--surface-elevated);
      backdrop-filter: blur(8px);
      border-radius: var(--r-xl);
      border: 1px solid rgba(139,92,246,0.05);
      margin-bottom: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .alert-time-header {
      padding: 14px 16px 12px;
      border-bottom: 1px solid rgba(139,92,246,0.06);
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(90deg,rgba(139,92,246,0.04),transparent);
    }
    .alert-time-header-icon {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(139,92,246,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    .alert-time-header-text { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .alert-time-body { padding: 16px; }
    .alert-time-desc {
      font-size: 12px; color: var(--text-muted);
      line-height: 1.6; margin-bottom: 14px;
    }
    .alert-time-desc strong { color: var(--text-primary); }
    .alert-time-row {
      display: flex; align-items: flex-end; gap: 12px;
      flex-wrap: wrap; margin-bottom: 14px;
    }
    .alert-time-input-wrap { flex: 1; min-width: 150px; }
    .alert-time-label {
      font-size: 9px; font-weight: 700; color: var(--text-muted);
      letter-spacing: .5px; text-transform: uppercase;
      margin-bottom: 6px; display: block;
    }
    .alert-time-input {
      width: 100%; font-size: 16px; font-weight: 800;
      padding: 11px 16px;
      border: 1.5px solid rgba(139,92,246,0.4);
      border-radius: 21px;
      background: rgba(255,255,255,0.85);
      color: var(--text-primary); outline: none;
      font-family: var(--font); transition: border-color .2s;
    }
    .alert-time-input:focus { border-color: var(--purple-500); }
    .alert-active-wrap { min-width: 140px; }
    .alert-active-label {
      font-size: 9px; font-weight: 700; color: var(--text-muted);
      letter-spacing: .5px; text-transform: uppercase;
      margin-bottom: 6px; display: block;
    }
    .alert-active-pill {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--purple-100); border: 1.5px solid var(--purple-200);
      border-radius: 21px; padding: 11px 20px;
      font-size: 16px; font-weight: 900; color: var(--purple-600);
      white-space: nowrap; min-width: 130px;
    }
    .alert-presets-label {
      font-size: 9px; font-weight: 700; color: var(--text-muted);
      letter-spacing: .8px; text-transform: uppercase; margin-bottom: 8px;
    }
    .alert-presets-grid { display: flex; flex-wrap: wrap; gap: 7px; }
    .alert-preset-btn {
      font-size: 11px; font-weight: 600;
      padding: 7px 14px; border-radius: 15px;
      border: 1px solid rgba(200,195,240,.7);
      background: rgba(255,255,255,.7);
      color: var(--text-muted); cursor: pointer;
      transition: all .2s; font-family: var(--font); white-space: nowrap;
    }
    .alert-preset-btn:hover {
      background: var(--purple-100); border-color: var(--purple-200); color: var(--purple-600);
    }
    .alert-preset-btn.active-preset {
      background: var(--purple-600); border-color: var(--purple-700);
      color: #fff; font-weight: 700;
    }
    .settings-sec-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 16px; border-radius: var(--r-sm);
      margin: 10px 0 4px; position: relative; overflow: hidden; cursor: pointer;
    }
    .settings-sec-header::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0;
      width: 4px; border-radius: 2px 0 0 2px;
    }
    .sth-night   { background: rgba(99,102,241,0.08); }
    .sth-night::before { background: linear-gradient(180deg,#6366f1,#8b5cf6); }
    .sth-morning { background: rgba(249,115,22,0.08); }
    .sth-morning::before { background: linear-gradient(180deg,#f97316,#fbbf24); }
    .sth-prep    { background: rgba(14,165,233,0.08); }
    .sth-prep::before { background: linear-gradient(180deg,#0ea5e9,#06b6d4); }
    .sth-default { background: rgba(168,85,247,0.08); }
    .sth-default::before { background: linear-gradient(180deg,#a855f7,#ec4899); }
    .settings-sec-label {
      font-size: 9px; font-weight: 700; letter-spacing: 2px;
      text-transform: uppercase; margin-bottom: 2px;
    }
    .sth-night .settings-sec-label   { color: #6366f1; }
    .sth-morning .settings-sec-label { color: #f97316; }
    .sth-prep .settings-sec-label    { color: #0284c7; }
    .sth-default .settings-sec-label { color: #a855f7; }
    .settings-sec-desc { font-size: 11px; font-weight: 600; }
    .sth-night .settings-sec-desc    { color: #4338ca; }
    .sth-morning .settings-sec-desc  { color: #c2410c; }
    .sth-prep .settings-sec-desc     { color: #0369a1; }
    .sth-default .settings-sec-desc  { color: #7e22ce; }
    .settings-sec-badge {
      font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: var(--r-pill);
    }
    .sth-night .settings-sec-badge   { background: #ede9fe; color: #7c3aed; }
    .sth-morning .settings-sec-badge { background: #fff7ed; color: #f97316; }
    .sth-prep .settings-sec-badge    { background: #e0f2fe; color: #0284c7; }
    .sth-default .settings-sec-badge { background: #fdf4ff; color: #a855f7; }
    .habit-item {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 14px;
      border-bottom: 1px solid rgba(139,92,246,0.06);
      transition: background .15s; min-height: 54px;
    }
    .habit-item:hover    { background: rgba(139,92,246,0.03); }
    .habit-item:last-child { border-bottom: none; }
    .habit-info { flex: 1; min-width: 0; padding-right: 4px; }
    .habit-name {
      font-size: 13px; font-weight: 800; color: var(--text-primary);
      white-space: normal; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; line-height: 1.35; word-break: break-word;
    }
    .habit-meta {
      font-size: 10px; color: var(--text-muted);
      margin-top: 2px; white-space: normal; line-height: 1.3;
    }
    .habit-pts-badge {
      font-size: 9px; font-weight: 700; padding: 2px 6px;
      border-radius: var(--r-pill);
      background: var(--yellow-50); color: var(--yellow-600);
      border: 1px solid var(--yellow-border); flex-shrink: 0; white-space: nowrap;
    }
    .habit-actions {
      display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    }
    .habit-edit-btn {
      font-size: 10px; font-weight: 600; padding: 4px 8px;
      border-radius: var(--r-pill);
      border: 1px solid var(--purple-200);
      background: var(--purple-100); color: var(--purple-600);
      cursor: pointer; flex-shrink: 0;
      font-family: var(--font); white-space: nowrap;
    }
    .habit-edit-btn:hover { background: var(--purple-600); color: #fff; }
    .habit-del-btn {
      font-size: 14px; color: var(--text-muted); cursor: pointer;
      background: none; border: none; padding: 0 2px; line-height: 1; flex-shrink: 0;
    }
    .habit-del-btn:hover { color: var(--red-500); }
    .habit-icon-wrap {
      width: 38px; height: 38px; min-width: 38px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      background: var(--purple-50); border: 1px solid var(--purple-200);
      flex-shrink: 0; cursor: pointer; overflow: hidden;
      position: relative; transition: all .2s;
    }
    .habit-icon-wrap:hover { border-color: var(--purple-400); transform: scale(1.05); }
    .habit-icon-wrap img {
      width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;
    }
    .habit-icon-edit-dot {
      position: absolute; bottom: 0; right: 0;
      width: 11px; height: 11px; border-radius: 50%;
      background: var(--purple-600); color: #fff;
      font-size: 6px; display: flex; align-items: center; justify-content: center;
    }
    .settings-section-title {
      font-size: 10px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .8px; padding: 10px 14px 5px;
    }
    .add-habit-form {
      padding: 12px 14px; border-top: 1px solid rgba(139,92,246,.06);
      display: flex; flex-direction: column; gap: 8px;
    }
    .add-habit-btn {
      padding: 10px;
      background: linear-gradient(135deg,var(--purple-600),var(--purple-700));
      color: #fff; border: none; border-radius: var(--r-pill);
      font-size: 13px; font-weight: 700; cursor: pointer; width: 100%;
      font-family: var(--font);
    }
    .settings-input {
      width: 100%; font-size: 16px; padding: 9px 12px;
      border: 1.5px solid rgba(200,195,240,.7); border-radius: var(--r-pill);
      background: rgba(255,255,255,.7); color: var(--text-primary);
      outline: none; font-family: var(--font);
      transition: border-color .2s, box-shadow .2s;
    }
    .settings-input:focus {
      border-color: var(--purple-500);
      box-shadow: 0 0 0 3px rgba(139,92,246,.12);
    }
    .settings-row { display: flex; gap: 7px; }
    .settings-select {
      flex: 1; font-size: 16px; padding: 8px 10px;
      border: 1.5px solid rgba(200,195,240,.7); border-radius: var(--r-sm);
      background: rgba(255,255,255,.7); color: var(--text-primary);
      outline: none; font-family: var(--font);
    }
    .settings-pts {
      width: 64px; font-size: 16px; padding: 8px 8px;
      border: 1.5px solid rgba(200,195,240,.7); border-radius: var(--r-sm);
      background: rgba(255,255,255,.7); color: var(--text-primary);
      outline: none; text-align: center; font-family: var(--font);
    }
    .settings-note {
      width: 100%; font-size: 16px; padding: 8px 12px;
      border: 1.5px solid rgba(200,195,240,.7); border-radius: var(--r-pill);
      background: rgba(255,255,255,.7); color: var(--text-primary);
      outline: none; font-family: var(--font);
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────────
   AUTO-BUILD PAGE SHELL ON MODULE LOAD
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  buildSettingsPageShell();
});
