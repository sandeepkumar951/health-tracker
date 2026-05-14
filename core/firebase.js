/**
 * ═══════════════════════════════════════════════════════════════
 * core/firebase.js — Firebase Realtime Database sync engine
 *
 * This module owns:
 * - Firebase app initialization
 * - save() / load() to RTDB
 * - debouncedSave() with retry logic
 * - Realtime listeners with echo detection
 * - Payload builders for daily + config paths
 * - Merge functions for conflict resolution
 * - Connection status display
 * - Midnight reset scheduler
 *
 * SYNC STRATEGY:
 * - Daily data (checks, water, pts, etc.) stored at /sandy_shared/daily_YYYY-MM-DD
 * - Config data (habits, sections, reminders) stored at /sandy_shared/config
 * - Echo detection via device ID + timestamp
 * - Conflict resolution: union merge for booleans, max-wins for numbers,
 *   timestamp-wins for arrays, explicit false for unchecked tasks
 * ═══════════════════════════════════════════════════════════════
 */

import {
  todayKey,
  yesterdayKey,
  DB_KEY,
  DB_KEY_MIDNIGHT,
  CT_SKILL_KEYS,
  SAVE_MAX_FAILS,
  SAVE_RETRY_BASE,
  REALTIME_MAX_RETRIES,
  REALTIME_BASE_DELAY,
  getDeviceId,
  sanitizeRemoteString,
  sanitizeRemoteNumber,
  sanitizeRemoteBool,
  validateTimeString,
  safeLocalStorageSave,
  showToast,
  sugarWeekStartOf
} from './utils.js';

import {
  state,
  flags,
  ensureDefaults,
  defaultState,
  replaceState,
  loadFiredToday,
  saveFiredToday
} from './state.js';


/* ═══════════════════════════════════════════════════════════════
   FIREBASE INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: 'AIzaSyDf6c55kjHOhJcRN3GbRB6wQTM_OcZgzxE',
  authDomain: 'sandyhealthtracker.firebaseapp.com',
  databaseURL: 'https://sandyhealthtracker-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'sandyhealthtracker',
  storageBucket: 'sandyhealthtracker.firebasestorage.app',
  messagingSenderId: '742150727652',
  appId: '1:742150727652:web:8c55ee8fb1327e02df09f1'
};

/** @type {firebase.app.App} */
let firebaseApp = null;

/** @type {firebase.database.Database} */
let rtdb = null;

/**
 * Initializes Firebase app and gets RTDB reference.
 * Safe to call multiple times (idempotent).
 */
export function initFirebase() {
  if (firebaseApp) return;
  // firebase is loaded globally via compat script tags in index.html
  firebaseApp = firebase.initializeApp(firebaseConfig);
  rtdb = firebase.database();
}

/**
 * Returns a reference under the shared user path.
 * @param {string} path
 * @returns {firebase.database.Reference}
 */
export function userRef(path) {
  return rtdb.ref('sandy_shared/' + path);
}

/**
 * Returns the raw RTDB instance (needed for .info/connected).
 * @returns {firebase.database.Database}
 */
export function getRtdb() {
  return rtdb;
}


/* ═══════════════════════════════════════════════════════════════
   STATUS DISPLAY
   ═══════════════════════════════════════════════════════════════ */

/**
 * Updates the Firebase connection status indicators in the UI.
 * @param {'online'|'syncing'|'offline'} s
 */
export function updateFbStatus(s) {
  const map = {
    online:  { cls: 'online',  txt: 'Connected to sandyhealthtracker' },
    syncing: { cls: 'syncing', txt: 'Syncing...' },
    offline: { cls: 'offline', txt: 'Offline — saved locally' }
  };
  const ref = map[s] || map.offline;

  ['fb-dot', 'settings-fb-dot'].forEach(id => {
    const d = document.getElementById(id);
    if (d) d.className = 'fb-dot ' + ref.cls;
  });

  const t1 = document.getElementById('fb-status-text');
  const t2 = document.getElementById('settings-fb-text');
  if (t1) t1.textContent = ref.txt;
  if (t2) t2.textContent = ref.txt.replace('sandyhealthtracker', 'Firebase');
}

/** @private Timer for sync status auto-dismiss */
let _syncDismissTimer = null;

/**
 * Shows a temporary sync status overlay in the top-right corner.
 * @param {'syncing'|'success'|'error'} type
 * @param {string} msg
 */
export function showSync(type, msg) {
  const s = document.getElementById('sync-status');
  const d = document.getElementById('sync-dot');
  const t = document.getElementById('sync-text');
  if (!s) return;

  s.className = 'sync-status show ' + type;
  if (d) d.className = type === 'syncing' ? 'sync-dot pulse' : 'sync-dot';
  if (t) t.textContent = msg;

  clearTimeout(_syncDismissTimer);
  _syncDismissTimer = setTimeout(() => s.classList.remove('show'), 2200);
}


/* ═══════════════════════════════════════════════════════════════
   DEBOUNCED SAVE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Schedules a save with debouncing. Multiple rapid calls collapse
 * into a single write after the delay expires.
 * @param {number} [delay=500] - Milliseconds to wait
 */
export function debouncedSave(delay) {
  flags.saveVersion++;
  clearTimeout(flags.saveDebounceTimer);
  flags.saveDebounceTimer = setTimeout(() => save(), delay !== undefined ? delay : 500);
}


/* ═══════════════════════════════════════════════════════════════
   PAYLOAD BUILDERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the daily data payload for Firebase.
 * Includes all daily-resettable fields (checks, water, pts, etc.)
 * and cross-day cumulative fields (totalPts, streaks, logs).
 * @returns {object}
 */
export function buildDailyPayload() {
  // Explicit boolean checks so false (unchecked) syncs correctly
  const checksPayload = {};
  if (state.checks && typeof state.checks === 'object') {
    Object.keys(state.checks).forEach(k => {
      checksPayload[k] = state.checks[k] === true;
    });
  }

  const payload = {
    date: todayKey(),
    savedAt: new Date().toISOString(),
    savedBy: getDeviceId(),
    lastResetTimestamp: state.lastResetTimestamp || 0,

    checks: checksPayload,
    water: state.water || 0,
    pts: state.pts || 0,
    totalPts: state.totalPts || 0,
    earnedBadges: state.earnedBadges || [],
    lastDate: state.lastDate || '',
    missedBannerDismissedDate: state.missedBannerDismissedDate || '',
    missedTasksAlertTime: state.missedTasksAlertTime || '21:00',

    // English
    engStreak: state.engStreak || 0,
    lastEngDate: state.lastEngDate || '',
    engReadDone: !!state.engReadDone,
    engSpeakDone: !!state.engSpeakDone,
    engSpeakStreak: state.engSpeakStreak || 0,
    engSpeakLastDate: state.engSpeakLastDate || '',
    engLearnDone: !!state.engLearnDone,
    engLearnStreak: state.engLearnStreak || 0,
    engLearnLastDate: state.engLearnLastDate || '',

    // Hindi
    hiReadDone: !!state.hiReadDone,
    hiReadStreak: state.hiReadStreak || 0,
    hiReadLastDate: state.hiReadLastDate || '',
    hiSpeakDone: !!state.hiSpeakDone,
    hiSpeakStreak: state.hiSpeakStreak || 0,
    hiSpeakLastDate: state.hiSpeakLastDate || '',
    hiLearnDone: !!state.hiLearnDone,
    hiLearnStreak: state.hiLearnStreak || 0,
    hiLearnLastDate: state.hiLearnLastDate || '',

    // Career
    ctSkills: state.ctSkills || { sql: 0, tools: 0, proj: 0, intv: 0 },
    ctStudyHrs: state.ctStudyHrs || 0,
    ctDayDone: !!state.ctDayDone,
    ctStreakDays: state.ctStreakDays || 0,
    ctLastDate: state.ctLastDate || null,
    ctStreakLastDate: state.ctStreakLastDate || null,
    ctTodayLogged: !!state.ctTodayLogged,
    ctTotalDays: state.ctTotalDays || 0,
    ctTasks: state.ctTasks || [],
    ctTasksUpdatedAt: state.ctTasksUpdatedAt || 0,
    ctLog: state.ctLog || [],
    ctLogUpdatedAt: state.ctLogUpdatedAt || 0,
    ctWeeklyHours: state.ctWeeklyHours || {},
    ctLastStudyDate: state.ctLastStudyDate || null,
    ctDayHistory: state.ctDayHistory || {},
    ctConsecutiveRestDays: state.ctConsecutiveRestDays || 0,

    // Junk / Sugar / Biryani
    junkLog: state.junkLog || [],
    sugarLog: state.sugarLog || [],
    biryLog: state.biryLog || [],
    weeklyGrams: state.weeklyGrams || 0,
    sugarWeekStart: state.sugarWeekStart || '',

    // Weekly tasks
    weeklyTasks: state.weeklyTasks || [],
    weeklyTasksResetDate: state.weeklyTasksResetDate || '',

    // Water
    waterLog: state.waterLog || {},
    wtReminderInterval: state.wtReminderInterval || 60,
    wtReminderTime: state.wtReminderTime || null,
    wtReminderEnabled: !!state.wtReminderEnabled,
    wtLastReminderFired: state.wtLastReminderFired || null
  };

  // Safety: trim payload if too large
  const serialized = JSON.stringify(payload);
  if (serialized.length > 900000) {
    console.warn('Sandy Brain: payload too large, trimming arrays');
    if (payload.junkLog.length > 200) payload.junkLog = payload.junkLog.slice(-200);
    if (payload.sugarLog.length > 200) payload.sugarLog = payload.sugarLog.slice(-200);
    if (payload.ctLog.length > 30) payload.ctLog = payload.ctLog.slice(0, 30);
  }

  return payload;
}

/**
 * Builds the config payload for Firebase.
 * Includes habits, sections, reminders, and their timestamps.
 * Image data URIs are replaced with placeholders to keep payload small.
 * @returns {object}
 */
export function buildConfigPayload() {
  const safeHabits = (state.habits || []).map(h => {
    if (h.customIconType === 'image' && h.customIcon && h.customIcon.startsWith('data:image/')) {
      return Object.assign({}, h, {
        customIcon: '__needs_upload__',
        customIconType: 'image_local'
      });
    }
    return h;
  });

  return {
    habits: safeHabits,
    sections: state.sections || [],
    reminders: state.reminders || [],
    updatedAt: new Date().toISOString(),
    habitsUpdatedAt: state.habitsUpdatedAt || 0,
    sectionsUpdatedAt: state.sectionsUpdatedAt || 0,
    remindersUpdatedAt: state.remindersUpdatedAt || 0,
    deletedReminderIds: (state.deletedReminderIds || []).slice(-100)
  };
}


/* ═══════════════════════════════════════════════════════════════
   APPLY REMOTE DOCUMENTS — Merge conflict resolution
   ═══════════════════════════════════════════════════════════════ */

/**
 * Merges a remote daily document into local state.
 *
 * Conflict resolution strategy:
 * - Stale date data is ignored entirely
 * - Reset propagation via lastResetTimestamp
 * - totalPts: always take max (cumulative)
 * - checks: true wins (union), but explicit false from newer save wins
 * - water: always take higher
 * - earnedBadges: union merge
 * - booleans: OR merge (true wins)
 * - streaks/counts: take max
 * - arrays with IDs: union merge by ID
 *
 * @param {object} d - Remote daily document
 */
export function applyDailyDoc(d) {
  if (!d || typeof d !== 'object') return;

  const remoteSavedAt = d.savedAt ? new Date(d.savedAt).getTime() : 0;
  const remoteResetAt = sanitizeRemoteNumber(d.lastResetTimestamp, 0, Infinity, 0);
  const localResetAt = state.lastResetTimestamp || 0;

  // Skip entirely if remote is for wrong date
  if (d.date && d.date !== todayKey()) return;

  // If remote carries a later reset, apply it first
  if (remoteResetAt > localResetAt) {
    state.lastResetTimestamp = remoteResetAt;
    state.checks = {};
    state.water = 0;
    state.pts = 0;
    // Do NOT reset totalPts — that is cumulative
  }

  const mergeChecks = !(remoteSavedAt > 0 && remoteSavedAt < state.lastResetTimestamp);

  // totalPts: always take max (cumulative across all time)
  state.totalPts = Math.max(state.totalPts || 0, d.totalPts || 0);

  if (mergeChecks) {
    // pts: only take remote pts if remote reset is same or newer
    if (remoteResetAt >= localResetAt) {
      state.pts = Math.max(state.pts || 0, d.pts || 0);
    }

    // Water: always take higher
    state.water = Math.max(state.water || 0, d.water || 0);
    if (!state.waterLog) state.waterLog = {};
    state.waterLog[todayKey()] = Math.max(state.waterLog[todayKey()] || 0, state.water);

    // Checks: apply BOTH true and false explicitly
    if (d.checks && typeof d.checks === 'object') {
      state.checks = state.checks || {};
      Object.keys(d.checks).forEach(k => {
        const remoteVal = d.checks[k] === true;
        if (remoteVal) {
          state.checks[k] = true;
        } else if (!remoteVal && remoteSavedAt > flags._lastSaveTimestamp) {
          // Remote explicitly unchecked and is newer than our last save
          state.checks[k] = false;
        }
        // Otherwise keep local value
      });
    }
  }

  // Earned badges: UNION merge
  if (Array.isArray(d.earnedBadges)) {
    state.earnedBadges = state.earnedBadges || [];
    d.earnedBadges.forEach(b => {
      if (!state.earnedBadges.includes(b)) state.earnedBadges.push(b);
    });
  }

  // String fields: take latest (alphabetically higher = more recent ISO date)
  const stringFieldsLatest = [
    'lastDate', 'missedTasksAlertTime', 'missedBannerDismissedDate',
    'lastEngDate', 'engSpeakLastDate', 'engLearnLastDate',
    'hiReadLastDate', 'hiSpeakLastDate', 'hiLearnLastDate',
    'ctLastDate', 'ctStreakLastDate', 'sugarWeekStart',
    'weeklyTasksResetDate', 'wtReminderTime'
  ];
  stringFieldsLatest.forEach(f => {
    if (d[f] !== undefined) {
      const sanitized = sanitizeRemoteString(d[f], 40);
      if (!state[f]) state[f] = sanitized;
      else if (typeof d[f] === 'string' && typeof state[f] === 'string') {
        if (sanitized > state[f]) state[f] = sanitized;
      }
    }
  });

  if (d.wtReminderInterval !== undefined) {
    state.wtReminderInterval = Math.max(
      state.wtReminderInterval || 0,
      sanitizeRemoteNumber(d.wtReminderInterval, 15, 240, 60)
    );
  }

  // Boolean OR merge (true wins)
  [
    'ctTodayLogged', 'ctDayDone', 'wtReminderEnabled',
    'engReadDone', 'engSpeakDone', 'engLearnDone',
    'hiReadDone', 'hiSpeakDone', 'hiLearnDone'
  ].forEach(f => { if (d[f]) state[f] = true; });

  // Streak/count: take max
  [
    'engStreak', 'engSpeakStreak', 'engLearnStreak',
    'hiReadStreak', 'hiSpeakStreak', 'hiLearnStreak',
    'ctStreakDays', 'ctConsecutiveRestDays'
  ].forEach(f => {
    state[f] = Math.max(state[f] || 0, sanitizeRemoteNumber(d[f], 0, Infinity, 0));
  });

  // ctTotalDays: only accept remote >= local
  state.ctTotalDays = Math.max(
    state.ctTotalDays || 0,
    sanitizeRemoteNumber(d.ctTotalDays, 0, Infinity, 0)
  );

  // Career skills: take max per skill
  if (d.ctSkills && typeof d.ctSkills === 'object') {
    state.ctSkills = state.ctSkills || { sql: 0, tools: 0, proj: 0, intv: 0 };
    CT_SKILL_KEYS.forEach(k => {
      state.ctSkills[k] = Math.max(
        state.ctSkills[k] || 0,
        sanitizeRemoteNumber(d.ctSkills[k], 0, 100, 0)
      );
    });
  }

  // Study hours today: take max
  if (mergeChecks) {
    state.ctStudyHrs = Math.max(
      state.ctStudyHrs || 0,
      sanitizeRemoteNumber(d.ctStudyHrs, 0, 24, 0)
    );
  }

  if (d.ctLastStudyDate && (!state.ctLastStudyDate || d.ctLastStudyDate > state.ctLastStudyDate)) {
    state.ctLastStudyDate = sanitizeRemoteString(d.ctLastStudyDate, 10);
  }

  // Tasks & log: timestamp-based winner
  if (Array.isArray(d.ctTasks) && (d.ctTasksUpdatedAt || 0) > (state.ctTasksUpdatedAt || 0)) {
    state.ctTasks = d.ctTasks;
    state.ctTasksUpdatedAt = d.ctTasksUpdatedAt;
  }
  if (Array.isArray(d.ctLog) && (d.ctLogUpdatedAt || 0) > (state.ctLogUpdatedAt || 0)) {
    state.ctLog = d.ctLog;
    state.ctLogUpdatedAt = d.ctLogUpdatedAt;
  }

  // Weekly hours: max per day
  if (d.ctWeeklyHours && typeof d.ctWeeklyHours === 'object') {
    state.ctWeeklyHours = state.ctWeeklyHours || {};
    Object.keys(d.ctWeeklyHours).forEach(k => {
      state.ctWeeklyHours[k] = Math.max(
        state.ctWeeklyHours[k] || 0,
        sanitizeRemoteNumber(d.ctWeeklyHours[k], 0, 24, 0)
      );
    });
  }

  // Day history: priority merge (complete > partial > rest)
  if (d.ctDayHistory && typeof d.ctDayHistory === 'object') {
    state.ctDayHistory = state.ctDayHistory || {};
    const priority = { complete: 3, partial: 2, rest: 1 };
    const validDateRe = /^\d{4}-\d{2}-\d{2}$/;
    const validValues = new Set(['complete', 'partial', 'rest']);
    Object.keys(d.ctDayHistory).forEach(k => {
      if (!validDateRe.test(k) || !validValues.has(d.ctDayHistory[k])) return;
      const existing = priority[state.ctDayHistory[k]] || 0;
      const incoming = priority[d.ctDayHistory[k]] || 0;
      if (incoming > existing) state.ctDayHistory[k] = d.ctDayHistory[k];
    });
  }

  // Junk and sugar logs: union by ID
  _mergeLogArray('junkLog', d);
  _mergeLogArray('sugarLog', d);

  // Biryani: merge by monthKey and entry ID
  if (Array.isArray(d.biryLog)) {
    state.biryLog = state.biryLog || [];
    d.biryLog.forEach(remoteMonth => {
      if (!remoteMonth.monthKey) return;
      let localMonth = state.biryLog.find(x => x.monthKey === remoteMonth.monthKey);
      if (!localMonth) {
        state.biryLog.push(JSON.parse(JSON.stringify(remoteMonth)));
        return;
      }
      const localIds = new Set((localMonth.entries || []).map(e => e.id));
      (remoteMonth.entries || []).forEach(re => {
        if (re.id && !localIds.has(re.id)) localMonth.entries.push(re);
      });
      localMonth.count = localMonth.entries.length;
    });
  }

  if ((d.weeklyGrams || 0) > (state.weeklyGrams || 0)) {
    state.weeklyGrams = d.weeklyGrams;
  }

  // Weekly tasks: merge by ID, OR-merge done state
  if (Array.isArray(d.weeklyTasks) && d.weeklyTasks.length > 0) {
    state.weeklyTasks = state.weeklyTasks || [];
    const localMap = new Map(state.weeklyTasks.map(t => [t.id, t]));
    d.weeklyTasks.forEach(rt => {
      if (!rt.id) return;
      const existing = localMap.get(rt.id);
      if (!existing) {
        state.weeklyTasks.push(rt);
        localMap.set(rt.id, rt);
      } else {
        if (rt.done && !existing.done) existing.done = true;
      }
    });
  }

  // Water log: max per day
  if (d.waterLog && typeof d.waterLog === 'object') {
    state.waterLog = state.waterLog || {};
    Object.keys(d.waterLog).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const val = d.waterLog[k];
      if (typeof val !== 'number' || val < 0 || val > 50) return;
      state.waterLog[k] = Math.max(state.waterLog[k] || 0, val);
    });
  }
}

/**
 * Merges a remote config document into local state.
 * Handles habits, sections, reminders, and deletedReminderIds.
 * @param {object} d - Remote config document
 */
export function applyConfigDoc(d) {
  if (!d || typeof d !== 'object') return;

  // Habits: timestamp-based winner
  if (Array.isArray(d.habits) && (d.habitsUpdatedAt || 0) > (state.habitsUpdatedAt || 0)) {
    state.habits = d.habits.map(h => ({
      id: sanitizeRemoteString(h.id, 40),
      section: sanitizeRemoteString(h.section, 40),
      name: sanitizeRemoteString(h.name, 80),
      note: sanitizeRemoteString(h.note, 100),
      pts: sanitizeRemoteNumber(h.pts, 1, 20, 3),
      order: sanitizeRemoteNumber(h.order, 0, 9999, 0),
      customIcon: h.customIconType === 'image_local'
        ? ((state.habits || []).find(x => x.id === h.id) || {}).customIcon || sanitizeRemoteString(h.customIcon, 200)
        : sanitizeRemoteString(h.customIcon, 200),
      customIconType: sanitizeRemoteString(h.customIconType, 20)
    }));
    state.habitsUpdatedAt = d.habitsUpdatedAt;
    flags._settingsNeedRebuild = true;
  }

  // Sections: timestamp-based winner
  if (Array.isArray(d.sections) && (d.sectionsUpdatedAt || 0) > (state.sectionsUpdatedAt || 0)) {
    state.sections = d.sections.map(s => ({
      id: sanitizeRemoteString(s.id, 40),
      icon: sanitizeRemoteString(s.icon, 10),
      name: sanitizeRemoteString(s.name, 40),
      tag: sanitizeRemoteString(s.tag, 20)
    }));
    state.sectionsUpdatedAt = d.sectionsUpdatedAt;
    flags._settingsNeedRebuild = true;
  }

  // Reminders: timestamp-based winner
  if (Array.isArray(d.reminders) && (d.remindersUpdatedAt || 0) > (state.remindersUpdatedAt || 0)) {
    state.reminders = d.reminders.map(r => ({
      id: sanitizeRemoteString(r.id, 40),
      title: sanitizeRemoteString(r.title, 60),
      msg: sanitizeRemoteString(r.msg, 100),
      time: validateTimeString(r.time) ? r.time : '08:00',
      icon: sanitizeRemoteString(r.icon, 10),
      days: Array.isArray(r.days) ? r.days.filter(x => typeof x === 'number' && x >= 0 && x <= 6) : [],
      enabled: sanitizeRemoteBool(r.enabled)
    }));
    state.remindersUpdatedAt = d.remindersUpdatedAt;
  }

  // deletedReminderIds: union merge, then cap
  if (Array.isArray(d.deletedReminderIds)) {
    state.deletedReminderIds = state.deletedReminderIds || [];
    const localSet = new Set(state.deletedReminderIds);
    d.deletedReminderIds.forEach(id => {
      if (typeof id === 'string') localSet.add(id);
    });
    state.deletedReminderIds = Array.from(localSet).slice(-100);
  }
}

/**
 * @private Merges a log array field by ID (union merge).
 */
function _mergeLogArray(field, remoteDoc) {
  if (!Array.isArray(remoteDoc[field]) || !remoteDoc[field].length) return;
  state[field] = state[field] || [];
  const localIds = new Set(state[field].map(e => e.id).filter(Boolean));
  remoteDoc[field].forEach(re => {
    if (re.id && !localIds.has(re.id)) {
      state[field].push(re);
      localIds.add(re.id);
    }
  });
}


/* ═══════════════════════════════════════════════════════════════
   SAVE ENGINE
   ═══════════════════════════════════════════════════════════════ */

/**
 * Persists state to both localStorage and Firebase RTDB.
 * Uses atomic multi-path update to write daily + config in one call.
 * Includes retry logic with exponential backoff.
 */
export async function save() {
  // Always persist locally first
  try {
    safeLocalStorageSave(DB_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }

  if (flags.isSaving) return;
  flags.isSaving = true;

  const thisVersion = flags.saveVersion;

  try {
    updateFbStatus('syncing');

    const today = todayKey();
    const now = new Date().toISOString();
    flags._lastSaveTimestamp = Date.now();
    flags._lastRemoteSavedAt = now;

    const dailyPath = 'sandy_shared/daily_' + today;
    const configPath = 'sandy_shared/config';

    const dailyPayload = buildDailyPayload();
    dailyPayload.savedAt = now;
    dailyPayload.savedBy = getDeviceId();

    const configPayload = buildConfigPayload();
    configPayload.updatedAt = now;

    // Atomic multi-path update
    const updates = {};
    Object.keys(dailyPayload).forEach(key => {
      updates[dailyPath + '/' + key] = dailyPayload[key];
    });
    updates[configPath] = configPayload;

    await rtdb.ref().update(updates);

    updateFbStatus('online');
    showSync('success', 'Synced');
    flags.saveFailCount = 0;
    flags.lastSavedVersion = thisVersion;

  } catch (err) {
    console.warn('Firebase RTDB save error:', err);
    updateFbStatus('offline');
    showSync('error', 'Saved locally');
    flags.saveFailCount++;

    if (flags.saveFailCount < SAVE_MAX_FAILS) {
      const delay = Math.min(SAVE_RETRY_BASE * Math.pow(2, flags.saveFailCount), 15000);
      setTimeout(() => { if (!flags.isSaving) save(); }, delay);
    } else {
      flags.saveFailCount = 0;
    }
  } finally {
    flags.isSaving = false;

    // If new changes arrived during save, schedule another
    if (flags.saveVersion !== flags.lastSavedVersion && flags.saveFailCount < SAVE_MAX_FAILS) {
      setTimeout(() => save(), 150);
    }
  }
}


/* ═══════════════════════════════════════════════════════════════
   LOAD
   ═══════════════════════════════════════════════════════════════ */

/**
 * Loads state from localStorage, then merges with Firebase data.
 * Firebase data takes priority via merge functions.
 */
export async function load() {
  // Load from localStorage first
  try {
    const r = localStorage.getItem(DB_KEY);
    if (r) {
      const parsed = Object.assign(defaultState(), JSON.parse(r));
      replaceState(parsed);
    }
  } catch (e) {
    replaceState(defaultState());
  }

  // Then merge with Firebase
  try {
    showSync('syncing', 'Loading...');
    updateFbStatus('syncing');

    const today = todayKey();
    const [dailySnap, configSnap] = await Promise.all([
      userRef('daily_' + today).once('value'),
      userRef('config').once('value')
    ]);

    if (dailySnap.exists()) applyDailyDoc(dailySnap.val());
    if (configSnap.exists()) applyConfigDoc(configSnap.val());

    updateFbStatus('online');
    showSync('success', 'Loaded');
  } catch (err) {
    console.warn('Firebase RTDB load error:', err);
    updateFbStatus('offline');
  }
}


/* ═══════════════════════════════════════════════════════════════
   REALTIME SYNC
   ═══════════════════════════════════════════════════════════════ */

/**
 * Callback registry for UI refresh after sync.
 * Set by init.js to avoid circular imports.
 * @type {Function|null}
 */
let _onSyncRefreshUI = null;

/**
 * Registers the callback that refreshes UI after a sync merge.
 * Called once from init.js.
 * @param {Function} fn
 */
export function onSyncRefreshUI(fn) {
  _onSyncRefreshUI = fn;
}

/**
 * Callback for config sync rebuild.
 * @type {Function|null}
 */
let _onConfigSync = null;

/**
 * Registers the callback for config sync rebuild.
 * @param {Function} fn
 */
export function onConfigSync(fn) {
  _onConfigSync = fn;
}

/**
 * Detaches ALL Firebase listeners cleanly.
 * Must be called before re-attaching (day change, reconnect, etc.)
 */
export function detachAllListeners() {
  if (flags._dailyListenerRef && flags._dailyListenerCb) {
    try { flags._dailyListenerRef.off('value', flags._dailyListenerCb); } catch (e) { /* ignore */ }
  }
  flags._dailyListenerRef = null;
  flags._dailyListenerCb = null;

  if (flags._configListenerRef && flags._configListenerCb) {
    try { flags._configListenerRef.off('value', flags._configListenerCb); } catch (e) { /* ignore */ }
  }
  flags._configListenerRef = null;
  flags._configListenerCb = null;

  if (flags._connectedListenerCb) {
    try { rtdb.ref('.info/connected').off('value', flags._connectedListenerCb); } catch (e) { /* ignore */ }
    flags._connectedListenerCb = null;
  }
}

/**
 * Starts realtime listeners for daily and config data.
 * Includes echo detection (ignores own writes) and oscillation guards.
 */
export function startRealtimeSync() {
  // Always detach first to prevent duplicates
  detachAllListeners();

  const myDeviceId = getDeviceId();
  const dailyRef = userRef('daily_' + todayKey());
  const configRef = userRef('config');

  // ── Daily listener ──
  flags._dailyListenerCb = dailyRef.on('value', snap => {
    flags.realtimeRetryCount = 0;
    if (!snap.exists()) return;
    const remote = snap.val();
    if (!remote) return;

    // Echo detection
    if (remote.savedBy === myDeviceId && remote.savedAt === flags._lastRemoteSavedAt) return;

    // Oscillation guard
    if (flags._syncMergeInProgress) return;
    flags._syncMergeInProgress = true;

    applyDailyDoc(remote);
    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }

    // Check if local has newer data to push back
    const localHasMore =
      (state.water || 0) > (remote.water || 0) ||
      (state.pts || 0) > (remote.pts || 0) ||
      (state.totalPts || 0) > (remote.totalPts || 0) ||
      (state.ctStudyHrs || 0) > (remote.ctStudyHrs || 0) ||
      (state.ctStreakDays || 0) > (remote.ctStreakDays || 0) ||
      (state.lastResetTimestamp || 0) > (remote.lastResetTimestamp || 0);

    const localChecksNewer = (() => {
      const rc = remote.checks || {};
      const lc = state.checks || {};
      return Object.keys(lc).some(k => lc[k] !== rc[k]);
    })();

    // Refresh UI
    if (_onSyncRefreshUI) _onSyncRefreshUI();

    if (localHasMore || localChecksNewer) {
      flags._syncMergeInProgress = true;
      debouncedSave(1200);
      setTimeout(() => { flags._syncMergeInProgress = false; }, 1800);
    } else {
      flags._syncMergeInProgress = false;
    }

    showSync('success', 'Updated from other device');

  }, err => {
    console.warn('Daily listener error:', err);
    updateFbStatus('offline');
    flags._syncMergeInProgress = false;
    flags.realtimeRetryCount++;

    if (flags.realtimeRetryCount <= REALTIME_MAX_RETRIES) {
      const delay = Math.min(REALTIME_BASE_DELAY * Math.pow(1.5, flags.realtimeRetryCount), 60000);
      setTimeout(startRealtimeSync, delay);
    }
  });

  flags._dailyListenerRef = dailyRef;

  // ── Config listener ──
  flags._configListenerCb = configRef.on('value', snap => {
    if (!snap.exists()) return;
    const remote = snap.val();
    if (!remote) return;

    // Echo detection for config
    if (remote.updatedAt === flags._lastRemoteSavedAt) return;

    applyConfigDoc(remote);
    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }

    if (flags._configSyncTimer) clearTimeout(flags._configSyncTimer);
    flags._configSyncTimer = setTimeout(() => {
      flags._configSyncTimer = null;
      flags._settingsNeedRebuild = true;
      if (_onConfigSync) _onConfigSync();
    }, 500);

    showSync('success', 'Config synced');

  }, err => {
    console.warn('Config listener error:', err);
  });

  flags._configListenerRef = configRef;

  // ── Connection state listener ──
  flags._connectedListenerCb = snap => {
    if (snap.val() === true) {
      updateFbStatus('online');
      debouncedSave(500);
    } else {
      updateFbStatus('offline');
    }
  };

  rtdb.ref('.info/connected').on('value', flags._connectedListenerCb);
}


/* ═══════════════════════════════════════════════════════════════
   FORCE SYNC ALL
   ═══════════════════════════════════════════════════════════════ */

/**
 * Forces a complete read-merge-write cycle.
 * Reads remote data first, merges, then writes merged state back.
 */
export async function forceSyncAll() {
  showToast('Force syncing...');
  flags.saveFailCount = 0;
  flags._lastRemoteSavedAt = '';

  try {
    const [dailySnap, configSnap] = await Promise.all([
      userRef('daily_' + todayKey()).once('value'),
      userRef('config').once('value')
    ]);

    if (dailySnap.exists()) applyDailyDoc(dailySnap.val());
    if (configSnap.exists()) applyConfigDoc(configSnap.val());

    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }

    if (_onSyncRefreshUI) _onSyncRefreshUI();

    // Write merged state back
    await save();
  } catch (e) {
    console.warn('Force sync read failed:', e);
  }

  detachAllListeners();
  startRealtimeSync();
  showToast('All data synced across devices!', 'gt');
}


/* ═══════════════════════════════════════════════════════════════
   MIDNIGHT RESET SCHEDULER
   ═══════════════════════════════════════════════════════════════ */

/** @private Timer handle for midnight scheduler */
let _midnightTimer = null;

/**
 * Callback for performing the midnight reset.
 * Set by init.js to avoid circular dependencies.
 * @type {Function|null}
 */
let _onMidnightReset = null;

/**
 * Registers the midnight reset callback.
 * @param {Function} fn
 */
export function onMidnightReset(fn) {
  _onMidnightReset = fn;
}

/**
 * Schedules a function to fire just after midnight.
 * The actual reset logic is in init.js (passed via onMidnightReset).
 */
export function scheduleMidnightReset() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2, 0);
  const msUntil = Math.max(0, nextMidnight - now);

  clearTimeout(_midnightTimer);
  _midnightTimer = setTimeout(async () => {
    const resetKey = todayKey();
    const storedKey = localStorage.getItem(DB_KEY_MIDNIGHT + 'lastFired') || '';
    if (storedKey === resetKey) {
      scheduleMidnightReset();
      return;
    }

    safeLocalStorageSave(DB_KEY_MIDNIGHT + 'lastFired', resetKey);
    flags.midnightResetFiredKey = resetKey;

    // Delegate to the registered callback
    if (_onMidnightReset) {
      await _onMidnightReset(resetKey);
    }

    scheduleMidnightReset();
  }, msUntil);
}

/**
 * Clears the midnight timer (used during cleanup/factory reset).
 */
export function clearMidnightTimer() {
  clearTimeout(_midnightTimer);
  _midnightTimer = null;
}
