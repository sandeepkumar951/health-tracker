/**
 * ═══════════════════════════════════════════════════════════════
 * shared/badges.js — Achievement / badge system
 *
 * This module owns:
 * - Badge definitions with condition functions
 * - checkBadgesDebounced() — async badge evaluation
 * - openBadges() / closeBadges() — modal rendering
 * - Registration on window for cross-module access
 *
 * BRIDGE PATTERN:
 * The theme module needs badge data for the summary card.
 * To avoid circular imports (theme -> badges -> theme),
 * this module registers BADGES on window._BADGES_LIST
 * and window._BADGE_COUNT at load time.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  sanitizeHTML,
  showToast,
  confetti,
  DB_KEY,
  todayKey,
  safeLocalStorageSave
} from '../core/utils.js';

import { state, flags } from '../core/state.js';
import { userRef } from '../core/firebase.js';


/* ═══════════════════════════════════════════════════════════════
   BADGE DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Each badge has:
 * - id: unique identifier (stored in earnedBadges array)
 * - icon: emoji displayed in UI
 * - name: display name
 * - desc: short description
 * - condition: function(state) => boolean
 */
export const BADGES = [
  {
    id: 'first_step',
    icon: '👣',
    name: 'First Step',
    desc: 'Complete your first task',
    condition: s => (s.totalPts || 0) >= 3
  },
  {
    id: 'early_bird',
    icon: '🐦',
    name: 'Early Bird',
    desc: 'Complete morning routine',
    condition: s => ['lemon', 'almonds', 'walnuts', 'amla']
      .every(k => s.checks && s.checks[k] === true)
  },
  {
    id: 'skin_care',
    icon: '✨',
    name: 'Glow Up',
    desc: 'Complete skin care routine',
    condition: s => ['facewash_am', 'moisturizer', 'sunscreen']
      .every(k => s.checks && s.checks[k] === true)
  },
  {
    id: 'hydrated',
    icon: '💧',
    name: 'Pool Master',
    desc: 'Fill the water pool!',
    condition: s => (s.water || 0) >= 11
  },
  {
    id: 'streak3',
    icon: '🔥',
    name: '3-Day Streak',
    desc: 'Study 3 days in a row',
    condition: s => (s.ctStreakDays || 0) >= 3
  },
  {
    id: 'streak7',
    icon: '💪',
    name: 'Week Warrior',
    desc: 'Study 7 days in a row',
    condition: s => (s.ctStreakDays || 0) >= 7
  },
  {
    id: 'streak14',
    icon: '🚀',
    name: 'Fortnight Fire',
    desc: 'Study 14 days in a row',
    condition: s => (s.ctStreakDays || 0) >= 14
  },
  {
    id: 'streak30',
    icon: '🏆',
    name: 'Monthly Legend',
    desc: 'Study 30 days in a row',
    condition: s => (s.ctStreakDays || 0) >= 30
  },
  {
    id: 'pts100',
    icon: '⭐',
    name: 'Century',
    desc: 'Earn 100 total XP',
    condition: s => (s.totalPts || 0) >= 100
  },
  {
    id: 'pts500',
    icon: '🌟',
    name: '500 Club',
    desc: 'Earn 500 total XP',
    condition: s => (s.totalPts || 0) >= 500
  },
  {
    id: 'night_owl',
    icon: '🌃',
    name: 'Night Owl',
    desc: 'Complete full night routine',
    condition: s => ['facewash_pm', 'hair_tablets', 'revision', 'sleep']
      .every(k => s.checks && s.checks[k] === true)
  },
  {
    id: 'career25',
    icon: '📊',
    name: 'Quarter Way',
    desc: 'Reach 25% career readiness',
    condition: s => _ctOverallPct(s) >= 25
  },
  {
    id: 'career50',
    icon: '🎯',
    name: 'Halfway There',
    desc: 'Reach 50% career readiness',
    condition: s => _ctOverallPct(s) >= 50
  },
  {
    id: 'career100',
    icon: '🏅',
    name: 'Job Ready!',
    desc: 'Reach 100% career readiness',
    condition: s => _ctOverallPct(s) >= 100
  },
  {
    id: 'lang_hi',
    icon: '🇮🇳',
    name: 'Hindi Hero',
    desc: 'Complete all 3 Hindi tasks today',
    condition: s => s.hiReadDone && s.hiSpeakDone && s.hiLearnDone
  },
  {
    id: 'lang_en',
    icon: '🇬🇧',
    name: 'English Star',
    desc: 'Complete all 3 English tasks today',
    condition: s => s.engReadDone && s.engSpeakDone && s.engLearnDone
  },
  {
    id: 'sugar_ctrl',
    icon: '🍬',
    name: 'Sugar Boss',
    desc: 'Keep weekly sugar under 25g with at least 1 entry',
    condition: s =>
      (s.weeklyGrams || 0) <= 25 &&
      (s.sugarLog || []).filter(e => e.weekStart === s.sugarWeekStart).length >= 1
  },
  {
    id: 'weekly5',
    icon: '📅',
    name: 'Weekly Planner',
    desc: 'Complete 5 weekly tasks',
    condition: s => (s.weeklyTasks || []).filter(t => t.done).length >= 5
  },
  {
    id: 'water_week',
    icon: '🌊',
    name: 'Hydration Hero',
    desc: 'Hit the water goal 3 days in a row',
    condition: s => {
      if (!s.waterLog) return false;
      const now = new Date();
      let run = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const k = d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        if ((s.waterLog[k] || 0) >= 11) {
          run++;
          if (run >= 3) return true;
        } else if (i > 0) {
          break;
        }
      }
      return run >= 3;
    }
  }
];


/* ═══════════════════════════════════════════════════════════════
   WINDOW BRIDGE — for theme.js summary card access
   ═══════════════════════════════════════════════════════════════ */

// Register on window so theme.js can read badge data without
// creating a circular import
window._BADGES_LIST = BADGES;
window._BADGE_COUNT = BADGES.length;


/* ═══════════════════════════════════════════════════════════════
   PRIVATE HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Computes career overall percentage from state skills.
 * Private copy to avoid importing from career module (would create cycle).
 * @param {object} s - State object
 * @returns {number} 0-100
 */
function _ctOverallPct(s) {
  const skills = (s || state).ctSkills || {};
  return Math.round(
    ((skills.sql || 0) + (skills.tools || 0) + (skills.proj || 0) + (skills.intv || 0)) / 4
  );
}


/* ═══════════════════════════════════════════════════════════════
   checkBadgesDebounced() — Evaluates all badge conditions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Checks all badge conditions with a 150ms debounce.
 * Awards new badges, shows toast + confetti, persists to Firebase.
 * Safe to call frequently — the timer collapses rapid calls.
 */
export function checkBadgesDebounced() {
  if (flags.badgeCheckTimer) clearTimeout(flags.badgeCheckTimer);

  flags.badgeCheckTimer = setTimeout(async () => {
    flags.badgeCheckTimer = null;
    let newBadge = false;

    for (const b of BADGES) {
      // Skip already earned
      if ((state.earnedBadges || []).includes(b.id)) continue;

      try {
        if (b.condition(state)) {
          if (!state.earnedBadges) state.earnedBadges = [];
          state.earnedBadges.push(b.id);
          showToast('New badge: ' + b.name + ' ' + b.icon);
          confetti();
          newBadge = true;
        }
      } catch (e) {
        // Condition threw — skip silently
      }
    }

    if (newBadge) {
      // Persist locally
      try {
        safeLocalStorageSave(DB_KEY, JSON.stringify(state));
      } catch (e) { /* ignore */ }

      // Persist to Firebase (just the badges array)
      try {
        await userRef('daily_' + todayKey() + '/earnedBadges').set(state.earnedBadges);
      } catch (e) {
        // Will sync on next full save
      }
    }
  }, 150);
}

/**
 * Cancels any pending badge check timer.
 * Used during factory reset cleanup.
 */
export function cancelBadgeCheck() {
  if (flags.badgeCheckTimer) {
    clearTimeout(flags.badgeCheckTimer);
    flags.badgeCheckTimer = null;
  }
}


/* ═══════════════════════════════════════════════════════════════
   BADGE MODAL
   ═══════════════════════════════════════════════════════════════ */

/**
 * Opens the badge modal and renders all badges (earned + locked).
 */
export function openBadges() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;

  grid.innerHTML = '';

  BADGES.forEach(b => {
    const earned = (state.earnedBadges || []).includes(b.id);
    const d = document.createElement('div');
    d.className = 'badge-card' + (earned ? ' earned' : '');
    d.setAttribute('role', 'listitem');
    d.setAttribute('aria-label', sanitizeHTML(b.name) + (earned ? ' — earned' : ' — locked'));

    d.innerHTML =
      '<div class="badge-icon" aria-hidden="true">' + b.icon + '</div>' +
      '<div class="badge-name">' + sanitizeHTML(b.name) + '</div>' +
      '<div class="badge-desc">' + sanitizeHTML(b.desc) + '</div>';

    grid.appendChild(d);
  });

  const modal = document.getElementById('badges-modal');
  if (modal) {
    modal.classList.add('open');
    const btn = modal.querySelector('button');
    if (btn) btn.focus();
  }
}

/**
 * Closes the badge modal.
 */
export function closeBadges() {
  const m = document.getElementById('badges-modal');
  if (m) m.classList.remove('open');
}
