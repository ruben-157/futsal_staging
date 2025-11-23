import {
    state,
    saveAttendees,
    saveTeams,
    saveResults,
    saveTimestamp,
    saveRounds,
    savePlayers,
    KEYS
} from '../state/storage.js';
import {
    MAX_ATTENDEES,
    COLORS,
    getSkill,
    getStamina,
    DEFAULT_SKILL,
    DEFAULT_STAMINA,
    SKILLS,
    STAMINA,
    normalizeRating,
    snapToRatingStep,
    RATING_STEP
} from '../data/config.js';
import { computeStableSeedFromAttendees, shuffleSeeded } from '../utils/random.js';
import { balanceSkillToTargets, balanceStaminaEqualSkill } from './balance.js';
import { applyRosterHarmonyFinal, computeHarmonyBias } from './harmony.js';
import { logError } from '../utils/logging.js';

export const EVENTS = {
    STATE_CHANGED: 'futsal:state-changed',
    GEN_ERROR: 'futsal:gen-error'
};

function dispatchStateChanged() {
    document.dispatchEvent(new CustomEvent(EVENTS.STATE_CHANGED));
}

function dispatchGenError(msg) {
    document.dispatchEvent(new CustomEvent(EVENTS.GEN_ERROR, { detail: msg }));
}

export function addToAttendees(name) {
    if (state.attendees.includes(name)) return;
    if (state.attendees.length >= MAX_ATTENDEES) {
        // Limit reached, maybe dispatch an event or let UI handle check
        return;
    }
    state.attendees.push(name);
    saveAttendees();
    dispatchStateChanged();
}

export function removeFromAttendees(name) {
    const idx = state.attendees.indexOf(name);
    if (idx >= 0) {
        state.attendees.splice(idx, 1);
        saveAttendees();
        dispatchStateChanged();
    }
}

export function resetState() {
    state.attendees = [];
    state.teams = [];
    state.results = {};
    state.timestamp = Date.now();
    state.rounds = 2;
    saveAttendees();
    saveTeams();
    saveResults();
    saveTimestamp();
    saveRounds();
    dispatchGenError(''); // Clear error
    dispatchStateChanged();
}

export function addRound() {
    if (!state.teams || state.teams.length < 2) return;
    state.rounds = Math.max(1, Number(state.rounds) || 2) + 1;
    state.celebrated = false;
    saveRounds();
    dispatchStateChanged();
}

export function removeRound(r) {
    // Logic to check if round has results should be done by caller or here
    // Assuming caller validated or we force it
    const keys = Object.keys(state.results || {});
    for (const k of keys) {
        const rec = state.results[k];
        if (rec && Number(rec.round) === Number(r)) {
            delete state.results[k];
        }
    }
    state.rounds = Math.max(2, Number(r) - 1);
    state.celebrated = false;
    saveResults();
    saveRounds();
    dispatchStateChanged();
}

export function updateTeamName(teamId, newName) {
    const team = state.teams.find(t => String(t.id) === String(teamId));
    if (team) {
        team.name = newName || team.name;
        saveTeams();
        dispatchStateChanged();
    }
}

export function addIncidentalPlayer(name, skillVal, staminaVal) {
    const finalName = getUniqueName(name);
    SKILLS[finalName] = normalizeRating(skillVal, DEFAULT_SKILL);
    STAMINA[finalName] = normalizeRating(staminaVal, DEFAULT_STAMINA);

    if (!state.players.some(p => p.toLowerCase() === finalName.toLowerCase())) {
        state.players.push(finalName);
        savePlayers();
    }
    state.attendees.push(finalName);
    saveAttendees();
    dispatchStateChanged();
}

function getUniqueName(name) {
    const lowerExisting = new Set([...state.players, ...state.attendees].map(x => x.toLowerCase()));
    let finalName = name;
    if (lowerExisting.has(finalName.toLowerCase())) {
        let i = 2;
        while (lowerExisting.has((name + ' (' + i + ')').toLowerCase())) i++;
        finalName = name + ' (' + i + ')';
    }
    return finalName;
}

export function generateTeams(tOverride) {
    const n = state.attendees.length;
    if (!state.timestamp) { state.timestamp = Date.now(); saveTimestamp(); }

    // Determine team count
    let t = tOverride;
    if (!t) {
        // Default logic if no override provided (though usually called with override for 11 players)
        // But for standard cases, we need the logic:
        t = Math.max(1, Math.min(4, Math.floor(n / 4)));
        // Handle 15 players -> 3 teams default
        if (n === 15) t = 3;
        // Handle 16-20 -> 4 teams
        if (n >= 16) t = 4;
    }

    const stableSeed = computeStableSeedFromAttendees(state.attendees);
    const shuffled = shuffleSeeded(state.attendees, stableSeed);

    const totalStaminaOv = state.attendees.reduce((s, name) => s + getStamina(name), 0);
    const avgStaminaOv = n > 0 ? (totalStaminaOv / n) : DEFAULT_STAMINA;

    // Evenly distribute capacities
    const base = Array(t).fill(Math.floor(n / t));
    const r = n % t;
    for (let i = t - r; i < t; i++) if (i >= 0 && i < t) base[i] += 1;

    const colors = COLORS.slice(0, Math.min(t, COLORS.length));
    const totalSkillOv = state.attendees.reduce((s, name) => s + getSkill(name), 0);
    const avgSkillOv = totalSkillOv / n;

    const teamInfos = base.map((size, i) => ({
        cap: size,
        target: size * avgSkillOv,
        skillSum: 0,
        staminaSum: 0,
        team: { id: i + 1, name: colors[i].name, color: colors[i].hex, members: [] }
    }));

    const orderIndex = new Map(shuffled.map((name, idx) => [name, idx]));
    const playersSorted = [...state.attendees].sort((a, b) => {
        const sa = getSkill(a), sb = getSkill(b);
        if (sb !== sa) return sb - sa;
        return (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0);
    });

    for (const player of playersSorted) {
        const s = getSkill(player);
        const st = getStamina(player);
        let best = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < teamInfos.length; i++) {
            const info = teamInfos[i];
            if (info.team.members.length < info.cap) {
                const def = info.target - info.skillSum;
                const harmonyBias = computeHarmonyBias(info.team.members, player);
                const score = def - harmonyBias;
                if (score > bestScore + 1e-9) { bestScore = score; best = i; }
                else if (Math.abs(score - bestScore) <= 1e-9 && best !== -1) {
                    const bi = teamInfos[best];
                    if (st >= avgStaminaOv) {
                        if (info.cap < bi.cap) { best = i; }
                        else if (info.cap === bi.cap) {
                            if (info.staminaSum < bi.staminaSum) best = i;
                        }
                    }
                    const bestIdx = best;
                    const bi2 = teamInfos[bestIdx];
                    if (info.team.members.length < bi2.team.members.length) best = i;
                    else if (info.team.members.length === bi2.team.members.length && info.skillSum < bi2.skillSum) best = i;
                    else if (info.team.members.length === bi2.team.members.length && info.skillSum === bi2.skillSum && i < bestIdx) best = i;
                }
            }
        }
        if (best === -1) best = 0;
        const tgt = teamInfos[best];
        tgt.team.members.push(player);
        tgt.skillSum += s;
        tgt.staminaSum += st;
    }

    state.teams = teamInfos.map(x => x.team);
    try { balanceSkillToTargets(state.teams, state.attendees, getSkill); } catch (_) { }
    try { balanceStaminaEqualSkill(state.teams, getSkill, getStamina); } catch (_) { }
    try { applyRosterHarmonyFinal(state.teams); } catch (_) { }

    state.results = {};
    state.rounds = 2;
    localStorage.removeItem(KEYS.prevRanks);
    saveTeams(); saveResults(); saveRounds();
    dispatchStateChanged();
}

export function saveMatchResult(matchId, resultData) {
    // resultData: { a, b, round, ga, gb, gpa, gpb }
    state.results[matchId] = resultData;

    // Clear drafts
    try {
        delete state.results[matchId].gaDraft;
        delete state.results[matchId].gbDraft;
        delete state.results[matchId].gpaDraft;
        delete state.results[matchId].gpbDraft;
    } catch (_) { }

    const ok = saveResults();
    if (!ok) {
        logError('ERR_SAVE_RESULTS', 'Failed to persist results', { matchId });
        return false;
    }
    dispatchStateChanged();
    return true;
}

export function saveMatchDraft(matchId, draftData) {
    // draftData: { gaDraft, gbDraft, gpaDraft, gpbDraft, ...prev }
    const prev = state.results[matchId] || {};
    state.results[matchId] = { ...prev, ...draftData };
    saveResults();
    // No state changed event needed for drafts usually, or maybe yes?
    // If we want to persist drafts, we don't necessarily need to re-render everything.
    // But let's keep it simple.
}

export function setCelebrated(val) {
    state.celebrated = val;
}
