// ─── Sound engine ─────────────────────────────────────────────────────────────
// Pool-based audio: 2 instances per sound to allow fast overlapping triggers.

import { soundsPath } from '../data/assetPaths';
import { getGameDbCreaturesRawSync } from '../data/gameDbData';

// ─── Sound registry ───────────────────────────────────────────────────────────
const FILES: Record<string, string> = {
    // Player
    footstep:               'footstep.mp3',
    cry:                    'cry.mp3',
    plate:                  'clic.wav',
    door:                   'door.wav',
    teleport:               'teleport.wav',
    wall_bump:              'wall_bump.wav',
    falling_item:           'falling_item.wav',
    falling_and_dying:      'falling_and_dying.wav',
    exploding_fireball:     'exploding_fireball.wav',
    exploding_spell:        'exploding_spell.wav',
    swallowing:             'swallowing.wav',
    champion_wounded_1:     'champion_wounded_1.wav',
    champion_wounded_2:     'champion_wounded_2.wav',
    champion_wounded_3:     'champion_wounded_3.wav',
    champion_wounded_4:     'champion_wounded_4.wav',
    horn_of_fear:           'horn_of_fear.wav',
    war_cry:                'war_cry.wav',
    // Party attack
    attack_slash:           'attack_slash.mp3',
    // Creature attacks
    attack_giant_scorpion:  'attack_giant_scorpion.mp3',
    attack_giggler:         'attack_giggler.mp3',
    attack_magenta_worm:    'attack_magenta_worm.mp3',
    attack_mummy_ghost:     'attack_mummy_ghost.mp3',
    attack_pain_rat_dragon: 'attack_pain_rat_dragon.mp3',
    attack_rockpile:        'attack_rockpile.mp3',
    attack_screamer_oitu:   'attack_screamer_oitu.mp3',
    attack_trolin_golem:    'attack_trolin_golem.mp3',
    attack_water_elemental: 'attack_water_elemental.mp3',
    attack_couatl:          'attack_couatl.mp3',
    attack_whoosh:          'attack_whoosh.wav',
    // Creature movement
    move_animated_armour:   'move_animated_armour.mp3',
    move_giant_wasp_couatl: 'move_giant_wasp_couatl.mp3',
    move_mummy_group:       'move_mummy_group.mp3',
    move_red_dragon:        'move_red_dragon.mp3',
    move_screamer_group:    'move_screamer_group.mp3',
    move_skeleton:          'move_skeleton.mp3',
    move_slime_water:       'move_slime_water.mp3',
};

type RawI559Creature = {
    index: number;
    attackSoundOrdinal?: number;
};

type RawGameDb = {
    originalAtari?: {
        i559?: {
            creatures?: RawI559Creature[];
        };
    };
};

// Derived from the extracted Atari sound table:
// - 1 => Attack (Pain Rat - Red Dragon)
// - 2 => Attack (Mummy - Ghost)
// - 3 => Attack (Screamer - Oitu)
// - 4 => Attack (Giant Scorpion)
// - 5 => Attack (Magenta Worm)
// - 6 => Attack (Giggler)
// - 7 => Attack (Trolin - Stone Golem)
// - 8 => Attack (Skeleton / Animated Armour)
const ATTACK_SOUND_BY_ORDINAL: Record<number, string> = {
    1: 'attack_pain_rat_dragon',
    2: 'attack_mummy_ghost',
    3: 'attack_screamer_oitu',
    4: 'attack_giant_scorpion',
    5: 'attack_magenta_worm',
    6: 'attack_giggler',
    7: 'attack_trolin_golem',
    8: 'attack_slash',
};

// ─── Pool ─────────────────────────────────────────────────────────────────────
const pool: Record<string, HTMLAudioElement[]> = {};

function getOrCreate(name: string): HTMLAudioElement[] {
    if (!pool[name]) {
        const file = FILES[name];
        if (!file) return [];
        // 2 instances per sound — enough for fast retriggers
        pool[name] = [
            Object.assign(new Audio(soundsPath(file)), { preload: 'auto' }),
            Object.assign(new Audio(soundsPath(file)), { preload: 'auto' }),
        ];
    }
    return pool[name];
}

/** Eagerly preload all sounds (call once at app start). */
export function preloadAllSounds(): void {
    for (const name of Object.keys(FILES)) getOrCreate(name);
}

// Per-sound cooldown: prevents the same sound from re-triggering within MIN_INTERVAL ms
const MIN_INTERVAL = 250; // ms
const lastPlayed: Record<string, number> = {};
const activeLoops: Record<string, HTMLAudioElement | null> = {};
const loopTimeouts: Record<string, number | undefined> = {};

// ─── Debug overlay pub/sub ────────────────────────────────────────────────────
type SoundListener = (name: string, file: string) => void;
const soundListeners = new Set<SoundListener>();
export function onSoundPlayed(fn: SoundListener): () => void {
    soundListeners.add(fn);
    return () => soundListeners.delete(fn);
}

function play(
    name: string,
    volume = 0.65,
    options?: {
        volumeJitter?: number;
        playbackRateMin?: number;
        playbackRateMax?: number;
    },
): void {
    const now = Date.now();
    if (now - (lastPlayed[name] ?? 0) < MIN_INTERVAL) return;
    lastPlayed[name] = now;
    const audios = getOrCreate(name);
    if (!audios.length) return;
    const audio = audios.find(a => a.paused || a.ended) ?? audios[0];
    try {
        const volumeJitter = options?.volumeJitter ?? 0;
        const playbackRateMin = options?.playbackRateMin ?? 1;
        const playbackRateMax = options?.playbackRateMax ?? 1;
        const volumeOffset = volumeJitter > 0 ? (Math.random() * 2 - 1) * volumeJitter : 0;
        const playbackRate = playbackRateMax > playbackRateMin
            ? playbackRateMin + Math.random() * (playbackRateMax - playbackRateMin)
            : playbackRateMin;
        audio.volume = Math.max(0, Math.min(1, volume + volumeOffset));
        audio.playbackRate = playbackRate;
        audio.currentTime = 0;
        audio.play().catch(() => { /* autoplay policy */ });
        for (const fn of soundListeners) fn(name, FILES[name] ?? name);
    } catch { /* ignore */ }
}

function playLoopFor(name: string, durationMs: number, volume = 0.65): void {
    const audios = getOrCreate(name);
    if (!audios.length) return;

    const currentLoop = activeLoops[name];
    const timeoutId = loopTimeouts[name];
    if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
    }

    if (currentLoop && !currentLoop.paused) {
        currentLoop.volume = volume;
        loopTimeouts[name] = window.setTimeout(() => {
            currentLoop.loop = false;
            currentLoop.pause();
            currentLoop.currentTime = 0;
            if (activeLoops[name] === currentLoop) {
                activeLoops[name] = null;
            }
            loopTimeouts[name] = undefined;
        }, durationMs);
        return;
    }

    if (currentLoop) {
        currentLoop.loop = false;
        currentLoop.pause();
        currentLoop.currentTime = 0;
    }

    const audio = audios.find(a => a !== currentLoop && (a.paused || a.ended)) ?? audios[0];

    try {
        audio.loop = true;
        audio.volume = volume;
        audio.currentTime = 0;
        audio.play().catch(() => { /* autoplay policy */ });
        for (const fn of soundListeners) fn(name, FILES[name] ?? name);
        activeLoops[name] = audio;
        loopTimeouts[name] = window.setTimeout(() => {
            audio.loop = false;
            audio.pause();
            audio.currentTime = 0;
            if (activeLoops[name] === audio) {
                activeLoops[name] = null;
            }
            loopTimeouts[name] = undefined;
        }, durationMs);
    } catch { /* ignore */ }
}

// ─── Player ───────────────────────────────────────────────────────────────────
export function playStep():  void {
    play('footstep', 0.37, {
        volumeJitter: 0.035,
        playbackRateMin: 0.96,
        playbackRateMax: 1.04,
    });
}
export function playCry():   void { play('cry',       0.55); }
export function playPlate(): void { play('plate',     0.80); }
export function playDoor(): void { play('door', 0.65); }
export function playDoorMotion(durationMs = 1000, volume = 0.65): void { playLoopFor('door', durationMs, volume); }
export function playTeleport(): void { play('teleport', 0.70); }
export function playWallBump(): void { play('wall_bump', 0.70); }
export function playFallingItem(): void { play('falling_item', 0.68); }
export function playFallingAndDying(): void { play('falling_and_dying', 0.72); }
export function playExplodingFireball(): void { play('exploding_fireball', 0.72); }
export function playExplodingSpell(): void { play('exploding_spell', 0.72); }
export function playSwallowing(): void { play('swallowing', 0.68); }
export function playChampionWounded(): void {
    const sound = CHAMPION_WOUNDED_SOUNDS[Math.floor(Math.random() * CHAMPION_WOUNDED_SOUNDS.length)];
    play(sound, 0.68);
}
export function playHornOfFear(): void { play('horn_of_fear', 0.72); }
export function playWarCry(): void { play('war_cry', 0.72); }

// ─── Party attack ─────────────────────────────────────────────────────────────
export function playPartyAttack(): void { play('attack_slash', 0.70); }

// ─── Creature sound mapping ───────────────────────────────────────────────────
// { move?: soundName, attack?: soundName }
// null move  = immaterial (silent movement)
// null attack = no specific sound (uses whoosh)
const CREATURE_MOVE_SOUNDS: Record<number, string | null> = {
     0: 'move_screamer_group',    // Giant Scorpion
     1: 'move_slime_water',       // Swamp Slime
     2: 'move_mummy_group',       // Giggler
     3: null,                     // Wizard Eye
     4: 'move_screamer_group',    // Pain Rat
     5: 'move_screamer_group',    // Ruster
     6: 'move_screamer_group',    // Screamer
     7: 'move_screamer_group',    // Rockpile
     8: null,                     // Ghost
     9: 'move_mummy_group',       // Stone Golem
    10: 'move_mummy_group',       // Mummy
    11: null,                     // Black Flame
    12: 'move_skeleton',          // Skeleton
    13: 'move_giant_wasp_couatl', // Couatl
    14: 'move_mummy_group',       // Vexirk
    15: 'move_screamer_group',    // Magenta Worm
    16: 'move_mummy_group',       // Trolin
    17: 'move_giant_wasp_couatl', // Giant Wasp
    18: 'move_animated_armour',   // Animated Armour
    19: null,                     // Materializer
    20: 'move_slime_water',       // Water Elemental
    21: 'move_screamer_group',    // Oitu
    22: 'move_mummy_group',       // Demon
    23: null,                     // Lord Chaos
    24: 'move_red_dragon',        // Red Dragon
    25: null,                     // Lord Order
    26: null,                     // Grey Lord
};

type CreatureSoundDef = {
    move: string | null;
    attack: string;
};

let creatureSoundsCache: Record<number, CreatureSoundDef> | null = null;

function buildCreatureSounds(): Record<number, CreatureSoundDef> {
    const gameDb = JSON.parse(getGameDbCreaturesRawSync()) as RawGameDb;
    const attackOrdinals = new Map<number, number>(
        (gameDb.originalAtari?.i559?.creatures ?? []).map((creature) => [
            creature.index,
            creature.attackSoundOrdinal ?? 0,
        ]),
    );

    return Object.fromEntries(
        Object.entries(CREATURE_MOVE_SOUNDS).map(([id, move]) => {
            const typeId = Number(id);
            const attackOrdinal = attackOrdinals.get(typeId) ?? 0;
            return [typeId, {
                move,
                attack: ATTACK_SOUND_BY_ORDINAL[attackOrdinal] ?? 'attack_whoosh',
            }];
        }),
    );
}

function getCreatureSound(typeId: number): CreatureSoundDef | null {
    if (!creatureSoundsCache) {
        try {
            creatureSoundsCache = buildCreatureSounds();
        } catch {
            return {
                move: CREATURE_MOVE_SOUNDS[typeId] ?? null,
                attack: 'attack_whoosh',
            };
        }
    }
    return creatureSoundsCache[typeId] ?? null;
}

const ATTACK_SOUND_OVERRIDES: Partial<Record<number, string>> = {
    7: 'attack_rockpile', // Local asset is closer to the original rockpile impact.
    20: 'attack_water_elemental', // Preserve the dedicated local clip while keeping ordinal-derived fallback logic.
};

const CHAMPION_WOUNDED_SOUNDS = [
    'champion_wounded_1',
    'champion_wounded_2',
    'champion_wounded_3',
    'champion_wounded_4',
] as const;

export function playCreatureMove(typeId: number): void {
    const s = getCreatureSound(typeId);
    if (s?.move) play(s.move, 0.55);
}

export function playCreatureAttack(typeId: number): void {
    const s = getCreatureSound(typeId);
    if (!s) return;
    play(ATTACK_SOUND_OVERRIDES[typeId] ?? s.attack, 0.70);
}
