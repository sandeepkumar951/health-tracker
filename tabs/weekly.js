/**
 * ═══════════════════════════════════════════════════════════════
 * tabs/weekly.js — Weekly task planner
 *
 * This module owns:
 * - Weekly page HTML (built once as IIFE in original)
 * - Task CRUD (add, toggle, edit, delete)
 * - Multi-day picker with preset buttons
 * - Filter system (all, active, done, by day)
 * - Week reset logic
 * - Stats rendering (done, progress, active, pending)
 * - Clear done / reset week actions
 *
 * MULTI-DAY SUPPORT:
 * Tasks can be assigned to multiple days via comma-separated
 * day strings (e.g., "Mon,Wed,Fri"). The day picker UI
 * supports selecting multiple days and preset buttons
 * (Everyday, Weekdays, Weekends).
 * ═══════════════════════════════════════════════════════════════
 */

import {
  DAY_NAMES,
  genId,
  sanitizeHTML,
  showToast,
  validateTaskDay,
  validateTaskDays,
  getTaskEmoji,
  getWeeklyDayColor
} from '../core/utils.js';

import { state, flags } from '../core/state.js';
import { debouncedSave } from '../core/firebase.js';
import { updateSummaryCards, updateStatsBanner } from '../shared/theme.js';
import { checkBadgesDebounced } from '../shared/badges.js';
import {
  onPageShow,
  onFullRefresh,
  renderTodayWeeklyPanel
} from '../tabs/today.js';


/* ═══════════════════════════════════════════════════════════════
   WEEK HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns the current week's date range as a display string.
 * @returns {string} e.g., "12 May – 18 May"
 */
function wtGetWeekLabel() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const o = { day: 'numeric', month: 'short' };
  return mon.toLocaleDateString('en-GB', o) + ' – ' + sun.toLocaleDateString('en-GB', o);
}

/**
 * Returns the Monday of the current week as 'YYYY-MM-DD'.
 * @returns {string}
 */
function wtGetCurrentWeekKey() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return mon.toISOString().slice(0, 10);
}


/* ═══════════════════════════════════════════════════════════════
   WEEK RESET
   ═══════════════════════════════════════════════════════════════ */

/**
 * Checks if a new week has started and resets task completion.
 * Converts Today/Tomorrow tasks to Anytime for the new week.
 */
export function wtCheckWeekReset() {
  const cw = wtGetCurrentWeekKey();
  if (state.weeklyTasksResetDate === cw) return;

  const doneBefore = (state.weeklyTasks || []).filter(t => t.done).length;

  state.weeklyTasksResetDate = cw;
  state.weeklyTasks = (state.weeklyTasks || []).map(t => Object.assign({}, t, { done: false }));

  // Convert Today/Tomorrow to Anytime for new week
  let movedCount = 0;
  state.weeklyTasks = state.weeklyTasks.map(t => {
    if (t.day === 'Today' || t.day === 'Tomorrow') {
      movedCount++;
      return Object.assign({}, t, { day: 'Anytime' });
    }
    return t;
  });

  // Show toasts BEFORE save
  if (movedCount > 0) {
    showToast(movedCount + ' task' + (movedCount !== 1 ? 's' : '') + ' moved to Anytime for new week', 'yt');
  }
  if (doneBefore > 0) {
    showToast('New week! ' + doneBefore + ' completed tasks reset.', 'gt');
  }

  debouncedSave(500);
}


/* ═══════════════════════════════════════════════════════════════
   TASK CRUD
   ═══════════════════════════════════════════════════════════════ */

/**
 * Adds a new weekly task from the input fields.
 */
export function wtAddTask() {
  const inp = document.getElementById('wt-task-input');
  const noteInp = document.getElementById('wt-task-note');
  const name = inp ? inp.value.trim() : '';

  if (!name) { showToast('Enter a task name'); return; }
  if (name.length > 80) { showToast('Task name too long (max 80 characters)', 'yt'); return; }
  if (!state.weeklyTasks) state.weeklyTasks = [];

  const rawDay = flags.wtSelectedDays.length > 0 ? flags.wtSelectedDays.join(',') : 'Anytime';
  const day = validateTaskDays(rawDay);

  state.weeklyTasks.push({
    id: genId(),
    name,
    note: noteInp ? noteInp.value.trim() : '',
    day,
    done: false,
    createdAt: new Date().toISOString()
  });

  if (inp) inp.value = '';
  if (noteInp) noteInp.value = '';

  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  showToast('Task added!', 'gt');
}

/**
 * Toggles a weekly task's done state.
 * @param {string} id - Task ID
 */
export function wtToggleTask(id) {
  const t = (state.weeklyTasks || []).find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;

  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  updateSummaryCards();
  updateStatsBanner();

  if (t.done) {
    showToast('Done!', 'gt');
    checkBadgesDebounced();
  }
}

/**
 * Deletes a weekly task.
 * @param {string} id - Task ID
 */
export function wtDeleteTask(id) {
  if (!confirm('Delete this task?')) return;
  state.weeklyTasks = (state.weeklyTasks || []).filter(x => x.id !== id);
  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  showToast('Deleted');
}


/* ═══════════════════════════════════════════════════════════════
   TASK EDITING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Opens the weekly task edit modal.
 * @param {string} id - Task ID
 */
export function wtOpenEdit(id) {
  const t = (state.weeklyTasks || []).find(x => x.id === id);
  if (!t) return;
  flags.wtEditingId = id;

  const nm = document.getElementById('wet-name');
  const nt = document.getElementById('wet-note');
  const dy = document.getElementById('wet-day');

  if (nm) nm.value = t.name || '';
  if (nt) nt.value = t.note || '';
  if (dy) dy.value = validateTaskDay(t.day || 'Anytime');

  const modal = document.getElementById('weekly-edit-modal');
  if (modal) {
    modal.classList.add('open');
    if (nm) nm.focus();
  }
}

/**
 * Saves the edited weekly task.
 */
export function saveWeeklyEdit() {
  const editId = flags.wtEditingId;
  if (!editId) return;

  const t = (state.weeklyTasks || []).find(x => x.id === editId);
  if (!t) return;

  const nm = document.getElementById('wet-name');
  const nt = document.getElementById('wet-note');
  const dy = document.getElementById('wet-day');

  const newName = nm ? nm.value.trim() : '';
  if (!newName) { showToast('Task name cannot be empty', 'yt'); return; }
  if (newName.length > 80) { showToast('Task name too long (max 80 characters)', 'yt'); return; }

  t.name = newName;
  if (nt) t.note = nt.value.trim();
  if (dy) t.day = validateTaskDay(dy.value);

  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  closeWeeklyEditModal();
  showToast('Updated!');
}

/**
 * Closes the weekly task edit modal.
 */
export function closeWeeklyEditModal() {
  const modal = document.getElementById('weekly-edit-modal');
  if (modal) modal.classList.remove('open');
  flags.wtEditingId = null;
}


/* ═══════════════════════════════════════════════════════════════
   FILTER SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sets the active task filter and re-renders.
 * @param {HTMLElement} btn - Filter button element
 * @param {string} filter - Filter key
 */
export function wtSetFilter(btn, filter) {
  document.querySelectorAll('.weekly-filter-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  flags.wtFilter = filter;
  wtRenderTasks();
}


/* ═══════════════════════════════════════════════════════════════
   DAY PICKER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sets a day preset (everyday, weekdays, weekends, clear).
 * @param {string} type
 */
export function wtSetDayPreset(type) {
  const map = {
    everyday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weekends: ['Sat', 'Sun'],
    clear: []
  };
  flags.wtSelectedDays = map[type] || [];
  _syncDayPills();
}

/**
 * @private Syncs day pill selection state with flags.wtSelectedDays.
 */
function _syncDayPills() {
  document.querySelectorAll('.wt-day-pill').forEach(p => {
    p.classList.toggle('sel', flags.wtSelectedDays.includes(p.dataset.day));
  });
}


/* ═══════════════════════════════════════════════════════════════
   BULK ACTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Removes all completed tasks.
 */
export function wtClearDone() {
  if (!confirm('Remove all completed tasks?')) return;
  state.weeklyTasks = (state.weeklyTasks || []).filter(t => !t.done);
  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  showToast('Cleared');
}

/**
 * Resets all tasks to incomplete.
 */
export function wtResetWeek() {
  if (!confirm('Reset all weekly tasks to incomplete?')) return;
  state.weeklyTasks = (state.weeklyTasks || []).map(t => Object.assign({}, t, { done: false }));
  debouncedSave();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  showToast('Reset');
}


/* ═══════════════════════════════════════════════════════════════
   STATS RENDERING
   ═══════════════════════════════════════════════════════════════ */

/**
 * @private Updates the weekly stats bar (done, progress, active, pending).
 */
function _wtUpdateStats() {
  const tasks = state.weeklyTasks || [];
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const active = tasks.filter(t => !t.done).length;

  const wd = document.getElementById('ws-done');
  const wp = document.getElementById('ws-progress');
  const wa = document.getElementById('ws-active');
  const wpe = document.getElementById('ws-pending');
  const wc = document.getElementById('weekly-tasks-count');

  if (wd) wd.textContent = String(done);
  if (wp) wp.textContent = pct + '%';
  if (wa) wa.textContent = String(active);
  if (wpe) wpe.textContent = String(total - done);
  if (wc) wc.textContent = done + '/' + total + ' done';
}


/* ═══════════════════════════════════════════════════════════════
   TASK LIST RENDERING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Renders the weekly task list with current filter applied.
 */
export function wtRenderTasks() {
  const container = document.getElementById('weekly-task-list');
  if (!container) return;

  const sub = document.getElementById('weekly-hero-sub');
  if (sub) sub.textContent = 'Week of ' + wtGetWeekLabel();

  const tasks = state.weeklyTasks || [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = dayNames[new Date().getDay()];
  const filter = flags.wtFilter;

  let filtered;
  if (filter === 'all') filtered = tasks;
  else if (filter === 'active') filtered = tasks.filter(t => !t.done);
  else if (filter === 'done') filtered = tasks.filter(t => t.done);
  else if (filter === 'today') {
    filtered = tasks.filter(t => {
      if (!t.day) return false;
      const days = t.day.split(',');
      return days.includes(todayName) || days.includes('Today') || days.includes('Anytime');
    });
  } else {
    // Day-specific filter (Mon, Tue, etc.)
    filtered = tasks.filter(t => {
      if (!t.day) return false;
      return t.day.split(',').includes(filter);
    });
  }

  _wtUpdateStats();

  if (!filtered.length) {
    container.innerHTML = '<div class="weekly-empty">' +
      (tasks.length === 0
        ? 'No tasks yet. Add your first weekly task above!'
        : 'No tasks match this filter.') +
      '</div>';
    return;
  }

  container.innerHTML = '';

  filtered.forEach(t => {
    const dc = getWeeklyDayColor(t.day);
    const emoji = getTaskEmoji(t.name);
    const safeName = sanitizeHTML(t.name || '');
    const safeNote = sanitizeHTML(t.note || '');
    const dayDisplay = sanitizeHTML((t.day || '').split(',').join(' · '));

    const row = document.createElement('div');
    row.className = 'weekly-task-item' + (t.done ? ' wt-done' : '');
    row.setAttribute('role', 'listitem');

    row.innerHTML =
      // Checkbox
      '<div class="weekly-cb' + (t.done ? ' checked' : '') + '" ' +
        'data-action="wt-toggle" data-id="' + t.id + '" ' +
        'role="checkbox" aria-checked="' + (t.done ? 'true' : 'false') + '" ' +
        'tabindex="0" aria-label="' + safeName + '"></div>' +

      // Icon
      '<div class="weekly-task-icon" style="background:' + dc.bg + ';border-color:' + dc.color + '40;" aria-hidden="true">' + emoji + '</div>' +

      // Body
      '<div class="weekly-task-body">' +
        '<div class="weekly-task-name">' + safeName + '</div>' +
        (safeNote ? '<div class="weekly-task-note">' + safeNote + '</div>' : '') +
      '</div>' +

      // Actions
      '<div class="weekly-task-actions">' +
        '<span class="weekly-day-badge" style="background:' + dc.bg + ';color:' + dc.color + ';">' + dayDisplay + '</span>' +
        '<button class="weekly-edit-btn" data-action="wt-edit" data-id="' + t.id + '" aria-label="Edit task: ' + safeName + '">Edit</button>' +
        '<button class="weekly-del-btn" data-action="wt-delete" data-id="' + t.id + '" aria-label="Delete task: ' + safeName + '">x</button>' +
      '</div>';

    container.appendChild(row);
  });
}


/* ═══════════════════════════════════════════════════════════════
   PAGE HTML BUILDER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the weekly planner page HTML.
 * Called once during initialization.
 */
export function buildWeeklyPage() {
  const page = document.getElementById('page-weekly');
  if (!page || page.children.length > 0) return;

  page.innerHTML =
    // Hero
    '<div class="weekly-hero" role="banner">' +
      '<div class="weekly-hero-label">WEEKLY PLANNER</div>' +
      '<div class="weekly-hero-title">This Week</div>' +
      '<div class="weekly-hero-sub" id="weekly-hero-sub">All tasks for the week</div>' +
    '</div>' +

    // Stats row
    '<div class="weekly-stats-row" role="region" aria-label="Weekly task statistics">' +
      '<div class="weekly-stat-item"><div class="weekly-stat-num" id="ws-done" style="color:#22c55e;" aria-live="polite">0</div><div class="weekly-stat-lbl">DONE</div></div>' +
      '<div class="weekly-stat-item"><div class="weekly-stat-num" id="ws-progress" style="color:#7c3aed;" aria-live="polite">0%</div><div class="weekly-stat-lbl">PROGRESS</div></div>' +
      '<div class="weekly-stat-item"><div class="weekly-stat-num" id="ws-active" style="color:#0284c7;" aria-live="polite">0</div><div class="weekly-stat-lbl">ACTIVE</div></div>' +
      '<div class="weekly-stat-item"><div class="weekly-stat-num" id="ws-pending" style="color:#f59e0b;" aria-live="polite">0</div><div class="weekly-stat-lbl">PENDING</div></div>' +
    '</div>' +

    // Main card
    '<div class="weekly-tasks-card">' +
      '<div class="weekly-tasks-header">' +
        '<div class="weekly-tasks-title"><span aria-hidden="true">📋</span> Weekly Tasks</div>' +
        '<span class="weekly-tasks-count" id="weekly-tasks-count" aria-live="polite">0/0 done</span>' +
      '</div>' +

      // Add row
      '<div style="padding:12px 16px;border-bottom:1px solid rgba(139,92,246,0.05);">' +
        '<div class="weekly-add-row">' +
          '<input class="weekly-add-input" id="wt-task-input" placeholder="Add a new weekly task..." maxlength="80" aria-label="New weekly task name"/>' +
          '<input class="weekly-add-note" id="wt-task-note" placeholder="Sub-note (optional)" maxlength="60" aria-label="Task sub-note"/>' +

          // Day picker
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<div class="wt-day-picker" id="wt-day-picker" role="group" aria-label="Select days">' +
              '<button type="button" class="wt-day-pill sel" data-day="Mon">Mon</button>' +
              '<button type="button" class="wt-day-pill" data-day="Tue">Tue</button>' +
              '<button type="button" class="wt-day-pill" data-day="Wed">Wed</button>' +
              '<button type="button" class="wt-day-pill" data-day="Thu">Thu</button>' +
              '<button type="button" class="wt-day-pill" data-day="Fri">Fri</button>' +
              '<button type="button" class="wt-day-pill" data-day="Sat">Sat</button>' +
              '<button type="button" class="wt-day-pill" data-day="Sun">Sun</button>' +
            '</div>' +

            // Presets
            '<div class="wt-day-presets">' +
              '<button type="button" class="wt-preset-chip" data-action="wt-preset" data-preset="everyday">Everyday</button>' +
              '<button type="button" class="wt-preset-chip" data-action="wt-preset" data-preset="weekdays">Weekdays (Mon-Fri)</button>' +
              '<button type="button" class="wt-preset-chip" data-action="wt-preset" data-preset="weekends">Weekends (Sat-Sun)</button>' +
              '<button type="button" class="wt-preset-chip" data-action="wt-preset" data-preset="clear">Clear</button>' +
            '</div>' +
          '</div>' +

          '<button class="weekly-add-btn" data-action="wt-add-task" aria-label="Add weekly task">+ Add</button>' +
        '</div>' +
      '</div>' +

      // Filter row
      '<div class="weekly-filter-row" role="group" aria-label="Task day filters">' +
        '<button class="weekly-filter-btn active" data-action="wt-filter" data-filter="all" aria-pressed="true">All</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="active" aria-pressed="false">Active</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="done" aria-pressed="false">Done</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="today" aria-pressed="false">Today</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Mon" aria-pressed="false">Mon</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Tue" aria-pressed="false">Tue</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Wed" aria-pressed="false">Wed</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Thu" aria-pressed="false">Thu</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Fri" aria-pressed="false">Fri</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Sat" aria-pressed="false">Sat</button>' +
        '<button class="weekly-filter-btn" data-action="wt-filter" data-filter="Sun" aria-pressed="false">Sun</button>' +
      '</div>' +

      // Task list
      '<div id="weekly-task-list" style="padding:8px 0;" role="list" aria-label="Weekly tasks" aria-live="polite"></div>' +
    '</div>' +

    // Actions
    '<div class="reset-row">' +
      '<button class="rbtn" data-action="wt-clear-done">Clear completed tasks</button>' +
    '</div>' +
    '<div class="reset-row" style="padding-top:0;">' +
      '<button class="rbtn danger" data-action="wt-reset-week">Reset all weekly tasks</button>' +
    '</div>';
}


/* ═══════════════════════════════════════════════════════════════
   EVENT BINDING (called once from init.js)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Binds all weekly planner event handlers via delegation.
 */
export function bindWeeklyEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
      case 'wt-add-task':
        wtAddTask();
        break;

      case 'wt-toggle':
        wtToggleTask(el.dataset.id);
        break;

      case 'wt-edit':
        wtOpenEdit(el.dataset.id);
        break;

      case 'wt-delete':
        wtDeleteTask(el.dataset.id);
        break;

      case 'wt-filter':
        wtSetFilter(el, el.dataset.filter);
        break;

      case 'wt-preset':
        wtSetDayPreset(el.dataset.preset);
        break;

      case 'wt-clear-done':
        wtClearDone();
        break;

      case 'wt-reset-week':
        wtResetWeek();
        break;
    }
  });

  // Day pill toggle (click on individual day pills)
  document.addEventListener('click', e => {
    const pill = e.target.closest('.wt-day-pill');
    if (!pill) return;

    const day = pill.dataset.day;
    if (!day) return;

    if (flags.wtSelectedDays.includes(day)) {
      flags.wtSelectedDays = flags.wtSelectedDays.filter(d => d !== day);
    } else {
      flags.wtSelectedDays.push(day);
    }
    _syncDayPills();
  });

  // Enter key on task input
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target && e.target.id === 'wt-task-input') {
      wtAddTask();
    }
  });

  // Weekly checkbox keyboard support
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList.contains('weekly-cb')) {
      e.preventDefault();
      const id = e.target.dataset.id;
      if (id) wtToggleTask(id);
    }
  });

  // Weekly edit modal save/cancel
  document.addEventListener('click', e => {
    const target = e.target;
    if (!target) return;

    // Save button in edit modal
    if (target.closest('#weekly-edit-modal .edit-save')) {
      saveWeeklyEdit();
    }
    // Cancel button in edit modal
    if (target.closest('#weekly-edit-modal .edit-cancel')) {
      closeWeeklyEditModal();
    }
    // Click on overlay to close
    if (target.id === 'weekly-edit-modal' && target.classList.contains('open')) {
      closeWeeklyEditModal();
    }
  });
}


/* ═══════════════════════════════════════════════════════════════
   PAGE INIT & REGISTRATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * @private Initializes the weekly page when navigated to.
 */
function _initWeeklyPage() {
  wtRenderTasks();
}

// Register with navigation system
onPageShow('weekly', _initWeeklyPage);

// Register full refresh callback
onFullRefresh(() => wtRenderTasks());
