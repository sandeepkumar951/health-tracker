/* ═══════════════════════════════════════════════════════════════
   tabs/english.js
   Language progress tab — Hindi and English daily tracking,
   streaks, skill bars, mark-as-done buttons.
   Depends on: core/state.js, core/utils.js, core/firebase.js
═══════════════════════════════════════════════════════════════ */

'use strict';

import {
  state
} from '../core/state.js';

import {
  todayKey,
  daysBetween,
  sanitizeHTML,
  showToast
} from '../core/utils.js';

import {
  debouncedSave
} from '../core/firebase.js';

/* ─────────────────────────────────────────────────────────────
   STREAK CALCULATOR
───────────────────────────────────────────────────────────────*/

/**
 * Calculates the new streak value when a task is marked done.
 * - Same day  → keep current streak
 * - Yesterday → increment streak
 * - Older     → reset to 1
 */
function calcStreak(lastDate, currentStreak) {
  const today = todayKey();
  if (!lastDate) return 1;
  const diff = daysBetween(lastDate, today);
  if (diff === 0) return currentStreak || 1;
  if (diff === 1) return (currentStreak || 0) + 1;
  return 1;
}

/* ─────────────────────────────────────────────────────────────
   DAILY RESET
───────────────────────────────────────────────────────────────*/

/**
 * Resets all daily language done-flags at midnight.
 * Called by firebase.js via the sandy:resetLangFlags event.
 */
export function resetDailyLangFlags() {
  state.hiReadDone  = false;
  state.hiSpeakDone = false;
  state.hiLearnDone = false;
  state.engReadDone  = false;
  state.engSpeakDone = false;
  state.engLearnDone = false;

  /* Re-render if the page element exists */
  if (document.getElementById('hi-read-btn')) renderLangUI();
}

/* ─────────────────────────────────────────────────────────────
   HINDI — MARK ACTIONS
───────────────────────────────────────────────────────────────*/

export function hiMarkRead() {
  if (state.hiReadDone) { showToast('Already marked today!'); return; }
  state.hiReadDone    = true;
  state.hiReadStreak  = calcStreak(state.hiReadLastDate, state.hiReadStreak);
  state.hiReadLastDate= todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('Hindi reading marked! +5 XP', 'gt');
}

export function hiMarkSpeak() {
  if (state.hiSpeakDone) { showToast('Already marked today!'); return; }
  state.hiSpeakDone    = true;
  state.hiSpeakStreak  = calcStreak(state.hiSpeakLastDate, state.hiSpeakStreak);
  state.hiSpeakLastDate= todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('Hindi speaking marked! +5 XP', 'gt');
}

export function hiMarkLearn() {
  if (state.hiLearnDone) { showToast('Already marked today!'); return; }
  state.hiLearnDone    = true;
  state.hiLearnStreak  = calcStreak(state.hiLearnLastDate, state.hiLearnStreak);
  state.hiLearnLastDate= todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('Hindi words learned! +5 XP', 'gt');
}

/* ─────────────────────────────────────────────────────────────
   ENGLISH — MARK ACTIONS
───────────────────────────────────────────────────────────────*/

export function engMarkRead() {
  if (state.engReadDone) { showToast('Already marked today!'); return; }
  state.engReadDone  = true;
  state.engStreak    = calcStreak(state.lastEngDate, state.engStreak);
  state.lastEngDate  = todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('English reading marked! +5 XP', 'gt');
}

export function engMarkSpeak() {
  if (state.engSpeakDone) { showToast('Already marked today!'); return; }
  state.engSpeakDone    = true;
  state.engSpeakStreak  = calcStreak(state.engSpeakLastDate, state.engSpeakStreak);
  state.engSpeakLastDate= todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('English speaking marked! +5 XP', 'gt');
}

export function engMarkLearn() {
  if (state.engLearnDone) { showToast('Already marked today!'); return; }
  state.engLearnDone    = true;
  state.engLearnStreak  = calcStreak(state.engLearnLastDate, state.engLearnStreak);
  state.engLearnLastDate= todayKey();
  _addXP(5);
  renderLangUI();
  debouncedSave();
  showToast('Words learned marked! +5 XP', 'gt');
}

/* ─────────────────────────────────────────────────────────────
   RENDER UI
───────────────────────────────────────────────────────────────*/

/**
 * Refreshes all language progress bars, streak badges,
 * and done-button states from current state.
 */
export function renderLangUI() {
  /* ── Hindi bars ── */
  _setLangBar('hi-read-bar',  'hi-read-pct',  state.hiReadDone  ? 100 : 0, 'var(--purple-500)');
  _setLangBar('hi-speak-bar', 'hi-speak-pct', state.hiSpeakDone ? 100 : 0, 'var(--purple-500)');
  _setLangBar('hi-learn-bar', 'hi-learn-pct', state.hiLearnDone ? 100 : 0, 'var(--purple-500)');

  const hiDone = [state.hiReadDone, state.hiSpeakDone, state.hiLearnDone].filter(Boolean).length;
  _setLangBar(
    'hi-overall-bar', 'hi-overall-pct',
    Math.round(hiDone / 3 * 100),
    'linear-gradient(90deg,var(--purple-500),var(--purple-400))'
  );

  /* ── Hindi streak badges ── */
  _setLangText('hi-read-streak',  state.hiReadStreak  || 0);
  _setLangText('hi-speak-streak', state.hiSpeakStreak || 0);
  _setLangText('hi-learn-streak', state.hiLearnStreak || 0);

  /* ── Hindi buttons ── */
  _setLangDoneBtn('hi-read-btn',  state.hiReadDone,  'Read today',    'Read done');
  _setLangDoneBtn('hi-speak-btn', state.hiSpeakDone, 'Spoke today',   'Spoke done');
  _setLangDoneBtn('hi-learn-btn', state.hiLearnDone, 'Learned today', 'Learned done');

  /* ── English bars ── */
  _setLangBar('eng-read-bar',  'eng-read-pct',  state.engReadDone  ? 100 : 0, 'var(--green-500)');
  _setLangBar('eng-speak-bar', 'eng-speak-pct', state.engSpeakDone ? 100 : 0, 'var(--green-500)');
  _setLangBar('eng-learn-bar', 'eng-learn-pct', state.engLearnDone ? 100 : 0, 'var(--green-500)');

  const engDone = [state.engReadDone, state.engSpeakDone, state.engLearnDone].filter(Boolean).length;
  _setLangBar(
    'eng-overall-bar', 'eng-overall-pct',
    Math.round(engDone / 3 * 100),
    'linear-gradient(90deg,var(--green-500),var(--green-400))'
  );

  /* ── English streak badges ── */
  _setLangText('eng-reading-streak-badge', state.engStreak      || 0);
  _setLangText('eng-days-done',            state.engStreak      || 0);
  _setLangText('eng-speak-streak',         state.engSpeakStreak || 0);
  _setLangText('eng-learn-streak',         state.engLearnStreak || 0);

  /* ── English buttons ── */
  _setLangDoneBtn('eng-read-btn',  state.engReadDone,  'Read today',    'Read done');
  _setLangDoneBtn('eng-speak-btn', state.engSpeakDone, 'Spoke today',   'Spoke done');
  _setLangDoneBtn('eng-learn-btn', state.engLearnDone, 'Learned today', 'Learned done');

  /* Update rewards if theme module is available */
  import('../shared/theme.js').then(m => {
    if (m.updateReward)       m.updateReward();
    if (m._updateFooterChips) m._updateFooterChips();
  });
}

/* ─────────────────────────────────────────────────────────────
   PAGE BUILDER
   Builds the full English/Language page HTML.
   Called once on first visit.
───────────────────────────────────────────────────────────────*/
export function buildEnglishPage() {
  const page = document.getElementById('page-english');
  if (!page || page.children.length > 0) return;

  /* Inject CSS */
  _injectLangCSS();

  page.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div style="font-size:20px;" aria-hidden="true">💬</div>
      <div style="font-size:17px;font-weight:900;color:var(--text-primary);">
        Language Progress
      </div>
    </div>

    <div id="lang-two-col"
         style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">

      <!-- ══ HINDI ══ -->
      <div class="sc" style="margin-bottom:0;" role="region" aria-label="Hindi progress">

        <div style="padding:12px 14px 9px;border-bottom:1px solid rgba(139,92,246,.07);">
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:13px;font-weight:900;color:var(--text-primary);">
            <span style="font-size:15px;" aria-hidden="true">🇮🇳</span>
            Hindi Progress
          </div>
        </div>

        <!-- Read -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              📖 Read one small topic in Hindi
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--purple-600);"
                  id="hi-read-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="hi-read-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span class="lang-streak-badge">
              <span id="hi-read-streak">0</span> days done
            </span>
          </div>
          <button id="hi-read-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#f59e0b,#d97706);"
                  onclick="hiMarkRead()">
            Read today
          </button>
        </div>

        <!-- Speak -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              🎤 Speak 1 min in Hindi
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--purple-600);"
                  id="hi-speak-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="hi-speak-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span class="lang-streak-badge">
              <span id="hi-speak-streak">0</span> days done
            </span>
          </div>
          <button id="hi-speak-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#8b5cf6,#7c3aed);"
                  onclick="hiMarkSpeak()">
            Spoke today
          </button>
        </div>

        <!-- Learn -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              ✏️ Learn 3 words + 1 sentence
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--purple-600);"
                  id="hi-learn-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="hi-learn-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span class="lang-streak-badge">
              <span id="hi-learn-streak">0</span> days done
            </span>
          </div>
          <button id="hi-learn-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#3b82f6,#2563eb);"
                  onclick="hiMarkLearn()">
            Learned today
          </button>
        </div>

        <!-- Hindi overall -->
        <div style="padding:10px 14px;">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;color:var(--text-muted);font-weight:600;">
              Hindi Knowledge
            </span>
            <span style="font-size:11px;font-weight:700;color:var(--purple-600);"
                  id="hi-overall-pct" aria-live="polite">0%</span>
          </div>
          <div style="height:6px;background:rgba(139,92,246,.1);
                      border-radius:99px;overflow:hidden;"
               role="progressbar"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
               aria-label="Hindi overall progress">
            <div id="hi-overall-bar"
                 style="height:100%;border-radius:99px;width:0%;transition:width .4s;">
            </div>
          </div>
        </div>

      </div><!-- /Hindi -->

      <!-- ══ ENGLISH ══ -->
      <div class="sc" style="margin-bottom:0;" role="region" aria-label="English progress">

        <div style="padding:12px 14px 9px;border-bottom:1px solid rgba(139,92,246,.07);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;flex-wrap:wrap;gap:5px;">
            <div style="display:flex;align-items:center;gap:6px;
                        font-size:13px;font-weight:900;color:var(--text-primary);">
              <span style="font-size:15px;" aria-hidden="true">🇬🇧</span>
              English Progress
            </div>
            <span style="font-size:10px;font-weight:700;
                         background:var(--red-50);color:var(--red-600);
                         border:1px solid var(--red-border);
                         border-radius:99px;padding:2px 9px;"
                  aria-live="polite">
              Streak: <span id="eng-reading-streak-badge">0</span> days
            </span>
          </div>
        </div>

        <!-- Read -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              📖 Read English article today
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--green-600);"
                  id="eng-read-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="eng-read-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;
                      gap:7px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="lang-streak-badge">
              <span id="eng-days-done">0</span> days done
            </span>
          </div>
          <button id="eng-read-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#22c55e,#16a34a);"
                  onclick="engMarkRead()">
            Read today
          </button>
        </div>

        <!-- Speak -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              🎤 Speak 1 min in English
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--green-600);"
                  id="eng-speak-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="eng-speak-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span class="lang-streak-badge">
              <span id="eng-speak-streak">0</span> days done
            </span>
          </div>
          <button id="eng-speak-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#f59e0b,#d97706);"
                  onclick="engMarkSpeak()">
            Spoke today
          </button>
        </div>

        <!-- Learn -->
        <div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-primary);">
              ✏️ Learn 3 words + make 1 sentence
            </div>
            <span style="font-size:11px;font-weight:700;color:var(--green-600);"
                  id="eng-learn-pct" aria-live="polite">0%</span>
          </div>
          <div class="lang-progress-bar"
               role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lang-bar-fill" id="eng-learn-bar" style="width:0%;"></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            <span class="lang-streak-badge">
              <span id="eng-learn-streak">0</span> days done
            </span>
          </div>
          <button id="eng-learn-btn"
                  class="lang-mark-btn"
                  aria-pressed="false"
                  style="background:linear-gradient(90deg,#8b5cf6,#7c3aed);"
                  onclick="engMarkLearn()">
            Learned today
          </button>
        </div>

        <!-- English overall -->
        <div style="padding:10px 14px;">
          <div style="display:flex;align-items:center;
                      justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;color:var(--text-muted);font-weight:600;">
              English Progress
            </span>
            <span style="font-size:11px;font-weight:700;color:var(--green-600);"
                  id="eng-overall-pct" aria-live="polite">0%</span>
          </div>
          <div style="height:6px;background:rgba(139,92,246,.1);
                      border-radius:99px;overflow:hidden;"
               role="progressbar"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
               aria-label="English overall progress">
            <div id="eng-overall-bar"
                 style="height:100%;border-radius:99px;width:0%;transition:width .4s;">
            </div>
          </div>
        </div>

      </div><!-- /English -->

    </div><!-- /lang-two-col -->
  `;
}

/* ─────────────────────────────────────────────────────────────
   PRIVATE HELPERS
───────────────────────────────────────────────────────────────*/

/**
 * Adds XP to today's and total points, then refreshes rewards.
 */
function _addXP(amount) {
  state.pts      = Math.min(99999, (state.pts      || 0) + amount);
  state.totalPts = Math.min(99999, (state.totalPts || 0) + amount);
}

/**
 * Updates a progress bar fill and its percentage label.
 */
function _setLangBar(barId, pctId, pct, color) {
  const bar   = document.getElementById(barId);
  const pctEl = document.getElementById(pctId);

  if (bar) {
    bar.style.width      = pct + '%';
    bar.style.background = color;
  }
  if (pctEl) pctEl.textContent = pct + '%';

  if (bar) {
    const track = bar.closest('[role="progressbar"]');
    if (track) track.setAttribute('aria-valuenow', pct);
  }
}

/**
 * Sets the text content of an element by ID.
 */
function _setLangText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/**
 * Updates a mark-as-done button to reflect its done/not-done state.
 */
function _setLangDoneBtn(id, done, labelOff, labelOn) {
  const btn = document.getElementById(id);
  if (!btn) return;

  if (done) {
    btn.textContent = labelOn;
    btn.style.background = '#e5e7eb';
    btn.style.color      = '#555';
    btn.style.cursor     = 'default';
    btn.style.opacity    = '0.7';
    btn.setAttribute('aria-pressed',  'true');
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.textContent      = labelOff;
    btn.style.opacity    = '1';
    btn.style.cursor     = 'pointer';
    btn.style.background = '';
    btn.style.color      = '';
    btn.setAttribute('aria-pressed', 'false');
    btn.removeAttribute('aria-disabled');
  }
}

/**
 * Injects the language tab CSS once.
 */
function _injectLangCSS() {
  if (document.getElementById('lang-css')) return;
  const s   = document.createElement('style');
  s.id      = 'lang-css';
  s.textContent = `
    .lang-mark-btn {
      margin-top: 7px;
      padding: 5px 14px;
      border: none;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      transition: all .2s;
      font-family: var(--font);
    }
    .lang-mark-btn:hover {
      opacity: .88;
      transform: translateY(-1px);
    }
    .lang-progress-bar {
      height: 5px;
      background: rgba(139,92,246,.1);
      border-radius: 99px;
      overflow: hidden;
      margin-bottom: 9px;
    }
    .lang-bar-fill {
      height: 100%;
      border-radius: 99px;
      transition: width .4s;
    }
    .lang-streak-badge {
      font-size: 10px;
      font-weight: 600;
      background: var(--yellow-50);
      color: var(--yellow-600);
      border: 1px solid var(--yellow-border);
      border-radius: 99px;
      padding: 2px 9px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    @media(max-width:479px) {
      #lang-two-col {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────────
   AUTO-BUILD PAGE ON MODULE LOAD
───────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  buildEnglishPage();
});
