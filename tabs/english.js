/**
 * ═══════════════════════════════════════════════════════════════
 * tabs/english.js — Hindi + English language progress tracker
 *
 * This module owns:
 * - Language page HTML (built once as IIFE in original)
 * - Hindi mark functions (read, speak, learn)
 * - English mark functions (read, speak, learn)
 * - Streak calculation for language tasks
 * - renderLangUI() — updates all progress bars and buttons
 * - resetDailyLangFlags() — resets daily completion flags
 *
 * DESIGN:
 * Each language has 3 daily tasks (read, speak, learn).
 * Each task has its own streak counter.
 * Completing all 3 tasks for a language earns a badge.
 * Each task awards 5 XP.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  todayKey,
  calcStreak,
  showToast
} from '../core/utils.js';

import { state } from '../core/state.js';
import { debouncedSave } from '../core/firebase.js';
import { updateReward, updateFooterChips } from '../shared/theme.js';
import { checkBadgesDebounced } from '../shared/badges.js';
import { onPageShow, onLightweightRefresh, onFullRefresh } from '../tabs/today.js';


/* ═══════════════════════════════════════════════════════════════
   HINDI MARK FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Marks Hindi reading as done for today.
 */
export function hiMarkRead() {
  if (state.hiReadDone) { showToast('Already marked today!'); return; }
  state.hiReadDone = true;
  state.hiReadStreak = calcStreak(state.hiReadLastDate, state.hiReadStreak);
  state.hiReadLastDate = todayKey();
  _addLangXP();
  showToast('Hindi reading marked! +5 XP', 'gt');
}

/**
 * Marks Hindi speaking as done for today.
 */
export function hiMarkSpeak() {
  if (state.hiSpeakDone) { showToast('Already marked today!'); return; }
  state.hiSpeakDone = true;
  state.hiSpeakStreak = calcStreak(state.hiSpeakLastDate, state.hiSpeakStreak);
  state.hiSpeakLastDate = todayKey();
  _addLangXP();
  showToast('Hindi speaking marked! +5 XP', 'gt');
}

/**
 * Marks Hindi word learning as done for today.
 */
export function hiMarkLearn() {
  if (state.hiLearnDone) { showToast('Already marked today!'); return; }
  state.hiLearnDone = true;
  state.hiLearnStreak = calcStreak(state.hiLearnLastDate, state.hiLearnStreak);
  state.hiLearnLastDate = todayKey();
  _addLangXP();
  showToast('Hindi words learned! +5 XP', 'gt');
}


/* ═══════════════════════════════════════════════════════════════
   ENGLISH MARK FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Marks English reading as done for today.
 */
export function engMarkRead() {
  if (state.engReadDone) { showToast('Already marked today!'); return; }
  state.engReadDone = true;
  state.engStreak = calcStreak(state.lastEngDate, state.engStreak);
  state.lastEngDate = todayKey();
  _addLangXP();
  showToast('English reading marked! +5 XP', 'gt');
}

/**
 * Marks English speaking as done for today.
 */
export function engMarkSpeak() {
  if (state.engSpeakDone) { showToast('Already marked today!'); return; }
  state.engSpeakDone = true;
  state.engSpeakStreak = calcStreak(state.engSpeakLastDate, state.engSpeakStreak);
  state.engSpeakLastDate = todayKey();
  _addLangXP();
  showToast('English speaking marked! +5 XP', 'gt');
}

/**
 * Marks English word learning as done for today.
 */
export function engMarkLearn() {
  if (state.engLearnDone) { showToast('Already marked today!'); return; }
  state.engLearnDone = true;
  state.engLearnStreak = calcStreak(state.engLearnLastDate, state.engLearnStreak);
  state.engLearnLastDate = todayKey();
  _addLangXP();
  showToast('Words learned marked! +5 XP', 'gt');
}


/* ═══════════════════════════════════════════════════════════════
   PRIVATE: Add XP + refresh
   ═══════════════════════════════════════════════════════════════ */

/**
 * @private Adds 5 XP, refreshes UI, saves, and checks badges.
 * Shared by all 6 mark functions.
 */
function _addLangXP() {
  state.pts = Math.min(99999, (state.pts || 0) + 5);
  state.totalPts = Math.min(99999, (state.totalPts || 0) + 5);
  updateReward();
  updateFooterChips();
  renderLangUI();
  debouncedSave();
  checkBadgesDebounced();
}


/* ═══════════════════════════════════════════════════════════════
   RESET DAILY FLAGS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Resets all daily language completion flags.
 * Called during daily reset / midnight transition.
 */
export function resetDailyLangFlags() {
  state.hiReadDone = false;
  state.hiSpeakDone = false;
  state.hiLearnDone = false;
  state.engReadDone = false;
  state.engSpeakDone = false;
  state.engLearnDone = false;

  // Re-render if buttons exist
  if (document.getElementById('hi-read-btn')) renderLangUI();
}


/* ═══════════════════════════════════════════════════════════════
   RENDER LANGUAGE UI
   ═══════════════════════════════════════════════════════════════ */

/**
 * Updates all language progress bars, streak badges, and button states.
 */
export function renderLangUI() {
  // ── Hindi ──
  _setLangBar('hi-read-bar', 'hi-read-pct', state.hiReadDone ? 100 : 0, 'var(--purple-500)');
  _setLangBar('hi-speak-bar', 'hi-speak-pct', state.hiSpeakDone ? 100 : 0, 'var(--purple-500)');
  _setLangBar('hi-learn-bar', 'hi-learn-pct', state.hiLearnDone ? 100 : 0, 'var(--purple-500)');

  const hiDone = [state.hiReadDone, state.hiSpeakDone, state.hiLearnDone].filter(Boolean).length;
  _setLangBar('hi-overall-bar', 'hi-overall-pct',
    Math.round(hiDone / 3 * 100), 'linear-gradient(90deg,var(--purple-500),var(--purple-400))');

  _setLangText('hi-read-streak', state.hiReadStreak || 0);
  _setLangText('hi-speak-streak', state.hiSpeakStreak || 0);
  _setLangText('hi-learn-streak', state.hiLearnStreak || 0);

  _setLangDoneBtn('hi-read-btn', state.hiReadDone, 'Read today', 'Read done');
  _setLangDoneBtn('hi-speak-btn', state.hiSpeakDone, 'Spoke today', 'Spoke done');
  _setLangDoneBtn('hi-learn-btn', state.hiLearnDone, 'Learned today', 'Learned done');

  // ── English ──
  _setLangBar('eng-read-bar', 'eng-read-pct', state.engReadDone ? 100 : 0, 'var(--green-500)');
  _setLangBar('eng-speak-bar', 'eng-speak-pct', state.engSpeakDone ? 100 : 0, 'var(--green-500)');
  _setLangBar('eng-learn-bar', 'eng-learn-pct', state.engLearnDone ? 100 : 0, 'var(--green-500)');

  const engDone = [state.engReadDone, state.engSpeakDone, state.engLearnDone].filter(Boolean).length;
  _setLangBar('eng-overall-bar', 'eng-overall-pct',
    Math.round(engDone / 3 * 100), 'linear-gradient(90deg,var(--green-500),var(--green-400))');

  _setLangText('eng-reading-streak-badge', state.engStreak || 0);
  _setLangText('eng-days-done', state.engStreak || 0);
  _setLangText('eng-speak-streak', state.engSpeakStreak || 0);
  _setLangText('eng-learn-streak', state.engLearnStreak || 0);

  _setLangDoneBtn('eng-read-btn', state.engReadDone, 'Read today', 'Read done');
  _setLangDoneBtn('eng-speak-btn', state.engSpeakDone, 'Spoke today', 'Spoke done');
  _setLangDoneBtn('eng-learn-btn', state.engLearnDone, 'Learned today', 'Learned done');
}


/* ═══════════════════════════════════════════════════════════════
   PRIVATE RENDER HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * @private Sets a progress bar width, percentage text, and ARIA value.
 * @param {string} barId - Bar fill element ID
 * @param {string} pctId - Percentage text element ID
 * @param {number} pct - 0-100
 * @param {string} color - CSS background value
 */
function _setLangBar(barId, pctId, pct, color) {
  const bar = document.getElementById(barId);
  const pctEl = document.getElementById(pctId);
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = color;
    const track = bar.closest('[role="progressbar"]');
    if (track) track.setAttribute('aria-valuenow', pct);
  }
  if (pctEl) pctEl.textContent = pct + '%';
}

/**
 * @private Sets text content of an element by ID.
 * @param {string} id
 * @param {*} val
 */
function _setLangText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/**
 * @private Toggles a language button between active and done states.
 * @param {string} id - Button element ID
 * @param {boolean} done - Whether the task is done
 * @param {string} labelOff - Button text when not done
 * @param {string} labelOn - Button text when done
 */
function _setLangDoneBtn(id, done, labelOff, labelOn) {
  const btn = document.getElementById(id);
  if (!btn) return;

  if (done) {
    btn.textContent = labelOn;
    btn.style.background = '#e5e7eb';
    btn.style.color = '#555';
    btn.style.cursor = 'default';
    btn.style.opacity = '0.7';
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.textContent = labelOff;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.style.background = '';
    btn.style.color = '';
    btn.setAttribute('aria-pressed', 'false');
    btn.removeAttribute('aria-disabled');
  }
}


/* ═══════════════════════════════════════════════════════════════
   PAGE HTML BUILDER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Builds the English/Hindi language page HTML.
 * Called once during initialization.
 */
export function buildEnglishPage() {
  const page = document.getElementById('page-english');
  if (!page || page.children.length > 0) return;

  page.innerHTML =
    '<style>' +
      '.lang-mark-btn{margin-top:7px;padding:5px 14px;border:none;border-radius:99px;font-size:11px;font-weight:700;cursor:pointer;color:#fff;transition:all .2s;font-family:var(--font);}' +
      '.lang-mark-btn:hover{opacity:.88;transform:translateY(-1px);}' +
      '.lang-progress-bar{height:5px;background:rgba(139,92,246,.1);border-radius:99px;overflow:hidden;margin-bottom:9px;}' +
      '.lang-bar-fill{height:100%;border-radius:99px;transition:width .4s;}' +
      '.lang-streak-badge{font-size:10px;font-weight:600;background:var(--yellow-50);color:var(--yellow-600);border:1px solid var(--yellow-border);border-radius:99px;padding:2px 9px;display:inline-flex;align-items:center;gap:3px;}' +
      '@media(max-width:479px){#lang-two-col{grid-template-columns:1fr!important;}}' +
    '</style>' +

    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
      '<div style="font-size:20px;" aria-hidden="true">💬</div>' +
      '<div style="font-size:17px;font-weight:900;color:var(--text-primary);">Language Progress</div>' +
    '</div>' +

    '<div id="lang-two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +

      // ── Hindi Card ──
      '<div class="sc" style="margin-bottom:0;" role="region" aria-label="Hindi progress">' +
        '<div style="padding:12px 14px 9px;border-bottom:1px solid rgba(139,92,246,.07);">' +
          '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:900;color:var(--text-primary);">' +
            '<span style="font-size:15px;" aria-hidden="true">🇮🇳</span>Hindi Progress' +
          '</div>' +
        '</div>' +

        // Read
        _buildLangTask('hi-read', '📖 Read one small topic in Hindi', 'hi-read-streak', 'hi-read-btn',
          'background:linear-gradient(90deg,#f59e0b,#d97706);', 'Read today') +

        // Speak
        _buildLangTask('hi-speak', '🎤 Speak 1 min in Hindi', 'hi-speak-streak', 'hi-speak-btn',
          'background:linear-gradient(90deg,#8b5cf6,#7c3aed);', 'Spoke today') +

        // Learn
        _buildLangTask('hi-learn', '✏️ Learn 3 words + 1 sentence', 'hi-learn-streak', 'hi-learn-btn',
          'background:linear-gradient(90deg,#3b82f6,#2563eb);', 'Learned today') +

        // Overall
        _buildLangOverall('hi-overall', 'Hindi Knowledge') +
      '</div>' +

      // ── English Card ──
      '<div class="sc" style="margin-bottom:0;" role="region" aria-label="English progress">' +
        '<div style="padding:12px 14px 9px;border-bottom:1px solid rgba(139,92,246,.07);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px;">' +
            '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:900;color:var(--text-primary);">' +
              '<span style="font-size:15px;" aria-hidden="true">🇬🇧</span>English Progress' +
            '</div>' +
            '<span style="font-size:10px;font-weight:700;background:var(--red-50);color:var(--red-600);border:1px solid var(--red-border);border-radius:99px;padding:2px 9px;" aria-live="polite">' +
              'Streak: <span id="eng-reading-streak-badge">0</span> days' +
            '</span>' +
          '</div>' +
        '</div>' +

        // Read
        _buildLangTask('eng-read', '📖 Read English article today', 'eng-days-done', 'eng-read-btn',
          'background:linear-gradient(90deg,#22c55e,#16a34a);', 'Read today', 'var(--green-600)') +

        // Speak
        _buildLangTask('eng-speak', '🎤 Speak 1 min in English', 'eng-speak-streak', 'eng-speak-btn',
          'background:linear-gradient(90deg,#f59e0b,#d97706);', 'Spoke today', 'var(--green-600)') +

        // Learn
        _buildLangTask('eng-learn', '✏️ Learn 3 words + make 1 sentence', 'eng-learn-streak', 'eng-learn-btn',
          'background:linear-gradient(90deg,#8b5cf6,#7c3aed);', 'Learned today', 'var(--green-600)') +

        // Overall
        _buildLangOverall('eng-overall', 'English Progress', 'var(--green-600)') +
      '</div>' +

    '</div>';
}

/**
 * @private Builds HTML for a single language task section.
 * @param {string} prefix - ID prefix (e.g., 'hi-read')
 * @param {string} title - Task description
 * @param {string} streakId - Streak counter element ID
 * @param {string} btnId - Button element ID
 * @param {string} btnStyle - CSS for button background
 * @param {string} btnLabel - Button text
 * @param {string} [pctColor='var(--purple-600)'] - Color for percentage text
 * @returns {string} HTML string
 */
function _buildLangTask(prefix, title, streakId, btnId, btnStyle, btnLabel, pctColor) {
  const color = pctColor || 'var(--purple-600)';
  return (
    '<div style="padding:12px 14px;border-bottom:1px solid rgba(139,92,246,.06);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">' +
        '<div style="font-size:12px;font-weight:600;color:var(--text-primary);">' + title + '</div>' +
        '<span style="font-size:11px;font-weight:700;color:' + color + ';" id="' + prefix + '-pct" aria-live="polite">0%</span>' +
      '</div>' +
      '<div class="lang-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="lang-bar-fill" id="' + prefix + '-bar" style="width:0%;"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;' + (btnId.startsWith('eng-read') ? 'margin-bottom:8px;' : '') + '">' +
        '<span class="lang-streak-badge"><span id="' + streakId + '">0</span> days done</span>' +
      '</div>' +
      '<button id="' + btnId + '" class="lang-mark-btn" aria-pressed="false" ' +
        'style="' + btnStyle + '" data-action="lang-mark" data-target="' + btnId + '">' +
        btnLabel +
      '</button>' +
    '</div>'
  );
}

/**
 * @private Builds HTML for the overall progress section.
 * @param {string} prefix - ID prefix (e.g., 'hi-overall')
 * @param {string} label - Display label
 * @param {string} [color='var(--purple-600)'] - Color for percentage
 * @returns {string} HTML string
 */
function _buildLangOverall(prefix, label, color) {
  const c = color || 'var(--purple-600)';
  return (
    '<div style="padding:10px 14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:11px;color:var(--text-muted);font-weight:600;">' + label + '</span>' +
        '<span style="font-size:11px;font-weight:700;color:' + c + ';" id="' + prefix + '-pct" aria-live="polite">0%</span>' +
      '</div>' +
      '<div style="height:6px;background:rgba(139,92,246,.1);border-radius:99px;overflow:hidden;" ' +
        'role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="' + label + '">' +
        '<div id="' + prefix + '-bar" style="height:100%;border-radius:99px;width:0%;transition:width .4s;"></div>' +
      '</div>' +
    '</div>'
  );
}


/* ═══════════════════════════════════════════════════════════════
   EVENT BINDING (called once from init.js)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Binds language button click events via delegation.
 */
export function bindEnglishEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action="lang-mark"]');
    if (!el) return;

    const target = el.dataset.target;
    switch (target) {
      case 'hi-read-btn':  hiMarkRead(); break;
      case 'hi-speak-btn': hiMarkSpeak(); break;
      case 'hi-learn-btn': hiMarkLearn(); break;
      case 'eng-read-btn':  engMarkRead(); break;
      case 'eng-speak-btn': engMarkSpeak(); break;
      case 'eng-learn-btn': engMarkLearn(); break;
    }
  });
}


/* ═══════════════════════════════════════════════════════════════
   REGISTRATION — Page show + refresh callbacks
   ═══════════════════════════════════════════════════════════════ */

// Register page init
onPageShow('english', () => renderLangUI());

// Register refresh callbacks
onLightweightRefresh(() => renderLangUI());
onFullRefresh(() => renderLangUI());
