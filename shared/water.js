/* ═══════════════════════════════════════════════════════════════
   shared/water.js
   Water tracker scene — submarine animation, wave, bubbles,
   fish, completion glow, glass buttons, water reminder engine,
   hydration insights panel.
   Depends on: core/state.js, core/utils.js, core/firebase.js
═══════════════════════════════════════════════════════════════ */

'use strict';

import {
  state,
  WT_GOAL,
  WT_ML,
  /* flags */
  wtDone,          setWtDone,
  wtPropRAF,       setWtPropRAF,
  wtIdleTmr,       setWtIdleTmr,
  wtRemTimer,      setWtRemTimer,
  wtRemNextTimeout,setWtRemNextTimeout,
  wtSceneInitialized, setWtSceneInitialized,
  cachedSceneHeight,  setCachedSceneHeight,
  _wtAppOpenTime
} from '../core/state.js';

import {
  todayKey,
  sanitizeHTML,
  showToast,
  confetti,
  validateTimeString,
  safeLocalStorageSave
} from '../core/utils.js';

import {
  debouncedSave
} from '../core/firebase.js';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────*/
const WT_SCENE_H = 200;
const WT_X0      = 10;   /* submarine start X % */
const WT_X1      = 84;   /* submarine end   X % */
const WT_Y0      = 8;    /* submarine base  Y px */
const WT_CLR     = 30;   /* clearance from water top */

const WT_REM_PRESETS = [
  { label: 'Every 30m',  interval: 30  },
  { label: 'Every 45m',  interval: 45  },
  { label: 'Every 1hr',  interval: 60  },
  { label: 'Every 90m',  interval: 90  },
  { label: 'Every 2hr',  interval: 120 }
];

/* ─────────────────────────────────────────────────────────────
   PROPELLER ANIMATION
───────────────────────────────────────────────────────────────*/
let _propAng = 0;

/**
 * Starts the submarine propeller animation loop.
 * Safe to call multiple times — cancels previous RAF first.
 */
export function _wtStartAnimation() {
  if (wtPropRAF) { cancelAnimationFrame(wtPropRAF); setWtPropRAF(null); }
  _propAng = 0;
  _animProp();
}

function _animProp() {
  _propAng += 10;
  const p = document.getElementById('wt-prop');
  if (p) p.setAttribute('transform', 'rotate(' + _propAng + ',5,20)');
  setWtPropRAF(requestAnimationFrame(_animProp));
}

/* ─────────────────────────────────────────────────────────────
   WATER LEVEL APPLICATION
───────────────────────────────────────────────────────────────*/

/**
 * Applies water fill level P (0–1) to the scene.
 * Updates the water div height, submarine position,
 * fish visibility, particles, and status text.
 */
export function wtApply(P) {
  P = Math.min(Math.max(P, 0), 1);

  if (!cachedSceneHeight) {
    const scene = document.getElementById('wt-scene');
    if (scene) setCachedSceneHeight(scene.offsetHeight || WT_SCENE_H);
  }

  const scH    = cachedSceneHeight || WT_SCENE_H;
  const maxWH  = scH * 0.50;
  const waterPx= P * maxWH;
  const waterPct=(waterPx / scH) * 100;

  requestAnimationFrame(() => {
    /* Water div height */
    const waterEl = document.getElementById('wt-water');
    if (waterEl) waterEl.style.height = waterPct + '%';

    /* Submarine position */
    const sub = document.getElementById('wt-sub');
    if (sub) {
      if (P <= 0) {
        sub.classList.remove('wt-visible');
        sub.style.left   = WT_X0 + '%';
        sub.style.bottom = WT_Y0 + 'px';
      } else {
        sub.classList.add('wt-visible');
        const rawX = WT_X0 + P * (WT_X1 - WT_X0);
        const subY1= maxWH - WT_CLR;
        const rawB = WT_Y0 + P * (subY1 - WT_Y0);
        const maxB = Math.max(waterPx - WT_CLR, WT_Y0);
        sub.style.left   = rawX + '%';
        sub.style.bottom = Math.min(rawB, maxB) + 'px';
      }
    }

    /* Fish visibility */
    ['wt-fish1','wt-fish2','wt-fish3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('wt-visible', P > 0.04);
    });

    /* Particles */
    document.querySelectorAll('.wt-particle')
            .forEach(pt => pt.classList.toggle('wt-visible', P > 0.04));
  });

  /* Status text */
  const mlEl = document.getElementById('wt-ml-now');
  const stEl = document.getElementById('wt-status');

  if (mlEl) mlEl.textContent = (state.water * WT_ML) + 'ml';

  if (stEl) {
    if      (P === 0) { stEl.textContent = 'start drinking'; stEl.style.color = '#aaa';     }
    else if (P < .30) { stEl.textContent = 'keep going!';    stEl.style.color = '#4A90E2';  }
    else if (P < .70) { stEl.textContent = 'halfway there!'; stEl.style.color = '#2B7AB8';  }
    else if (P < 1)   { stEl.textContent = 'almost there!';  stEl.style.color = '#1a5f8f';  }
    else              { stEl.textContent = 'goal reached!';   stEl.style.color = '#27AE60';  }
  }

  /* Completion state */
  if (P >= 1 && !wtDone) {
    setWtDone(true);
    const cg = document.getElementById('wt-comp-glow');
    if (cg) cg.classList.add('show');

    wtBubbles(20);

    setTimeout(() => {
      const cb = document.getElementById('wt-comp-banner');
      if (cb) cb.classList.add('show');
    }, 700);

    if (!(state.earnedBadges || []).includes('hydrated')) {
      state.earnedBadges = state.earnedBadges || [];
      state.earnedBadges.push('hydrated');
      showToast('New badge: Pool Master! 💧', 'gt');
      confetti();
      debouncedSave();
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER WATER (called after state.water changes)
───────────────────────────────────────────────────────────────*/

/**
 * Syncs glass buttons and water level to state.water.
 */
export function renderWater() {
  const glasses = document.getElementById('wt-glasses');
  const scene   = document.getElementById('wt-scene');

  if (!glasses && !scene) return;

  wtApply(state.water / WT_GOAL);

  if (!glasses) {
    if (scene) wtBuildGlasses();
    return;
  }

  const buttons = glasses.querySelectorAll('.wt-glass-btn');

  if (buttons.length === WT_GOAL) {
    /* Update in-place — no rebuild */
    buttons.forEach((btn, i) => {
      const shouldBeFilled = i < state.water;
      const isFilled       = btn.classList.contains('wt-filled');
      if (shouldBeFilled !== isFilled) {
        btn.classList.toggle('wt-filled', shouldBeFilled);
        btn.setAttribute('aria-pressed',
          shouldBeFilled ? 'true' : 'false');
        btn.setAttribute('aria-label',
          'Glass ' + (i+1) + ' of ' + WT_GOAL +
          (shouldBeFilled ? ' — filled' : ' — empty'));
      }
    });
  } else {
    wtBuildGlasses();
  }
}

/* ─────────────────────────────────────────────────────────────
   BUILD GLASS BUTTONS
───────────────────────────────────────────────────────────────*/

/**
 * Builds the row of 11 glass buttons from scratch.
 */
export function wtBuildGlasses() {
  const row = document.getElementById('wt-glasses');
  if (!row) return;

  row.innerHTML = '';

  for (let i = 0; i < WT_GOAL; i++) {
    const b = document.createElement('button');
    b.className = 'wt-glass-btn' + (i < state.water ? ' wt-filled' : '');
    b.innerHTML = '💧';
    b.setAttribute('aria-label',
      'Glass ' + (i+1) + ' of ' + WT_GOAL +
      (i < state.water ? ' — filled' : ' — empty'));
    b.setAttribute('aria-pressed', i < state.water ? 'true' : 'false');
    b.dataset.i = i;

    b.onclick = ((idx) => () => {
      if (wtDone) return;
      const was    = idx < state.water;
      state.water  = was ? idx : idx + 1;
      if (!was) { wtSpawnDrop(); wtBubbles(7); }

      if (!state.waterLog) state.waterLog = {};
      state.waterLog[todayKey()] = state.water;

      wtApply(state.water / WT_GOAL);
      renderWater();
      debouncedSave();
      renderHydrationInsights();

      import('../shared/theme.js').then(m => {
        if (m.updateStatsBanner) m.updateStatsBanner();
      });
    })(i);

    row.appendChild(b);
  }
}

/* ─────────────────────────────────────────────────────────────
   ANIMATIONS
───────────────────────────────────────────────────────────────*/

/**
 * Spawns a falling water drop animation.
 */
export function wtSpawnDrop() {
  const scene = document.getElementById('wt-scene');
  if (!scene) return;

  const d       = document.createElement('div');
  d.className   = 'wt-drop-fall';
  d.textContent = '💧';
  d.style.left  = (15 + Math.random() * 65) + '%';
  scene.appendChild(d);

  setTimeout(() => {
    wtSpawnSplash(d.style.left);
    d.remove();
  }, 950);
}

/**
 * Spawns a splash effect at the water surface.
 */
export function wtSpawnSplash(lc) {
  const scene = document.getElementById('wt-scene');
  if (!scene) return;

  const s       = document.createElement('div');
  s.className   = 'wt-splash';
  s.textContent = '💦';
  s.style.left  = lc;
  s.style.top   = Math.max(50, 100 - (state.water / WT_GOAL) * 50) + '%';
  scene.appendChild(s);
  setTimeout(() => s.remove(), 800);
}

/**
 * Spawns rising bubble animations from the submarine position.
 * fc = forced count (0 = auto based on fill level).
 */
export function wtBubbles(fc) {
  const P     = state.water / WT_GOAL;
  const count = fc || (P < .3 ? 3 : P < .7 ? 6 : 10);
  const scene = document.getElementById('wt-scene');
  const sub   = document.getElementById('wt-sub');
  if (!scene || !sub) return;

  const sL = parseFloat(sub.style.left)   || WT_X0;
  const sB = parseFloat(sub.style.bottom) || WT_Y0;

  for (let i = 0; i < count; i++) {
    ((i) => setTimeout(() => {
      const b   = document.createElement('div');
      b.className = 'wt-bubble';
      const sz  = 3 + Math.random() * 7;
      b.style.cssText =
        'width:'  + sz + 'px;' +
        'height:' + sz + 'px;' +
        'left:'   + (sL + (Math.random() - .5) * 8) + '%;' +
        'bottom:' + (sB + 20 + Math.random() * 12) + 'px;' +
        '--dx:'   + ((Math.random() - .5) * 28) + 'px;' +
        'animation-duration:' + (1.1 + Math.random() * 1.3) + 's;';
      scene.appendChild(b);
      setTimeout(() => b.remove(), 2600);
    }, i * 80))(i);
  }
}

/**
 * Spawns floating particles inside the water body.
 * Only spawns when water > 0.
 */
export function wtSpawnParticles() {
  if ((state.water || 0) <= 0) return;
  const body = document.getElementById('wt-water-body');
  if (!body) return;

  body.querySelectorAll('.wt-particle').forEach(p => p.remove());

  for (let i = 0; i < 10; i++) {
    const pt    = document.createElement('div');
    pt.className= 'wt-particle';
    const sz    = 2 + Math.random() * 4;
    pt.style.cssText =
      'width:'             + sz + 'px;' +
      'height:'            + sz + 'px;' +
      'left:'              + (Math.random() * 100) + '%;' +
      'bottom:'            + (Math.random() * 80)  + '%;' +
      'animation-duration:'+ (4 + Math.random() * 5) + 's;' +
      'animation-delay:-'  + (Math.random() * 6) + 's;';
    body.appendChild(pt);
  }
}

/* ─────────────────────────────────────────────────────────────
   WATER REMINDER ENGINE
───────────────────────────────────────────────────────────────*/

let _wtRemInitPending = false;

/**
 * Initialises the water reminder UI from current state.
 * Guards against re-entrance with _wtRemInitPending.
 */
export function wtRemInit() {
  if (_wtRemInitPending) return;
  _wtRemInitPending = true;

  try {
    setTimeout(() => { _wtRemInitPending = false; }, 200);

    if (state.wtReminderInterval === undefined) state.wtReminderInterval  = 60;
    if (state.wtReminderTime     === undefined) state.wtReminderTime      = null;
    if (state.wtReminderEnabled  === undefined) state.wtReminderEnabled   = false;

    const intInp  = document.getElementById('wt-rem-interval');
    const timeInp = document.getElementById('wt-rem-starttime');

    if (intInp)  intInp.value  = state.wtReminderInterval;

    if (state.wtReminderTime && timeInp) {
      timeInp.value = state.wtReminderTime;
    } else if (timeInp) {
      const n = new Date();
      n.setMinutes(n.getMinutes() + state.wtReminderInterval);
      timeInp.value =
        String(n.getHours()).padStart(2,'0') + ':' +
        String(n.getMinutes()).padStart(2,'0');
    }

    _wtRemBuildPresets();
    wtRemUpdatePill();
    wtRemUpdateStatus();
    _wtRemHighlightPreset(state.wtReminderInterval);

    /* Clear and restart timers */
    if (wtRemNextTimeout) { clearTimeout(wtRemNextTimeout);  setWtRemNextTimeout(null); }
    if (wtRemTimer)       { clearInterval(wtRemTimer);       setWtRemTimer(null); }

    if (state.wtReminderEnabled) {
      wtRemScheduleNext();
      const tmr = setInterval(() => {
        if (document.getElementById('wt-rem-next-pill')) {
          wtRemUpdatePill();
          wtRemUpdateStatus();
        }
      }, 30000);
      setWtRemTimer(tmr);
    }

  } catch (e) {
    _wtRemInitPending = false;
    console.warn('wtRemInit error:', e);
  }
}

/**
 * Calculates milliseconds until the next reminder fires.
 * Returns -1 if reminders are disabled.
 */
export function wtRemMsUntilNext() {
  if (!state.wtReminderEnabled) return -1;

  const now      = Date.now();
  const interval = (state.wtReminderInterval || 60) * 60 * 1000;

  if (state.wtLastReminderFired)
    return (state.wtLastReminderFired + interval) - now;

  if (state.wtReminderTime) {
    const d       = new Date();
    const [hh,mm] = state.wtReminderTime.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
    let startMs   = d.getTime();
    if (startMs <= now) {
      const elapsed = now - startMs;
      const periods = Math.floor(elapsed / interval) + 1;
      startMs      += periods * interval;
    }
    return startMs - now;
  }

  return interval;
}

/**
 * Formats a millisecond duration as "Xh Ym", "X min" or "Xs".
 */
export function wtRemFormatCountdown(ms) {
  if (ms <= 0) return 'now';
  const totalSec = Math.round(ms / 1000);
  const h        = Math.floor(totalSec / 3600);
  const m        = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + ' min';
  return totalSec + 's';
}

/**
 * Schedules the next water reminder notification.
 * Uses _wtAppOpenTime to avoid firing immediately on app open.
 */
export function wtRemScheduleNext() {
  if (!state.wtReminderEnabled) return;

  const ms       = wtRemMsUntilNext();
  const interval = (state.wtReminderInterval || 60) * 60 * 1000;

  if (ms <= 0) {
    const sinceLastFire = state.wtLastReminderFired
      ? Date.now() - state.wtLastReminderFired
      : Infinity;
    const sinceAppOpen  = Date.now() - _wtAppOpenTime;

    /* Don't fire immediately on app open or if fired very recently */
    if (sinceAppOpen < 30000 || sinceLastFire < 60000) {
      if (wtRemNextTimeout) clearTimeout(wtRemNextTimeout);
      setWtRemNextTimeout(setTimeout(() => wtRemFire(), interval));
      return;
    }

    wtRemFire();
    return;
  }

  if (wtRemNextTimeout) clearTimeout(wtRemNextTimeout);
  setWtRemNextTimeout(setTimeout(() => wtRemFire(), ms));
}

/**
 * Fires the water reminder notification.
 */
export function wtRemFire() {
  if (!state.wtReminderEnabled) return;

  state.wtLastReminderFired = Date.now();
  debouncedSave(200);

  /* Use the reminders module for consistent notification handling */
  import('../tabs/reminders.js').then(m => {
    if (m.fireNotification)
      m.fireNotification(
        'Drink Water!',
        "Time for a glass — you're at " + state.water + '/' + WT_GOAL + ' glasses today.',
        '💧'
      );
  });

  showToast('Time to drink water! 💧', 'gt');
  wtRemUpdatePill();

  const statusEl = document.getElementById('wt-rem-status');
  if (statusEl) {
    statusEl.textContent = 'Just reminded you! Drink up.';
    statusEl.className   = 'wt-rem-status wt-rem-fired';
  }

  if (state.wtReminderEnabled) {
    const interval = (state.wtReminderInterval || 60) * 60 * 1000;
    if (wtRemNextTimeout) clearTimeout(wtRemNextTimeout);
    setWtRemNextTimeout(setTimeout(() => wtRemFire(), interval));
  }
}

/* ── Reminder UI helpers ── */

export function wtRemOnIntervalChange() {
  const inp = document.getElementById('wt-rem-interval');
  if (!inp) return;
  let v = parseInt(inp.value) || 60;
  v     = Math.max(15, Math.min(240, v));
  state.wtReminderInterval = v;
  _wtRemHighlightPreset(v);
  wtRemUpdatePill();
  debouncedSave(1500);
}

export function wtRemOnTimeChange() {
  const inp = document.getElementById('wt-rem-starttime');
  if (!inp) return;
  if (validateTimeString(inp.value)) {
    state.wtReminderTime = inp.value;
    wtRemUpdatePill();
  }
}

export function wtRemStep(delta) {
  const inp = document.getElementById('wt-rem-interval');
  if (!inp) return;
  let v     = (parseInt(inp.value) || 60) + delta;
  v         = Math.max(15, Math.min(240, v));
  inp.value = v;
  state.wtReminderInterval = v;
  _wtRemHighlightPreset(v);
  wtRemUpdatePill();
  debouncedSave(1500);
}

export function wtRemSave() {
  const intInp  = document.getElementById('wt-rem-interval');
  const timeInp = document.getElementById('wt-rem-starttime');

  let interval  = intInp ? (parseInt(intInp.value) || 60) : 60;
  interval      = Math.max(15, Math.min(240, interval));

  if (timeInp && !validateTimeString(timeInp.value)) {
    showToast('Invalid time format', 'rt');
    return;
  }

  state.wtReminderInterval = interval;
  state.wtReminderTime     = timeInp ? timeInp.value : null;
  state.wtReminderEnabled  = true;

  const nextMs  = wtRemMsUntilNext();
  const minStr  = nextMs > 0 ? wtRemFormatCountdown(nextMs) : 'right now';

  _wtRemHighlightPreset(interval);
  wtRemUpdatePill();
  wtRemUpdateStatus('Reminder set! Next alert in ' + minStr);

  /* Restart timers */
  if (wtRemNextTimeout) { clearTimeout(wtRemNextTimeout);  setWtRemNextTimeout(null); }
  if (wtRemTimer)       { clearInterval(wtRemTimer);       setWtRemTimer(null); }

  const tmr = setInterval(() => {
    if (document.getElementById('wt-rem-next-pill')) {
      wtRemUpdatePill();
      wtRemUpdateStatus();
    }
  }, 30000);
  setWtRemTimer(tmr);

  wtRemScheduleNext();
  debouncedSave();
  showToast('Water reminder set — every ' + interval + ' min!', 'gt');
}

export function wtRemSkip() {
  if (wtRemNextTimeout) { clearTimeout(wtRemNextTimeout); setWtRemNextTimeout(null); }
  state.wtLastReminderFired = Date.now();

  const interval = (state.wtReminderInterval || 60) * 60 * 1000;
  wtRemUpdatePill();
  wtRemUpdateStatus('Next reminder skipped. Resuming after that.');
  setWtRemNextTimeout(setTimeout(() => wtRemFire(), interval));

  debouncedSave(200);
  showToast('Skipped next water reminder', 'yt');
}

export function wtRemUpdatePill() {
  const pill = document.getElementById('wt-rem-next-pill');
  if (!pill) return;

  if (!state.wtReminderEnabled) {
    pill.textContent  = 'Not set';
    pill.className    = 'wt-rem-next-pill';
    return;
  }

  const ms = wtRemMsUntilNext();
  if      (ms < 0)            { pill.textContent = 'Not set';           pill.className = 'wt-rem-next-pill'; }
  else if (ms === 0)           { pill.textContent = 'Due now!';          pill.className = 'wt-rem-next-pill overdue'; }
  else if (ms <= 5*60*1000)   { pill.textContent = 'In ' + wtRemFormatCountdown(ms); pill.className = 'wt-rem-next-pill soon'; }
  else                         { pill.textContent = 'In ' + wtRemFormatCountdown(ms); pill.className = 'wt-rem-next-pill'; }
}

export function wtRemUpdateStatus(msg) {
  const el = document.getElementById('wt-rem-status');
  if (!el) return;

  if (msg) {
    el.textContent = msg;
    el.className   = 'wt-rem-status';
    return;
  }

  if (!state.wtReminderEnabled) {
    el.textContent = 'Tap "Set Reminder" to enable water alerts.';
    el.className   = 'wt-rem-status';
    return;
  }

  const ms       = wtRemMsUntilNext();
  const interval = state.wtReminderInterval || 60;

  if      (ms < 0)   { el.textContent = 'Reminder disabled.';         el.className = 'wt-rem-status'; }
  else if (ms === 0) { el.textContent = 'Time to drink water!';        el.className = 'wt-rem-status wt-rem-fired'; }
  else {
    el.className   = 'wt-rem-status';
    el.textContent =
      'Reminding every ' + interval + ' min · ' +
      'next in ' + wtRemFormatCountdown(ms) + ' · ' +
      'start ' + (state.wtReminderTime || '--:--');
  }
}

function _wtRemBuildPresets() {
  const row = document.getElementById('wt-rem-presets');
  if (!row) return;
  row.innerHTML = '';

  WT_REM_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className      = 'wt-rem-preset-btn';
    btn.textContent    = p.label;
    btn.dataset.interval = p.interval;
    btn.setAttribute('aria-label', 'Set reminder to ' + p.label);

    btn.onclick = () => {
      const intInp = document.getElementById('wt-rem-interval');
      if (intInp) intInp.value = p.interval;
      state.wtReminderInterval = p.interval;
      _wtRemHighlightPreset(p.interval);
      wtRemUpdatePill();
      wtRemUpdateStatus();
    };

    row.appendChild(btn);
  });
}

function _wtRemHighlightPreset(interval) {
  document.querySelectorAll('.wt-rem-preset-btn').forEach(btn => {
    btn.classList.toggle('active-preset', +btn.dataset.interval === +interval);
  });
}

/* ─────────────────────────────────────────────────────────────
   HYDRATION INSIGHTS
───────────────────────────────────────────────────────────────*/

/**
 * Renders the hydration insights panel below the water scene.
 * Shows today's intake, goal completion, and a trend vs last week.
 */
export function renderHydrationInsights() {
  const container = document.getElementById('hydration-insights-wrap');
  if (!container) return;

  const goal       = 3.3;
  const currentL   = (state.water || 0) * 0.3;
  const completionPct = Math.min(100, Math.round((currentL / goal) * 100));

  if (!state.waterLog) state.waterLog = {};

  const today = new Date();
  let priorSum  = 0;
  let priorDays = 0;

  for (let i = 1; i <= 7; i++) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    const key =
      d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
    const glasses = state.waterLog[key];
    if (glasses !== undefined && glasses > 0) {
      priorSum  += glasses * 0.3;
      priorDays++;
    }
  }

  const lastWeekAvg = priorDays > 0
    ? parseFloat((priorSum / priorDays).toFixed(1))
    : null;

  const diffPct = lastWeekAvg !== null && lastWeekAvg > 0
    ? Math.round(((currentL - lastWeekAvg) / lastWeekAvg) * 100)
    : 0;
  const isUp    = diffPct >= 0;

  let insightText = '';
  if      (currentL === 0)    insightText = 'You have not logged any water today. Start with a glass of lemon water!';
  else if (!lastWeekAvg)       insightText = 'Great start! Keep logging water daily to see your weekly trend.';
  else if (currentL < lastWeekAvg) insightText = 'You are drinking ' + Math.abs(diffPct) + '% less than your recent average. Try adding 1 extra glass before lunch!';
  else if (currentL >= goal)   insightText = 'Goal reached! You are fully hydrated. Your liver and skin will thank you!';
  else                         insightText = 'On track! You are matching your recent average. Keep going!';

  const avgDisplay  = currentL.toFixed(1);
  const trendClass  = isUp ? 'up' : 'down';
  const trendSymbol = isUp ? '↑' : '↓';

  container.innerHTML =
    '<div class="hydro-divider"></div>' +
    '<div class="hydro-header">HYDRATION INSIGHTS</div>' +
    '<div class="hydro-cards">' +

    /* Today's intake */
    '<div class="hydro-card"><div class="hydro-card-top-bar"></div><div class="hydro-card-body">' +
      '<div class="hydro-icon-ring" aria-hidden="true">💧</div>' +
      '<div class="hydro-card-label">TODAY\'S INTAKE</div>' +
      '<div style="display:flex;align-items:baseline;gap:2px;">' +
        '<span class="hydro-card-number">' + avgDisplay + '</span>' +
        '<span class="hydro-card-unit">L</span>' +
      '</div>' +
      (lastWeekAvg !== null
        ? '<div class="hydro-trend-pill ' + trendClass + '" ' +
            'aria-label="' + Math.abs(diffPct) + '% ' + (isUp ? 'more' : 'less') + ' than recent average">' +
            trendSymbol + ' ' + Math.abs(diffPct) + '% vs recent avg' +
          '</div>'
        : '<div style="font-size:10px;color:#94a3b8;margin-top:6px;">Log daily to see trend</div>') +
    '</div></div>' +

    /* Goal completion */
    '<div class="hydro-card"><div class="hydro-card-top-bar"></div><div class="hydro-card-body">' +
      '<div class="hydro-icon-ring" aria-hidden="true">📅</div>' +
      '<div class="hydro-card-label">GOAL COMPLETION</div>' +
      '<div style="display:flex;align-items:baseline;gap:2px;">' +
        '<span class="hydro-card-number">' + completionPct + '</span>' +
        '<span class="hydro-card-unit">%</span>' +
      '</div>' +
      '<div class="hydro-bar-track" ' +
        'role="progressbar" ' +
        'aria-valuenow="' + completionPct + '" ' +
        'aria-valuemin="0" aria-valuemax="100">' +
        '<div class="hydro-bar-fill" style="width:' + completionPct + '%"></div>' +
      '</div>' +
      '<div class="hydro-bar-label"><span>0%</span><span>100%</span></div>' +
    '</div></div>' +

    /* Daily goal */
    '<div class="hydro-card"><div class="hydro-card-top-bar"></div><div class="hydro-card-body">' +
      '<div class="hydro-icon-ring" aria-hidden="true">🎯</div>' +
      '<div class="hydro-card-label">DAILY GOAL</div>' +
      '<div style="display:flex;align-items:baseline;gap:2px;">' +
        '<span class="hydro-card-number">3.3</span>' +
        '<span class="hydro-card-unit">L</span>' +
      '</div>' +
      '<div style="font-size:10px;color:#64748b;margin-top:4px;">' + state.water + '/11 glasses</div>' +
    '</div></div>' +

    '</div>' + /* /hydro-cards */

    '<div class="hydro-insight">' +
      '<div class="hydro-insight-text">' + sanitizeHTML(insightText) + '</div>' +
    '</div>';
}

/* ─────────────────────────────────────────────────────────────
   BUILD WATER SECTION (called by today.js)
───────────────────────────────────────────────────────────────*/

/**
 * Builds the complete water tracker card element.
 * Appends it to the today-sections container.
 * Returns the card element.
 */
export function buildWaterSection() {
  _injectWaterCSS();

  const sc      = document.createElement('div');
  sc.className  = 'sc sc-water-full-width';

  sc.innerHTML =
    '<div class="sh">' +
      '<span class="si" aria-hidden="true">💧</span>' +
      '<span class="st">Water</span>' +
      '<span class="stag">11 × 300ml = 3.3L</span>' +
    '</div>' +

    '<div class="wt-wrap">' +

      /* Scene */
      '<div class="wt-scene" id="wt-scene" ' +
           'role="img" aria-label="Water tracker visualization">' +

        '<div class="wt-sun" aria-hidden="true"><div class="wt-sun-core"></div></div>' +

        '<div class="wt-clouds" aria-hidden="true">' +
          '<div class="wt-cloud wc1"><div class="wt-cshape"></div></div>' +
          '<div class="wt-cloud wc2"><div class="wt-cshape"></div></div>' +
          '<div class="wt-cloud wc3"><div class="wt-cshape"></div></div>' +
          '<div class="wt-cloud wc4"><div class="wt-cshape"></div></div>' +
        '</div>' +

        '<div class="wt-water" id="wt-water" aria-hidden="true">' +
          '<div class="wt-water-body" id="wt-water-body">' +
            '<div class="wt-fish" id="wt-fish1" ' +
                 'style="bottom:26%;left:68%;font-size:14px;' +
                        'animation-duration:17s;animation-delay:-4s;">🐟</div>' +
            '<div class="wt-fish" id="wt-fish2" ' +
                 'style="bottom:54%;left:50%;font-size:10px;' +
                        'animation-duration:23s;animation-delay:-9s;">🐠</div>' +
            '<div class="wt-fish" id="wt-fish3" ' +
                 'style="bottom:38%;left:80%;font-size:9px;' +
                        'animation-duration:20s;animation-delay:-6s;">🐡</div>' +
          '</div>' +
          '<div class="wt-wave-wrap">' +
            '<svg viewBox="0 0 1200 20" preserveAspectRatio="none" ' +
                 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
              '<path d="M0,10 C100,2 200,18 300,10 C400,2 500,18 600,10 ' +
                       'C700,2 800,18 900,10 C1000,2 1100,18 1200,10 ' +
                       'L1200,20 L0,20 Z" fill="rgba(255,255,255,0.32)"/>' +
            '</svg>' +
          '</div>' +
        '</div>' +

        /* Submarine */
        '<div class="wt-sub" id="wt-sub" aria-hidden="true">' +
          '<svg width="62" height="28" viewBox="0 0 64 30" ' +
               'xmlns="http://www.w3.org/2000/svg">' +
            '<ellipse cx="32" cy="20" rx="25" ry="9" fill="#E74C3C"/>' +
            '<rect x="25" y="9" width="13" height="9" rx="3" fill="#C0392B"/>' +
            '<rect x="30" y="4" width="4"  height="7" rx="2" fill="#C0392B"/>' +
            '<circle cx="32" cy="4" r="3" fill="#888"/>' +
            '<circle cx="44" cy="20" r="5.5" fill="#5DADE2" opacity=".88"/>' +
            '<ellipse cx="9" cy="20" rx="7" ry="9" fill="#C0392B"/>' +
            '<g id="wt-prop">' +
              '<ellipse cx="5" cy="20" rx="2" ry="6" fill="#7F8C8D"/>' +
              '<ellipse cx="5" cy="20" rx="6" ry="2" fill="#95A5A6" opacity=".8"/>' +
            '</g>' +
            '<polygon points="29,27 25,30 35,30" fill="#C0392B"/>' +
          '</svg>' +
        '</div>' +

        '<div class="wt-comp-glow"   id="wt-comp-glow"   aria-hidden="true"></div>' +
        '<div class="wt-comp-banner" id="wt-comp-banner" aria-live="polite">' +
          '<p>🌊 Hydration complete!</p>' +
          '<span>The submarine has surfaced. Well done!</span>' +
        '</div>' +

      '</div>' + /* /wt-scene */

      /* Panel */
      '<div class="wt-panel">' +
        '<div class="wt-glasses-row" id="wt-glasses" ' +
             'role="group" aria-label="Water glasses — tap to log"></div>' +
        '<div class="wt-info">' +
          '<span class="wt-ml-now" id="wt-ml-now" aria-live="polite">0ml</span>' +
          '<span class="wt-ml-goal">/ 3300ml</span>' +
          '<span class="wt-status" id="wt-status" ' +
                'aria-live="polite" style="color:#aaa;">start drinking</span>' +
        '</div>' +
      '</div>' +

      /* Reminder wrap */
      _buildWaterReminderHTML() +

    '</div>'; /* /wt-wrap */

  /* Hydration insights div — appended inside wt-wrap */
  const hydroDiv     = document.createElement('div');
  hydroDiv.id        = 'hydration-insights-wrap';
  hydroDiv.className = 'hydro-wrap';
  const wtWrap       = sc.querySelector('.wt-wrap');
  if (wtWrap) wtWrap.appendChild(hydroDiv);
  else        sc.appendChild(hydroDiv);

  /* Initialise after DOM insertion */
  setTimeout(() => {
    setWtDone(false);
    setCachedSceneHeight(0);
    wtBuildGlasses();
    wtApply(state.water / WT_GOAL);

    /* Idle bubble timer */
    if (wtIdleTmr) { clearInterval(wtIdleTmr); setWtIdleTmr(null); }
    const tmr = setInterval(() => {
      if (state.water > 0 && !wtDone) wtBubbles(0);
    }, 3200);
    setWtIdleTmr(tmr);

    _wtStartAnimation();
    wtSpawnParticles();

    const hw = document.getElementById('hydration-insights-wrap');
    if (hw) renderHydrationInsights();

    setWtSceneInitialized(true);

    /* Init reminder UI if input exists */
    const intInp = document.getElementById('wt-rem-interval');
    if (intInp) wtRemInit();

  }, 100);

  return sc;
}

/* ─────────────────────────────────────────────────────────────
   WATER REMINDER HTML
───────────────────────────────────────────────────────────────*/
function _buildWaterReminderHTML() {
  return (
    '<div class="wt-reminder-wrap" id="wt-reminder-wrap">' +
      '<div class="wt-rem-header">' +
        '<div class="wt-rem-title">' +
          '<div class="wt-rem-title-icon" aria-hidden="true">⏰</div>' +
          'Next Water Reminder' +
        '</div>' +
        '<div class="wt-rem-next-pill" id="wt-rem-next-pill" aria-live="polite">Not set</div>' +
      '</div>' +

      '<div class="wt-rem-grid">' +

        /* Interval card */
        '<div class="wt-rem-card">' +
          '<div class="wt-rem-card-label">Remind every</div>' +
          '<div class="wt-rem-card-row">' +
            '<input class="wt-rem-interval-input" id="wt-rem-interval" ' +
                   'type="number" min="15" max="240" value="60" ' +
                   'aria-label="Reminder interval in minutes" ' +
                   'onchange="wtRemOnIntervalChange()" ' +
                   'oninput="wtRemOnIntervalChange()"/>' +
            '<span class="wt-rem-unit">min</span>' +
            '<div class="wt-rem-stepper">' +
              '<button class="wt-rem-step-btn" onclick="wtRemStep(15)" ' +
                      'aria-label="Increase by 15 minutes">▲</button>' +
              '<button class="wt-rem-step-btn" onclick="wtRemStep(-15)" ' +
                      'aria-label="Decrease by 15 minutes">▼</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Start time card */
        '<div class="wt-rem-card">' +
          '<div class="wt-rem-card-label">Start from time</div>' +
          '<div class="wt-rem-card-row">' +
            '<input class="wt-rem-time-input" id="wt-rem-starttime" ' +
                   'type="time" value="08:00" ' +
                   'aria-label="Reminder start time" ' +
                   'onchange="wtRemOnTimeChange()"/>' +
          '</div>' +
        '</div>' +

      '</div>' + /* /wt-rem-grid */

      '<div class="wt-rem-presets" id="wt-rem-presets" ' +
           'role="group" aria-label="Reminder interval presets"></div>' +

      '<div class="wt-rem-actions">' +
        '<button class="wt-rem-save-btn" onclick="wtRemSave()">Set Reminder</button>' +
        '<button class="wt-rem-skip-btn" onclick="wtRemSkip()">Skip Next</button>' +
      '</div>' +

      '<div class="wt-rem-status" id="wt-rem-status" aria-live="polite">' +
        'Set your reminder interval above' +
      '</div>' +

    '</div>'
  );
}

/* ─────────────────────────────────────────────────────────────
   CSS INJECTOR
───────────────────────────────────────────────────────────────*/
function _injectWaterCSS() {
  if (document.getElementById('wt-css')) return;
  const s = document.createElement('style');
  s.id    = 'wt-css';
  s.textContent = `
    .wt-wrap { padding: 10px 12px 0; }
    .wt-scene {
      width: 100%; height: 200px; border-radius: 16px;
      position: relative; overflow: hidden;
      background: linear-gradient(180deg,#C8EEFF 0%,#9DD8F5 40%,#74C4EC 100%);
      box-shadow: 0 6px 24px rgba(0,80,160,.18);
    }
    @media(max-width:500px) { .wt-scene { height: 160px; border-radius: 12px; } }
    @media(min-width:1024px){ .wt-scene { height: 260px; } }
    .wt-sun { position:absolute;top:10px;right:12px;width:clamp(30px,7vw,52px);height:clamp(30px,7vw,52px);z-index:4; }
    .wt-sun-core {
      width:100%;height:100%;border-radius:50%;
      background:radial-gradient(circle at 36% 34%,#FFFDE7 0%,#FFD740 50%,#FFA000 100%);
      box-shadow:0 0 0 clamp(3px,.8vw,9px) rgba(255,215,64,.22),0 0 clamp(16px,4vw,45px) rgba(255,180,0,.5);
      animation:wtSunPulse 4s ease-in-out infinite;
    }
    @keyframes wtSunPulse {
      0%,100%{box-shadow:0 0 0 clamp(3px,.8vw,9px) rgba(255,215,64,.22),0 0 clamp(16px,4vw,45px) rgba(255,180,0,.5);}
      50%{box-shadow:0 0 0 clamp(5px,1.2vw,14px) rgba(255,215,64,.14),0 0 clamp(26px,6vw,70px) rgba(255,180,0,.68);}
    }
    .wt-clouds{position:absolute;top:0;left:0;right:0;height:52%;z-index:3;pointer-events:none;overflow:hidden;}
    .wt-cloud{position:absolute;}
    .wt-cshape{position:relative;background:rgba(255,255,255,.94);border-radius:100px;filter:drop-shadow(0 2px 6px rgba(100,160,210,.18));}
    .wt-cshape::before,.wt-cshape::after{content:'';position:absolute;background:rgba(255,255,255,.94);border-radius:50%;}
    .wc1{top:18%;left:3%;animation:wcd1 22s ease-in-out infinite alternate;}
    .wc1 .wt-cshape{width:clamp(54px,13vw,100px);height:clamp(18px,4.5vw,34px);}
    .wc1 .wt-cshape::before{width:clamp(26px,6.5vw,48px);height:clamp(26px,6.5vw,48px);top:clamp(-13px,-3.2vw,-24px);left:clamp(7px,1.8vw,13px);}
    .wc1 .wt-cshape::after{width:clamp(32px,8vw,58px);height:clamp(22px,5.5vw,40px);top:clamp(-11px,-2.7vw,-20px);right:clamp(7px,1.8vw,13px);}
    .wc2{top:42%;left:20%;animation:wcd2 18s ease-in-out infinite alternate;}
    .wc2 .wt-cshape{width:clamp(44px,11vw,84px);height:clamp(15px,3.8vw,28px);}
    .wc2 .wt-cshape::before{width:clamp(20px,5vw,38px);height:clamp(20px,5vw,38px);top:clamp(-10px,-2.5vw,-19px);left:clamp(6px,1.5vw,11px);}
    .wc2 .wt-cshape::after{width:clamp(26px,6.5vw,48px);height:clamp(17px,4.2vw,32px);top:clamp(-8px,-2vw,-16px);right:clamp(6px,1.5vw,11px);}
    .wc3{top:10%;left:44%;animation:wcd1 25s ease-in-out infinite alternate-reverse;}
    .wc3 .wt-cshape{width:clamp(40px,10vw,76px);height:clamp(14px,3.5vw,26px);}
    .wc3 .wt-cshape::before{width:clamp(18px,4.5vw,34px);height:clamp(18px,4.5vw,34px);top:clamp(-9px,-2.2vw,-17px);left:clamp(5px,1.2vw,10px);}
    .wc3 .wt-cshape::after{width:clamp(22px,5.5vw,42px);height:clamp(15px,3.7vw,28px);top:clamp(-7px,-1.8vw,-14px);right:clamp(5px,1.2vw,10px);}
    .wc4{top:35%;left:62%;animation:wcd2 20s ease-in-out infinite alternate;}
    .wc4 .wt-cshape{width:clamp(34px,8.5vw,64px);height:clamp(11px,2.8vw,22px);}
    .wc4 .wt-cshape::before{width:clamp(15px,3.8vw,28px);height:clamp(15px,3.8vw,28px);top:clamp(-7px,-1.9vw,-14px);left:clamp(4px,1vw,8px);}
    .wc4 .wt-cshape::after{width:clamp(18px,4.5vw,34px);height:clamp(12px,3vw,22px);top:clamp(-6px,-1.5vw,-11px);right:clamp(4px,1vw,8px);}
    @media(max-width:420px){.wc4{display:none;}}
    @keyframes wcd1{from{transform:translateX(0)}to{transform:translateX(16px)}}
    @keyframes wcd2{from{transform:translateX(8px)}to{transform:translateX(-12px)}}
    .wt-water{position:absolute;bottom:0;left:0;right:0;height:0%;border-radius:0 0 16px 16px;z-index:5;transition:height .9s cubic-bezier(.4,0,.2,1);pointer-events:none;overflow:visible;}
    .wt-water-body{position:absolute;inset:0;background:linear-gradient(180deg,rgba(52,162,225,.9) 0%,#1A6AAA 45%,#0C3F70 100%);border-radius:0 0 16px 16px;will-change:transform;transform:translateZ(0);}
    .wt-water-body::before{content:'';position:absolute;top:0;left:12%;width:9%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.08) 0%,transparent 100%);transform:skewX(-8deg);}
    .wt-water-body::after{content:'';position:absolute;top:0;left:50%;width:6%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.05) 0%,transparent 100%);transform:skewX(5deg);}
    .wt-wave-wrap{position:absolute;top:-16px;left:0;width:200%;height:20px;z-index:6;pointer-events:none;will-change:transform;transform:translateZ(0);}
    .wt-wave-wrap svg{width:100%;height:100%;animation:wtWave 5s linear infinite;}
    @keyframes wtWave{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    .wt-sub{position:absolute;z-index:8;opacity:0;transition:left .9s cubic-bezier(.4,0,.2,1),bottom .9s cubic-bezier(.4,0,.2,1),opacity .6s ease;animation:wtBob 3.4s ease-in-out infinite;will-change:transform,left,bottom;transform:translateZ(0);}
    .wt-sub.wt-visible{opacity:1;}
    @keyframes wtBob{0%,100%{transform:translateY(0) rotate(0deg)}30%{transform:translateY(-5px) rotate(-1.2deg)}70%{transform:translateY(3px) rotate(.8deg)}}
    .wt-bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,.42);border:1px solid rgba(255,255,255,.75);pointer-events:none;z-index:7;animation:wtBRise linear forwards;}
    @keyframes wtBRise{0%{opacity:.8;transform:translateY(0)}100%{opacity:0;transform:translateY(-70px) translateX(var(--dx))}}
    .wt-particle{position:absolute;border-radius:50%;background:rgba(255,255,255,.25);pointer-events:none;opacity:0;animation:wtPtFloat linear infinite;z-index:6;transition:opacity .8s ease;}
    .wt-particle.wt-visible{opacity:1;}
    @keyframes wtPtFloat{0%{transform:translateY(0);opacity:.5}100%{transform:translateY(-80px);opacity:0}}
    .wt-fish{position:absolute;z-index:4;opacity:0;transition:opacity .8s ease;animation:wtFishSwim linear infinite;will-change:transform;}
    .wt-fish.wt-visible{opacity:.6;}
    @keyframes wtFishSwim{0%{transform:translateX(0)}100%{transform:translateX(-150px)}}
    .wt-drop-fall{position:absolute;font-size:18px;pointer-events:none;z-index:20;animation:wtDropFall .95s ease-in forwards;}
    @keyframes wtDropFall{0%{top:6%;opacity:1}80%{opacity:.8}100%{top:52%;opacity:0}}
    .wt-splash{position:absolute;pointer-events:none;z-index:9;font-size:13px;animation:wtSplash .75s ease-out forwards;}
    @keyframes wtSplash{0%{opacity:1;transform:scale(.6) translateY(0)}100%{opacity:0;transform:scale(2.2) translateY(-12px)}}
    .wt-comp-glow{position:absolute;inset:0;border-radius:16px;background:radial-gradient(ellipse at 80% 50%,rgba(100,230,255,.2) 0%,transparent 65%);opacity:0;transition:opacity 1s ease;z-index:10;pointer-events:none;}
    .wt-comp-glow.show{opacity:1;}
    .wt-comp-banner{position:absolute;bottom:10px;left:50%;transform:translateX(-50%) translateY(40px);background:rgba(255,255,255,.96);border-radius:12px;padding:8px 20px;text-align:center;z-index:12;opacity:0;transition:all .6s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 4px 22px rgba(0,100,200,.18);white-space:nowrap;}
    .wt-comp-banner.show{opacity:1;transform:translateX(-50%) translateY(0);}
    .wt-comp-banner p{font-size:12px;font-weight:700;color:#1a6fa8;}
    .wt-comp-banner span{font-size:10px;color:#5aa8cc;}
    .wt-panel{background:#fff;border:1px solid rgba(139,92,246,0.05);border-top:none;border-radius:0 0 var(--r-xl) var(--r-xl);padding:12px 14px;display:flex;flex-direction:column;gap:10px;margin-bottom:12px;}
    .wt-glasses-row{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;}
    .wt-glasses-row::-webkit-scrollbar{display:none;}
    .wt-glass-btn{width:38px;height:38px;border-radius:var(--r-pill);border:2px solid #D0E8F8;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;transition:all .22s cubic-bezier(.34,1.56,.64,1);position:relative;box-shadow:0 2px 6px rgba(0,0,0,.06);user-select:none;flex-shrink:0;}
    .wt-glass-btn:hover{transform:translateY(-3px);box-shadow:0 6px 16px rgba(74,144,226,.22);border-color:#4A90E2;}
    .wt-glass-btn.wt-filled{background:linear-gradient(135deg,#E1F3FF,#B3D9F8);border-color:#4A90E2;}
    .wt-glass-btn.wt-filled::after{content:'✓';position:absolute;top:2px;right:3px;color:#1565C0;font-size:9px;font-weight:800;}
    .wt-info{display:flex;align-items:center;gap:7px;flex-shrink:0;}
    .wt-ml-now{font-size:14px;font-weight:900;color:#1a5f8f;}
    .wt-ml-goal{font-size:12px;color:#aaa;}
    .wt-status{font-size:11px;font-weight:600;transition:color .3s;}
    .wt-reminder-wrap{background:#fff;border:1px solid #e0f2fe;border-top:none;border-radius:0 0 var(--r-xl) var(--r-xl);padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px;}
    .wt-rem-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;}
    .wt-rem-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#0369a1;letter-spacing:.3px;}
    .wt-rem-title-icon{width:28px;height:28px;border-radius:8px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
    .wt-rem-next-pill{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(90deg,#0ea5e9,#38bdf8);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:var(--r-pill);box-shadow:0 2px 8px rgba(14,165,233,.28);white-space:nowrap;}
    .wt-rem-next-pill.overdue{background:linear-gradient(90deg,#ef4444,#f87171);}
    .wt-rem-next-pill.soon{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
    .wt-rem-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    @media(max-width:640px){.wt-rem-grid{grid-template-columns:1fr;gap:8px;}}
    .wt-rem-card{background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:var(--r-md);padding:11px 13px;display:flex;flex-direction:column;gap:6px;}
    .wt-rem-card-label{font-size:9px;font-weight:700;color:#0284c7;letter-spacing:2px;text-transform:uppercase;}
    .wt-rem-card-row{display:flex;align-items:center;gap:8px;}
    .wt-rem-interval-input{width:64px;font-size:18px;font-weight:900;color:#0c4a6e;background:#fff;border:1.5px solid #7dd3fc;border-radius:var(--r-sm);padding:6px 8px;text-align:center;outline:none;font-family:var(--font);}
    .wt-rem-interval-input:focus{border-color:#0284c7;}
    .wt-rem-unit{font-size:12px;font-weight:600;color:#0369a1;}
    .wt-rem-stepper{display:flex;flex-direction:column;gap:3px;margin-left:auto;}
    .wt-rem-step-btn{width:26px;height:22px;border-radius:6px;border:1.5px solid #7dd3fc;background:#fff;color:#0284c7;font-size:13px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:all .15s;font-family:var(--font);}
    .wt-rem-step-btn:hover{background:#0284c7;color:#fff;border-color:#0284c7;}
    .wt-rem-time-input{flex:1;font-size:16px;font-weight:800;color:#0c4a6e;background:#fff;border:1.5px solid #7dd3fc;border-radius:var(--r-sm);padding:7px 10px;outline:none;font-family:var(--font);}
    .wt-rem-time-input:focus{border-color:#0284c7;}
    .wt-rem-actions{display:flex;gap:8px;flex-wrap:wrap;}
    .wt-rem-save-btn{flex:1;padding:10px 16px;background:linear-gradient(135deg,#0284c7,#0ea5e9);color:#fff;border:none;border-radius:var(--r-pill);font-size:12px;font-weight:800;cursor:pointer;font-family:var(--font);transition:all .2s;box-shadow:0 3px 12px rgba(2,132,199,.25);}
    .wt-rem-save-btn:hover{transform:translateY(-1px);}
    .wt-rem-skip-btn{padding:10px 14px;background:#f0f9ff;color:#0284c7;border:1.5px solid #7dd3fc;border-radius:var(--r-pill);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);}
    .wt-rem-presets{display:flex;gap:6px;flex-wrap:wrap;}
    .wt-rem-preset-btn{font-size:10px;font-weight:700;padding:5px 12px;border-radius:var(--r-pill);border:1.5px solid #bae6fd;background:#fff;color:#0284c7;cursor:pointer;transition:all .18s;font-family:var(--font);}
    .wt-rem-preset-btn:hover{background:#0284c7;color:#fff;border-color:#0284c7;}
    .wt-rem-preset-btn.active-preset{background:#0284c7;color:#fff;border-color:#0369a1;}
    .wt-rem-status{font-size:11px;font-weight:600;color:#0369a1;background:#e0f2fe;border-radius:var(--r-sm);padding:7px 12px;text-align:center;line-height:1.5;}
    .wt-rem-status.wt-rem-fired{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;}
    .hydro-wrap{padding:4px 14px 14px;}
    .hydro-divider{height:1px;background:#e2e8f0;margin:12px 0 8px;}
    .hydro-header{font-size:9px;font-weight:700;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
    .hydro-header::after{content:'';flex:1;height:1px;background:#e2e8f0;}
    .hydro-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
    @media(max-width:640px){.hydro-cards{grid-template-columns:1fr 1fr;}}
    .hydro-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(148,163,184,0.10);}
    .hydro-card-top-bar{height:3px;background:linear-gradient(90deg,#0284c7,#22d3ee);}
    .hydro-card-body{padding:12px 12px 10px;}
    .hydro-icon-ring{width:30px;height:30px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:8px;}
    .hydro-card-label{font-size:9px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px;}
    .hydro-card-number{font-size:24px;font-weight:900;color:#0f172a;line-height:1;}
    .hydro-card-unit{font-size:12px;font-weight:500;color:#64748b;margin-left:2px;}
    .hydro-trend-pill{display:inline-flex;align-items:center;gap:2px;border-radius:var(--r-pill);padding:2px 8px;font-size:10px;font-weight:700;margin-top:6px;}
    .hydro-trend-pill.up{background:#f0fdf4;color:#22c55e;}
    .hydro-trend-pill.down{background:#fef2f2;color:#ef4444;}
    .hydro-bar-track{height:5px;border-radius:var(--r-pill);background:#e0f2fe;margin-top:8px;overflow:hidden;}
    .hydro-bar-fill{height:5px;border-radius:var(--r-pill);background:linear-gradient(90deg,#0ea5e9,#06b6d4);}
    .hydro-bar-label{display:flex;justify-content:space-between;font-size:9px;font-weight:500;color:#94a3b8;margin-top:3px;}
    .hydro-insight{background:#f0f9ff;border:1px solid #bae6fd;border-radius:var(--r-sm);padding:8px 12px;margin-top:8px;}
    .hydro-insight-text{font-size:11px;font-weight:500;color:#0369a1;font-style:italic;}
  `;
  document.head.appendChild(s);
}
