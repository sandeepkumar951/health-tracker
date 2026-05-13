/* ═══════════════════════════════════════════════════════════════
   core/state.js
   Single source of truth for all application state.
   No DOM access. No Firebase. No side effects.
   Import this everywhere you need to read or write state.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   STORAGE KEYS
───────────────────────────────────────────────────────────────*/
export const DB_KEY          = 'htrack_v20';
export const DB_KEY_FIRED    = 'firedToday_';
export const DB_KEY_MIDNIGHT = 'midnightFired_';

/* ─────────────────────────────────────────────────────────────
   CALENDAR CONSTANTS
───────────────────────────────────────────────────────────────*/
export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ─────────────────────────────────────────────────────────────
   CAREER TRACKER CONSTANTS
───────────────────────────────────────────────────────────────*/
export const CT_HOUR_GOAL    = 4;
export const CT_WEEK_GOAL    = 28;
export const CT_TARGET_DATE  = '2026-08-30';
export const CT_LOG_LIMIT    = 50;
export const CT_XP_PER_HOUR  = 5;
export const CT_SKILL_KEYS   = ['sql', 'tools', 'proj', 'intv'];

/* ─────────────────────────────────────────────────────────────
   WATER TRACKER CONSTANTS
───────────────────────────────────────────────────────────────*/
export const WT_GOAL = 11;
export const WT_ML   = 300;

/* ─────────────────────────────────────────────────────────────
   DAILY STUDY GOAL (mirrors CT_HOUR_GOAL — single value)
───────────────────────────────────────────────────────────────*/
export const DAILY_HOUR_GOAL = CT_HOUR_GOAL;

/* ─────────────────────────────────────────────────────────────
   LIMITS
───────────────────────────────────────────────────────────────*/
export const MAX_JUNK_LOG     = 500;
export const MAX_SUGAR_LOG    = 500;
export const MAX_CT_TASKS     = 200;
export const MAX_WEEKLY_TASKS = 100;
export const MAX_DAY_HISTORY  = 400;

/* ─────────────────────────────────────────────────────────────
   FIREBASE / SYNC CONSTANTS
───────────────────────────────────────────────────────────────*/
export const REALTIME_MAX_RETRIES = 10;
export const REALTIME_BASE_DELAY  = 3000;
export const SAVE_MAX_FAILS       = 5;
export const SAVE_RETRY_BASE      = 300;

/* ─────────────────────────────────────────────────────────────
   VALID TASK DAYS
───────────────────────────────────────────────────────────────*/
export const VALID_TASK_DAYS = [
  'Mon','Tue','Wed','Thu','Fri','Sat','Sun',
  'Today','Tomorrow','Anytime'
];

/* ─────────────────────────────────────────────────────────────
   DEFAULT SECTIONS
───────────────────────────────────────────────────────────────*/
export const DEFAULT_SECTIONS = [
  { id: 'morning',   icon: '☀️',  name: 'Morning',          tag: 'on waking' },
  { id: 'skin_am',   icon: '🧴',  name: 'Morning skin',     tag: ''          },
  { id: 'breakfast', icon: '🍳',  name: 'Breakfast',        tag: ''          },
  { id: 'lunch',     icon: '🍛',  name: 'Lunch',            tag: ''          },
  { id: 'water',     icon: '💧',  name: 'Water',            tag: 'special'   },
  { id: 'evening',   icon: '🌆',  name: 'Evening',          tag: 'special'   },
  { id: 'dinner',    icon: '🌙',  name: 'Dinner',           tag: ''          },
  { id: 'night',     icon: '🌃',  name: 'Night routine',    tag: ''          },
  { id: 'prep',      icon: '📦',  name: 'Prep for tomorrow',tag: ''          }
];

/* ─────────────────────────────────────────────────────────────
   DEFAULT HABITS
───────────────────────────────────────────────────────────────*/
export const DEFAULT_HABITS = [
  { id: 'lemon',       section: 'morning',   name: 'Warm lemon water',           note: '1 glass, first thing',       pts: 3, order: 0 },
  { id: 'almonds',     section: 'morning',   name: 'Soaked almonds — 5 pieces',  note: 'Soak tonight',               pts: 3, order: 1 },
  { id: 'walnuts',     section: 'morning',   name: 'Walnuts — 2 pieces',         note: '',                           pts: 2, order: 2 },
  { id: 'amla',        section: 'morning',   name: 'Amla — 1 piece or juice',    note: 'Vitamin C',                  pts: 3, order: 3 },
  { id: 'facewash_am', section: 'skin_am',   name: 'Face wash',                  note: '',                           pts: 2, order: 0 },
  { id: 'moisturizer', section: 'skin_am',   name: 'Moisturizer',                note: '',                           pts: 2, order: 1 },
  { id: 'sunscreen',   section: 'skin_am',   name: 'Sunscreen',                  note: 'If going outside',           pts: 2, order: 2 },
  { id: 'eggs',        section: 'breakfast', name: '2 eggs',                     note: 'Protein for hair + skin',    pts: 4, order: 0 },
  { id: 'fruit_am',    section: 'breakfast', name: '1 fruit',                    note: 'Banana / apple / papaya',    pts: 3, order: 1 },
  { id: 'dal_lunch',   section: 'lunch',     name: 'Dal + vegetables + 1-2 roti',note: '',                           pts: 4, order: 0 },
  { id: 'curd',        section: 'lunch',     name: '1 bowl curd',                note: 'Gut health',                 pts: 3, order: 1 },
  { id: 'dinner',      section: 'dinner',    name: 'Roti + vegetables only',     note: 'No fried food at night',     pts: 3, order: 0 },
  { id: 'facewash_pm', section: 'night',     name: 'Face wash + moisturizer',    note: '',                           pts: 2, order: 0 },
  { id: 'hair_tablets',section: 'night',     name: 'Take hair tablets',          note: 'With water after dinner',    pts: 4, order: 1 },
  { id: 'keto',        section: 'night',     name: 'Ketoconazole shampoo',       note: '2x per week — leave 5 min', pts: 3, order: 2 },
  { id: 'revision',    section: 'night',     name: 'Revision in bed',            note: 'Read notes before sleeping', pts: 6, order: 3 },
  { id: 'sleep',       section: 'night',     name: 'Sleep by 9:30-10 PM',        note: '',                           pts: 4, order: 4 },
  { id: 'soak',        section: 'prep',      name: 'Soak 5 almonds overnight',   note: '',                           pts: 2, order: 0 },
  { id: 'prep_seeds',  section: 'prep',      name: 'Keep chia / flax seeds ready',note: '',                          pts: 2, order: 1 }
];

/* ─────────────────────────────────────────────────────────────
   DEFAULT REMINDERS
───────────────────────────────────────────────────────────────*/
export const DEFAULT_REMINDERS = [
  { id: 'r1', title: 'Good morning!',    msg: 'Lemon water, almonds & amla!',    time: '06:30', icon: '🌅', days: [0,1,2,3,4,5,6], enabled: true  },
  { id: 'r2', title: 'Study time',       msg: '4 hours — no phone!',             time: '10:00', icon: '📚', days: [1,2,3,4,5],     enabled: true  },
  { id: 'r3', title: 'Drink water',      msg: 'Have you had enough water?',      time: '14:00', icon: '💧', days: [0,1,2,3,4,5,6], enabled: true  },
  { id: 'r4', title: 'Evening snack',    msg: 'Fruit or seeds before 6 PM',      time: '17:00', icon: '🍎', days: [0,1,2,3,4,5,6], enabled: true  },
  { id: 'r5', title: 'Take hair tablets',msg: "Don't forget after dinner!",      time: '21:00', icon: '💊', days: [0,1,2,3,4,5,6], enabled: true  },
  { id: 'r6', title: 'Sleep time',       msg: 'Wind down. Revise & sleep by 10', time: '21:30', icon: '🌙', days: [0,1,2,3,4,5,6], enabled: true  }
];

/* ─────────────────────────────────────────────────────────────
   LEVEL DEFINITIONS
───────────────────────────────────────────────────────────────*/
export const LEVELS = [
  { min: 0,    label: '🌱 Beginner',   next: 50   },
  { min: 50,   label: '🌿 Growing',    next: 150  },
  { min: 150,  label: '💪 Consistent', next: 300  },
  { min: 300,  label: '🔥 Dedicated',  next: 500  },
  { min: 500,  label: '⭐ Advanced',   next: 800  },
  { min: 800,  label: '🚀 Elite',      next: 1200 },
  { min: 1200, label: '🏆 Legend',     next: 9999 }
];

/* ─────────────────────────────────────────────────────────────
   SHARED MUTABLE STATE
   All modules import this same object reference and mutate
   it directly — matching the original single-file pattern.
───────────────────────────────────────────────────────────────*/
export let state = {};

/* ─────────────────────────────────────────────────────────────
   RUNTIME FLAGS
   Module-level variables that survive page switches but reset
   on factory reset. Exported so init.js can reset them all.
───────────────────────────────────────────────────────────────*/
export let isSaving              = false;
export let saveDebounceTimer     = null;
export let saveFailCount         = 0;
export let saveVersion           = 0;
export let lastSavedVersion      = 0;
export let realtimeRetryCount    = 0;
export let wtSceneInitialized    = false;
export let wtDone                = false;
export let jnkSelected           = {};
export let jnkGridBuilt          = false;
export let confettiLock          = false;
export let badgeCheckTimer       = null;
export let firedToday            = {};
export let inAppTimeoutId        = null;
export let wtPropRAF             = null;
export let wtIdleTmr             = null;
export let wtRemTimer            = null;
export let wtRemNextTimeout      = null;
export let _wtAppOpenTime        = Date.now();
export let _ctCdInterval         = null;
export let ctPageBuilt           = false;
export let ctActiveTag           = 'All';
export let wtEditingId           = null;
export let wtFilter              = 'all';
export let wtSelectedDays        = ['Mon'];
export let jActiveLog            = 'sugar';
export let editingHabitId        = null;
export let settingsFilter        = 'all';
export let iconPickerHabitId     = null;
export let iconPickerMode        = 'emoji';
export let selectedEmoji         = null;
export let uploadedImageData     = null;
export let selDays               = [0,1,2,3,4,5,6];
export let biryaniLogInFlight    = false;
export let deferredInstallPrompt = null;
export let midnightResetFiredKey = '';
export let cachedSceneHeight     = 0;
export let masterTimerId         = null;
export let masterTickCount       = 0;
export let _configSyncTimer      = null;
export let _settingsNeedRebuild  = false;
export let _lastThemeKey         = '';
export let _reminderFirstCheck   = true;
export let _lastStreakMilestone  = 0;
export let _lastSaveTimestamp    = 0;
export let _lastRemoteSavedAt    = '';
export let _syncMergeInProgress  = false;
export let _dailyListenerRef     = null;
export let _dailyListenerCb      = null;
export let _configListenerRef    = null;
export let _configListenerCb     = null;
export let _connectedListenerCb  = null;
export let _lastEveningWasWeekend = null;
export let _ctDayCompletedThisSession = false;

/* ─────────────────────────────────────────────────────────────
   FLAG SETTERS
   Since ES module exports are live bindings but cannot be
   reassigned from outside the module, we expose setter
   functions for every flag that other modules need to mutate.
───────────────────────────────────────────────────────────────*/
export function setIsSaving(v)                    { isSaving = v; }
export function setSaveDebounceTimer(v)            { saveDebounceTimer = v; }
export function setSaveFailCount(v)                { saveFailCount = v; }
export function setSaveVersion(v)                  { saveVersion = v; }
export function setLastSavedVersion(v)             { lastSavedVersion = v; }
export function setRealtimeRetryCount(v)           { realtimeRetryCount = v; }
export function setWtSceneInitialized(v)           { wtSceneInitialized = v; }
export function setWtDone(v)                       { wtDone = v; }
export function setJnkSelected(v)                  { jnkSelected = v; }
export function setJnkGridBuilt(v)                 { jnkGridBuilt = v; }
export function setConfettiLock(v)                 { confettiLock = v; }
export function setBadgeCheckTimer(v)              { badgeCheckTimer = v; }
export function setFiredToday(v)                   { firedToday = v; }
export function setInAppTimeoutId(v)               { inAppTimeoutId = v; }
export function setWtPropRAF(v)                    { wtPropRAF = v; }
export function setWtIdleTmr(v)                    { wtIdleTmr = v; }
export function setWtRemTimer(v)                   { wtRemTimer = v; }
export function setWtRemNextTimeout(v)             { wtRemNextTimeout = v; }
export function setWtAppOpenTime(v)                { _wtAppOpenTime = v; }
export function setCtCdInterval(v)                 { _ctCdInterval = v; }
export function setCtPageBuilt(v)                  { ctPageBuilt = v; }
export function setCtActiveTag(v)                  { ctActiveTag = v; }
export function setWtEditingId(v)                  { wtEditingId = v; }
export function setWtFilter(v)                     { wtFilter = v; }
export function setWtSelectedDays(v)               { wtSelectedDays = v; }
export function setJActiveLog(v)                   { jActiveLog = v; }
export function setEditingHabitId(v)               { editingHabitId = v; }
export function setSettingsFilter(v)               { settingsFilter = v; }
export function setIconPickerHabitId(v)            { iconPickerHabitId = v; }
export function setIconPickerMode(v)               { iconPickerMode = v; }
export function setSelectedEmoji(v)                { selectedEmoji = v; }
export function setUploadedImageData(v)            { uploadedImageData = v; }
export function setSelDays(v)                      { selDays = v; }
export function setBiryaniLogInFlight(v)           { biryaniLogInFlight = v; }
export function setDeferredInstallPrompt(v)        { deferredInstallPrompt = v; }
export function setMidnightResetFiredKey(v)        { midnightResetFiredKey = v; }
export function setCachedSceneHeight(v)            { cachedSceneHeight = v; }
export function setMasterTimerId(v)                { masterTimerId = v; }
export function setMasterTickCount(v)              { masterTickCount = v; }
export function setConfigSyncTimer(v)              { _configSyncTimer = v; }
export function setSettingsNeedRebuild(v)          { _settingsNeedRebuild = v; }
export function setLastThemeKey(v)                 { _lastThemeKey = v; }
export function setReminderFirstCheck(v)           { _reminderFirstCheck = v; }
export function setLastStreakMilestone(v)          { _lastStreakMilestone = v; }
export function setLastSaveTimestamp(v)            { _lastSaveTimestamp = v; }
export function setLastRemoteSavedAt(v)            { _lastRemoteSavedAt = v; }
export function setSyncMergeInProgress(v)          { _syncMergeInProgress = v; }
export function setDailyListenerRef(v)             { _dailyListenerRef = v; }
export function setDailyListenerCb(v)              { _dailyListenerCb = v; }
export function setConfigListenerRef(v)            { _configListenerRef = v; }
export function setConfigListenerCb(v)             { _configListenerCb = v; }
export function setConnectedListenerCb(v)          { _connectedListenerCb = v; }
export function setLastEveningWasWeekend(v)        { _lastEveningWasWeekend = v; }
export function setCtDayCompletedThisSession(v)    { _ctDayCompletedThisSession = v; }

/* ─────────────────────────────────────────────────────────────
   defaultState()
   Returns a fresh state object with all fields at their
   zero / empty values. Called on first load and factory reset.
───────────────────────────────────────────────────────────────*/
export function defaultState() {
  const now = new Date();
  return {
    /* ── Daily ── */
    lastDate:                    '',
    lastResetTimestamp:          0,
    checks:                      {},
    water:                       0,
    pts:                         0,
    totalPts:                    0,
    earnedBadges:                [],
    missedBannerDismissedDate:   '',
    missedTasksAlertTime:        '21:00',

    /* ── Language: English ── */
    engStreak:       0,
    lastEngDate:     '',
    engReadDone:     false,
    engSpeakDone:    false,
    engSpeakStreak:  0,
    engSpeakLastDate:'',
    engLearnDone:    false,
    engLearnStreak:  0,
    engLearnLastDate:'',

    /* ── Language: Hindi ── */
    hiReadDone:      false,
    hiReadStreak:    0,
    hiReadLastDate:  '',
    hiSpeakDone:     false,
    hiSpeakStreak:   0,
    hiSpeakLastDate: '',
    hiLearnDone:     false,
    hiLearnStreak:   0,
    hiLearnLastDate: '',

    /* ── Career ── */
    ctSkills:               { sql: 0, tools: 0, proj: 0, intv: 0 },
    ctStudyHrs:             0,
    ctDayDone:              false,
    ctTodayLogged:          false,
    ctTotalDays:            0,
    ctStreakDays:           0,
    ctStreakLastDate:        null,
    ctLastDate:             null,
    ctLastStudyDate:        null,
    ctDayHistory:           {},
    ctConsecutiveRestDays:  0,
    ctTasks:                [],
    ctTasksUpdatedAt:       0,
    ctLog:                  [],
    ctLogUpdatedAt:         0,
    ctWeeklyHours:          {},

    /* ── Junk / Sugar / Biryani ── */
    junkLog:         [],
    sugarLog:        [],
    biryLog:         [],
    weeklyGrams:     0,
    sugarWeekStart:  _sugarWeekStartOf(now),
    jnkViewMonth:    now.getMonth(),
    jnkViewYear:     now.getFullYear(),
    jBViewM:         now.getMonth(),
    jBViewY:         now.getFullYear(),

    /* ── Weekly tasks ── */
    weeklyTasks:          [],
    weeklyTasksResetDate: '',

    /* ── Water ── */
    waterLog:            {},
    wtReminderInterval:  60,
    wtReminderTime:      null,
    wtReminderEnabled:   false,
    wtLastReminderFired: null,

    /* ── Habits / Sections / Reminders ── */
    habits:              [],
    sections:            [],
    reminders:           [],
    deletedReminderIds:  [],

    /* ── Timestamps for conflict resolution ── */
    habitsUpdatedAt:    0,
    sectionsUpdatedAt:  0,
    remindersUpdatedAt: 0
  };
}

/* ─────────────────────────────────────────────────────────────
   _sugarWeekStartOf(date)
   Internal helper — used only inside defaultState().
   The public version lives in core/utils.js.
───────────────────────────────────────────────────────────────*/
function _sugarWeekStartOf(d) {
  const x    = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return (
    x.getFullYear() + '-' +
    String(x.getMonth() + 1).padStart(2, '0') + '-' +
    String(x.getDate()).padStart(2, '0')
  );
}

/* ─────────────────────────────────────────────────────────────
   ensureDefaults()
   Patches a loaded state object so any missing / invalid
   fields are filled in. Safe to call multiple times.
───────────────────────────────────────────────────────────────*/
export function ensureDefaults() {

  /* Habits / sections / reminders */
  if (!state.habits   || !state.habits.length)   state.habits    = JSON.parse(JSON.stringify(DEFAULT_HABITS));
  if (!state.sections || !state.sections.length)  state.sections  = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
  if (!state.reminders|| !state.reminders.length) state.reminders = JSON.parse(JSON.stringify(DEFAULT_REMINDERS));

  /* Career skills */
  if (!state.ctSkills || typeof state.ctSkills !== 'object')
    state.ctSkills = { sql: 0, tools: 0, proj: 0, intv: 0 };

  CT_SKILL_KEYS.forEach(k => {
    if (typeof state.ctSkills[k] !== 'number' || isNaN(state.ctSkills[k]))
      state.ctSkills[k] = 0;
    state.ctSkills[k] = Math.max(0, Math.min(100, state.ctSkills[k]));
  });

  /* Arrays */
  if (!Array.isArray(state.ctTasks))          state.ctTasks          = [];
  if (!Array.isArray(state.ctLog))            state.ctLog            = [];
  if (!Array.isArray(state.junkLog))          state.junkLog          = [];
  if (!Array.isArray(state.sugarLog))         state.sugarLog         = [];
  if (!Array.isArray(state.biryLog))          state.biryLog          = [];
  if (!Array.isArray(state.weeklyTasks))      state.weeklyTasks      = [];
  if (!Array.isArray(state.earnedBadges))     state.earnedBadges     = [];
  if (!Array.isArray(state.deletedReminderIds)) state.deletedReminderIds = [];

  /* Objects */
  if (!state.ctWeeklyHours  || typeof state.ctWeeklyHours !== 'object')  state.ctWeeklyHours  = {};
  if (!state.waterLog       || typeof state.waterLog !== 'object')        state.waterLog       = {};
  if (!state.ctDayHistory   || typeof state.ctDayHistory !== 'object')    state.ctDayHistory   = {};
  if (!state.checks         || typeof state.checks !== 'object')          state.checks         = {};

  /* Numbers with defaults */
  if (typeof state.ctConsecutiveRestDays !== 'number') state.ctConsecutiveRestDays = 0;
  if (typeof state.ctStreakDays          !== 'number') state.ctStreakDays           = 0;
  if (typeof state.ctTotalDays          !== 'number') state.ctTotalDays            = 0;

  /* Timestamps */
  if (!state.habitsUpdatedAt)    state.habitsUpdatedAt    = 0;
  if (!state.sectionsUpdatedAt)  state.sectionsUpdatedAt  = 0;
  if (!state.remindersUpdatedAt) state.remindersUpdatedAt = 0;
  if (!state.ctTasksUpdatedAt)   state.ctTasksUpdatedAt   = 0;
  if (!state.ctLogUpdatedAt)     state.ctLogUpdatedAt     = 0;
  if (!state.lastResetTimestamp) state.lastResetTimestamp = 0;

  /* Strings */
  if (!state.sugarWeekStart)        state.sugarWeekStart        = _sugarWeekStartOf(new Date());
  if (!state.missedTasksAlertTime ||
      !_validateTime(state.missedTasksAlertTime)) state.missedTasksAlertTime = '21:00';

  /* Water reminder */
  if (state.wtReminderInterval === undefined) state.wtReminderInterval  = 60;
  if (state.wtReminderTime     === undefined) state.wtReminderTime      = null;
  if (state.wtReminderEnabled  === undefined) state.wtReminderEnabled   = false;
  if (state.wtLastReminderFired=== undefined) state.wtLastReminderFired = null;

  /* Career booleans */
  if (state.ctTodayLogged  === undefined) state.ctTodayLogged  = false;
  if (state.ctStreakLastDate=== undefined) state.ctStreakLastDate= null;
  if (state.ctLastStudyDate === undefined) state.ctLastStudyDate = null;

  /* Habit order fallback */
  state.habits.forEach((h, i) => { if (h.order === undefined) h.order = i; });

  /* Ensure IDs on log entries */
  state.junkLog.forEach(e  => { if (!e.id) e.id = _genId(); });
  state.sugarLog.forEach(e => { if (!e.id) e.id = _genId(); });
  state.biryLog.forEach(b  => {
    if (!b.entries) b.entries = [];
    b.entries.forEach(e => { if (!e.id) e.id = _genId(); });
    b.count = b.entries.length;
  });

  /* Hard caps on array lengths */
  if (state.junkLog.length    > MAX_JUNK_LOG)    state.junkLog    = state.junkLog.slice(-MAX_JUNK_LOG);
  if (state.sugarLog.length   > MAX_SUGAR_LOG)   state.sugarLog   = state.sugarLog.slice(-MAX_SUGAR_LOG);
  if (state.ctTasks.length    > MAX_CT_TASKS)    state.ctTasks    = state.ctTasks.slice(-MAX_CT_TASKS);
  if (state.weeklyTasks.length> MAX_WEEKLY_TASKS)state.weeklyTasks= state.weeklyTasks.slice(-MAX_WEEKLY_TASKS);
  if (state.deletedReminderIds.length > 100)
    state.deletedReminderIds = state.deletedReminderIds.slice(-100);

  /* Prune day history */
  const historyKeys = Object.keys(state.ctDayHistory).sort();
  if (historyKeys.length > MAX_DAY_HISTORY)
    historyKeys.slice(0, historyKeys.length - MAX_DAY_HISTORY)
               .forEach(k => delete state.ctDayHistory[k]);

  /* Validate day history values */
  const validDateRe  = /^\d{4}-\d{2}-\d{2}$/;
  const validOutcomes= new Set(['complete', 'partial', 'rest']);
  Object.keys(state.ctDayHistory).forEach(k => {
    if (!validDateRe.test(k) || !validOutcomes.has(state.ctDayHistory[k]))
      delete state.ctDayHistory[k];
  });

  /* Prune waterLog entries older than 30 days */
  const cutoff     = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey  = _dateKey(cutoff);
  Object.keys(state.waterLog).forEach(k => { if (k < cutoffKey) delete state.waterLog[k]; });

  /* Prune ctWeeklyHours beyond 14 days */
  const wCutoff    = new Date();
  wCutoff.setDate(wCutoff.getDate() - 14);
  const wCutoffKey = _dateKey(wCutoff);
  Object.keys(state.ctWeeklyHours).forEach(k => { if (k < wCutoffKey) delete state.ctWeeklyHours[k]; });

  /* jnkSelected safety */
  if (!jnkSelected || Array.isArray(jnkSelected)) setJnkSelected({});
}

/* ─────────────────────────────────────────────────────────────
   RESET ALL FLAGS
   Called by confirmFactoryReset() in init.js.
   Resets every exported flag back to its initial value.
───────────────────────────────────────────────────────────────*/
export function resetAllFlags() {
  isSaving               = false;
  saveDebounceTimer      = null;
  saveFailCount          = 0;
  saveVersion            = 0;
  lastSavedVersion       = 0;
  realtimeRetryCount     = 0;
  wtSceneInitialized     = false;
  wtDone                 = false;
  jnkSelected            = {};
  jnkGridBuilt           = false;
  confettiLock           = false;
  badgeCheckTimer        = null;
  firedToday             = {};
  inAppTimeoutId         = null;
  wtPropRAF              = null;
  wtIdleTmr              = null;
  wtRemTimer             = null;
  wtRemNextTimeout       = null;
  _wtAppOpenTime         = Date.now();
  _ctCdInterval          = null;
  ctPageBuilt            = false;
  ctActiveTag            = 'All';
  wtEditingId            = null;
  wtFilter               = 'all';
  wtSelectedDays         = ['Mon'];
  jActiveLog             = 'sugar';
  editingHabitId         = null;
  settingsFilter         = 'all';
  iconPickerHabitId      = null;
  iconPickerMode         = 'emoji';
  selectedEmoji          = null;
  uploadedImageData      = null;
  selDays                = [0,1,2,3,4,5,6];
  biryaniLogInFlight     = false;
  deferredInstallPrompt  = null;
  midnightResetFiredKey  = '';
  cachedSceneHeight      = 0;
  masterTimerId          = null;
  masterTickCount        = 0;
  _configSyncTimer       = null;
  _settingsNeedRebuild   = true;
  _lastThemeKey          = '';
  _reminderFirstCheck    = true;
  _lastStreakMilestone   = 0;
  _lastSaveTimestamp     = 0;
  _lastRemoteSavedAt     = '';
  _syncMergeInProgress   = false;
  _dailyListenerRef      = null;
  _dailyListenerCb       = null;
  _configListenerRef     = null;
  _configListenerCb      = null;
  _connectedListenerCb   = null;
  _lastEveningWasWeekend = null;
  _ctDayCompletedThisSession = false;
}

/* ─────────────────────────────────────────────────────────────
   PRIVATE HELPERS
   Used only inside this file — not exported.
───────────────────────────────────────────────────────────────*/
function _genId() {
  return '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function _dateKey(d) {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function _validateTime(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  if (parts.length !== 2) return false;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
