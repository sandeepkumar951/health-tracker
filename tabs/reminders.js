/**
 * ═══════════════════════════════════════════════════════════════
 * tabs/reminders.js — Reminder engine & notifications
 *
 * This module owns:
 * - Reminders page HTML builder
 * - Notification permission UI
 * - Reminder CRUD (add, toggle, delete)
 * - Reminder presets
 * - Days picker
 * - checkReminders() — fires due reminders
 * - fireNotification() — browser + in-app notifications
 * - Integration with service worker
 *
 * SCHEDULING:
 * Reminders are checked every 30s by the master timer (in init.js).
 * Each reminder has a time (HH:MM), list of active days (0-6),
 * and an enabled flag. Firing is deduplicated per reminder per
 * day via the firedToday map in localStorage.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  DAY_NAMES,
  genId,
  sanitizeHTML,
  showToast,
  validateTimeString,
  formatTime12,
  todayKey
} from '../core/utils.js';

import { state, flags, saveFiredToday } from '../core/state.js';
import { debouncedSave } from '../core/firebase.js';
import {
  onPageShow,
  onFullRefresh,
  showInAppNotif,
  renderHomeReminders,
  checkMissedTasksBanner
} from '../tabs/today.js';


/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const REMINDER_PRESETS = [
  { title: 'Drink water',      msg: 'Stay hydrated!',                time: '10:00', icon: '💧', days: [0,1,2,3,4,5,6] },
  { title: 'Take tablets',     msg: "Don't forget!",                 time: '21:00', icon: '💊', days: [0,1,2,3,4,5,6] },
  { title: 'Study time',       msg: '4 hours — no distractions!',    time: '09:00', icon: '📚', days: [1,2,3,4,5] },
  { title: 'Morning routine',  msg: 'Lemon water, almonds, amla',    time: '06:30', icon: '🌅', days: [0,1,2,3,4,5,6] },
  { title: 'Sleep reminder',   msg: 'Wind down. Sleep by 10 PM',     time: '21:30', icon: '🌙', days: [0,1,2,3,4,5,6] },
  { title: 'Lunch time',       msg: 'Dal + veggies + roti!',         time: '13:00', icon: '🥗', days: [1,2,3,4,5] },
  { title: 'Evening walk',     msg: 'Get some steps in!',            time: '17:30', icon: '🏃', days: [0,1,2,3,4,5,6] },
  { title: 'Read English',     msg: '10-15 min reading',             time: '20:00', icon: '📚', days: [0,1,2,3,4,5,6] }
];


/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION PERMISSION UI
   ═══════════════════════════════════════════════════════════════ */

/**
 * Updates the notification permission status display.
 */
export function updateNotifStatusUI() {
  const dot = document.getElementById('notif-dot');
  const txt = document.getElementById('notif-status-text');
  const btn = document.getElementById('notif-enable-btn');
  if (!dot || !txt || !btn) return;

  if (!('Notification' in window)) {
    dot.className = 'notif-status-dot denied';
    txt.textContent = 'Not supported on this device.';
    btn.style.display = 'none';
    return;
  }

  const p = Notification.permission;
  if (p === 'granted') {
    dot.className = 'notif-status-dot granted';
    txt.textContent = 'Notifications enabled!';
    btn.style.display = 'none';
  } else if (p === 'denied') {
    dot.className = 'notif-status-dot denied';
    txt.textContent = 'Blocked — check browser settings.';
    btn.style.display = 'block';
  } else {
    dot.className = 'notif-status-dot';
    txt.textContent = 'Tap Enable to receive reminders.';
    btn.style.display = 'block';
  }
}

/**
 * Requests notification permission from the user.
 */
export function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Not supported'); return; }
  Notification.requestPermission().then(p => {
    updateNotifStatusUI();
    if (p === 'granted') showToast('Notifications enabled!', 'gt');
  });
}


/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION DISPATCH
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fires a notification both in-app and as a browser notification.
 * @param {string} title
 * @param {string} body
 * @param {string} [icon='🔔']
 */
export function fireNotification(title, body, icon) {
  // In-app notification
  showInAppNotif(icon || '🔔', title, body);
  renderHomeReminders();

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body || '',
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A7%A0%3C/text%3E%3C/svg%3E",
        tag: title + '_' + new Date().toISOString().slice(0, 16)
      });
    } catch (e) { /* ignore */ }
  }
}


/* ═══════════════════════════════════════════════════════════════
   CHECK REMINDERS — Called by master timer every 30s
   ═══════════════════════════════════════════════════════════════ */

/** @private Tracks start time for 30s initial guard */
let _checkStartTime = null;

/**
 * Checks all enabled reminders and fires any that are due.
 * Uses firedToday map to prevent double-firing.
 * Skips the first 30s after app open (unless it's the first check).
 */
export function checkReminders() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const time = h + ':' + m;
  const day = now.getDay();
  const date = todayKey();

  // Skip first 30s after app open (unless first check)
  if (!flags._reminderFirstCheck) {
    if (!_checkStartTime) _checkStartTime = Date.now();
    if (Date.now() - _checkStartTime < 30000) return;
  }
  flags._reminderFirstCheck = false;
  if (!_checkStartTime) _checkStartTime = Date.now();

  const deletedIds = new Set(state.deletedReminderIds || []);

  (state.reminders || []).forEach(r => {
    if (!r.enabled) return;
    if (!r.days.includes(day)) return;
    if (r.time !== time) return;
    if (deletedIds.has(r.id)) return;

    const key = r.id + '_' + date + '_' + r.time;
    if (flags.firedToday[key]) return;

    flags.firedToday[key] = true;
    saveFiredToday();
    fireNotification(r.title, r.msg, r.icon);
  });

  // Also check missed tasks banner
  checkMissedTasksBanner();
}

/**
 * Resets the check start time (used during factory reset).
 */
export function resetCheckStartTime() {
  _checkStartTime = null;
}


/* ═══════════════════════════════════════════════════════════════
   REMINDER LIST RENDERING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Renders the reminder list in the reminders page.
 */
export function renderReminderList() {
  const list = document.getElementById('reminder-list');
  if (!list) return;

  const rems = state.reminders || [];
  const tag = document.getElementById('r-count-tag');
  if (tag) tag.textContent = rems.filter(r => r.enabled).length + ' active';

  list.innerHTML = '';

  if (!rems.length) {
    const e = document.createElement('div');
    e.className = 'tempty';
    e.textContent = 'No reminders yet.';
    list.appendChild(e);
    return;
  }

  rems.forEach((r, i) => {
    const allD = r.days.length === 7;
    const isWD = [1,2,3,4,5].every(d => r.days.includes(d)) && r.days.length === 5;
    const dL = allD ? 'Every day' : isWD ? 'Weekdays' : r.days.slice().sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ');

    const hh = +r.time.split(':')[0];
    const mm = r.time.split(':')[1];
    const tL = ((hh % 12) || 12) + ':' + mm + ' ' + (hh < 12 ? 'AM' : 'PM');

    const row = document.createElement('div');
    row.className = 'reminder-item';
    row.setAttribute('role', 'listitem');

    row.innerHTML =
      '<div class="reminder-icon-box" aria-hidden="true">' + r.icon + '</div>' +
      '<div class="reminder-body">' +
        '<div class="reminder-title">' + sanitizeHTML(r.title || '') + '</div>' +
        '<div class="reminder-time-row">' + tL + ' · ' + sanitizeHTML(dL) + '</div>' +
        (r.msg ? '<div class="reminder-msg-row">"' + sanitizeHTML(r.msg) + '"</div>' : '') +
      '</div>' +
      '<label class="r-toggle" aria-label="Toggle ' + sanitizeHTML(r.title || '') + '">' +
        '<input type="checkbox"' + (r.enabled ? ' checked' : '') +
          ' data-action="toggle-reminder" data-index="' + i + '"' +
          ' aria-label="Enable ' + sanitizeHTML(r.title || '') + '"/>' +
        '<span class="r-slider"></span>' +
      '</label>' +
      '<button class="reminder-del-btn" data-action="delete-reminder" data-index="' + i + '"' +
        ' aria-label="Delete reminder: ' + sanitizeHTML(r.title || '') + '">&times;</button>';

    list.appendChild(row);
  });
}


/* ═══════════════════════════════════════════════════════════════
   REMINDER CRUD
   ═══════════════════════════════════════════════════════════════ */

/**
 * Toggles a reminder's enabled state.
 * @param {number} idx - Reminder index
 * @param {boolean} enabled - New state
 */
export function toggleReminder(idx, enabled) {
  const r = (state.reminders || [])[idx];
  if (!r) return;
  r.enabled = enabled;
  state.remindersUpdatedAt = Date.now();
  debouncedSave();
  renderReminderList();
  renderHomeReminders();
  showToast(enabled ? 'Enabled' : 'Paused');
}

/**
 * Deletes a reminder.
 * @param {number} idx - Reminder index
 */
export function deleteReminder(idx) {
  if (!confirm('Delete this reminder?')) return;
  const reminder = (state.reminders || [])[idx];

  if (reminder && reminder.id) {
    if (!state.deletedReminderIds) state.deletedReminderIds = [];
    if (!state.deletedReminderIds.includes(reminder.id)) {
      state.deletedReminderIds.push(reminder.id);
    }
    if (state.deletedReminderIds.length > 100) {
      state.deletedReminderIds = state.deletedReminderIds.slice(-100);
    }
  }

  state.reminders = (state.reminders || []).filter((_, i) => i !== idx);
  state.remindersUpdatedAt = Date.now();
  debouncedSave();
  renderReminderList();
  renderHomeReminders();
  showToast('Deleted');
}

/**
 * Adds a new reminder from form inputs.
 */
export function addReminder() {
  const title = document.getElementById('r-title');
  const msg = document.getElementById('r-msg');
  const time = document.getElementById('r-time');
  const icon = document.getElementById('r-icon');

  const titleVal = title ? title.value.trim() : '';
  const timeVal = time ? time.value : '';

  if (!titleVal) { showToast('Enter a title'); return; }
  if (titleVal.length > 60) { showToast('Title too long (max 60 characters)', 'yt'); return; }
  if (!validateTimeString(timeVal)) { showToast('Invalid time format', 'rt'); return; }
  if (!flags.selDays.length) { showToast('Select at least one day'); return; }

  if (!state.reminders) state.reminders = [];

  state.reminders.push({
    id: genId(),
    title: titleVal,
    msg: msg ? msg.value.trim() : '',
    time: timeVal,
    icon: icon ? icon.value : '🔔',
    days: flags.selDays.slice(),
    enabled: true
  });

  state.remindersUpdatedAt = Date.now();
  debouncedSave();
  renderReminderList();
  renderHomeReminders();

  // Reset form
  if (title) title.value = '';
  if (msg) msg.value = '';
  if (time) time.value = '08:00';
  if (icon) icon.selectedIndex = 0;
  flags.selDays = [0,1,2,3,4,5,6];
  buildDaysPicker();

  showToast('Reminder set for ' + formatTime12(timeVal) + '!', 'gt');
}


/* ═══════════════════════════════════════════════════════════════
   DAYS PICKER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the days picker buttons in the add reminder form.
 */
export function buildDaysPicker() {
  const w = document.getElementById('days-picker');
  if (!w) return;
  w.innerHTML = '';

  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  names.forEach((d, i) => {
    const btn = document.createElement('button');
    btn.className = 'day-btn' + (flags.selDays.includes(i) ? ' sel' : '');
    btn.textContent = d;
    btn.type = 'button';
    btn.setAttribute('aria-pressed', flags.selDays.includes(i) ? 'true' : 'false');
    btn.setAttribute('aria-label', d + (flags.selDays.includes(i) ? ' selected' : ''));
    btn.dataset.dayIndex = i;
    w.appendChild(btn);
  });
}


/* ═══════════════════════════════════════════════════════════════
   PRESETS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the quick preset chips.
 * Only builds once (guarded).
 */
export function buildPresetChips() {
  const w = document.getElementById('preset-chips');
  if (!w || w.children.length > 0) return;

  REMINDER_PRESETS.forEach(p => {
    const c = document.createElement('div');
    c.className = 'preset-chip';
    c.textContent = p.icon + ' ' + p.title;
    c.setAttribute('role', 'button');
    c.setAttribute('tabindex', '0');
    c.setAttribute('aria-label', 'Load preset: ' + p.title);
    c.dataset.action = 'load-preset';
    c.dataset.presetTitle = p.title;
    c.dataset.presetMsg = p.msg;
    c.dataset.presetTime = p.time;
    c.dataset.presetIcon = p.icon;
    c.dataset.presetDays = JSON.stringify(p.days);
    w.appendChild(c);
  });
}


/* ═══════════════════════════════════════════════════════════════
   PAGE HTML BUILDER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the reminders page HTML.
 * Called once during initialization.
 */
export function buildRemindersPage() {
  const page = document.getElementById('page-reminders');
  if (!page || page.children.length > 0) return;

  page.innerHTML =
    // Notification permission card
    '<div class="sc">' +
      '<div class="sh"><span class="si" aria-hidden="true">🔔</span><span class="st">Notification permission</span></div>' +
      '<div class="notif-status-bar" role="status" aria-live="polite">' +
        '<div class="notif-status-dot" id="notif-dot"></div>' +
        '<span class="notif-status-text" id="notif-status-text">Checking...</span>' +
        '<button class="notif-enable-btn" id="notif-enable-btn" data-action="request-notif-permission">Enable</button>' +
      '</div>' +
      '<div class="abox blue" style="margin:8px 14px 10px;">Works best on Android Chrome. On iOS, add to Home Screen first then use Safari.</div>' +
    '</div>' +

    // Quick presets card
    '<div class="sc">' +
      '<div class="sh"><span class="si" aria-hidden="true">⚡</span><span class="st">Quick presets</span></div>' +
      '<div class="preset-chips" id="preset-chips" role="group" aria-label="Quick preset reminders"></div>' +
    '</div>' +

    // My reminders card
    '<div class="sc">' +
      '<div class="sh">' +
        '<span class="si" aria-hidden="true">📋</span>' +
        '<span class="st">My reminders</span>' +
        '<span class="r-count-tag" id="r-count-tag" aria-live="polite">0 active</span>' +
      '</div>' +
      '<div class="reminder-list" id="reminder-list" role="list" aria-label="My reminders" aria-live="polite"></div>' +
    '</div>' +

    // Add new reminder card
    '<div class="sc">' +
      '<div class="sh"><span class="si" aria-hidden="true">➕</span><span class="st">Add new reminder</span></div>' +
      '<div class="add-reminder-form">' +
        '<div><label class="form-label" for="r-title">Title</label>' +
          '<input class="form-input" id="r-title" placeholder="e.g. Drink water" maxlength="60" aria-label="Reminder title"/></div>' +
        '<div><label class="form-label" for="r-msg">Message (optional)</label>' +
          '<input class="form-input" id="r-msg" placeholder="e.g. Stay hydrated!" maxlength="100" aria-label="Reminder message"/></div>' +
        '<div class="form-row">' +
          '<div style="flex:1;"><label class="form-label" for="r-time">Time</label>' +
            '<input class="time-input" id="r-time" type="time" value="08:00" aria-label="Reminder time"/></div>' +
          '<div><label class="form-label" for="r-icon">Icon</label>' +
            '<select class="icon-select" id="r-icon" aria-label="Reminder icon">' +
              '<option>💧</option><option>🌅</option><option>🍳</option><option>💊</option>' +
              '<option>📚</option><option>🏃</option><option>🌙</option><option>🥗</option>' +
              '<option>☕</option><option>🧘</option><option>💪</option><option>⏰</option>' +
              '<option>🔔</option><option>❤️</option><option>🍎</option><option>🌿</option>' +
            '</select></div>' +
        '</div>' +
        '<div><label class="form-label">Repeat on days</label>' +
          '<div class="days-picker" id="days-picker" role="group" aria-label="Repeat days"></div></div>' +
        '<button class="add-reminder-btn" data-action="add-reminder">Set Reminder</button>' +
      '</div>' +
    '</div>';
}


/* ═══════════════════════════════════════════════════════════════
   EVENT BINDING (called once from init.js)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Binds all reminder-related event handlers via delegation.
 */
export function bindReminderEvents() {
  // ── Click delegation ──
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
      case 'add-reminder':
        addReminder();
        break;

      case 'delete-reminder':
        deleteReminder(+el.dataset.index);
        break;

      case 'request-notif-permission':
        requestNotifPermission();
        break;

      case 'load-preset': {
        const rt = document.getElementById('r-title');
        const rm = document.getElementById('r-msg');
        const rtime = document.getElementById('r-time');
        const ri = document.getElementById('r-icon');

        if (rt) rt.value = el.dataset.presetTitle || '';
        if (rm) rm.value = el.dataset.presetMsg || '';
        if (rtime) rtime.value = el.dataset.presetTime || '08:00';
        if (ri) ri.value = el.dataset.presetIcon || '🔔';

        try {
          flags.selDays = JSON.parse(el.dataset.presetDays || '[]');
        } catch (_) {
          flags.selDays = [0,1,2,3,4,5,6];
        }
        buildDaysPicker();
        showToast('Preset loaded');
        break;
      }
    }
  });

  // ── Checkbox change for toggle ──
  document.addEventListener('change', e => {
    const inp = e.target;
    if (!inp || inp.type !== 'checkbox') return;
    if (inp.dataset.action === 'toggle-reminder') {
      toggleReminder(+inp.dataset.index, inp.checked);
    }
  });

  // ── Days picker button clicks ──
  document.addEventListener('click', e => {
    const btn = e.target.closest('.day-btn[data-day-index]');
    if (!btn) return;

    const i = +btn.dataset.dayIndex;
    if (flags.selDays.includes(i)) {
      flags.selDays = flags.selDays.filter(x => x !== i);
    } else {
      flags.selDays.push(i);
    }
    buildDaysPicker();
  });

  // ── Preset chip keyboard support ──
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.dataset.action === 'load-preset') {
      e.preventDefault();
      e.target.click();
    }
  });

  // ── Service worker message relay ──
  window.addEventListener('sw-check-reminders', () => {
    checkReminders();
  });

  // ── Notification permission changed ──
  window.addEventListener('notif-permission-changed', () => {
    updateNotifStatusUI();
  });
}


/* ═══════════════════════════════════════════════════════════════
   PAGE INIT & REGISTRATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * @private Initializes the reminders page when navigated to.
 */
function _initRemindersPage() {
  // Reset form fields on every navigate
  flags.selDays = [0,1,2,3,4,5,6];
  buildDaysPicker();

  const rt = document.getElementById('r-title');
  const rm = document.getElementById('r-msg');
  const rtime = document.getElementById('r-time');
  const ri = document.getElementById('r-icon');

  if (rt) rt.value = '';
  if (rm) rm.value = '';
  if (rtime) rtime.value = '08:00';
  if (ri) ri.selectedIndex = 0;

  updateNotifStatusUI();
  renderReminderList();
}

// Register with navigation system
onPageShow('reminders', _initRemindersPage);

// Register refresh callback
onFullRefresh(() => renderReminderList());
