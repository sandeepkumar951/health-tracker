/**
 * core/firebase.js
 * Firebase initialization, save/load, and realtime sync.
 *
 * Fixes preserved from original:
 *   B-01/H5: clean listener detach via exact ref+callback
 *   C1: echo detection via device ID + save timestamp
 *   C2/C3: explicit false sync for unchecked tasks
 *   C4: lastResetTimestamp propagation
 *   C6/B-21: totalPts stale guard
 *   H1: _syncMergeInProgress oscillation guard
 *   H2: pts reset-aware logic
 *   B-28: sanitize all incoming remote strings
 *   M1: read-before-write in forceSyncAll
 */

import { state, defaultState, ensureDefaults, DB_KEY, DB_KEY_FIRED, DB_KEY_MIDNIGHT, CT_SKILL_KEYS } from './state.js';
import {
  todayKey, yesterdayKey, sugarWeekStartOf,
  sanitizeRemoteString, sanitizeRemoteNumber, sanitizeRemoteBool,
  validateTimeString, safeLocalStorageSave, genId, showToast
} from './utils.js';

'use strict';

// ─── Firebase config ──────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDf6c55kjHOhJcRN3GbRB6wQTM_OcZgzxE',
  authDomain:        'sandyhealthtracker.firebaseapp.com',
  databaseURL:       'https://sandyhealthtracker-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'sandyhealthtracker',
  storageBucket:     'sandyhealthtracker.firebasestorage.app',
  messagingSenderId: '742150727652',
  appId:             '1:742150727652:web:8c55ee8fb1327e02df09f1'
};

firebase.initializeApp(FIREBASE_CONFIG);
export const rtdb = firebase.database();

// ─── Module-level sync state ─────────────────────────────────────────────────

let _dailyListenerRef  = null;
let _dailyListenerCb   = null;
let _configListenerRef = null;
let _configListenerCb  = null;
let _connectedListenerCb = null;

let isSaving         = false;
let saveDebounceTimer = null;
let saveFailCount    = 0;
let saveVersion      = 0;
let lastSavedVersion = 0;
let realtimeRetryCount = 0;

export let _lastSaveTimestamp  = 0;
export let _lastRemoteSavedAt  = '';
export let _syncMergeInProgress = false;

const REALTIME_MAX_RETRIES = 10;
const REALTIME_BASE_DELAY  = 3000;
const SAVE_MAX_FAILS       = 5;
const SAVE_RETRY_BASE      = 300;

// ─── Device ID ────────────────────────────────────────────────────────────────

function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem('sandy_device_id'); } catch(e){}
  if (!id) {
    id = 'dev_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
    try { safeLocalStorageSave('sandy_device_id', id); } catch(e){}
  }
  return id;
}

// ─── Firebase status UI ───────────────────────────────────────────────────────

export function updateFbStatus(s) {
  const map = {
    online:  {cls:'online',  txt:'Connected to sandyhealthtracker'},
    syncing: {cls:'syncing', txt:'Syncing...'},
    offline: {cls:'offline', txt:'Offline — saved locally'}
  };
  const ref = map[s]||map.offline;
  ['fb-dot','settings-fb-dot'].forEach(id=>{
    const d = document.getElementById(id); if(d) d.className='fb-dot '+ref.cls;
  });
  const t1 = document.getElementById('fb-status-text');
  const t2 = document.getElementById('settings-fb-text');
  if(t1) t1.textContent = ref.txt;
  if(t2) t2.textContent = ref.txt.replace('sandyhealthtracker','Firebase');
}

export function showSync(type, msg) {
  const s = document.getElementById('sync-status');
  const d = document.getElementById('sync-dot');
  const t = document.getElementById('sync-text');
  if(!s) return;
  s.className = 'sync-status show '+type;
  if(d) d.className = type==='syncing' ? 'sync-dot pulse' : 'sync-dot';
  if(t) t.textContent = msg;
  clearTimeout(showSync._timer);
  showSync._timer = setTimeout(()=>s.classList.remove('show'), 2200);
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildDailyPayload() {
  // Store explicit booleans for checks (false = unchecked, syncs correctly)
  const checksPayload = {};
  if (state.checks && typeof state.checks==='object') {
    Object.keys(state.checks).forEach(k=>{ checksPayload[k] = state.checks[k]===true; });
  }

  const payload = {
    date: todayKey(), savedAt: new Date().toISOString(),
    savedBy: getDeviceId(),
    lastResetTimestamp: state.lastResetTimestamp||0,
    checks: checksPayload,
    water: state.water||0, pts: state.pts||0, totalPts: state.totalPts||0,
    earnedBadges: state.earnedBadges||[],
    lastDate: state.lastDate||'',
    missedBannerDismissedDate: state.missedBannerDismissedDate||'',
    missedTasksAlertTime: state.missedTasksAlertTime||'21:00',
    engStreak: state.engStreak||0, lastEngDate: state.lastEngDate||'',
    engReadDone: !!state.engReadDone, engSpeakDone: !!state.engSpeakDone,
    engSpeakStreak: state.engSpeakStreak||0, engSpeakLastDate: state.engSpeakLastDate||'',
    engLearnDone: !!state.engLearnDone, engLearnStreak: state.engLearnStreak||0,
    engLearnLastDate: state.engLearnLastDate||'',
    hiReadDone: !!state.hiReadDone, hiReadStreak: state.hiReadStreak||0,
    hiReadLastDate: state.hiReadLastDate||'', hiSpeakDone: !!state.hiSpeakDone,
    hiSpeakStreak: state.hiSpeakStreak||0, hiSpeakLastDate: state.hiSpeakLastDate||'',
    hiLearnDone: !!state.hiLearnDone, hiLearnStreak: state.hiLearnStreak||0,
    hiLearnLastDate: state.hiLearnLastDate||'',
    ctSkills: state.ctSkills||{sql:0,tools:0,proj:0,intv:0},
    ctStudyHrs: state.ctStudyHrs||0, ctDayDone: !!state.ctDayDone,
    ctStreakDays: state.ctStreakDays||0, ctLastDate: state.ctLastDate||null,
    ctStreakLastDate: state.ctStreakLastDate||null,
    ctTodayLogged: !!state.ctTodayLogged, ctTotalDays: state.ctTotalDays||0,
    ctTasks: state.ctTasks||[], ctTasksUpdatedAt: state.ctTasksUpdatedAt||0,
    ctLog: state.ctLog||[], ctLogUpdatedAt: state.ctLogUpdatedAt||0,
    ctWeeklyHours: state.ctWeeklyHours||{},
    ctLastStudyDate: state.ctLastStudyDate||null,
    ctDayHistory: state.ctDayHistory||{},
    ctConsecutiveRestDays: state.ctConsecutiveRestDays||0,
    junkLog: state.junkLog||[], sugarLog: state.sugarLog||[],
    biryLog: state.biryLog||[], weeklyGrams: state.weeklyGrams||0,
    sugarWeekStart: state.sugarWeekStart||'',
    weeklyTasks: state.weeklyTasks||[],
    weeklyTasksResetDate: state.weeklyTasksResetDate||'',
    waterLog: state.waterLog||{},
    wtReminderInterval: state.wtReminderInterval||60,
    wtReminderTime: state.wtReminderTime||null,
    wtReminderEnabled: !!state.wtReminderEnabled,
    wtLastReminderFired: state.wtLastReminderFired||null
  };

  // Guard against oversized payloads
  const serialized = JSON.stringify(payload);
  if (serialized.length > 900000) {
    console.warn('Sandy Brain: payload too large, trimming arrays');
    if (payload.junkLog.length>200) payload.junkLog = payload.junkLog.slice(-200);
    if (payload.sugarLog.length>200) payload.sugarLog = payload.sugarLog.slice(-200);
    if (payload.ctLog.length>30) payload.ctLog = payload.ctLog.slice(0,30);
  }
  return payload;
}

function buildConfigPayload() {
  // Strip large base64 images before sending to Firebase
  const safeHabits = (state.habits||[]).map(h=>{
    if (h.customIconType==='image' && h.customIcon && h.customIcon.startsWith('data:image/'))
      return Object.assign({},h,{customIcon:'__needs_upload__', customIconType:'image_local'});
    return h;
  });
  return {
    habits:   safeHabits,
    sections: state.sections||[],
    reminders: state.reminders||[],
    updatedAt: new Date().toISOString(),
    habitsUpdatedAt:    state.habitsUpdatedAt||0,
    sectionsUpdatedAt:  state.sectionsUpdatedAt||0,
    remindersUpdatedAt: state.remindersUpdatedAt||0,
    deletedReminderIds: (state.deletedReminderIds||[]).slice(-100)
  };
}

// ─── Apply remote documents ────────────────────────────────────────────────────

/**
 * Merges a remote daily document into local state.
 * Handles explicit false (unchecked) propagation, reset timestamps,
 * and stale date detection.
 */
export function applyDailyDoc(d) {
  if (!d||typeof d!=='object') return;

  const remoteSavedAt  = d.savedAt ? new Date(d.savedAt).getTime() : 0;
  const remoteResetAt  = sanitizeRemoteNumber(d.lastResetTimestamp, 0, Infinity, 0);
  const localResetAt   = state.lastResetTimestamp||0;

  // Skip stale data from a different day
  if (d.date && d.date!==todayKey()) return;

  // If remote carries a later reset, apply it first
  if (remoteResetAt > localResetAt) {
    state.lastResetTimestamp = remoteResetAt;
    state.checks = {};
    state.water  = 0;
    state.pts    = 0;
  }

  const mergeChecks = !(remoteSavedAt>0 && remoteSavedAt < state.lastResetTimestamp);

  // totalPts: always take max (cumulative across all time)
  state.totalPts = Math.max(state.totalPts||0, d.totalPts||0);

  if (mergeChecks) {
    // pts: only take remote if reset is same or newer
    if (remoteResetAt >= localResetAt)
      state.pts = Math.max(state.pts||0, d.pts||0);

    state.water = Math.max(state.water||0, d.water||0);
    if (!state.waterLog) state.waterLog={};
    state.waterLog[todayKey()] = Math.max(state.waterLog[todayKey()]||0, state.water);

    // Checks: explicit boolean merge — true always wins,
    // false wins only if remote save is newer than our last save
    if (d.checks && typeof d.checks==='object') {
      state.checks = state.checks||{};
      Object.keys(d.checks).forEach(k=>{
        const remoteVal = d.checks[k]===true;
        const localVal  = state.checks[k]===true;
        if (remoteVal) {
          state.checks[k] = true;
        } else if (!remoteVal && remoteSavedAt > _lastSaveTimestamp) {
          state.checks[k] = false;
        }
        // otherwise keep local value
      });
    }
  }

  // Earned badges: union merge
  if (Array.isArray(d.earnedBadges)) {
    state.earnedBadges = state.earnedBadges||[];
    d.earnedBadges.forEach(b=>{ if(!state.earnedBadges.includes(b)) state.earnedBadges.push(b); });
  }

  // String fields: take max (later date wins)
  const stringFieldsLatest = [
    'lastDate','missedTasksAlertTime','missedBannerDismissedDate',
    'lastEngDate','engSpeakLastDate','engLearnLastDate',
    'hiReadLastDate','hiSpeakLastDate','hiLearnLastDate',
    'ctLastDate','ctStreakLastDate','sugarWeekStart',
    'weeklyTasksResetDate','wtReminderTime'
  ];
  stringFieldsLatest.forEach(f=>{
    if (d[f]!==undefined) {
      const sanitized = sanitizeRemoteString(d[f], 40);
      if (!state[f]) state[f]=sanitized;
      else if (typeof d[f]==='string'&&typeof state[f]==='string') {
        if (sanitized>state[f]) state[f]=sanitized;
      }
    }
  });

  if (d.wtReminderInterval!==undefined)
    state.wtReminderInterval = Math.max(
      state.wtReminderInterval||0,
      sanitizeRemoteNumber(d.wtReminderInterval,15,240,60)
    );

  // Boolean OR merge
  ['ctTodayLogged','ctDayDone','wtReminderEnabled',
   'engReadDone','engSpeakDone','engLearnDone',
   'hiReadDone','hiSpeakDone','hiLearnDone']
    .forEach(f=>{ if(d[f]) state[f]=true; });

  // Streaks/counts: take max
  ['engStreak','engSpeakStreak','engLearnStreak',
   'hiReadStreak','hiSpeakStreak','hiLearnStreak',
   'ctStreakDays','ctConsecutiveRestDays']
    .forEach(f=>{ state[f]=Math.max(state[f]||0, sanitizeRemoteNumber(d[f],0,Infinity,0)); });

  state.ctTotalDays = Math.max(state.ctTotalDays||0, sanitizeRemoteNumber(d.ctTotalDays,0,Infinity,0));

  // Career skills: max per skill
  if (d.ctSkills&&typeof d.ctSkills==='object') {
    state.ctSkills = state.ctSkills||{sql:0,tools:0,proj:0,intv:0};
    CT_SKILL_KEYS.forEach(k=>{
      state.ctSkills[k] = Math.max(state.ctSkills[k]||0, sanitizeRemoteNumber(d.ctSkills[k],0,100,0));
    });
  }

  if (mergeChecks)
    state.ctStudyHrs = Math.max(state.ctStudyHrs||0, sanitizeRemoteNumber(d.ctStudyHrs,0,24,0));

  if (d.ctLastStudyDate&&(!state.ctLastStudyDate||d.ctLastStudyDate>state.ctLastStudyDate))
    state.ctLastStudyDate = sanitizeRemoteString(d.ctLastStudyDate, 10);

  // Tasks & log: timestamp-based winner
  if (Array.isArray(d.ctTasks)&&(d.ctTasksUpdatedAt||0)>(state.ctTasksUpdatedAt||0)) {
    state.ctTasks = d.ctTasks; state.ctTasksUpdatedAt = d.ctTasksUpdatedAt;
  }
  if (Array.isArray(d.ctLog)&&(d.ctLogUpdatedAt||0)>(state.ctLogUpdatedAt||0)) {
    state.ctLog = d.ctLog; state.ctLogUpdatedAt = d.ctLogUpdatedAt;
  }

  // Weekly hours: max per day
  if (d.ctWeeklyHours&&typeof d.ctWeeklyHours==='object') {
    state.ctWeeklyHours = state.ctWeeklyHours||{};
    Object.keys(d.ctWeeklyHours).forEach(k=>{
      state.ctWeeklyHours[k] = Math.max(state.ctWeeklyHours[k]||0,
        sanitizeRemoteNumber(d.ctWeeklyHours[k],0,24,0));
    });
  }

  // Day history: priority merge (complete > partial > rest)
  if (d.ctDayHistory&&typeof d.ctDayHistory==='object') {
    state.ctDayHistory = state.ctDayHistory||{};
    const priority = {complete:3,partial:2,rest:1};
    const validDateRe = /^\d{4}-\d{2}-\d{2}$/;
    const validValues = new Set(['complete','partial','rest']);
    Object.keys(d.ctDayHistory).forEach(k=>{
      if (!validDateRe.test(k)||!validValues.has(d.ctDayHistory[k])) return;
      const existing = priority[state.ctDayHistory[k]]||0;
      const incoming = priority[d.ctDayHistory[k]]||0;
      if (incoming>existing) state.ctDayHistory[k] = d.ctDayHistory[k];
    });
  }

  _mergeLogArray('junkLog', d);
  _mergeLogArray('sugarLog', d);

  // Biryani: merge by monthKey + entry ID
  if (Array.isArray(d.biryLog)) {
    state.biryLog = state.biryLog||[];
    d.biryLog.forEach(remoteMonth=>{
      if (!remoteMonth.monthKey) return;
      let localMonth = state.biryLog.find(x=>x.monthKey===remoteMonth.monthKey);
      if (!localMonth) { state.biryLog.push(JSON.parse(JSON.stringify(remoteMonth))); return; }
      const localIds = new Set((localMonth.entries||[]).map(e=>e.id));
      (remoteMonth.entries||[]).forEach(re=>{
        if (re.id&&!localIds.has(re.id)) localMonth.entries.push(re);
      });
      localMonth.count = localMonth.entries.length;
    });
  }

  if ((d.weeklyGrams||0)>(state.weeklyGrams||0)) state.weeklyGrams = d.weeklyGrams;

  // Weekly tasks: merge by ID, OR-merge done state
  if (Array.isArray(d.weeklyTasks)&&d.weeklyTasks.length>0) {
    state.weeklyTasks = state.weeklyTasks||[];
    const localMap = new Map(state.weeklyTasks.map(t=>[t.id,t]));
    d.weeklyTasks.forEach(rt=>{
      if (!rt.id) return;
      const existing = localMap.get(rt.id);
      if (!existing) { state.weeklyTasks.push(rt); localMap.set(rt.id,rt); }
      else { if (rt.done&&!existing.done) existing.done=true; }
    });
  }

  // Water log: max per day
  if (d.waterLog&&typeof d.waterLog==='object') {
    state.waterLog = state.waterLog||{};
    Object.keys(d.waterLog).forEach(k=>{
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const val = d.waterLog[k];
      if (typeof val!=='number'||val<0||val>50) return;
      state.waterLog[k] = Math.max(state.waterLog[k]||0, val);
    });
  }
}

function _mergeLogArray(field, remoteDoc) {
  if (!Array.isArray(remoteDoc[field])||!remoteDoc[field].length) return;
  state[field] = state[field]||[];
  const localIds = new Set(state[field].map(e=>e.id).filter(Boolean));
  remoteDoc[field].forEach(re=>{
    if (re.id&&!localIds.has(re.id)) { state[field].push(re); localIds.add(re.id); }
  });
}

/**
 * Merges a remote config document (habits, sections, reminders).
 * Uses timestamp-based winner for each category.
 */
export function applyConfigDoc(d) {
  if (!d||typeof d!=='object') return;

  if (Array.isArray(d.habits)&&(d.habitsUpdatedAt||0)>(state.habitsUpdatedAt||0)) {
    state.habits = d.habits.map(h=>({
      id:           sanitizeRemoteString(h.id,40),
      section:      sanitizeRemoteString(h.section,40),
      name:         sanitizeRemoteString(h.name,80),
      note:         sanitizeRemoteString(h.note,100),
      pts:          sanitizeRemoteNumber(h.pts,1,20,3),
      order:        sanitizeRemoteNumber(h.order,0,9999,0),
      customIcon:   h.customIconType==='image_local'
                      ? ((state.habits||[]).find(x=>x.id===h.id)?.customIcon || sanitizeRemoteString(h.customIcon,200))
                      : sanitizeRemoteString(h.customIcon,200),
      customIconType: sanitizeRemoteString(h.customIconType,20)
    }));
    state.habitsUpdatedAt = d.habitsUpdatedAt;
    window._settingsNeedRebuild = true;
  }

  if (Array.isArray(d.sections)&&(d.sectionsUpdatedAt||0)>(state.sectionsUpdatedAt||0)) {
    state.sections = d.sections.map(s=>({
      id:   sanitizeRemoteString(s.id,40),
      icon: sanitizeRemoteString(s.icon,10),
      name: sanitizeRemoteString(s.name,40),
      tag:  sanitizeRemoteString(s.tag,20)
    }));
    state.sectionsUpdatedAt = d.sectionsUpdatedAt;
    window._settingsNeedRebuild = true;
  }

  if (Array.isArray(d.reminders)&&(d.remindersUpdatedAt||0)>(state.remindersUpdatedAt||0)) {
    state.reminders = d.reminders.map(r=>({
      id:      sanitizeRemoteString(r.id,40),
      title:   sanitizeRemoteString(r.title,60),
      msg:     sanitizeRemoteString(r.msg,100),
      time:    validateTimeString(r.time) ? r.time : '08:00',
      icon:    sanitizeRemoteString(r.icon,10),
      days:    Array.isArray(r.days) ? r.days.filter(x=>typeof x==='number'&&x>=0&&x<=6) : [],
      enabled: sanitizeRemoteBool(r.enabled)
    }));
    state.remindersUpdatedAt = d.remindersUpdatedAt;
  }

  // deletedReminderIds: union merge, cap at 100
  if (Array.isArray(d.deletedReminderIds)) {
    state.deletedReminderIds = state.deletedReminderIds||[];
    const localSet = new Set(state.deletedReminderIds);
    d.deletedReminderIds.forEach(id=>{ if(typeof id==='string') localSet.add(id); });
    state.deletedReminderIds = Array.from(localSet).slice(-100);
  }
}

// ─── User ref helper ──────────────────────────────────────────────────────────

export function userRef(path) { return rtdb.ref('sandy_shared/'+path); }

// ─── Save ─────────────────────────────────────────────────────────────────────

export function debouncedSave(delay) {
  saveVersion++;
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(()=>save(), delay!==undefined ? delay : 500);
}

export async function save() {
  try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch(e){}

  if (isSaving) return;
  isSaving = true;
  const thisVersion = saveVersion;

  try {
    updateFbStatus('syncing');
    const now = new Date().toISOString();
    _lastSaveTimestamp = Date.now();
    _lastRemoteSavedAt = now;

    const dailyPath  = 'sandy_shared/daily_'+todayKey();
    const configPath = 'sandy_shared/config';

    const dailyPayload  = buildDailyPayload();
    dailyPayload.savedAt = now;
    dailyPayload.savedBy = getDeviceId();

    const configPayload = buildConfigPayload();
    configPayload.updatedAt = now;

    const updates = {};
    Object.keys(dailyPayload).forEach(key=>{ updates[dailyPath+'/'+key]=dailyPayload[key]; });
    updates[configPath] = configPayload;

    await rtdb.ref().update(updates);
    updateFbStatus('online');
    showSync('success','Synced');
    saveFailCount = 0;
    lastSavedVersion = thisVersion;

  } catch(err) {
    console.warn('Firebase RTDB save error:', err);
    updateFbStatus('offline');
    showSync('error','Saved locally');
    saveFailCount++;
    if (saveFailCount < SAVE_MAX_FAILS) {
      const delay = Math.min(SAVE_RETRY_BASE * Math.pow(2, saveFailCount), 15000);
      setTimeout(()=>{ if(!isSaving) save(); }, delay);
    } else { saveFailCount=0; }
  } finally {
    isSaving = false;
    if (saveVersion!==lastSavedVersion && saveFailCount<SAVE_MAX_FAILS)
      setTimeout(()=>save(), 150);
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function load() {
  // Load from localStorage first (instant)
  try {
    const r = localStorage.getItem(DB_KEY);
    if (r) Object.assign(state, defaultState(), JSON.parse(r));
  } catch(e) { Object.assign(state, defaultState()); }

  // Then load from Firebase (authoritative)
  try {
    showSync('syncing','Loading...');
    updateFbStatus('syncing');
    const today = todayKey();
    const [dailySnap, configSnap] = await Promise.all([
      userRef('daily_'+today).once('value'),
      userRef('config').once('value')
    ]);
    if (dailySnap.exists()) applyDailyDoc(dailySnap.val());
    if (configSnap.exists()) applyConfigDoc(configSnap.val());
    updateFbStatus('online');
    showSync('success','Loaded');
  } catch(err) {
    console.warn('Firebase RTDB load error:', err);
    updateFbStatus('offline');
  }
}

// ─── Realtime sync ────────────────────────────────────────────────────────────

export function _detachAllListeners() {
  if (_dailyListenerRef && _dailyListenerCb) {
    try { _dailyListenerRef.off('value', _dailyListenerCb); } catch(e){}
  }
  _dailyListenerRef = null; _dailyListenerCb = null;

  if (_configListenerRef && _configListenerCb) {
    try { _configListenerRef.off('value', _configListenerCb); } catch(e){}
  }
  _configListenerRef = null; _configListenerCb = null;

  if (_connectedListenerCb) {
    try { rtdb.ref('.info/connected').off('value', _connectedListenerCb); } catch(e){}
    _connectedListenerCb = null;
  }
}

export function startRealtimeSync() {
  _detachAllListeners();

  const myDeviceId = getDeviceId();
  const dailyRef   = userRef('daily_'+todayKey());
  const configRef  = userRef('config');

  // ── Daily listener ──────────────────────────────────────────────────────

  _dailyListenerCb = dailyRef.on('value', snap=>{
    realtimeRetryCount = 0;
    if (!snap.exists()) return;
    const remote = snap.val();
    if (!remote) return;

    // Echo detection: same device + same savedAt timestamp → skip
    if (remote.savedBy===myDeviceId && remote.savedAt===_lastRemoteSavedAt) return;

    // Oscillation guard
    if (_syncMergeInProgress) return;
    _syncMergeInProgress = true;

    const beforeWater  = state.water||0;
    const beforePts    = state.pts||0;
    const beforeTotal  = state.totalPts||0;
    const beforeChecks = JSON.stringify(state.checks||{});
    const beforeStudy  = state.ctStudyHrs||0;
    const beforeStreak = state.ctStreakDays||0;
    const beforeReset  = state.lastResetTimestamp||0;

    applyDailyDoc(remote);
    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch(e){}

    // Only push back if local has genuinely newer data
    const localHasMore =
      (state.water||0)       > (remote.water||0) ||
      (state.pts||0)         > (remote.pts||0) ||
      (state.totalPts||0)    > (remote.totalPts||0) ||
      (state.ctStudyHrs||0)  > (remote.ctStudyHrs||0) ||
      (state.ctStreakDays||0) > (remote.ctStreakDays||0) ||
      (state.lastResetTimestamp||0) > (remote.lastResetTimestamp||0);

    const localChecksNewer = (() => {
      const rc = remote.checks||{};
      const lc = state.checks||{};
      return Object.keys(lc).some(k=>lc[k]!==rc[k]);
    })();

    // Trigger lightweight UI refresh
    if (typeof window.refreshUILightweight==='function') window.refreshUILightweight();

    if (localHasMore||localChecksNewer) {
      debouncedSave(1200);
      setTimeout(()=>{ _syncMergeInProgress=false; }, 1800);
    } else {
      _syncMergeInProgress = false;
    }

    const changed =
      beforeWater  !== (state.water||0) ||
      beforePts    !== (state.pts||0) ||
      beforeTotal  !== (state.totalPts||0) ||
      beforeChecks !== JSON.stringify(state.checks||{}) ||
      beforeStudy  !== (state.ctStudyHrs||0) ||
      beforeStreak !== (state.ctStreakDays||0) ||
      beforeReset  !== (state.lastResetTimestamp||0);

    if (changed) showSync('success','Updated from other device');

  }, err=>{
    console.warn('Daily listener error:', err);
    updateFbStatus('offline');
    _syncMergeInProgress = false;
    realtimeRetryCount++;
    if (realtimeRetryCount <= REALTIME_MAX_RETRIES) {
      const delay = Math.min(REALTIME_BASE_DELAY * Math.pow(1.5, realtimeRetryCount), 60000);
      setTimeout(startRealtimeSync, delay);
    }
  });

  _dailyListenerRef = dailyRef;

  // ── Config listener ──────────────────────────────────────────────────────

  _configListenerCb = configRef.on('value', snap=>{
    if (!snap.exists()) return;
    const remote = snap.val();
    if (!remote||remote.updatedAt===_lastRemoteSavedAt) return;

    applyConfigDoc(remote);
    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch(e){}

    // Debounced UI rebuild on config sync
    clearTimeout(startRealtimeSync._configTimer);
    startRealtimeSync._configTimer = setTimeout(()=>{
      window._settingsNeedRebuild = true;
      if (typeof window.handleConfigSyncRebuild==='function') window.handleConfigSyncRebuild();
      if (typeof window.renderReminderList==='function') window.renderReminderList();
      if (typeof window.renderHomeReminders==='function') window.renderHomeReminders();
      const sp = document.getElementById('page-settings');
      if (sp&&sp.classList.contains('active')&&typeof window.buildSettingsPage==='function')
        window.buildSettingsPage();
    }, 500);

    showSync('success','Config synced');
  }, err=>console.warn('Config listener error:', err));

  _configListenerRef = configRef;

  // ── Connection state ───────────────────────────────────────────────────

  _connectedListenerCb = snap=>{
    if (snap.val()===true) {
      updateFbStatus('online');
      debouncedSave(500);
    } else { updateFbStatus('offline'); }
  };
  rtdb.ref('.info/connected').on('value', _connectedListenerCb);
}

// ─── Force sync ────────────────────────────────────────────────────────────────

export async function forceSyncAll() {
  showToast('Force syncing...');
  saveFailCount = 0;
  _lastRemoteSavedAt = '';
  try {
    // Read-before-write to avoid overwriting newer remote data
    const [dailySnap, configSnap] = await Promise.all([
      userRef('daily_'+todayKey()).once('value'),
      userRef('config').once('value')
    ]);
    if (dailySnap.exists()) applyDailyDoc(dailySnap.val());
    if (configSnap.exists()) applyConfigDoc(configSnap.val());
    try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch(e){}
    if (typeof window.refreshUILightweight==='function') window.refreshUILightweight();
    await save();
  } catch(e) { console.warn('Force sync read failed:', e); }

  _detachAllListeners();
  startRealtimeSync();
  showToast('All data synced across devices!','gt');
}

// ─── Fired Today ──────────────────────────────────────────────────────────────

export let firedToday = {};

export function loadFiredToday() {
  const key = DB_KEY_FIRED+todayKey();
  try { const s=localStorage.getItem(key); firedToday=s?JSON.parse(s):{};} catch(e){ firedToday={}; }
  // Clean up old fired-today keys
  try {
    const yesterday = yesterdayKey();
    const dayBefore = new Date(); dayBefore.setDate(dayBefore.getDate()-2);
    const dbKey = dayBefore.getFullYear()+'-'+String(dayBefore.getMonth()+1).padStart(2,'0')+'-'+String(dayBefore.getDate()).padStart(2,'0');
    localStorage.removeItem(DB_KEY_FIRED+yesterday);
    localStorage.removeItem(DB_KEY_FIRED+dbKey);
  } catch(e){}
  if (Object.keys(firedToday).length>200) firedToday={};
}

export function saveFiredToday() {
  try { safeLocalStorageSave(DB_KEY_FIRED+todayKey(), JSON.stringify(firedToday)); } catch(e){}
}

// ─── Window exports ───────────────────────────────────────────────────────────

Object.assign(window, {
  rtdb, userRef, debouncedSave, save, load,
  startRealtimeSync, _detachAllListeners, forceSyncAll,
  updateFbStatus, showSync, applyDailyDoc, applyConfigDoc,
  firedToday, loadFiredToday, saveFiredToday,
  get _lastSaveTimestamp(){ return _lastSaveTimestamp; },
  get _lastRemoteSavedAt(){ return _lastRemoteSavedAt; },
  get _syncMergeInProgress(){ return _syncMergeInProgress; }
});
