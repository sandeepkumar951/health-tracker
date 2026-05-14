/* ═══════════════════════════════════════════════════════════════
   core/init.js
   Application entry point and orchestrator.
   Imports from every module and runs the full startup sequence.
   Nothing else should call init() — only DOMContentLoaded.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CORE IMPORTS
───────────────────────────────────────────────────────────────*/
import {
  state,
  defaultState,
  ensureDefaults,
  resetAllFlags,
  /* flags */
  saveDebounceTimer,  setSaveDebounceTimer,
  wtPropRAF,          setWtPropRAF,
  wtIdleTmr,          setWtIdleTmr,
  wtRemTimer,         setWtRemTimer,
  wtRemNextTimeout,   setWtRemNextTimeout,
  _ctCdInterval,      setCtCdInterval,
  inAppTimeoutId,     setInAppTimeoutId,
  masterTimerId,      setMasterTimerId,
  masterTickCount,    setMasterTickCount,
  _configSyncTimer,   setConfigSyncTimer,
  badgeCheckTimer,    setBadgeCheckTimer,
  _settingsNeedRebuild, setSettingsNeedRebuild,
  _lastThemeKey,        setLastThemeKey,
  _reminderFirstCheck,  setReminderFirstCheck,
  _lastStreakMilestone, setLastStreakMilestone,
  _lastSaveTimestamp,   setLastSaveTimestamp,
  _lastRemoteSavedAt,   setLastRemoteSavedAt,
  _syncMergeInProgress, setSyncMergeInProgress,
  _dailyListenerRef,    setDailyListenerRef,
  _dailyListenerCb,     setDailyListenerCb,
  _configListenerRef,   setConfigListenerRef,
  _configListenerCb,    setConfigListenerCb,
  _connectedListenerCb, setConnectedListenerCb,
  _ctDayCompletedThisSession, setCtDayCompletedThisSession,
  _wtAppOpenTime,       setWtAppOpenTime,
  deferredInstallPrompt,
  setDeferredInstallPrompt,
  firedToday, setFiredToday,
  wtFilter,   setWtFilter,
  wtSceneInitialized, setWtSceneInitialized,
  jnkSelected,        setJnkSelected,
  jnkGridBuilt,       setJnkGridBuilt,
  saveFailCount,      setSaveFailCount,
  ctPageBuilt,        setCtPageBuilt,
  cachedSceneHeight,  setCachedSceneHeight,
  biryaniLogInFlight, setBiryaniLogInFlight,
  confettiLock,       setConfettiLock,
  wtDone,             setWtDone,
  selDays,            setSelDays,
  DB_KEY,
  DB_KEY_MIDNIGHT,
  DB_KEY_FIRED
} from './state.js';

import {
  todayKey,
  loadFiredToday,
  saveFiredToday,
  showToast,
  updateFbStatus,
  checkCriticalDomElements,
  checkStorageQuota,
  injectPrintStyles,
  safeLocalStorageSave,
  getDeviceId,
  sanitizeHTML
} from './utils.js';

import {
  rtdb,
  load,
  save,
  debouncedSave,
  startRealtimeSync,
  detachAllListeners,
  handleDailyReset,
  convertDayTasks,
  scheduleMidnightReset,
  ctCleanWeeklyHours,
  cleanOrphanEntries,
  forceSyncAll,
  applyDailyDoc,
  applyConfigDoc
} from './firebase.js';

/* ─────────────────────────────────────────────────────────────
   SHARED IMPORTS
───────────────────────────────────────────────────────────────*/
import {
  applyTheme,
  updateReward,
  updateSummaryCards,
  updateStatsBanner,
  checkStreakMilestone,
  _updateFooterChips
} from '../shared/theme.js';

import {
  checkBadgesDebounced,
  BADGES
} from '../shared/badges.js';

import {
  renderWater,
  wtRemInit,
  renderHydrationInsights
} from '../shared/water.js';

/* ─────────────────────────────────────────────────────────────
   TAB IMPORTS
───────────────────────────────────────────────────────────────*/
import {
  rebuildTodaySections,
  applyChecks,
  updateProg,
  toggle,
  checkMissedTasksBanner,
  closeMissedBanner,
  renderTodayWeeklyPanel,
  renderHomeReminders,
  resetToday,
  buildEveningSection,
  openBadges,
  closeBadges,
  openEditModal,
  saveEditHabit,
  closeEditModal,
  moveHabitUp,
  moveHabitDown,
  addNewHabit,
  deleteHabit,
  addNewSection,
  deleteSection,
  getHabitIconHtml,
  openIconPicker,
  switchIconMode,
  handleIconUpload,
  confirmIconPick,
  closeIconPicker,
  scrollToAddHabit
} from '../tabs/today.js';

import {
  ctInit,
  ctRenderAll,
  ctRenderHero,
  ctEvaluateStreak,
  ctDailyReset,
  ctAddHour,
  ctRemoveHour,
  ctAddHourAndSkill,
  ctRemoveHourAndSkill,
  ctCompleteDay,
  ctSelectTag,
  ctAddTask,
  ctToggleTask,
  ctRemoveTask,
  ctClearLog,
  ctResetAll,
  ctNewQuote,
  ctGetTodayHrs,
  ctOverallPct,
  ctStartCountdown
} from '../tabs/career.js';

import {
  renderLangUI,
  resetDailyLangFlags,
  hiMarkRead,
  hiMarkSpeak,
  hiMarkLearn,
  engMarkRead,
  engMarkSpeak,
  engMarkLearn
} from '../tabs/english.js';

import {
  jnkBuildCatGrid,
  jnkRenderChips,
  jnkRenderAll,
  jnkLogItems,
  jnkDeleteEntry,
  jnkRemoveChip,
  jnkToggleCat,
  jnkSetQty,
  jnkChangeMonth,
  jnkOpenSummary,
  jRenderSugar,
  jRenderBiryani,
  jRenderLogs,
  jCheckWeekReset,
  jAddSugar,
  jAddManualSugar,
  jDeleteSugar,
  jSwitchLog,
  jLogBiryani,
  jDeleteBiryani,
  jChangeBMonth,
  openBiryaniConfirm,
  confirmBiryaniLog,
  closeBiryaniConfirm
} from '../tabs/junk.js';

import {
  wtRenderTasks,
  wtAddTask,
  wtToggleTask,
  wtDeleteTask,
  wtOpenEdit,
  saveWeeklyEdit,
  closeWeeklyEditModal,
  wtSetFilter,
  wtClearDone,
  wtResetWeek,
  wtSetDayPreset,
  wtCheckWeekReset
} from '../tabs/weekly.js';

import {
  buildDaysPicker,
  buildPresetChips,
  renderReminderList,
  addReminder,
  toggleReminder,
  deleteReminder,
  updateNotifStatusUI,
  requestNotifPermission,
  fireNotification,
  checkReminders,
  showInAppNotif,
  closeInApp
} from '../tabs/reminders.js';

import {
  buildSettingsPage,
  buildSettingsPageShell,
  updateMissedAlertDisplay,
  saveMissedAlertTime,
  setMissedAlertPreset
} from '../tabs/settings.js';

import {
  registerInlineServiceWorker,
  showPWAInstallBanner,
  installPWA
} from '../shared/pwa.js';

/* ─────────────────────────────────────────────────────────────
   EXPOSE GLOBALS
   All public functions must be on window so that any remaining
   inline onclick="" handlers in index.html still work.
   As you clean up the HTML you can remove entries from here.
───────────────────────────────────────────────────────────────*/
function exposeGlobals() {
  /* Core */
  window.state              = state;
  window.save               = save;
  window.debouncedSave      = debouncedSave;
  window.forceSyncAll       = forceSyncAll;
  window.todayKey           = todayKey;
  window.showToast          = showToast;
  window.applyDailyDoc      = applyDailyDoc;
  window.applyConfigDoc     = applyConfigDoc;

  /* Theme / rewards */
  window.applyTheme         = applyTheme;
  window.updateReward       = updateReward;
  window.updateSummaryCards = updateSummaryCards;
  window.updateStatsBanner  = updateStatsBanner;
  window.checkStreakMilestone = checkStreakMilestone;
  window._updateFooterChips = _updateFooterChips;
  window.checkBadgesDebounced = checkBadgesDebounced;
  window.BADGES             = BADGES;

  /* Water */
  window.renderWater        = renderWater;
  window.renderHydrationInsights = renderHydrationInsights;

  /* Today tab */
  window.toggle             = toggle;
  window.applyChecks        = applyChecks;
  window.updateProg         = updateProg;
  window.resetToday         = resetToday;
  window.rebuildTodaySections = rebuildTodaySections;
  window.renderTodayWeeklyPanel = renderTodayWeeklyPanel;
  window.renderHomeReminders  = renderHomeReminders;
  window.checkMissedTasksBanner = checkMissedTasksBanner;
  window.closeMissedBanner  = closeMissedBanner;
  window.openBadges         = openBadges;
  window.closeBadges        = closeBadges;
  window.openEditModal      = openEditModal;
  window.saveEditHabit      = saveEditHabit;
  window.closeEditModal     = closeEditModal;
  window.moveHabitUp        = moveHabitUp;
  window.moveHabitDown      = moveHabitDown;
  window.addNewHabit        = addNewHabit;
  window.deleteHabit        = deleteHabit;
  window.addNewSection      = addNewSection;
  window.deleteSection      = deleteSection;
  window.openIconPicker     = openIconPicker;
  window.switchIconMode     = switchIconMode;
  window.handleIconUpload   = handleIconUpload;
  window.confirmIconPick    = confirmIconPick;
  window.closeIconPicker    = closeIconPicker;
  window.scrollToAddHabit   = scrollToAddHabit;
  window.getHabitIconHtml   = getHabitIconHtml;

  /* Career tab */
  window.ctInit             = ctInit;
  window.ctRenderAll        = ctRenderAll;
  window.ctAddHour          = ctAddHour;
  window.ctRemoveHour       = ctRemoveHour;
  window.ctAddHourAndSkill  = ctAddHourAndSkill;
  window.ctRemoveHourAndSkill = ctRemoveHourAndSkill;
  window.ctCompleteDay      = ctCompleteDay;
  window.ctSelectTag        = ctSelectTag;
  window.ctAddTask          = ctAddTask;
  window.ctToggleTask       = ctToggleTask;
  window.ctRemoveTask       = ctRemoveTask;
  window.ctClearLog         = ctClearLog;
  window.ctResetAll         = ctResetAll;
  window.ctNewQuote         = ctNewQuote;
  window.ctStartCountdown   = ctStartCountdown;
  window.ctGetTodayHrs      = ctGetTodayHrs;
  window.ctOverallPct       = ctOverallPct;

  /* English tab */
  window.renderLangUI       = renderLangUI;
  window.hiMarkRead         = hiMarkRead;
  window.hiMarkSpeak        = hiMarkSpeak;
  window.hiMarkLearn        = hiMarkLearn;
  window.engMarkRead        = engMarkRead;
  window.engMarkSpeak       = engMarkSpeak;
  window.engMarkLearn       = engMarkLearn;

  /* Junk tab */
  window.jnkBuildCatGrid    = jnkBuildCatGrid;
  window.jnkRenderChips     = jnkRenderChips;
  window.jnkRenderAll       = jnkRenderAll;
  window.jnkLogItems        = jnkLogItems;
  window.jnkDeleteEntry     = jnkDeleteEntry;
  window.jnkRemoveChip      = jnkRemoveChip;
  window.jnkToggleCat       = jnkToggleCat;
  window.jnkSetQty          = jnkSetQty;
  window.jnkChangeMonth     = jnkChangeMonth;
  window.jnkOpenSummary     = jnkOpenSummary;
  window.jRenderSugar       = jRenderSugar;
  window.jRenderBiryani     = jRenderBiryani;
  window.jRenderLogs        = jRenderLogs;
  window.jAddSugar          = jAddSugar;
  window.jAddManualSugar    = jAddManualSugar;
  window.jDeleteSugar       = jDeleteSugar;
  window.jSwitchLog         = jSwitchLog;
  window.jLogBiryani        = jLogBiryani;
  window.jDeleteBiryani     = jDeleteBiryani;
  window.jChangeBMonth      = jChangeBMonth;
  window.openBiryaniConfirm = openBiryaniConfirm;
  window.confirmBiryaniLog  = confirmBiryaniLog;
  window.closeBiryaniConfirm= closeBiryaniConfirm;

  /* Weekly tab */
  window.wtRenderTasks      = wtRenderTasks;
  window.wtAddTask          = wtAddTask;
  window.wtToggleTask       = wtToggleTask;
  window.wtDeleteTask       = wtDeleteTask;
  window.wtOpenEdit         = wtOpenEdit;
  window.saveWeeklyEdit     = saveWeeklyEdit;
  window.closeWeeklyEditModal = closeWeeklyEditModal;
  window.wtSetFilter        = wtSetFilter;
  window.wtClearDone        = wtClearDone;
  window.wtResetWeek        = wtResetWeek;
  window.wtSetDayPreset     = wtSetDayPreset;

  /* Reminders tab */
  window.buildDaysPicker    = buildDaysPicker;
  window.addReminder        = addReminder;
  window.toggleReminder     = toggleReminder;
  window.deleteReminder     = deleteReminder;
  window.requestNotifPermission = requestNotifPermission;
  window.fireNotification   = fireNotification;
  window.showInAppNotif     = showInAppNotif;
  window.closeInApp         = closeInApp;

  /* Settings tab */
  window.buildSettingsPage  = buildSettingsPage;
  window.updateMissedAlertDisplay = updateMissedAlertDisplay;
  window.saveMissedAlertTime      = saveMissedAlertTime;
  window.setMissedAlertPreset     = setMissedAlertPreset;

  /* PWA */
  window.installPWA         = installPWA;
  window.showPWAInstallBanner = showPWAInstallBanner;

  /* Factory reset */
  window.confirmFactoryReset = confirmFactoryReset;
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION
   Reads data-page from nav buttons — no inline onclick needed.
───────────────────────────────────────────────────────────────*/
function setupNavigation() {

  /* Nav button clicks */
  document.querySelectorAll('.nb[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      showPage(btn.dataset.page, btn);
    });
  });

  /* Stats banner nav clicks */
  document.querySelectorAll('[data-nav-to]').forEach(el => {
    el.addEventListener('click', () => {
      const page   = el.dataset.navTo;
      const navBtn = document.querySelector('.nb[data-page="' + page + '"]');
      if (navBtn) showPage(page, navBtn);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  /* "View All" weekly tasks button on Today tab */
  const viewAllBtn = document.querySelector('[data-page="weekly"].nb-inline');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      const navBtn = document.querySelector('.nb[data-page="weekly"]');
      if (navBtn) showPage('weekly', navBtn);
    });
  }

  /* Handle deep link from URL hash on load */
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) {
    const validPages = [
      'today', 'study', 'english', 'junk', 'weekly', 'reminders', 'settings'
    ];
    if (validPages.includes(hash)) {
      setTimeout(() => {
        const navBtn = document.querySelector('.nb[data-page="' + hash + '"]');
        if (navBtn) showPage(hash, navBtn);
      }, 300);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   showPage
   Switches the visible page and runs any tab-specific setup.
───────────────────────────────────────────────────────────────*/
export function showPage(id, btn) {
  const prevPage = document.querySelector('.page.active');
  const prevId   = prevPage ? prevPage.id.replace('page-', '') : '';

  /* Cancel water animation when leaving Today */
  if (prevId === 'today' && id !== 'today') {
    if (wtPropRAF)  { cancelAnimationFrame(wtPropRAF); setWtPropRAF(null); }
    if (wtIdleTmr)  { clearInterval(wtIdleTmr); setWtIdleTmr(null); }
  }

  /* Cancel career countdown when leaving Study */
  if (prevId === 'study' && id !== 'study') {
    if (_ctCdInterval) { clearInterval(_ctCdInterval); setCtCdInterval(null); }
  }

  /* Deactivate all pages and nav buttons */
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });

  /* Activate target page */
  const page = document.getElementById('page-' + id);
  if (page) {
    page.classList.add('active');
    page.classList.add('page-switching');
    setTimeout(() => page.classList.remove('page-switching'), 250);
  }

  /* Activate nav button */
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
  }

  /* Tab-specific setup */
  switch (id) {

    case 'today':
      /* Restart water animation */
      if (document.getElementById('wt-scene')) {
        import('../shared/water.js').then(m => {
          if (!wtPropRAF && m._wtStartAnimation) m._wtStartAnimation();
          if (wtIdleTmr) { clearInterval(wtIdleTmr); setWtIdleTmr(null); }
          if ((state.water || 0) > 0 && !wtDone) {
            const tmr = setInterval(() => {
              if (state.water > 0 && !wtDone && m.wtBubbles) m.wtBubbles(0);
            }, 3200);
            setWtIdleTmr(tmr);
          }
        });
      }
      _rebuildEveningIfNeeded();
      renderTodayWeeklyPanel();
      renderHomeReminders();
      break;

    case 'study':
      ctInit();
      break;

    case 'english':
      renderLangUI();
      break;

    case 'junk':
      state.jnkViewMonth = new Date().getMonth();
      state.jnkViewYear  = new Date().getFullYear();
      jnkBuildCatGrid();
      jnkRenderChips();
      jnkRenderAll();
      jRenderSugar();
      jRenderBiryani();
      jRenderLogs();
      setTimeout(() => {
        const jPage = document.getElementById('page-junk');
        if (jPage) jPage.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
      break;

    case 'weekly':
      wtRenderTasks();
      break;

    case 'reminders':
      setSelDays([0,1,2,3,4,5,6]);
      buildDaysPicker();
      /* Reset form fields */
      const rt    = document.getElementById('r-title');  if (rt)    rt.value = '';
      const rm    = document.getElementById('r-msg');    if (rm)    rm.value = '';
      const rtime = document.getElementById('r-time');   if (rtime) rtime.value = '08:00';
      const ri    = document.getElementById('r-icon');   if (ri)    ri.selectedIndex = 0;
      updateNotifStatusUI();
      renderReminderList();
      break;

    case 'settings':
      setSettingsNeedRebuild(true);
      buildSettingsPage();
      break;
  }

  try { window.location.hash = id; } catch (e) {}
}
window.showPage = showPage;

/* ─────────────────────────────────────────────────────────────
   EVENING SECTION REBUILD GUARD
   Only rebuilds when weekend status actually changes.
───────────────────────────────────────────────────────────────*/
let _lastEveningWasWeekend = null;

function _rebuildEveningIfNeeded() {
  const isWeekend = (() => {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  })();

  if (_lastEveningWasWeekend === isWeekend) return;
  _lastEveningWasWeekend = isWeekend;

  const existing = document.getElementById('eve-list');
  if (existing) {
    const card = existing.closest('.sc');
    if (card) card.remove();
  }

  const container = document.getElementById('today-sections');
  if (container) {
    container.appendChild(buildEveningSection());
    applyChecks();
  }
}

/* ─────────────────────────────────────────────────────────────
   MASTER TIMER
   Runs every 30 seconds. Handles reminders, theme refresh,
   stats update, streak milestones, and settings rebuild.
───────────────────────────────────────────────────────────────*/
function startMasterTimer() {
  if (masterTimerId) { clearInterval(masterTimerId); setMasterTimerId(null); }
  setMasterTickCount(0);

  const timerId = setInterval(() => {
    if (document.hidden) return;

    setMasterTickCount(masterTickCount + 1);

    /* Every tick (30 s) */
    checkReminders();

    /* Every 2 ticks (60 s) */
    if (masterTickCount % 2 === 0) {
      applyTheme();
      renderHomeReminders();
      ctRenderHero();
    }

    /* Every 10 ticks (5 min) */
    if (masterTickCount % 10 === 0) {
      updateStatsBanner();
      checkStreakMilestone();
      ctCleanWeeklyHours();
      try { jCheckWeekReset(); } catch (e) {}
    }

    /* Rebuild settings only when flagged AND page is active */
    if (masterTickCount % 10 === 0 && _settingsNeedRebuild) {
      const sp = document.getElementById('page-settings');
      if (sp && sp.classList.contains('active')) buildSettingsPage();
    }

    /* Overflow guard */
    if (masterTickCount > 100000) setMasterTickCount(0);

  }, 30000);

  setMasterTimerId(timerId);
}

/* ─────────────────────────────────────────────────────────────
   LIGHTWEIGHT UI REFRESH
   Called by Firebase realtime sync on remote changes.
───────────────────────────────────────────────────────────────*/
function refreshUILightweight() {
  applyChecks();
  updateProg();
  updateReward();
  updateSummaryCards();
  renderHomeReminders();
  renderWater();
  updateStatsBanner();

  if (document.getElementById('ct-root')) ctRenderAll();

  renderLangUI();
  jnkRenderAll();
  jRenderSugar();
  jRenderBiryani();
  _updateFooterChips();
}
window.refreshUILightweight = refreshUILightweight;

/* ─────────────────────────────────────────────────────────────
   FULL UI REFRESH
   Called after midnight reset or factory reset.
───────────────────────────────────────────────────────────────*/
function refreshUI() {
  refreshUILightweight();
  rebuildTodaySections();
  applyChecks();
  renderLangUI();
  renderReminderList();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  jRenderLogs();
  updateMissedAlertDisplay();
  applyTheme();
}
window.refreshUI = refreshUI;

/* ─────────────────────────────────────────────────────────────
   CUSTOM EVENT LISTENERS
   Firebase module fires these events to communicate with
   tab modules without creating circular imports.
───────────────────────────────────────────────────────────────*/
function setupCustomEventListeners() {

  window.addEventListener('sandy:refreshLightweight', () => {
    refreshUILightweight();
  });

  window.addEventListener('sandy:refreshFull', () => {
    refreshUI();
  });

  window.addEventListener('sandy:configRebuild', () => {
    _handleConfigSyncRebuild();
  });

  window.addEventListener('sandy:evaluateStreak', () => {
    ctEvaluateStreak();
  });

  window.addEventListener('sandy:resetLangFlags', () => {
    resetDailyLangFlags();
  });

  window.addEventListener('sandy:junkWeekReset', () => {
    try { jCheckWeekReset(); } catch (e) {}
  });

  window.addEventListener('sandy:weeklyTasksReset', () => {
    try { wtCheckWeekReset(); } catch (e) {}
  });

  window.addEventListener('sandy:updateStatsBanner', () => {
    updateStatsBanner();
  });
}

/* ─────────────────────────────────────────────────────────────
   CONFIG SYNC REBUILD
   Surgically rebuilds only the sections that changed.
───────────────────────────────────────────────────────────────*/
function _handleConfigSyncRebuild() {
  const container = document.getElementById('today-sections');
  if (!container) return;

  /* Re-render reminders list */
  renderReminderList();
  renderHomeReminders();

  /* Rebuild settings if open */
  const sp = document.getElementById('page-settings');
  if (sp && sp.classList.contains('active')) buildSettingsPage();

  /* Determine if full rebuild is needed */
  const domSections = new Set();
  container.querySelectorAll('[id^="sec-"]').forEach(el => {
    domSections.add(el.id.replace('sec-', ''));
  });

  const expectedSections = new Set();
  (state.sections || []).forEach(sec => {
    if (sec.tag === 'special') return;
    const habits = (state.habits || []).filter(h => h.section === sec.id);
    if (habits.length > 0) expectedSections.add(sec.id);
  });

  let needsFullRebuild = false;
  expectedSections.forEach(id => { if (!domSections.has(id)) needsFullRebuild = true; });
  domSections.forEach(id     => { if (!expectedSections.has(id)) needsFullRebuild = true; });

  if (needsFullRebuild) {
    rebuildTodaySections();
  } else {
    /* Surgical per-section rebuild */
    expectedSections.forEach(id => {
      const secEl     = document.getElementById('sec-' + id);
      if (!secEl) return;
      const domCount  = secEl.querySelectorAll('.ci').length;
      const stateCount= (state.habits || []).filter(h => h.section === id).length;
      if (domCount !== stateCount) {
        import('../tabs/today.js').then(m => {
          if (m.rebuildSection) m.rebuildSection(id);
        });
      }
    });
  }

  applyChecks();
}

/* ─────────────────────────────────────────────────────────────
   VISIBILITY CHANGE
   Handles tab coming back into focus.
───────────────────────────────────────────────────────────────*/
function setupVisibilityChange() {
  document.addEventListener('visibilitychange', async () => {

    /* ── Hidden ── */
    if (document.hidden) {
      setConfettiLock(false);
      try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) {}

      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        setSaveDebounceTimer(null);
        save();
      }

      /* Archive study hours before hiding */
      if (
        (state.ctStudyHrs || 0) > 0 &&
        state.ctLastStudyDate &&
        state.ctLastStudyDate === todayKey()
      ) {
        if (!state.ctWeeklyHours) state.ctWeeklyHours = {};
        const key = state.ctLastStudyDate;
        if (state.ctStudyHrs > (state.ctWeeklyHours[key] || 0)) {
          state.ctWeeklyHours[key] = state.ctStudyHrs;
          debouncedSave(200);
        }
      }
      return;
    }

    /* ── Visible again ── */
    setWtAppOpenTime(Date.now());
    applyTheme();

    const today = todayKey();

    /* Date changed while app was hidden */
    if (state.lastDate !== today) {
      const storedKey = localStorage.getItem(DB_KEY_MIDNIGHT + 'lastFired') || '';
      if (storedKey === today) {
        refreshUI();
        return;
      }

      /* Archive + streak + reset */
      if ((state.ctStudyHrs || 0) > 0 && state.ctLastStudyDate) {
        if (!state.ctWeeklyHours) state.ctWeeklyHours = {};
        state.ctWeeklyHours[state.ctLastStudyDate] = Math.max(
          state.ctWeeklyHours[state.ctLastStudyDate] || 0,
          state.ctStudyHrs
        );
      }
      if (state.lastDate && state.ctDayHistory && !state.ctDayHistory[state.lastDate]) {
        state.ctDayHistory[state.lastDate] =
          state.ctDayDone              ? 'complete' :
          (state.ctStudyHrs || 0) > 0  ? 'partial'  : 'rest';
      }

      ctEvaluateStreak();

      state.checks                   = {};
      state.water                    = 0;
      state.pts                      = 0;
      state.ctDayDone                = false;
      state.ctStudyHrs               = 0;
      state.ctTodayLogged            = false;
      state.ctLastStudyDate          = null;
      state.missedBannerDismissedDate= '';
      state.lastResetTimestamp       = Date.now();

      setFiredToday({});
      setWtFilter('all');
      setWtSceneInitialized(false);
      setJnkSelected({});
      setJnkGridBuilt(false);
      setSaveFailCount(0);
      setCtPageBuilt(false);
      setCachedSceneHeight(0);
      setReminderFirstCheck(true);

      convertDayTasks();
      resetDailyLangFlags();
      try { jCheckWeekReset();  } catch (e) {}
      try { wtCheckWeekReset(); } catch (e) {}

      safeLocalStorageSave(DB_KEY_MIDNIGHT + 'lastFired', today);
      state.lastDate = today;

      await save();
      refreshUI();

      detachAllListeners();
      startRealtimeSync();

      const b = document.getElementById('banner');
      if (b) { b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 4000); }
      showToast('New day! Checklist reset.', 'gt');
      return;
    }

    /* Normal resume — same day */
    if (state.wtReminderEnabled) {
      import('../shared/water.js').then(m => {
        if (m.wtRemScheduleNext) m.wtRemScheduleNext();
      });
    }

    renderHomeReminders();
    checkReminders();
    updateStatsBanner();
  });
}

/* ─────────────────────────────────────────────────────────────
   EVENT DELEGATION
   Central click handler for data-action attributes.
───────────────────────────────────────────────────────────────*/
function setupEventDelegation() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const id     = el.dataset.id || el.dataset.habitId;

    switch (action) {
      /* Today / habits */
      case 'open-icon-picker':  e.stopPropagation(); openIconPicker(id); break;
      case 'move-habit-up':     e.stopPropagation(); moveHabitUp(id);    break;
      case 'move-habit-down':   e.stopPropagation(); moveHabitDown(id);  break;
      case 'move-up':           moveHabitUp(id);   break;
      case 'move-down':         moveHabitDown(id); break;
      case 'edit-habit':        openEditModal(id); break;
      case 'delete-habit':      deleteHabit(id);   break;
      case 'delete-section':    deleteSection(id); break;

      /* Alert preset */
      case 'set-alert-preset':  setMissedAlertPreset(el.dataset.time); break;

      /* Weekly tasks */
      case 'wt-toggle':   wtToggleTask(id);                         break;
      case 'wt-edit':     wtOpenEdit(id);                           break;
      case 'wt-delete':   wtDeleteTask(id);                         break;
      case 'wt-filter':   wtSetFilter(el, el.dataset.filter);       break;

      /* Career */
      case 'toggle-ct-task':  ctToggleTask(id);                     break;
      case 'delete-ct-task':  ctRemoveTask(id);                     break;
      case 'ct-skill-plus':   ctAddHourAndSkill(el.dataset.skill, el.dataset.label); break;
      case 'ct-skill-minus':  ctRemoveHourAndSkill(el.dataset.skill); break;
      case 'ct-select-tag':   ctSelectTag(el, el.dataset.tag);      break;

      /* Junk */
      case 'jnk-month':        jnkChangeMonth(+el.dataset.dir);         break;
      case 'jnk-qty':          e.stopPropagation(); jnkSetQty(el.dataset.id, +el.dataset.delta); break;
      case 'jnk-remove-chip':  jnkRemoveChip(el.dataset.id);            break;
      case 'jnk-delete':       jnkDeleteEntry(el.dataset.id);           break;
      case 'add-sugar':        jAddSugar(el.dataset.name, el.dataset.icon, +el.dataset.grams); break;
      case 'delete-sugar':     jDeleteSugar(el.dataset.id);             break;
      case 'biry-month':       jChangeBMonth(+el.dataset.dir);          break;
      case 'delete-biryani':   jDeleteBiryani(el.dataset.monthKey, el.dataset.id); break;
      case 'jnk-switch-log':   jSwitchLog(el.dataset.tab);              break;

      /* Reminders */
      case 'toggle-reminder': {
        const idx = +el.dataset.index;
        toggleReminder(idx, el.checked !== undefined ? el.checked : el.dataset.checked === 'true');
        break;
      }
      case 'delete-reminder': deleteReminder(+el.dataset.index); break;

      /* Habit checklist item toggle */
      default: break;
    }
  });

  /* Checklist item toggle — separate handler */
  document.addEventListener('click', e => {
    const ci = e.target.closest('.ci[data-key]');
    if (!ci) return;
    if (e.target.closest('.reorder-btn'))   return;
    if (e.target.closest('.task-emoji'))    return;
    if (e.target.closest('[data-action]'))  return;
    toggle(ci);
  });

  /* Checkbox change (reminder toggles) */
  document.addEventListener('change', e => {
    const inp = e.target;
    if (!inp || inp.type !== 'checkbox') return;
    if (inp.dataset.action === 'toggle-reminder')
      toggleReminder(+inp.dataset.index, inp.checked);
  });
}

/* ─────────────────────────────────────────────────────────────
   KEYBOARD NAVIGATION
───────────────────────────────────────────────────────────────*/
function setupKeyboard() {
  document.addEventListener('keydown', e => {

    /* Enter / Space on checklist items */
    if (e.key === 'Enter' || e.key === ' ') {
      const active = document.activeElement;
      if (!active) return;
      if (active.classList.contains('ci')) {
        e.preventDefault();
        toggle(active);
      }
    }

    /* Escape closes modals */
    if (e.key === 'Escape') {
      const modals = [
        { id: 'biryani-confirm-modal', fn: closeBiryaniConfirm },
        { id: 'badges-modal',          fn: closeBadges          },
        { id: 'edit-modal',            fn: closeEditModal       },
        { id: 'weekly-edit-modal',     fn: closeWeeklyEditModal },
        { id: 'icon-picker-overlay',   fn: closeIconPicker      }
      ];
      for (const m of modals) {
        const el = document.getElementById(m.id);
        if (el && el.classList.contains('open')) { m.fn(); return; }
      }
      const missed = document.getElementById('missed-banner');
      if (missed && missed.classList.contains('show')) closeMissedBanner();
    }
  });

  /* Focus trap inside modals */
  const MODAL_IDS = [
    'badges-modal', 'edit-modal', 'weekly-edit-modal',
    'icon-picker-overlay', 'biryani-confirm-modal'
  ];
  const FOCUSABLE =
    'button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),' +
    '[tabindex]:not([tabindex="-1"])';

  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const open = MODAL_IDS
      .map(id => document.getElementById(id))
      .find(el => el && el.classList.contains('open'));
    if (!open) return;
    const items = Array.from(open.querySelectorAll(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last  = items[items.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  /* Modal scroll lock */
  if (typeof MutationObserver !== 'undefined') {
    MODAL_IDS.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      const mo = new MutationObserver(() => {
        const anyOpen = MODAL_IDS.some(mid => {
          const m = document.getElementById(mid);
          return m && m.classList.contains('open');
        });
        document.body.style.overflow = anyOpen ? 'hidden' : '';
      });
      mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   SWIPE NAVIGATION
───────────────────────────────────────────────────────────────*/
function setupSwipeNav() {
  const PAGE_ORDER = [
    'today', 'study', 'english', 'junk', 'weekly', 'reminders', 'settings'
  ];
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;

  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartT = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dt = Date.now() - touchStartT;

    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) || dt > 400) return;

    const scrollable = e.target.closest(
      '.stats-banner, nav, .weekly-filter-row, .wt-glasses-row, .ct-tag-row,' +
      '.jnk-cat-grid, .preset-chips, .days-picker, .badge-grid,' +
      '.icon-emoji-grid, .ct-chart-bars, .jnk-chips-area,' +
      '.wt-rem-presets, .section-labels, .ct-milestones,' +
      '.ct-log-list, .jnk-activity-list, .modal-sheet, .icon-picker-sheet'
    );
    if (scrollable) return;

    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const currentId  = activePage.id.replace('page-', '');
    const currentIdx = PAGE_ORDER.indexOf(currentId);
    if (currentIdx === -1) return;

    const nextIdx = dx < 0
      ? Math.min(currentIdx + 1, PAGE_ORDER.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx === currentIdx) return;

    const navBtn = document.querySelector('.nb[data-page="' + PAGE_ORDER[nextIdx] + '"]');
    if (navBtn) showPage(PAGE_ORDER[nextIdx], navBtn);

  }, { passive: true });
}

/* ─────────────────────────────────────────────────────────────
   DOUBLE TAP ZOOM PREVENTION
───────────────────────────────────────────────────────────────*/
function setupDoubleTapPrevention() {
  let lastTap = 0;
  const TARGETS = [
    '.ci', '.wt-glass-btn', '.jnk-cat-card', '.nb',
    '.weekly-cb', '.ct-hour-btn', '.ct-skill-btn',
    '.lang-mark-btn', '.s-btn'
  ].join(',');

  document.addEventListener('touchend', e => {
    const now  = Date.now();
    const diff = now - lastTap;
    if (diff < 300 && diff > 0) {
      const el = e.target.closest(TARGETS);
      if (el) { e.preventDefault(); el.click(); }
    }
    lastTap = now;
  }, { passive: false });
}

/* ─────────────────────────────────────────────────────────────
   IOS INPUT SCROLL FIX
───────────────────────────────────────────────────────────────*/
function setupIOSInputFix() {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  document.addEventListener('focusin', e => {
    const el  = e.target;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
  }, { passive: true });
}

/* ─────────────────────────────────────────────────────────────
   NETWORK STATUS
───────────────────────────────────────────────────────────────*/
function setupNetworkListeners() {
  window.addEventListener('online', () => {
    updateFbStatus('syncing');
    showToast('Back online — syncing...', 'gt');
    setSaveFailCount(0);
    setRealtimeRetryCount(0);
    setTimeout(() => {
      debouncedSave(500);
      detachAllListeners();
      startRealtimeSync();
    }, 1000);
  });

  window.addEventListener('offline', () => {
    updateFbStatus('offline');
    showToast('Offline — changes saved locally', 'yt');
  });
}

/* ─────────────────────────────────────────────────────────────
   ORIENTATION CHANGE
───────────────────────────────────────────────────────────────*/
function setupOrientationChange() {
  window.addEventListener('orientationchange', () => {
    setCachedSceneHeight(0);
    setTimeout(() => {
      if (document.getElementById('wt-scene')) renderWater();
    }, 300);
  });
}

/* ─────────────────────────────────────────────────────────────
   GLOBAL ERROR HANDLERS
───────────────────────────────────────────────────────────────*/
function setupGlobalErrorHandlers() {
  window.addEventListener('error', event => {
    console.warn('Sandy Brain error:', event.message, event.filename, event.lineno);
  });

  window.addEventListener('unhandledrejection', event => {
    if (
      event.reason &&
      typeof event.reason.message === 'string' &&
      /firebase|network|fetch|Failed to fetch/i.test(event.reason.message)
    ) {
      event.preventDefault();
      return;
    }
    console.warn('Sandy Brain: unhandled rejection:', event.reason);
  });
}

/* ─────────────────────────────────────────────────────────────
   LOADING SCREEN
───────────────────────────────────────────────────────────────*/
function runLoadingScreen() {
  const bar    = document.getElementById('loading-bar');
  const screen = document.getElementById('app-loading-screen');
  if (!bar || !screen) return;

  let dismissed = false;
  let progress  = 0;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearInterval(progressTimer);
    bar.style.width = '100%';
    setTimeout(() => {
      screen.style.opacity = '0';
      setTimeout(() => {
        if (screen.parentNode) screen.parentNode.removeChild(screen);
      }, 400);
    }, 200);
  }

  /* Auto-dismiss when today-sections has content */
  const checkTimer = setInterval(() => {
    if (dismissed) { clearInterval(checkTimer); return; }
    const sections  = document.getElementById('today-sections');
    const hasContent= sections && sections.children.length > 0;
    const stateReady= typeof state !== 'undefined' && state !== null && state.lastDate !== undefined;
    if (hasContent && stateReady) { clearInterval(checkTimer); dismiss(); }
  }, 100);

  /* Hard timeout — always dismiss after 3 s */
  setTimeout(() => { clearInterval(checkTimer); if (!dismissed) dismiss(); }, 3000);

  /* Progress bar animation */
  const progressTimer = setInterval(() => {
    if (dismissed) return;
    progress = Math.min(95, progress + (95 - progress) * 0.08);
    bar.style.width = progress + '%';
  }, 100);
}

/* ─────────────────────────────────────────────────────────────
   FACTORY RESET
───────────────────────────────────────────────────────────────*/
export function confirmFactoryReset() {
  if (!confirm('Delete ALL data including streaks, career progress and badges?')) return;

  /* Stop all timers and listeners */
  detachAllListeners();

  if (wtPropRAF)       { cancelAnimationFrame(wtPropRAF); setWtPropRAF(null); }
  if (wtIdleTmr)       { clearInterval(wtIdleTmr);        setWtIdleTmr(null); }
  if (wtRemTimer)      { clearInterval(wtRemTimer);        setWtRemTimer(null); }
  if (wtRemNextTimeout){ clearTimeout(wtRemNextTimeout);   setWtRemNextTimeout(null); }
  if (_ctCdInterval)   { clearInterval(_ctCdInterval);     setCtCdInterval(null); }
  if (inAppTimeoutId)  { clearTimeout(inAppTimeoutId);     setInAppTimeoutId(null); }
  if (masterTimerId)   { clearInterval(masterTimerId);     setMasterTimerId(null); }
  if (_configSyncTimer){ clearTimeout(_configSyncTimer);   setConfigSyncTimer(null); }
  if (badgeCheckTimer) { clearTimeout(badgeCheckTimer);    setBadgeCheckTimer(null); }

  /* Reset all module-level flags */
  resetAllFlags();

  /* Clear localStorage */
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k === DB_KEY ||
        k.startsWith(DB_KEY_FIRED) ||
        k.startsWith(DB_KEY_MIDNIGHT)
      )) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}

  /* Reset state and rebuild */
  Object.assign(state, defaultState());
  ensureDefaults();

  /* Clear today-sections DOM */
  const todaySections = document.getElementById('today-sections');
  if (todaySections) todaySections.innerHTML = '';

  /* Re-run init */
  init().then(() => {
    startMasterTimer();
    showToast('Factory reset complete', 'gt');
  });
}
window.confirmFactoryReset = confirmFactoryReset;

/* ─────────────────────────────────────────────────────────────
   MAIN INIT FUNCTION
───────────────────────────────────────────────────────────────*/
export async function init() {

  loadFiredToday();

  /* Reset state to clean defaults */
  Object.assign(state, defaultState());
  window.currentUID = 'sandy_shared';

  console.log('Sandy Brain: using shared_tracker collection');

  /* ── Load data ── */
  await load();
  ensureDefaults();
  handleDailyReset();

  /* Career daily reset runs early so streak shows before tab visited */
  ctDailyReset();

  /* Session completion flag */
  if (state.ctDayDone) setCtDayCompletedThisSession(true);
  else                 setCtDayCompletedThisSession(false);

  /* ── Deferred cleanup ── */
  cleanOrphanEntries();
  ctCleanWeeklyHours();

  /* ── Theme — force full rewrite on first load ── */
  setLastThemeKey('');
  applyTheme();

  /* ── Mark settings as needing rebuild ── */
  setSettingsNeedRebuild(true);

  /* ── Build Today tab ── */
  rebuildTodaySections();
  applyChecks();
  renderHomeReminders();
  updateSummaryCards();
  updateStatsBanner();
  renderLangUI();
  updateProg();
  updateReward();
  _updateFooterChips();
  renderTodayWeeklyPanel();

  /* ── Junk tab init ── */
  jnkBuildCatGrid();
  jnkRenderChips();
  jnkRenderAll();
  jRenderSugar();
  jRenderBiryani();
  jRenderLogs();

  /* ── Week resets (after load so toasts are accurate) ── */
  try { jCheckWeekReset();  } catch (e) {}
  try { wtCheckWeekReset(); } catch (e) {}

  /* ── Reminders tab ── */
  buildDaysPicker();
  buildPresetChips();
  updateNotifStatusUI();
  renderReminderList();

  /* ── Career tab ── */
  ctInit();

  /* ── Weekly tab ── */
  wtRenderTasks();
  renderTodayWeeklyPanel();

  /* ── Settings tab ── */
  updateMissedAlertDisplay();

  /* ── Master timer (called once — never again except after factory reset) ── */
  startMasterTimer();

  /* ── App open time for water reminder ── */
  setWtAppOpenTime(Date.now());

  /* ── Firebase realtime sync ── */
  startRealtimeSync();
  scheduleMidnightReset();

  /* ── Reminder engine first check ── */
  setReminderFirstCheck(true);
  checkReminders();

  /* ── Service worker ── */
  registerInlineServiceWorker();

  /* ── PWA install prompt ── */
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    setTimeout(() => {
      if (deferredInstallPrompt) showPWAInstallBanner();
    }, 5000);
  }

  /* ── Streak milestone check ── */
  setTimeout(() => checkStreakMilestone(), 2000);

  console.log(
    '%cSandy Brain initialized successfully',
    'color:#7C3AED;font-weight:900;font-family:system-ui;'
  );
}

/* ─────────────────────────────────────────────────────────────
   BEFORE INSTALL PROMPT (PWA)
───────────────────────────────────────────────────────────────*/
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  setDeferredInstallPrompt(event);
  if (!window.matchMedia('(display-mode: standalone)').matches)
    setTimeout(showPWAInstallBanner, 5000);
});

window.addEventListener('appinstalled', () => {
  showToast('Sandy Brain installed successfully!', 'gt');
  setDeferredInstallPrompt(null);
  const b = document.getElementById('pwa-install-banner');
  if (b) b.remove();
});

/* ─────────────────────────────────────────────────────────────
   DOM CONTENT LOADED — KICK OFF
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {

  /* Inject print styles */
  injectPrintStyles();

  /* Set up all event listeners */
  setupNavigation();
  setupEventDelegation();
  setupKeyboard();
  setupSwipeNav();
  setupDoubleTapPrevention();
  setupIOSInputFix();
  setupNetworkListeners();
  setupOrientationChange();
  setupGlobalErrorHandlers();
  setupCustomEventListeners();
  setupVisibilityChange();

  /* Expose globals for any remaining inline handlers */
  exposeGlobals();

  /* Start loading screen animation */
  runLoadingScreen();

  /* Run init */
  requestAnimationFrame(() => {
    init().catch(err => {
      console.error('Sandy Brain: init failed:', err);
      try {
        ensureDefaults();
        rebuildTodaySections();
        applyChecks();
        applyTheme();
      } catch (e) {}
    });
  });

  /* DOM safety check after 2.5 s */
  setTimeout(checkCriticalDomElements, 2500);
  checkStorageQuota();
});
