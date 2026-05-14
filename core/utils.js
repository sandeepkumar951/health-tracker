/**
 * ═══════════════════════════════════════════════════════════════
 * core/utils.js — Pure utility functions (zero dependencies)
 *
 * Every function here is stateless and reusable.
 * No module imports — this is the leaf of the dependency tree.
 * ═══════════════════════════════════════════════════════════════
 */

/* ─── CONSTANTS ─── */

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const VALID_TASK_DAYS = [
  'Mon','Tue','Wed','Thu','Fri','Sat','Sun',
  'Today','Tomorrow','Anytime'
];

/** Persistence keys */
export const DB_KEY        = 'htrack_v20';
export const DB_KEY_FIRED  = 'firedToday_';
export const DB_KEY_MIDNIGHT = 'midnightFired_';

/** Career tracker constants */
export const CT_HOUR_GOAL    = 4;
export const CT_WEEK_GOAL    = 28;
export const CT_TARGET_DATE  = '2026-08-30';
export const CT_LOG_LIMIT    = 50;
export const CT_XP_PER_HOUR  = 5;
export const CT_SKILL_KEYS   = ['sql','tools','proj','intv'];

/** Water tracker constants */
export const WT_GOAL = 11;
export const WT_ML   = 300;

/** Limits */
export const DAILY_HOUR_GOAL   = CT_HOUR_GOAL;
export const MAX_JUNK_LOG      = 500;
export const MAX_SUGAR_LOG     = 500;
export const MAX_CT_TASKS      = 200;
export const MAX_WEEKLY_TASKS  = 100;
export const MAX_DAY_HISTORY   = 400;

/** Sync tuning */
export const REALTIME_MAX_RETRIES = 10;
export const REALTIME_BASE_DELAY  = 3000;
export const SAVE_MAX_FAILS       = 5;
export const SAVE_RETRY_BASE      = 300;

/** Junk / sugar / biryani limits */
export const JNK_LIMIT      = 4;
export const J_SUGAR_LIMIT  = 50;
export const J_BIRY_LIMIT   = 2;


/* ═══════════════════════════════════════════════════════════════
   DATE UTILITIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns today's date as 'YYYY-MM-DD'.
 * @returns {string}
 */
export function todayKey() {
  const n = new Date();
  return (
    n.getFullYear() + '-' +
    String(n.getMonth() + 1).padStart(2, '0') + '-' +
    String(n.getDate()).padStart(2, '0')
  );
}

/**
 * Returns yesterday's date as 'YYYY-MM-DD'.
 * @returns {string}
 */
export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * Calculates the number of days between two 'YYYY-MM-DD' date strings.
 * @param {string} a - Start date
 * @param {string} b - End date
 * @returns {number} Integer days between (can be negative)
 */
export function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.floor(
    (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000
  );
}

/**
 * Returns the Monday-start week key for a given date.
 * @param {Date|string} d - Date object or 'YYYY-MM-DD' string
 * @returns {string} 'YYYY-MM-DD' of the Monday
 */
export function weekStartOf(d) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return (
    x.getFullYear() + '-' +
    String(x.getMonth() + 1).padStart(2, '0') + '-' +
    String(x.getDate()).padStart(2, '0')
  );
}

/**
 * Sugar week start — same logic as weekStartOf but called separately
 * so the name is clear in sugar-related contexts.
 * @param {Date|string} d
 * @returns {string}
 */
export function sugarWeekStartOf(d) {
  return weekStartOf(d);
}

/**
 * Returns 'YYYY-MM' for a given month index (0-11) and year.
 * @param {number} month - 0-based month
 * @param {number} year
 * @returns {string}
 */
export function monthKey(month, year) {
  return year + '-' + String(month + 1).padStart(2, '0');
}

/**
 * Returns current month key 'YYYY-MM'.
 * @returns {string}
 */
export function currentMonthKey() {
  const n = new Date();
  return monthKey(n.getMonth(), n.getFullYear());
}

/**
 * Formats 'YYYY-MM-DD' as '14 May'.
 * @param {string} dateKey
 * @returns {string}
 */
export function formatDateShort(dateKey) {
  if (!dateKey) return '';
  try {
    const d = new Date(dateKey + 'T00:00:00');
    return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  } catch (e) {
    return dateKey;
  }
}

/**
 * Formats 'YYYY-MM-DD' as 'Wed, 14 May 2026'.
 * @param {string} dateKey
 * @returns {string}
 */
export function formatDateFull(dateKey) {
  if (!dateKey) return '';
  try {
    return new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateKey;
  }
}

/**
 * Returns today as 'Wed, 14 May 2026'.
 * @returns {string}
 */
export function todayStr() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Returns the end-of-week key (7 days after weekStart) as 'YYYY-MM-DD'.
 * Used for sugar tracker week boundary comparisons.
 * @param {string} weekStart - 'YYYY-MM-DD'
 * @returns {string}
 */
export function sugarWeekEndKey(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * Checks if a dateKey is today.
 * @param {string} dateKey
 * @returns {boolean}
 */
export function isToday(dateKey) {
  return dateKey === todayKey();
}

/**
 * Checks if a dateKey is yesterday.
 * @param {string} dateKey
 * @returns {boolean}
 */
export function isYesterday(dateKey) {
  return dateKey === yesterdayKey();
}

/**
 * Returns 'Today', 'Yesterday', or a short formatted date.
 * @param {string} dateKey
 * @returns {string}
 */
export function getRelativeDate(dateKey) {
  if (isToday(dateKey)) return 'Today';
  if (isYesterday(dateKey)) return 'Yesterday';
  return formatDateShort(dateKey);
}

/**
 * Checks if the current day is Saturday or Sunday.
 * @returns {boolean}
 */
export function isWeekend() {
  const d = new Date().getDay();
  return d === 0 || d === 6;
}


/* ═══════════════════════════════════════════════════════════════
   TIME UTILITIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validates an 'HH:MM' time string.
 * @param {string} val
 * @returns {boolean}
 */
export function validateTimeString(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  if (parts.length !== 2) return false;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Formats 'HH:MM' (24h) into '3:45 PM' (12h).
 * @param {string} val - 'HH:MM'
 * @returns {string}
 */
export function formatTime12(val) {
  if (!val) return '';
  const [h, m] = val.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  return ((h % 12) || 12) + ':' + String(m || 0).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
}


/* ═══════════════════════════════════════════════════════════════
   VALIDATION UTILITIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validates a single task day string against VALID_TASK_DAYS.
 * Falls back to 'Anytime' if invalid.
 * @param {string} day
 * @returns {string}
 */
export function validateTaskDay(day) {
  if (!VALID_TASK_DAYS.includes(day)) {
    console.warn('Sandy Brain: invalid task day "' + day + '" converted to Anytime');
    return 'Anytime';
  }
  return day;
}

/**
 * Validates a comma-separated multi-day string.
 * Falls back to 'Anytime' if all are invalid.
 * @param {string} dayStr
 * @returns {string}
 */
export function validateTaskDays(dayStr) {
  if (!dayStr) return 'Anytime';
  const parts = dayStr.split(',').map(d => d.trim()).filter(Boolean);
  const valid = parts.filter(d => VALID_TASK_DAYS.includes(d));
  if (valid.length === 0) return 'Anytime';
  if (valid.length === 1) return valid[0];
  return valid.join(',');
}

/**
 * Validates a habit name (1-80 characters, non-empty after trim).
 * @param {string} name
 * @returns {boolean}
 */
export function validateHabitName(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  return t.length >= 1 && t.length <= 80;
}


/* ═══════════════════════════════════════════════════════════════
   SANITIZATION UTILITIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sanitizes a string for safe HTML insertion.
 * Strips javascript: and inline event handlers, then HTML-encodes.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  const cleaned = str
    .replace(/javascript\s*:/gi, 'nojs:')
    .replace(/on\w+\s*=/gi, 'data-removed=');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes a string received from Firebase, capping its length.
 * @param {*} val
 * @param {number} [maxLen=200]
 * @returns {string}
 */
export function sanitizeRemoteString(val, maxLen) {
  if (typeof val !== 'string') return '';
  return String(val).slice(0, maxLen || 200);
}

/**
 * Sanitizes a number received from Firebase with min/max clamping.
 * @param {*} val
 * @param {number} [min]
 * @param {number} [max]
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function sanitizeRemoteNumber(val, min, max, fallback) {
  const n = Number(val);
  if (isNaN(n)) return fallback !== undefined ? fallback : 0;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * Sanitizes a boolean received from Firebase.
 * @param {*} val
 * @returns {boolean}
 */
export function sanitizeRemoteBool(val) {
  return !!val;
}


/* ═══════════════════════════════════════════════════════════════
   ID GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generates a short unique ID for records.
 * @returns {string}
 */
export function genId() {
  return '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Returns (or creates) a persistent device ID stored in localStorage.
 * Used for Firebase echo detection so a device ignores its own writes.
 * @returns {string}
 */
export function getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem('sandy_device_id');
  } catch (e) { /* ignore */ }
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    try {
      safeLocalStorageSave('sandy_device_id', id);
    } catch (e) { /* ignore */ }
  }
  return id;
}


/* ═══════════════════════════════════════════════════════════════
   LOCAL STORAGE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Safely writes to localStorage with QuotaExceededError recovery.
 * On quota error, prunes old fired/midnight keys then retries.
 * @param {string} key
 * @param {string} value
 */
export function safeLocalStorageSave(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      try {
        // Prune old daily keys to free space
        const keysToRemove = [];
        const ydKey = yesterdayKey();
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(DB_KEY_FIRED) || k.startsWith(DB_KEY_MIDNIGHT))) {
            const dateInKey = k.split('_').pop();
            if (dateInKey && dateInKey < ydKey) keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, value);
      } catch (e2) {
        showToast('Storage full — some data may not persist locally', 'yt');
      }
    }
  }
}


/* ═══════════════════════════════════════════════════════════════
   CLIPBOARD
   ═══════════════════════════════════════════════════════════════ */

/**
 * Copies text to clipboard with toast feedback.
 * @param {string} text
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied!', 'gt'))
      .catch(() => showToast('Copy failed', 'yt'));
  } else {
    showToast('Copy not supported', 'yt');
  }
}


/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

/** @private Timer handle for auto-dismiss */
let _toastTimer = null;

/**
 * Shows a toast notification at the bottom of the screen.
 * Auto-dismisses after 3 seconds.
 * @param {string} msg - Message to display
 * @param {string} [cls] - Optional CSS class: 'gt' (green), 'yt' (yellow), 'rt' (red)
 */
export function showToast(msg, cls) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (cls || '');

  // Also announce to screen readers
  const ar = document.getElementById('aria-announce');
  if (ar) ar.textContent = msg;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.className = 'toast ' + (cls || '');
    if (ar) ar.textContent = '';
  }, 3000);
}


/* ═══════════════════════════════════════════════════════════════
   CONFETTI
   ═══════════════════════════════════════════════════════════════ */

/** @private Lock to prevent confetti spam */
let _confettiLock = false;

/**
 * Spawns a small burst of emoji confetti from the bottom of the viewport.
 * Debounced to prevent rapid-fire calls.
 */
export function confetti() {
  if (_confettiLock) return;
  _confettiLock = true;
  setTimeout(() => { _confettiLock = false; }, 1500);

  ['🎉', '⭐', '✨', '🎊', '💫'].forEach((emoji, i) => {
    setTimeout(() => {
      if (document.hidden) return;
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.textContent = emoji;
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'left:' + (Math.random() * 85) + 'vw;' +
        'top:' + (80 + Math.random() * 30) + 'px;' +
        'position:fixed;';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }, i * 120);
  });
}

/**
 * Resets the confetti lock (used during factory reset).
 */
export function resetConfettiLock() {
  _confettiLock = false;
}


/* ═══════════════════════════════════════════════════════════════
   AUDIO — COMPLETION TICK
   ═══════════════════════════════════════════════════════════════ */

/** @private */
let _audioCtx = null;
let _userInteracted = false;
let _audioIdleTimer = null;

/**
 * Must be called once to enable audio (requires user gesture).
 * Automatically attached to first click/touchstart.
 */
export function enableAudio() {
  if (_userInteracted) return;
  _userInteracted = true;
}

// Auto-enable on first interaction
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => enableAudio(), { once: true });
  document.addEventListener('touchstart', () => enableAudio(), { once: true });
}

/**
 * Plays a short sine-wave tick sound when a task is completed.
 * AudioContext is created on demand and auto-closed after 5s idle.
 */
export function playCompletionTick() {
  if (!_userInteracted) return;
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return;

  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();

    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.15);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.15);

    // Auto-close AudioContext after 5s idle to free resources
    clearTimeout(_audioIdleTimer);
    _audioIdleTimer = setTimeout(() => {
      if (_audioCtx) {
        try { _audioCtx.close(); } catch (e) { /* ignore */ }
        _audioCtx = null;
      }
    }, 5000);
  } catch (e) {
    /* Audio not available — fail silently */
  }
}

/**
 * Closes the AudioContext immediately (used during cleanup).
 */
export function closeAudioContext() {
  if (_audioCtx) {
    try { _audioCtx.close(); } catch (e) { /* ignore */ }
    _audioCtx = null;
  }
  clearTimeout(_audioIdleTimer);
}


/* ═══════════════════════════════════════════════════════════════
   EMOJI HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns an appropriate emoji for a task name based on keyword matching.
 * @param {string} name
 * @returns {string}
 */
export function getTaskEmoji(name) {
  if (!name) return '✅';
  const n = name.toLowerCase();

  if (/prayer|pray|namaz/.test(n)) return '🙏';
  if (/lemon|lime/.test(n)) return '🍋';
  if (/almond|walnut|nut/.test(n)) return '🌰';
  if (/amla/.test(n)) return '🍈';
  if (/egg/.test(n)) return '🥚';
  if (/fruit|apple|banana|papaya/.test(n)) return '🍎';
  if (/spinach|green|vegetable/.test(n)) return '🥦';
  if (/curd|yogurt|dahi/.test(n)) return '🥛';
  if (/seed|chia|flax/.test(n)) return '🌻';
  if (/sql|database|query|join/.test(n)) return '🗄️';
  if (/python|code|program/.test(n)) return '🐍';
  if (/excel|spreadsheet|pivot/.test(n)) return '📊';
  if (/resume|cv|linkedin/.test(n)) return '📄';
  if (/interview|mock/.test(n)) return '🎤';
  if (/apply|job|company/.test(n)) return '💼';
  if (/study|learn|course|revise/.test(n)) return '📚';
  if (/read|reading|english|article/.test(n)) return '📰';
  if (/face.?wash|wash|cleanse/.test(n)) return '🧴';
  if (/moistur/.test(n)) return '💆';
  if (/sunscreen|spf/.test(n)) return '☀️';
  if (/tablet|medicine|pill|hair tab/.test(n)) return '💊';
  if (/shampoo|keto/.test(n)) return '🚿';
  if (/sleep|bed|night/.test(n)) return '😴';
  if (/oil|massage/.test(n)) return '🛢️';
  if (/walk|step|exercise|gym/.test(n)) return '🏃';
  if (/water|hydrat|drink/.test(n)) return '💧';
  if (/lunch|dal|roti|rice/.test(n)) return '🍛';
  if (/dinner/.test(n)) return '🌙';
  if (/breakfast/.test(n)) return '🍳';
  if (/soak/.test(n)) return '🌊';
  if (/prep|ready|tomorrow/.test(n)) return '📦';
  if (/reminder/.test(n)) return '🔔';
  if (/laundry|cloth|iron|clean/.test(n)) return '🧹';
  if (/project|portfolio/.test(n)) return '🗂️';
  if (/network|connect/.test(n)) return '🤝';

  return '✅';
}

/**
 * Returns the emoji icon for a section, with fallback to the stored icon.
 * @param {string} id - Section ID
 * @param {string} icon - Stored icon string
 * @returns {string}
 */
export function getSectionEmoji(id, icon) {
  const map = {
    morning: '☀️',
    skin_am: '🧴',
    breakfast: '🍳',
    lunch: '🍛',
    water: '💧',
    evening: '🌆',
    dinner: '🌙',
    night: '🌃',
    prep: '📦'
  };
  return map[id] || icon || '📌';
}

/**
 * Returns the HTML content for a habit's icon (emoji, uploaded image, or fallback).
 * Handles synced images, local-only images, and the __needs_upload__ indicator.
 * @param {object} habit - Habit object from state
 * @returns {string} HTML string
 */
export function getHabitIconHtml(habit) {
  if (!habit) return '✅';

  // Image not synced indicator
  if (habit.customIcon === '__needs_upload__') {
    return (
      '<span title="Image not synced — re-upload on this device" style="font-size:18px;">' +
      getTaskEmoji(habit.name) +
      '</span>'
    );
  }

  // Uploaded image stored as data URI
  if (
    habit.customIconType === 'image' &&
    habit.customIcon &&
    habit.customIcon.startsWith('data:image/')
  ) {
    const safeUrl = habit.customIcon.replace(/"/g, '&quot;');
    return (
      '<img src="' + safeUrl + '" alt="" ' +
      'style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>'
    );
  }

  // Image stored locally only (not synced to Firebase)
  if (
    habit.customIconType === 'image_local' ||
    habit.customIcon === '__local_image__'
  ) {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const ls = JSON.parse(raw);
        const lh = (ls.habits || []).find(x => x.id === habit.id);
        if (
          lh &&
          lh.customIconType === 'image' &&
          lh.customIcon &&
          lh.customIcon.startsWith('data:image/')
        ) {
          const safeUrl = lh.customIcon.replace(/"/g, '&quot;');
          return (
            '<img src="' + safeUrl + '" alt="" ' +
            'style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>'
          );
        }
      }
    } catch (e) { /* ignore */ }

    return (
      '<span title="Image not synced — re-upload on this device" style="font-size:18px;">' +
      getTaskEmoji(habit.name) +
      '</span>'
    );
  }

  // Custom emoji
  if (habit.customIcon) return sanitizeHTML(habit.customIcon);

  // Default: auto-detect from name
  return getTaskEmoji(habit.name);
}


/* ═══════════════════════════════════════════════════════════════
   WEEKLY DAY COLOR MAP
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns background and text color for a weekly task day badge.
 * Supports multi-day strings (uses first day's color).
 * @param {string} day - Day string, possibly comma-separated
 * @returns {{ bg: string, color: string }}
 */
export function getWeeklyDayColor(day) {
  const map = {
    Mon:      { bg: '#eff6ff', color: '#2563eb' },
    Tue:      { bg: '#f0fdf4', color: '#16a34a' },
    Wed:      { bg: '#fffbeb', color: '#d97706' },
    Thu:      { bg: '#fdf4ff', color: '#9333ea' },
    Fri:      { bg: '#fef2f2', color: '#dc2626' },
    Sat:      { bg: '#ecfdf5', color: '#059669' },
    Sun:      { bg: '#fff1f2', color: '#e11d48' },
    Today:    { bg: '#e0f2fe', color: '#0284c7' },
    Tomorrow: { bg: '#f0fdf4', color: '#16a34a' },
    Anytime:  { bg: '#f5f3ff', color: '#7c3aed' }
  };

  const firstDay = (day || '').split(',')[0].trim();
  return map[firstDay] || map['Anytime'];
}


/* ═══════════════════════════════════════════════════════════════
   DOM HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Safely queries a DOM element by ID with null check.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Sets textContent of an element only if it exists and value changed.
 * Avoids unnecessary DOM writes.
 * @param {string} id - Element ID
 * @param {string} text - New text content
 */
export function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) {
    el.textContent = text;
  }
}

/**
 * Sets an inline style property on an element by ID, only if it exists.
 * @param {string} id
 * @param {string} prop - CSS property name
 * @param {string} value - CSS value
 */
export function setStyle(id, prop, value) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = value;
}


/* ═══════════════════════════════════════════════════════════════
   DEBOUNCE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Creates a debounced version of a function.
 * @param {Function} fn
 * @param {number} delay - Milliseconds
 * @returns {Function} Debounced function with .cancel() method
 */
export function debounce(fn, delay) {
  let timer = null;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}


/* ═══════════════════════════════════════════════════════════════
   STREAK CALCULATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Calculates the new streak count for language tracking.
 * If last date was today -> return current streak.
 * If last date was yesterday -> increment.
 * Otherwise -> reset to 1.
 * @param {string} lastDate - 'YYYY-MM-DD' of last completion
 * @param {number} currentStreak
 * @returns {number}
 */
export function calcStreak(lastDate, currentStreak) {
  const today = todayKey();
  if (!lastDate) return 1;
  const diff = daysBetween(lastDate, today);
  if (diff === 0) return currentStreak || 1;
  if (diff === 1) return (currentStreak || 0) + 1;
  return 1;
}
