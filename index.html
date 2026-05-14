/**
 * ═══════════════════════════════════════════════════════════════
 * core/init.js — Application startup orchestrator
 *
 * This module owns:
 * - init() — complete boot sequence
 * - Master timer (30s interval)
 * - DOMContentLoaded entry point
 * - Global event listeners (visibility, network, orientation)
 * - Swipe navigation
 * - Keyboard navigation
 * - Focus traps for modals
 * - Modal scroll lock
 * - Loading screen dismissal
 * - Orphan data cleanup
 *
 * This is the TOP of the dependency tree.
 * It imports from all other modules but nothing imports from it
 * (except dynamic import in settings.js for factory reset).
 * ═══════════════════════════════════════════════════════════════
 */

import {
  todayKey,
  yesterdayKey,
  DB_KEY,
  DB_KEY_MIDNIGHT,
  DAY_NAMES,
  safeLocalStorageSave,
  showToast
} from './utils.js';

import {
  state,
  flags,
  defaultState,
  replaceState,
  ensureDefaults,
  loadFiredToday,
  saveFiredToday
} from './state.js';

import {
  initFirebase,
  load,
  save,
  debouncedSave,
  startRealtimeSync,
  detachAllListeners,
  scheduleMidnightReset,
  onSyncRefreshUI,
  onConfigSync,
  onMidnightReset,
  updateFbStatus
} from './firebase.js';

import {
  applyTheme,
  updateReward,
  updateSummaryCards,
  updateStatsBanner,
  updateFooterChips,
  checkStreakMilestone
} from '../shared/theme.js';

import { checkBadgesDebounced } from '../shared/badges.js';

import {
  buildWaterSection,
  renderWater,
  renderHydrationInsights,
  wtStartAnimation,
  wtStopAnimation,
  wtBubbles,
  wtCleanup,
  wtRemInit,
  wtRemScheduleNext,
  bindWaterEvents
} from '../shared/water.js';

import { initPWA } from '../shared/pwa.js';

import {
  toggle,
  applyChecks,
  updateProg,
  buildTodaySections,
  rebuildTodaySections,
  rebuildSection,
  buildEveningSection,
  rebuildEveningIfNeeded,
  handleDailyReset,
  showPage,
  refreshUI,
  refreshUILightweight,
  renderHomeReminders,
  renderTodayWeeklyPanel,
  showInAppNotif,
  closeInApp,
  checkMissedTasksBanner,
  closeMissedBanner,
  resetToday,
  onPageShow,
  onLightweightRefresh,
  onFullRefresh
} from '../tabs/today.js';

import {
  ctInit,
  ctRenderAll,
  ctRenderHero,
  ctDailyReset,
  ctCleanWeeklyHours,
  ctOverallPct,
  bindCareerEvents
} from '../tabs/career.js';

import {
  buildEnglishPage,
  renderLangUI,
  resetDailyLangFlags,
  bindEnglishEvents
} from '../tabs/english.js';

import {
  jnkBuildCatGrid,
  jnkRenderChips,
  jnkRenderAll,
  jRenderSugar,
  jRenderBiryani,
  jRenderLogs,
  jCheckWeekReset,
  bindJunkEvents
} from '../tabs/junk.js';

import {
  buildWeeklyPage,
  wtRenderTasks,
  wtCheckWeekReset,
  bindWeeklyEvents
} from '../tabs/weekly.js';

import {
  buildRemindersPage,
  checkReminders,
  renderReminderList,
  buildDaysPicker,
  buildPresetChips,
  updateNotifStatusUI,
  bindReminderEvents
} from '../tabs/reminders.js';

import {
  buildSettingsPageShell,
  buildSettingsPage,
  updateMissedAlertDisplay,
  handleConfigSyncRebuild,
  bindSettingsEvents,
  closeEditModal,
  closeIconPicker
} from '../tabs/settings.js';

import { closeBadges } from '../shared/badges.js';
import { closeBiryaniConfirm } from '../tabs/junk.js';


/* ═══════════════════════════════════════════════════════════════
   REGISTER FIREBASE CALLBACKS
   These break the circular dependency by passing functions as
   callbacks rather than importing init.js from firebase.js.
   ═══════════════════════════════════════════════════════════════ */

onSyncRefreshUI(() => refreshUILightweight());

onConfigSync(() => {
  handleConfigSyncRebuild();
  renderReminderList();
  renderHomeReminders();
  const sp = document.getElementById('page-settings');
  if (sp && sp.classList.contains('active')) buildSettingsPage();
});

onMidnightReset(async (resetKey) => {
  // Archive study hours
  if ((state.ctStudyHrs || 0) > 0 && state.ctLastStudyDate) {
    if (!state.ctWeeklyHours) state.ctWeeklyHours = {};
    state.ctWeeklyHours[state.ctLastStudyDate] = Math.max(
      state.ctWeeklyHours[state.ctLastStudyDate] || 0, state.ctStudyHrs
    );
  }

  // Archive day history
  if (state.lastDate && state.ctDayHistory && !state.ctDayHistory[state.lastDate]) {
    state.ctDayHistory[state.lastDate] = state.ctDayDone
      ? 'complete' : (state.ctStudyHrs || 0) > 0 ? 'partial' : 'rest';
  }

  // Reset daily fields
  state.checks = {};
  state.water = 0;
  state.pts = 0;
  state.ctDayDone = false;
  state.ctStudyHrs = 0;
  state.ctTodayLogged = false;
  state.ctLastStudyDate = null;
  state.missedBannerDismissedDate = '';
  state.lastResetTimestamp = Date.now();

  flags.firedToday = {};
  flags.wtFilter = 'all';
  flags.wtSceneInitialized = false;
  flags.jnkSelected = {};
  flags.jnkGridBuilt = false;
  flags.saveFailCount = 0;
  flags.ctPageBuilt = false;
  flags.cachedSceneHeight = 0;
  flags._lastThemeKey = '';
  flags._reminderFirstCheck = true;

  resetDailyLangFlags();
  try { jCheckWeekReset(); } catch (e) { /* ignore */ }
  try { wtCheckWeekReset(); } catch (e) { /* ignore */ }

  state.lastDate = resetKey;
  saveFiredToday();
  await save();
  refreshUI();

  const b = document.getElementById('banner');
  if (b) { b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 4000); }
  showToast('New day started! Checklist reset.', 'gt');

  // Reattach listeners for new day path
  detachAllListeners();
  startRealtimeSync();
});


/* ═══════════════════════════════════════════════════════════════
   REGISTER LIGHTWEIGHT REFRESH CALLBACKS
   ═══════════════════════════════════════════════════════════════ */

onLightweightRefresh(() => {
  if (document.getElementById('ct-root')) ctRenderAll();
  renderLangUI();
  jnkRenderAll();
  jRenderSugar();
  jRenderBiryani();
});

onFullRefresh(() => {
  renderLangUI();
  renderReminderList();
  wtRenderTasks();
  renderTodayWeeklyPanel();
  jRenderLogs();
  updateMissedAlertDisplay();
});


/* ═══════════════════════════════════════════════════════════════
   MASTER TIMER (30s interval)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Starts the master timer that drives periodic updates.
 */
function startMasterTimer() {
  if (flags.masterTimerId) { clearInterval(flags.masterTimerId); flags.masterTimerId = null; }
  flags.masterTickCount = 0;

  flags.masterTimerId = setInterval(() => {
    if (document.hidden) return;
    flags.masterTickCount++;

    // Every 30s: check reminders
    if (flags.masterTickCount % 1 === 0) checkReminders();

    // Every 60s: theme, home reminders, career hero
    if (flags.masterTickCount % 2 === 0) {
      applyTheme();
      renderHomeReminders();
      ctRenderHero();
    }

    // Every 5 min: stats, streak milestone, cleanup, week reset
    if (flags.masterTickCount % 10 === 0) {
      updateStatsBanner();
      checkStreakMilestone();
      ctCleanWeeklyHours();
      try { jCheckWeekReset(); } catch (e) { /* ignore */ }
    }

    // Every 5 min: settings rebuild if needed AND page is active
    if (flags.masterTickCount % 10 === 0 && flags._settingsNeedRebuild) {
      const sp = document.getElementById('page-settings');
      if (sp && sp.classList.contains('active')) buildSettingsPage();
    }

    if (flags.masterTickCount > 100000) flags.masterTickCount = 0;
  }, 30000);
}


/* ═══════════════════════════════════════════════════════════════
   VISIBILITY CHANGE HANDLER
   ═══════════════════════════════════════════════════════════════ */

function _setupVisibilityHandler() {
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      // Save state when going to background
      try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
      if (flags.saveDebounceTimer) {
        clearTimeout(flags.saveDebounceTimer);
        flags.saveDebounceTimer = null;
        save();
      }

      // Archive study hours if studying
      if ((state.ctStudyHrs || 0) > 0 && state.ctLastStudyDate && state.ctLastStudyDate === todayKey()) {
        if (!state.ctWeeklyHours) state.ctWeeklyHours = {};
        const key = state.ctLastStudyDate;
        if (state.ctStudyHrs > (state.ctWeeklyHours[key] || 0)) {
          state.ctWeeklyHours[key] = state.ctStudyHrs;
          debouncedSave(200);
        }
      }
      return;
    }

    // ── Returning from background ──
    flags._wtAppOpenTime = Date.now();
    applyTheme();

    // Retry sync if previously exhausted
    if (flags.realtimeRetryCount >= 10) {
      flags.realtimeRetryCount = 0;
      detachAllListeners();
      startRealtimeSync();
    }

    // Check for day change
    const today = todayKey();
    if (state.lastDate !== today) {
      const storedKey = localStorage.getItem(DB_KEY_MIDNIGHT + 'lastFired') || '';
      if (storedKey === today) { refreshUI(); return; }

      // Archive
      if ((state.ctStudyHrs || 0) > 0 && state.ctLastStudyDate) {
        if (!state.ctWeeklyHours) state.ctWeeklyHours = {};
        state.ctWeeklyHours[state.ctLastStudyDate] = Math.max(
          state.ctWeeklyHours[state.ctLastStudyDate] || 0, state.ctStudyHrs
        );
      }
      if (state.lastDate && state.ctDayHistory && !state.ctDayHistory[state.lastDate]) {
        state.ctDayHistory[state.lastDate] = state.ctDayDone
          ? 'complete' : (state.ctStudyHrs || 0) > 0 ? 'partial' : 'rest';
      }

      // Reset
      state.checks = {}; state.water = 0; state.pts = 0;
      state.ctDayDone = false; state.ctStudyHrs = 0; state.ctTodayLogged = false;
      state.ctLastStudyDate = null; state.missedBannerDismissedDate = '';
      state.lastResetTimestamp = Date.now();
      flags.firedToday = {}; flags.wtFilter = 'all'; flags.wtSceneInitialized = false;
      flags.jnkSelected = {}; flags.jnkGridBuilt = false; flags.saveFailCount = 0;
      flags.ctPageBuilt = false; flags.cachedSceneHeight = 0; flags._reminderFirstCheck = true;

      resetDailyLangFlags();
      try { jCheckWeekReset(); } catch (e) { /* ignore */ }
      try { wtCheckWeekReset(); } catch (e) { /* ignore */ }

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

    // Normal return — refresh UI
    if (state.wtReminderEnabled) {
      if (flags.wtRemNextTimeout) { clearTimeout(flags.wtRemNextTimeout); flags.wtRemNextTimeout = null; }
      wtRemScheduleNext();
    }
    renderHomeReminders();
    checkReminders();
    updateStatsBanner();
  });
}


/* ═══════════════════════════════════════════════════════════════
   GLOBAL EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

function _setupGlobalEvents() {
  // ── Network status ──
  window.addEventListener('online', () => {
    updateFbStatus('syncing');
    showToast('Back online — syncing...', 'gt');
    flags.saveFailCount = 0;
    flags.realtimeRetryCount = 0;
    setTimeout(() => { debouncedSave(500); detachAllListeners(); startRealtimeSync(); }, 1000);
  });

  window.addEventListener('offline', () => {
    updateFbStatus('offline');
    showToast('Offline — changes saved locally', 'yt');
  });

  // ── Orientation change ──
  window.addEventListener('orientationchange', () => {
    flags.cachedSceneHeight = 0;
    setTimeout(() => { if (document.getElementById('wt-scene')) renderWater(); }, 300);
  });

  // ── Window resize ──
  window.addEventListener('resize', () => { flags.cachedSceneHeight = 0; });

  // ── Checklist item clicks (event delegation) ──
  document.addEventListener('click', e => {
    const ci = e.target.closest('.ci[data-key]');
    if (!ci) return;
    if (e.target.closest('.reorder-btn')) return;
    if (e.target.closest('.task-emoji')) return;
    if (e.target.closest('[data-action]')) return;
    toggle(ci);
  });

  // ── Keyboard: Enter/Space on checklist items ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const active = document.activeElement;
      if (!active) return;
      if (active.classList.contains('ci')) { e.preventDefault(); toggle(active); }
    }

    // Escape key closes modals
    if (e.key === 'Escape') {
      const modals = [
        { id: 'biryani-confirm-modal', fn: closeBiryaniConfirm },
        { id: 'badges-modal', fn: closeBadges },
        { id: 'edit-modal', fn: closeEditModal },
        { id: 'weekly-edit-modal', fn: () => import('../tabs/weekly.js').then(m => m.closeWeeklyEditModal()) },
        { id: 'icon-picker-overlay', fn: closeIconPicker }
      ];
      for (const m of modals) {
        const el = document.getElementById(m.id);
        if (el && el.classList.contains('open')) { m.fn(); return; }
      }
      const missed = document.getElementById('missed-banner');
      if (missed && missed.classList.contains('show')) closeMissedBanner();
    }
  });

  // ── In-app notification close ──
  document.addEventListener('click', e => {
    if (e.target && e.target.closest('.inapp-notif-close')) closeInApp();
    if (e.target && e.target.closest('.missed-banner-close')) closeMissedBanner();
  });

  // ── Badges button ──
  document.addEventListener('click', e => {
    if (e.target && e.target.closest('.badges-view-btn')) {
      import('../shared/badges.js').then(m => m.openBadges());
    }
    // Close badges modal on overlay click
    if (e.target && e.target.id === 'badges-modal' && e.target.classList.contains('open')) {
      closeBadges();
    }
  });

  // ── Nav-to action (from weekly panel on today page) ──
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action="nav-to"]');
    if (!el) return;
    const navBtns = document.querySelectorAll('.nb');
    const navBtn = navBtns[+el.dataset.navIndex];
    if (navBtn) showPage(el.dataset.page, navBtn);
  });
}


/* ═══════════════════════════════════════════════════════════════
   SWIPE NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

function _setupSwipeNav() {
  const PAGE_ORDER = ['today', 'study', 'english', 'junk', 'weekly', 'reminders', 'settings'];
  let touchStartX = 0, touchStartY = 0, touchStartT = 0;

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

    // Don't swipe if inside a scrollable container
    const scrollable = e.target.closest(
      '.stats-banner, nav, .weekly-filter-row, .wt-glasses-row, .ct-tag-row, ' +
      '.jnk-cat-grid, .preset-chips, .days-picker, .badge-grid, ' +
      '.icon-emoji-grid, .ct-chart-bars, .jnk-chips-area, ' +
      '.wt-rem-presets, .section-labels, .ct-milestones, ' +
      '.ct-log-list, .jnk-activity-list, .modal-sheet, .icon-picker-sheet'
    );
    if (scrollable) return;

    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    const currentId = activePage.id.replace('page-', '');
    const currentIdx = PAGE_ORDER.indexOf(currentId);
    if (currentIdx === -1) return;

    const nextIdx = dx < 0
      ? Math.min(currentIdx + 1, PAGE_ORDER.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx === currentIdx) return;

    const navBtns = document.querySelectorAll('.nb');
    const navBtn = navBtns[nextIdx];
    if (navBtn) showPage(PAGE_ORDER[nextIdx], navBtn);
  }, { passive: true });
}


/* ═══════════════════════════════════════════════════════════════
   FOCUS TRAP & SCROLL LOCK
   ═══════════════════════════════════════════════════════════════ */

function _setupFocusTrap() {
  const MODAL_IDS = ['badges-modal', 'edit-modal', 'weekly-edit-modal', 'icon-picker-overlay', 'biryani-confirm-modal'];
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const open = MODAL_IDS.map(id => document.getElementById(id)).find(el => el && el.classList.contains('open'));
    if (!open) return;

    const items = Array.from(open.querySelectorAll(FOCUSABLE));
    if (!items.length) return;

    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

function _setupModalScrollLock() {
  const MODAL_IDS = ['badges-modal', 'edit-modal', 'weekly-edit-modal', 'icon-picker-overlay', 'biryani-confirm-modal'];
  if (typeof MutationObserver === 'undefined') return;

  MODAL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
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


/* ═══════════════════════════════════════════════════════════════
   DOUBLE-TAP ZOOM PREVENTION
   ═══════════════════════════════════════════════════════════════ */

function _setupDoubleTapPrevention() {
  let lastTap = 0;
  const TARGETS = ['.ci', '.wt-glass-btn', '.jnk-cat-card', '.nb', '.weekly-cb', '.ct-hour-btn', '.ct-skill-btn', '.lang-mark-btn', '.s-btn'].join(',');

  document.addEventListener('touchend', e => {
    const now = Date.now();
    const diff = now - lastTap;
    if (diff < 300 && diff > 0) {
      const el = e.target.closest(TARGETS);
      if (el) { e.preventDefault(); el.click(); }
    }
    lastTap = now;
  }, { passive: false });
}


/* ═══════════════════════════════════════════════════════════════
   iOS INPUT SCROLL FIX
   ═══════════════════════════════════════════════════════════════ */

function _setupIOSInputFix() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  document.addEventListener('focusin', e => {
    const el = e.target;
    if (!el) return;
    const tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
    setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350);
  }, { passive: true });
}


/* ═══════════════════════════════════════════════════════════════
   DATA CLEANUP
   ═══════════════════════════════════════════════════════════════ */

function _cleanOrphanEntries() {
  setTimeout(() => {
    let changed = false;

    // Fix sugarLog entries missing dateKey
    if (Array.isArray(state.sugarLog)) {
      state.sugarLog = state.sugarLog.filter(e => {
        if (e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) return true;
        if (e.weekStart && e.weekStart === state.sugarWeekStart && e.date) {
          try {
            const d = new Date(e.date);
            if (!isNaN(d.getTime())) {
              e.dateKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              changed = true;
              return true;
            }
          } catch (_) { /* ignore */ }
        }
        return false;
      });
    }

    // Fix junkLog entries missing dateKey
    if (Array.isArray(state.junkLog)) {
      state.junkLog = state.junkLog.map(e => {
        if (e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) return e;
        if (e.date) {
          try {
            const d = new Date(e.date);
            if (!isNaN(d.getTime())) {
              e.dateKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              changed = true;
              return e;
            }
          } catch (_) { /* ignore */ }
        }
        return null;
      }).filter(Boolean);
    }

    if (changed) {
      try { safeLocalStorageSave(DB_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
      updateStatsBanner();
    }
  }, 3000);
}


/* ═══════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════ */

function _dismissLoadingScreen() {
  const bar = document.getElementById('loading-bar');
  const screen = document.getElementById('app-loading-screen');
  if (!bar || !screen) return;

  let dismissed = false;
  let progress = 0;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearInterval(progressTimer);
    bar.style.width = '100%';
    setTimeout(() => {
      screen.style.opacity = '0';
      setTimeout(() => { if (screen.parentNode) screen.parentNode.removeChild(screen); }, 400);
    }, 200);
  }

  const checkTimer = setInterval(() => {
    if (dismissed) { clearInterval(checkTimer); return; }
    const sections = document.getElementById('today-sections');
    const hasContent = sections && sections.children.length > 0;
    const stateReady = state.lastDate !== undefined;
    if (hasContent && stateReady) { clearInterval(checkTimer); dismiss(); }
  }, 100);

  setTimeout(() => { clearInterval(checkTimer); if (!dismissed) dismiss(); }, 3000);

  const progressTimer = setInterval(() => {
    if (dismissed) return;
    progress = Math.min(95, progress + (95 - progress) * 0.08);
    bar.style.width = progress + '%';
  }, 100);
}


/* ═══════════════════════════════════════════════════════════════
   NAV BUTTON BINDING
   ═══════════════════════════════════════════════════════════════ */

function _setupNavButtons() {
  const PAGE_MAP = ['today', 'study', 'english', 'junk', 'weekly', 'reminders', 'settings'];

  document.querySelectorAll('.nb').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      showPage(PAGE_MAP[idx], btn);
    });
  });
}


/* ═══════════════════════════════════════════════════════════════
   INIT — Complete startup sequence
   ═══════════════════════════════════════════════════════════════ */

/**
 * Main initialization function.
 * Called on DOMContentLoaded and after factory reset.
 */
export async function init() {
  // ── Firebase ──
  initFirebase();

  // ── Load state ──
  loadFiredToday();
  replaceState(defaultState());
  flags.currentUID = 'sandy_shared';

  await load();
  ensureDefaults();
  handleDailyReset();

  // Career daily reset (so streak displays correctly before tab visit)
  ctDailyReset();
  if (state.ctDayDone) flags._ctDayCompletedThisSession = true;
  else flags._ctDayCompletedThisSession = false;

  // ── Cleanup ──
  _cleanOrphanEntries();
  ctCleanWeeklyHours();

  // ── Theme ──
  flags._lastThemeKey = '';
  applyTheme();
  flags._settingsNeedRebuild = true;

  // ── Build pages ──
  buildEnglishPage();
  buildWeeklyPage();
  buildRemindersPage();
  buildSettingsPageShell();

  // ── Build today page ──
  rebuildTodaySections();
  applyChecks();
  renderHomeReminders();
  updateSummaryCards();
  updateStatsBanner();
  renderLangUI();
  updateProg();
  updateReward();
  updateFooterChips();
  renderTodayWeeklyPanel();

  // ── Junk page ──
  jnkBuildCatGrid();
  jnkRenderChips();
  jnkRenderAll();
  jRenderSugar();
  jRenderBiryani();
  jRenderLogs();

  // ── Week resets ──
  try { jCheckWeekReset(); } catch (e) { /* ignore */ }
  try { wtCheckWeekReset(); } catch (e) { /* ignore */ }

  // ── Reminders page ──
  buildDaysPicker();
  buildPresetChips();
  updateNotifStatusUI();
  renderReminderList();

  // ── Career ──
  ctInit();

  // ── Weekly ──
  wtRenderTasks();
  renderTodayWeeklyPanel();

  // ── Settings ──
  updateMissedAlertDisplay();

  // ── Master timer ──
  startMasterTimer();

  // ── App open time ──
  flags._wtAppOpenTime = Date.now();

  // ── Firebase realtime ──
  startRealtimeSync();
  scheduleMidnightReset();

  // ── Reminders ──
  flags._reminderFirstCheck = true;
  checkReminders();

  // ── PWA ──
  initPWA();

  // ── Deep link navigation ──
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) {
    const pageMap = { today: 0, study: 1, english: 2, junk: 3, weekly: 4, reminders: 5, settings: 6 };
    if (pageMap[hash] !== undefined) {
      setTimeout(() => {
        const navBtns = document.querySelectorAll('.nb');
        const btn = navBtns[pageMap[hash]];
        if (btn) showPage(hash, btn);
      }, 300);
    }
  }

  // ── Streak milestone ──
  setTimeout(() => checkStreakMilestone(), 2000);

  console.log('%cSandy\'s Second Brain', 'color:#7C3AED;font-size:16px;font-weight:900;font-family:system-ui;');
  console.log('%cModular architecture · ES6 modules · Zero inline handlers', 'color:#16a34a;font-size:11px;font-family:system-ui;');
}


/* ═══════════════════════════════════════════════════════════════
   DOMContentLoaded — Entry point
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Start loading screen animation immediately
  _dismissLoadingScreen();

  // Setup nav buttons
  _setupNavButtons();

  // Setup global event handlers
  _setupGlobalEvents();
  _setupVisibilityHandler();
  _setupSwipeNav();
  _setupFocusTrap();
  _setupModalScrollLock();
  _setupDoubleTapPrevention();
  _setupIOSInputFix();

  // Bind module-specific events
  bindWaterEvents();
  bindCareerEvents();
  bindEnglishEvents();
  bindJunkEvents();
  bindWeeklyEvents();
  bindReminderEvents();
  bindSettingsEvents();

  // Boot the app
  requestAnimationFrame(() => {
    init().catch(err => {
      console.error('Sandy Brain: init failed:', err);
      try {
        ensureDefaults();
        rebuildTodaySections();
        applyChecks();
        applyTheme();
      } catch (e) { /* ignore */ }
    });
  });
});


/* ═══════════════════════════════════════════════════════════════
   ERROR HANDLERS
   ═══════════════════════════════════════════════════════════════ */

window.addEventListener('error', event => {
  console.warn('Sandy Brain error:', event.message, event.filename, event.lineno);
});

window.addEventListener('unhandledrejection', event => {
  if (event.reason && typeof event.reason.message === 'string' &&
    /firebase|network|fetch|Failed to fetch/i.test(event.reason.message)) {
    event.preventDefault();
    return;
  }
  console.warn('Sandy Brain: unhandled rejection:', event.reason);
});
