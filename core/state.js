/**
 * core/state.js
 * Single source of truth for all app state.
 * Exports the mutable `state` object and helper functions.
 */

import {
  sugarWeekStartOf, genId, sanitizeRemoteString, sanitizeRemoteNumber,
  todayKey, yesterdayKey, currentMonthKey, safeLocalStorageSave
} from './utils.js';

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DB_KEY           = 'htrack_v20';
export const DB_KEY_FIRED     = 'firedToday_';
export const DB_KEY_MIDNIGHT  = 'midnightFired_';
export const CT_HOUR_GOAL     = 4;
export const CT_WEEK_GOAL     = 28;
export const CT_TARGET_DATE   = '2026-08-30';
export const CT_LOG_LIMIT     = 50;
export const CT_XP_PER_HOUR   = 5;
export const CT_SKILL_KEYS    = ['sql','tools','proj','intv'];
export const WT_GOAL          = 11;
export const WT_ML            = 300;
export const DAILY_HOUR_GOAL  = CT_HOUR_GOAL;
export const MAX_JUNK_LOG     = 500;
export const MAX_SUGAR_LOG    = 500;
export const MAX_CT_TASKS     = 200;
export const MAX_WEEKLY_TASKS = 100;
export const MAX_DAY_HISTORY  = 400;

// ─── Default data ─────────────────────────────────────────────────────────────

export const DEFAULT_SECTIONS = [
  {id:'morning',  icon:'☀️', name:'Morning',          tag:'on waking'},
  {id:'skin_am',  icon:'🧴', name:'Morning skin',      tag:''},
  {id:'breakfast',icon:'🍳', name:'Breakfast',         tag:''},
  {id:'lunch',    icon:'🍛', name:'Lunch',              tag:''},
  {id:'water',    icon:'💧', name:'Water',              tag:'special'},
  {id:'evening',  icon:'🌆', name:'Evening',            tag:'special'},
  {id:'dinner',   icon:'🌙', name:'Dinner',             tag:''},
  {id:'night',    icon:'🌃', name:'Night routine',      tag:''},
  {id:'prep',     icon:'📦', name:'Prep for tomorrow',  tag:''}
];

export const DEFAULT_HABITS = [
  {id:'lemon',      section:'morning',   name:'Warm lemon water',          note:'1 glass, first thing',         pts:3, order:0},
  {id:'almonds',    section:'morning',   name:'Soaked almonds — 5 pieces', note:'Soak tonight',                 pts:3, order:1},
  {id:'walnuts',    section:'morning',   name:'Walnuts — 2 pieces',        note:'',                             pts:2, order:2},
  {id:'amla',       section:'morning',   name:'Amla — 1 piece or juice',   note:'Vitamin C',                   pts:3, order:3},
  {id:'facewash_am',section:'skin_am',   name:'Face wash',                 note:'',                             pts:2, order:0},
  {id:'moisturizer',section:'skin_am',   name:'Moisturizer',               note:'',                             pts:2, order:1},
  {id:'sunscreen',  section:'skin_am',   name:'Sunscreen',                 note:'If going outside',             pts:2, order:2},
  {id:'eggs',       section:'breakfast', name:'2 eggs',                    note:'Protein for hair + skin',      pts:4, order:0},
  {id:'fruit_am',   section:'breakfast', name:'1 fruit',                   note:'Banana / apple / papaya',      pts:3, order:1},
  {id:'dal_lunch',  section:'lunch',     name:'Dal + vegetables + 1-2 roti',note:'',                           pts:4, order:0},
  {id:'curd',       section:'lunch',     name:'1 bowl curd',               note:'Gut health',                   pts:3, order:1},
  {id:'dinner',     section:'dinner',    name:'Roti + vegetables only',    note:'No fried food at night',       pts:3, order:0},
  {id:'facewash_pm',section:'night',     name:'Face wash + moisturizer',   note:'',                             pts:2, order:0},
  {id:'hair_tablets',section:'night',    name:'Take hair tablets',         note:'With water after dinner',      pts:4, order:1},
  {id:'keto',       section:'night',     name:'Ketoconazole shampoo',      note:'2x per week — leave 5 min',   pts:3, order:2},
  {id:'revision',   section:'night',     name:'Revision in bed',           note:'Read notes before sleeping',   pts:6, order:3},
  {id:'sleep',      section:'night',     name:'Sleep by 9:30-10 PM',       note:'',                             pts:4, order:4},
  {id:'soak',       section:'prep',      name:'Soak 5 almonds overnight',  note:'',                             pts:2, order:0},
  {id:'prep_seeds', section:'prep',      name:'Keep chia / flax seeds ready',note:'',                          pts:2, order:1}
];

export const DEFAULT_REMINDERS = [
  {id:'r1',title:'Good morning!',   msg:'Lemon water, almonds & amla!',   time:'06:30',icon:'🌅',days:[0,1,2,3,4,5,6],enabled:true},
  {id:'r2',title:'Study time',      msg:'4 hours — no phone!',            time:'10:00',icon:'📚',days:[1,2,3,4,5],    enabled:true},
  {id:'r3',title:'Drink water',     msg:'Have you had enough water?',     time:'14:00',icon:'💧',days:[0,1,2,3,4,5,6],enabled:true},
  {id:'r4',title:'Evening snack',   msg:'Fruit or seeds before 6 PM',     time:'17:00',icon:'🍎',days:[0,1,2,3,4,5,6],enabled:true},
  {id:'r5',title:'Take hair tablets',msg:"Don't forget after dinner!",   time:'21:00',icon:'💊',days:[0,1,2,3,4,5,6],enabled:true},
  {id:'r6',title:'Sleep time',      msg:'Wind down. Revise & sleep by 10',time:'21:30',icon:'🌙',days:[0,1,2,3,4,5,6],enabled:true}
];

// ─── App state singleton ───────────────────────────────────────────────────

/**
 * The single mutable state object. All modules import this reference.
 * Never reassign `state` itself — only mutate its properties.
 */
export let state = {};

/**
 * Returns a fresh default state object.
 */
export function defaultState() {
  const now = new Date();
  return {
    lastDate:'', lastResetTimestamp:0,
    checks:{}, water:0, pts:0, totalPts:0,
    earnedBadges:[], missedBannerDismissedDate:'',
    missedTasksAlertTime:'21:00',
    engStreak:0, lastEngDate:'', engReadDone:false, engSpeakDone:false,
    engSpeakStreak:0, engSpeakLastDate:'', engLearnDone:false,
    engLearnStreak:0, engLearnLastDate:'',
    hiReadDone:false, hiReadStreak:0, hiReadLastDate:'',
    hiSpeakDone:false, hiSpeakStreak:0, hiSpeakLastDate:'',
    hiLearnDone:false, hiLearnStreak:0, hiLearnLastDate:'',
    ctSkills:{sql:0,tools:0,proj:0,intv:0},
    ctStudyHrs:0, ctDayDone:false, ctTodayLogged:false,
    ctTotalDays:0, ctStreakDays:0, ctStreakLastDate:null,
    ctLastDate:null, ctLastStudyDate:null,
    ctDayHistory:{}, ctConsecutiveRestDays:0,
    ctTasks:[], ctTasksUpdatedAt:0,
    ctLog:[], ctLogUpdatedAt:0,
    ctWeeklyHours:{},
    junkLog:[], sugarLog:[], biryLog:[],
    weeklyGrams:0, sugarWeekStart:sugarWeekStartOf(now),
    jnkViewMonth:now.getMonth(), jnkViewYear:now.getFullYear(),
    jBViewM:now.getMonth(), jBViewY:now.getFullYear(),
    weeklyTasks:[], weeklyTasksResetDate:'',
    waterLog:{}, wtReminderInterval:60,
    wtReminderTime:null, wtReminderEnabled:false,
    wtLastReminderFired:null,
    habits:[], sections:[], reminders:[],
    deletedReminderIds:[],
    habitsUpdatedAt:0, sectionsUpdatedAt:0, remindersUpdatedAt:0
  };
}

/**
 * Assigns default values for any missing state fields.
 * Safe to call multiple times.
 */
export function ensureDefaults() {
  if (!state.habits||!state.habits.length)   state.habits   = JSON.parse(JSON.stringify(DEFAULT_HABITS));
  if (!state.sections||!state.sections.length) state.sections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
  if (!state.reminders||!state.reminders.length) state.reminders = JSON.parse(JSON.stringify(DEFAULT_REMINDERS));

  if (!state.ctSkills||typeof state.ctSkills!=='object')
    state.ctSkills = {sql:0,tools:0,proj:0,intv:0};

  CT_SKILL_KEYS.forEach(k=>{
    if (typeof state.ctSkills[k]!=='number'||isNaN(state.ctSkills[k])) state.ctSkills[k]=0;
    state.ctSkills[k] = Math.max(0,Math.min(100,state.ctSkills[k]));
  });

  // Array guards
  ['ctTasks','ctLog','junkLog','sugarLog','biryLog','weeklyTasks','earnedBadges','deletedReminderIds']
    .forEach(k=>{ if (!Array.isArray(state[k])) state[k]=[]; });

  // Object guards
  ['ctWeeklyHours','waterLog','ctDayHistory','checks']
    .forEach(k=>{ if (!state[k]||typeof state[k]!=='object') state[k]={}; });

  // Number guards
  ['ctConsecutiveRestDays','ctStreakDays','ctTotalDays',
   'habitsUpdatedAt','sectionsUpdatedAt','remindersUpdatedAt',
   'ctTasksUpdatedAt','ctLogUpdatedAt','lastResetTimestamp']
    .forEach(k=>{ if (typeof state[k]!=='number') state[k]=0; });

  if (!validateTimeString(state.missedTasksAlertTime)) state.missedTasksAlertTime='21:00';
  if (!state.sugarWeekStart) state.sugarWeekStart=sugarWeekStartOf(new Date());
  if (state.wtReminderInterval===undefined) state.wtReminderInterval=60;
  if (state.wtReminderTime===undefined) state.wtReminderTime=null;
  if (state.wtReminderEnabled===undefined) state.wtReminderEnabled=false;
  if (state.wtLastReminderFired===undefined) state.wtLastReminderFired=null;
  if (state.ctTodayLogged===undefined) state.ctTodayLogged=false;
  if (state.ctStreakLastDate===undefined) state.ctStreakLastDate=null;
  if (state.ctLastStudyDate===undefined) state.ctLastStudyDate=null;

  state.habits.forEach((h,i)=>{ if (h.order===undefined) h.order=i; });

  // Ensure IDs on log entries
  state.junkLog.forEach(e=>{ if(!e.id) e.id=genId(); });
  state.sugarLog.forEach(e=>{ if(!e.id) e.id=genId(); });
  state.biryLog.forEach(b=>{
    if (!b.entries) b.entries=[];
    b.entries.forEach(e=>{ if(!e.id) e.id=genId(); });
    b.count = b.entries.length;
  });

  // Array size caps
  if (state.junkLog.length>MAX_JUNK_LOG)     state.junkLog     = state.junkLog.slice(-MAX_JUNK_LOG);
  if (state.sugarLog.length>MAX_SUGAR_LOG)   state.sugarLog    = state.sugarLog.slice(-MAX_SUGAR_LOG);
  if (state.ctTasks.length>MAX_CT_TASKS)     state.ctTasks     = state.ctTasks.slice(-MAX_CT_TASKS);
  if (state.weeklyTasks.length>MAX_WEEKLY_TASKS) state.weeklyTasks = state.weeklyTasks.slice(-MAX_WEEKLY_TASKS);
  if (state.deletedReminderIds.length>100)   state.deletedReminderIds = state.deletedReminderIds.slice(-100);

  // Day history size cap + validation
  const validDateRe  = /^\d{4}-\d{2}-\d{2}$/;
  const validValues  = new Set(['complete','partial','rest']);
  Object.keys(state.ctDayHistory).forEach(k=>{
    if (!validDateRe.test(k)||!validValues.has(state.ctDayHistory[k]))
      delete state.ctDayHistory[k];
  });
  const histKeys = Object.keys(state.ctDayHistory).sort();
  if (histKeys.length>MAX_DAY_HISTORY)
    histKeys.slice(0,histKeys.length-MAX_DAY_HISTORY).forEach(k=>delete state.ctDayHistory[k]);

  // Prune old waterLog entries (>30 days)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
  const cutoffKey = cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
  Object.keys(state.waterLog).forEach(k=>{ if(k<cutoffKey) delete state.waterLog[k]; });

  // Prune old ctWeeklyHours (>14 days)
  const wCutoff = new Date(); wCutoff.setDate(wCutoff.getDate()-14);
  const wCutoffKey = wCutoff.getFullYear()+'-'+String(wCutoff.getMonth()+1).padStart(2,'0')+'-'+String(wCutoff.getDate()).padStart(2,'0');
  Object.keys(state.ctWeeklyHours).forEach(k=>{ if(k<wCutoffKey) delete state.ctWeeklyHours[k]; });
}

/**
 * Replaces all state properties with values from `newState`.
 * Used after loading from localStorage or Firebase.
 */
export function applyState(newState) {
  Object.keys(state).forEach(k=>delete state[k]);
  Object.assign(state, defaultState(), newState);
}

// ─── Import validateTimeString locally (avoid circular import) ──────────────

function validateTimeString(val) {
  if (!val||typeof val!=='string') return false;
  const parts = val.split(':');
  if (parts.length!==2) return false;
  const h = parseInt(parts[0],10), m = parseInt(parts[1],10);
  return !isNaN(h)&&!isNaN(m)&&h>=0&&h<=23&&m>=0&&m<=59;
}

// ─── Window exports ──────────────────────────────────────────────────────────

Object.assign(window, {
  state, defaultState, ensureDefaults, applyState,
  DB_KEY, DB_KEY_FIRED, DB_KEY_MIDNIGHT,
  CT_HOUR_GOAL, CT_WEEK_GOAL, CT_TARGET_DATE, CT_LOG_LIMIT,
  CT_XP_PER_HOUR, CT_SKILL_KEYS, WT_GOAL, WT_ML, DAILY_HOUR_GOAL,
  MAX_JUNK_LOG, MAX_SUGAR_LOG, MAX_CT_TASKS, MAX_WEEKLY_TASKS
});
