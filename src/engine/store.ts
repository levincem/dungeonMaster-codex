import { create } from 'zustand';
import { getGameMap, GAME_MAPS, CHAMPION_START_POSITIONS } from '../data/mapLoader';
import { itemToLockData } from '../data/mechanisms';
import type {
    GameMap, GameTile, TeleporterObject,
    CreatureInstance, CreatureObject, FloorItem,
    SensorObject, WallTextObject, CardinalDir,
    ChampionEquipment, CreatureSide,
} from '../types/game';
import type { EquipSlotKey } from '../types/items';
import type { Champion } from '../data/champions';
import { CHAMPION_BY_ID } from '../data/champions';
import { CREATURE_TYPES } from '../data/creatures';
import { findSpell, getSkillLevel } from '../data/runes';
import type { CastSkill } from '../data/runes';
import { WEAPON_TYPES } from '../data/items';
import { playPartyAttack, playCreatureMove, playCreatureAttack, playPlate } from './sounds';

export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export type GamePhase = 'exploration' | 'mirror_open';

// ─── Champion vitals (live HP / Stamina / Mana) ───────────────────────────────
export interface ChampionVitals {
    hp:      number;  // current hit points (0 … champion.health)
    stamina: number;  // current stamina    (0 … champion.stamina)
    mana:    number;  // current mana       (0 … champion.mana)
}

export interface CastResult {
    success: boolean;
    message: string;
    ts: number; // Date.now() — used to trigger re-display
}

// ─── Floating damage number shown on struck creature ─────────────────────────
export interface DamageEvent {
    id: string;
    x: number;     // creature tile x
    y: number;     // creature tile y
    amount: number;
    ts: number;    // Date.now() — auto-cleared after ~600 ms
}

// ─── Torch burn lifecycle ──────────────────────────────────────────────────────
export const TORCH_LIFETIME_MS  = 15 * 60 * 1000;  // 15 min total
export const TORCH_STATE_MS     =  5 * 60 * 1000;  // 5 min per visual state

/** Return 0=unlit, 1=used_2, 2=used_1, 3=lit based on ms elapsed since lit */
export function torchStateIndex(elapsedMs: number): number {
    if (elapsedMs >= TORCH_LIFETIME_MS)        return 0; // burnt out
    if (elapsedMs >= TORCH_STATE_MS * 2)       return 1; // used_2
    if (elapsedMs >= TORCH_STATE_MS)           return 2; // used_1
    return 3;                                            // fresh lit
}

// ─── Spell lights (torch / light spells) ─────────────────────────────────────
export interface SpellLight {
    id: string;
    lightContrib: number; // added to lightLevel (+0.25 for FUL, +0.5 for OH IR RA, negative for Darkness)
    expiresAt: number;    // Date.now() ms
}

// ─── Compute scene light level (0 = dark, 1 = full light) ────────────────────
export function computeLightLevel(
    spellLights: SpellLight[],
    torchBurnStart: Record<string, number>,
    championEquipment: Record<number, import('../types/game').ChampionEquipment>,
): number {
    const now = Date.now();

    // Torch in any champion's hand that hasn't burnt out
    let torchContrib = 0;
    outer: for (const equip of Object.values(championEquipment)) {
        if (!equip) continue;
        for (const slot of ['rightHand', 'leftHand'] as const) {
            const item = equip[slot];
            if (!item || item.category !== 'Weapon' || item.typeId !== 16) continue;
            const litAt = torchBurnStart[item.id];
            if (litAt !== undefined && now - litAt < TORCH_LIFETIME_MS) {
                torchContrib = 1.0;
                break outer;
            }
        }
    }

    // Active spell contributions (positive = light, negative = darkness)
    const spellContrib = spellLights
        .filter(l => l.expiresAt > now)
        .reduce((sum, l) => sum + l.lightContrib, 0);

    return Math.max(0, Math.min(1, torchContrib + spellContrib));
}

// ─── Active projectiles (fireball, lightning, poison, plasma) ─────────────────
export type ProjectileEffect = 'fireball' | 'lightning' | 'poison' | 'plasma';

export interface Projectile {
    id: string;
    level: number;
    x: number;           // tile x
    y: number;           // tile y
    direction: Direction;
    effect: ProjectileEffect;
    damage: [number, number]; // [min, max]
    nextMoveAt: number;  // Date.now() ms — when to advance to next tile
}

// ─── Party shields (magic shield / fire shield spells) ────────────────────────
export interface PartyShield {
    id: string;
    expiresAt: number;
    protection: number; // fraction of damage blocked (0.0–1.0)
    fireOnly: boolean;  // true = fire_shield only, false = all physical
}

// ─── Footprint trail (footprints spell) ──────────────────────────────────────
export interface FootprintEntry {
    x: number;
    y: number;
    level: number;
    ts: number; // Date.now() when placed
}

// ─── Champion XP (one counter per skill discipline) ───────────────────────────
export type ChampionXP = Record<CastSkill, number>;

/** Total accumulated XP → skill level. Formula: floor(sqrt(xp / 500)) */
export function xpToLevel(xp: number): number {
    return Math.max(0, Math.floor(Math.sqrt(xp / 500)));
}

// ─── Per-champion combat state ────────────────────────────────────────────────
export interface ChampionCombat {
    cooldown:    number; // seconds remaining
    cooldownMax: number; // full duration (for overlay ratio)
}

const MAX_PARTY = 4;

/** Back-calculate starting XP from a champion's initial skill levels. */
function buildInitialXP(champion: import('../data/champions').Champion): ChampionXP {
    const lvlXP = (s: [number, number, number, number]) =>
        Math.pow(Math.max(s[0], s[2]), 2) * 500;
    return {
        fighter: lvlXP(champion.skills.fighter),
        ninja:   lvlXP(champion.skills.ninja),
        priest:  lvlXP(champion.skills.priest),
        wizard:  lvlXP(champion.skills.wizard),
    };
}

/** Weapon stats for the item in a champion's right hand (or unarmed). */
function getRightHandStats(equip: import('../types/game').ChampionEquipment | undefined): {
    name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: CastSkill;
} {
    const item = equip?.rightHand;
    if (item?.category === 'Weapon') {
        const wt = WEAPON_TYPES[item.typeId];
        if (wt && wt.atkSpd > 0) {
            const skill: CastSkill =
                wt.type === 'Staff' || wt.type === 'Wand' ? 'wizard' : 'fighter';
            return {
                name: wt.name,
                dmgMin: wt.damage[0],
                dmgMax: wt.damage[1],
                cooldownSec: wt.atkSpd / 10,
                skill,
            };
        }
    }
    return { name: 'Poing', dmgMin: 1, dmgMax: 4, cooldownSec: 2.0, skill: 'fighter' };
}

/** Living creatures directly in front of the party (up to 2, left then right). */
function creaturesInFront(
    level: number,
    position: [number, number],
    direction: Direction,
    creatures: import('../types/game').CreatureInstance[],
): import('../types/game').CreatureInstance[] {
    const [y, x] = position;
    const ty = direction === 'NORTH' ? y - 1 : direction === 'SOUTH' ? y + 1 : y;
    const tx = direction === 'EAST'  ? x + 1 : direction === 'WEST'  ? x - 1 : x;
    return creatures.filter(c => c.alive && c.mapIndex === level && c.y === ty && c.x === tx)
                    .sort((a, b) => (a.side === 'left' ? -1 : 1) - (b.side === 'left' ? -1 : 1));
}

// ─── Line-of-sight helper (grid ray — checks for wall/door blocking) ──────────

function hasLineOfSight(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax, dy = by - ay;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return true;
    for (let i = 1; i < steps; i++) {
        const cx = Math.round(ax + dx * i / steps);
        const cy = Math.round(ay + dy * i / steps);
        const tile = map.tiles[cy]?.[cx];
        if (!tile || tile.type === 'Wall' || tile.type === 'Door') return false;
    }
    return true;
}

// ─── Pressure plate activation pub/sub (no Zustand — only drives animation) ──
type PlateListener = (level: number, x: number, y: number) => void;
const plateListeners = new Set<PlateListener>();
export function subscribePlateActivated(fn: PlateListener) {
    plateListeners.add(fn);
    return () => plateListeners.delete(fn);
}
function notifyPlateActivated(level: number, x: number, y: number) {
    for (const fn of plateListeners) fn(level, x, y);
}

// ─── Creature action pub/sub (drives sprite frame changes) ───────────────────
type CreatureActionListener = (id: string, action: 'move' | 'attack') => void;
const creatureActionListeners = new Set<CreatureActionListener>();
export function onCreatureAction(fn: CreatureActionListener): () => void {
    creatureActionListeners.add(fn);
    return () => { creatureActionListeners.delete(fn); };
}
function notifyCreatureAction(id: string, action: 'move' | 'attack'): void {
    for (const fn of creatureActionListeners) fn(id, action);
}

// ─── Creature timers (mutable, kept outside Zustand to avoid per-frame re-renders) ──
const creatureTimers = new Map<string, { mt: number; at: number }>();

// ─── Creature initialisation ──────────────────────────────────────────────────

function buildCreatureInstances(): CreatureInstance[] {
    const instances: CreatureInstance[] = [];
    // Track how many creatures already placed per tile key
    const tileSides = new Map<string, CreatureSide>();

    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Creature') continue;
                    const co = obj as CreatureObject;
                    const def = CREATURE_TYPES[co.type];
                    if (!def) continue;
                    const moveSec = def.moveSpd / 6;
                    const atkSec  = def.atkSpd  / 6;
                    // Assign side: first creature on tile = 'left', second = 'right'
                    const tileKey = `${map.index},${tile.x},${tile.y}`;
                    const existing = tileSides.get(tileKey);
                    const side: CreatureSide = existing ? 'right' : 'left';
                    tileSides.set(tileKey, side);
                    const id = `${map.index}_${tile.x}_${tile.y}_${co.index}`;
                    creatureTimers.set(id, {
                        mt: Math.random() * moveSec,
                        at: Math.random() * atkSec,
                    });
                    instances.push({
                        id,
                        typeId: co.type,
                        mapIndex: map.index,
                        x: tile.x,
                        y: tile.y,
                        currentHP: co.hp > 0 ? co.hp : def.baseHP,
                        alive: true,
                        side,
                    });
                }
            }
        }
    }
    return instances;
}

// ─── Floor item initialisation ────────────────────────────────────────────────

const ITEM_CATEGORIES = new Set(['Weapon', 'Armor', 'Potion', 'Scroll', 'Misc', 'Container']);

function buildFloorItems(): FloorItem[] {
    const items: FloorItem[] = [];
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (!ITEM_CATEGORIES.has(obj.category)) continue;
                    const rawObj = obj as unknown as { type: number; name?: string };
                    items.push({
                        id: `${map.index}_${tile.x}_${tile.y}_${obj.category}_${obj.index}`,
                        category: obj.category as FloorItem['category'],
                        typeId: rawObj.type ?? 0,
                        rawName: rawObj.name,
                        mapIndex: map.index,
                        x: tile.x,
                        y: tile.y,
                        tilePos: obj.tilePos,
                    });
                }
            }
        }
    }
    return items;
}

// ─── Teleporter initialisation ────────────────────────────────────────────────

function buildOpenTeleporters(): Set<string> {
    const open = new Set<string>();
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                if (tile.type === 'Teleporter' && tile.open) {
                    open.add(`${map.index},${tile.y},${tile.x}`);
                }
            }
        }
    }
    const fired = new Set<string>();
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Sensor') continue;
                    const s = obj as SensorObject;
                    if (s.type !== 8) continue;
                    const sKey = `${map.index}_${s.index}`;
                    if (s.onceOnly && fired.has(sKey)) continue;
                    if (s.onceOnly) fired.add(sKey);
                    const targetTile = map.tiles[s.targetY]?.[s.targetX];
                    if (!targetTile || targetTile.type !== 'Teleporter') continue;
                    const tKey = `${map.index},${s.targetY},${s.targetX}`;
                    if (s.action === 'Set') open.add(tKey);
                    else if (s.action === 'Clear') open.delete(tKey);
                    else if (s.action === 'Toggle') open.has(tKey) ? open.delete(tKey) : open.add(tKey);
                }
            }
        }
    }
    return open;
}

// ─── Wall-text initialisation ─────────────────────────────────────────────────

function buildVisibleTexts(): Set<string> {
    const visible = new Set<string>();
    for (const map of GAME_MAPS) {
        for (const row of map.tiles) {
            for (const tile of row) {
                for (const obj of tile.objects) {
                    if (obj.category !== 'Text') continue;
                    if ((obj as WallTextObject).visible) {
                        visible.add(`${map.index}_${tile.x}_${tile.y}_${obj.index}`);
                    }
                }
            }
        }
    }
    return visible;
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

const getMap = (level: number): GameMap => getGameMap(level);

export const MIRROR_WALL_MAP: Map<string, Champion> = new Map(
    CHAMPION_START_POSITIONS.map(pos => [`${pos.x},${pos.y}`, CHAMPION_BY_ID[pos.portraitId]])
);
export const MIRROR_FACE_MAP: Map<string, CardinalDir> = new Map(
    CHAMPION_START_POSITIONS.map(pos => [`${pos.x},${pos.y}`, pos.wallFace])
);

const isWalkable = (level: number, y: number, x: number, openDoors: Set<string>): boolean => {
    const map = getMap(level);
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false;
    const tile = map.tiles[y]?.[x];
    if (!tile) return false;
    if (tile.type === 'Wall') return false;
    if (tile.type === 'Door') return openDoors.has(`${level},${y},${x}`);
    return true;
};

const getTeleporter = (tile: GameTile): TeleporterObject | undefined =>
    tile.objects.find((o): o is TeleporterObject => o.category === 'Teleporter');

// ─── Sensor effect helper ─────────────────────────────────────────────────────

type SensorState = {
    openDoors: Set<string>;
    openTeleporters: Set<string>;
    firedSensors: Set<string>;
    visibleTexts: Set<string>;
};

function applyToSet(s: Set<string>, key: string, action: string): Set<string> {
    const next = new Set(s);
    if (action === 'Set') next.add(key);
    else if (action === 'Clear') next.delete(key);
    else if (action === 'Toggle') next.has(key) ? next.delete(key) : next.add(key);
    return next;
}

function computeSensorEffect(sensor: SensorObject, level: number, ss: SensorState): Partial<SensorState> {
    if (sensor.action === 'Hold') return {};
    const sKey = `${level}_${sensor.index}`;
    if (sensor.onceOnly && ss.firedSensors.has(sKey)) return {};
    const newFired = sensor.onceOnly ? new Set([...ss.firedSensors, sKey]) : ss.firedSensors;
    const targetTile = getMap(level).tiles[sensor.targetY]?.[sensor.targetX];
    if (!targetTile) return { firedSensors: newFired };
    const tKey = `${level},${sensor.targetY},${sensor.targetX}`;
    if (targetTile.type === 'Door') {
        return { openDoors: applyToSet(ss.openDoors, tKey, sensor.action), firedSensors: newFired };
    }
    if (targetTile.type === 'Teleporter') {
        return { openTeleporters: applyToSet(ss.openTeleporters, tKey, sensor.action), firedSensors: newFired };
    }
    const textObj = targetTile.objects.find(
        o => o.category === 'Text' && (o as WallTextObject).tilePos === sensor.targetDir
    ) as WallTextObject | undefined;
    if (textObj) {
        const vKey = `${level}_${sensor.targetX}_${sensor.targetY}_${textObj.index}`;
        return { visibleTexts: applyToSet(ss.visibleTexts, vKey, sensor.action), firedSensors: newFired };
    }
    return { firedSensors: newFired };
}

/** Map movement direction → wall face toward the player (for wall-push sensors). */
const PUSH_FACE: Record<string, string> = {
    NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East',
};

/** Trigger sensors on a wall tile when the player pushes against it. */
function triggerWallPushSensors(level: number, wx: number, wy: number, dir: string, ss: SensorState): Partial<SensorState> {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || tile.type !== 'Wall') return {};
    const face = PUSH_FACE[dir];
    let cur: SensorState = ss;
    let changed = false;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.tilePos !== face) continue;
        // Skip: lever (1), wall-button (2), lock (4 — needs item), special (127)
        if (sensor.type === 1 || sensor.type === 2 || sensor.type === 4 || sensor.type === 127) continue;
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            changed = true;
        }
    }
    return changed ? cur : {};
}

/** Try to use an item from party inventory on a type-4 lock sensor.
 *  Returns updated sensor state + consumed inventory if a matching key was found. */
function triggerLockSensors(
    level: number, wx: number, wy: number, face: string, ss: SensorState,
    inventories: Record<number, FloorItem[]>,
): { sensorChanges: Partial<SensorState>; newInventories: Record<number, FloorItem[]> | null } {
    const tile = getMap(level).tiles[wy]?.[wx];
    if (!tile || tile.type !== 'Wall') return { sensorChanges: {}, newInventories: null };
    let cur: SensorState = ss;
    let sensorChanged = false;
    let newInventories: Record<number, FloorItem[]> | null = null;

    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.type !== 4 || sensor.tilePos !== face) continue;

        const required = sensor.data;
        // Find first champion that has the matching item
        let matchChampId: number | null = null;
        let matchItemId: string | null = null;
        for (const [cidStr, inv] of Object.entries(inventories)) {
            for (const item of inv) {
                if (itemToLockData(item.category, item.typeId) === required) {
                    matchChampId = parseInt(cidStr);
                    matchItemId = item.id;
                    break;
                }
            }
            if (matchChampId !== null) break;
        }
        if (matchChampId === null) continue;

        // Consume the item
        if (newInventories === null) newInventories = { ...inventories };
        const inv = newInventories[matchChampId] ?? [];
        newInventories[matchChampId] = inv.filter(i => i.id !== matchItemId);

        // Fire the sensor
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            sensorChanged = true;
        }
    }
    return { sensorChanges: sensorChanged ? cur : {}, newInventories };
}

function triggerFloorSensors(level: number, x: number, y: number, ss: SensorState): Partial<SensorState> {
    const tile = getMap(level).tiles[y]?.[x];
    if (!tile) return {};
    let cur: SensorState = ss;
    let changed = false;
    let playedSound = false;
    for (const obj of tile.objects) {
        if (obj.category !== 'Sensor') continue;
        const sensor = obj as SensorObject;
        if (sensor.type === 2 || sensor.type === 127) continue;
        const effect = computeSensorEffect(sensor, level, cur);
        if (Object.keys(effect).length > 0) {
            cur = { ...cur, ...effect } as SensorState;
            changed = true;
            if (sensor.sound && !playedSound) {
                playPlate();
                playedSound = true;
            }
        }
    }
    // Notify pressure-plate animation subscribers
    if (changed) notifyPlateActivated(level, x, y);
    return changed ? cur : {};
}

// ─── Staircase connections (auto-generated from dungeon.json destMap/destX/destY) ─
// requireGate: true = only passable once the party is assembled (Hall of Champions gate).

export const STAIR_CONNECTIONS: Array<{
    fromLevel: number; fromY: number; fromX: number;
    toLevel: number; toY: number; toX: number; dir: Direction;
    requireGate: boolean;
}> = [
    { fromLevel: 0,  fromY: 15, fromX: 3,  toLevel: 1,  toY: 1,  toX: 3,  dir: 'NORTH', requireGate: true  },
    { fromLevel: 1,  fromY: 1,  fromX: 3,  toLevel: 0,  toY: 15, toX: 3,  dir: 'EAST',  requireGate: false },
    { fromLevel: 1,  fromY: 26, fromX: 6,  toLevel: 2,  toY: 30, toX: 1,  dir: 'EAST',  requireGate: false },
    { fromLevel: 2,  fromY: 30, fromX: 1,  toLevel: 1,  toY: 26, toX: 6,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 2,  fromY: 21, fromX: 25, toLevel: 3,  toY: 31, toX: 30, dir: 'NORTH', requireGate: false },
    { fromLevel: 3,  fromY: 8,  fromX: 6,  toLevel: 4,  toY: 8,  toX: 1,  dir: 'WEST',  requireGate: false },
    { fromLevel: 3,  fromY: 12, fromX: 7,  toLevel: 4,  toY: 12, toX: 2,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 3,  fromY: 31, fromX: 30, toLevel: 2,  toY: 21, toX: 25, dir: 'SOUTH', requireGate: false },
    { fromLevel: 4,  fromY: 8,  fromX: 1,  toLevel: 3,  toY: 8,  toX: 6,  dir: 'NORTH', requireGate: false },
    { fromLevel: 4,  fromY: 12, fromX: 2,  toLevel: 3,  toY: 12, toX: 7,  dir: 'WEST',  requireGate: false },
    { fromLevel: 4,  fromY: 25, fromX: 6,  toLevel: 5,  toY: 20, toX: 6,  dir: 'EAST',  requireGate: false },
    { fromLevel: 4,  fromY: 6,  fromX: 8,  toLevel: 5,  toY: 1,  toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 5,  fromY: 20, fromX: 6,  toLevel: 4,  toY: 25, toX: 6,  dir: 'WEST',  requireGate: false },
    { fromLevel: 5,  fromY: 1,  fromX: 8,  toLevel: 4,  toY: 6,  toX: 8,  dir: 'NORTH', requireGate: false },
    { fromLevel: 5,  fromY: 25, fromX: 25, toLevel: 6,  toY: 25, toX: 25, dir: 'NORTH', requireGate: false },
    { fromLevel: 6,  fromY: 29, fromX: 22, toLevel: 7,  toY: 23, toX: 7,  dir: 'EAST',  requireGate: false },
    { fromLevel: 6,  fromY: 25, fromX: 25, toLevel: 5,  toY: 25, toX: 25, dir: 'SOUTH', requireGate: false },
    { fromLevel: 6,  fromY: 26, fromX: 27, toLevel: 7,  toY: 20, toX: 12, dir: 'EAST',  requireGate: false },
    { fromLevel: 7,  fromY: 5,  fromX: 3,  toLevel: 8,  toY: 11, toX: 11, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 20, fromX: 4,  toLevel: 8,  toY: 26, toX: 12, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 23, fromX: 7,  toLevel: 6,  toY: 29, toX: 22, dir: 'WEST',  requireGate: false },
    { fromLevel: 7,  fromY: 19, fromX: 8,  toLevel: 8,  toY: 25, toX: 16, dir: 'SOUTH', requireGate: false },
    { fromLevel: 7,  fromY: 23, fromX: 9,  toLevel: 8,  toY: 29, toX: 17, dir: 'EAST',  requireGate: false },
    { fromLevel: 7,  fromY: 20, fromX: 12, toLevel: 6,  toY: 26, toX: 27, dir: 'EAST',  requireGate: false },
    { fromLevel: 8,  fromY: 5,  fromX: 10, toLevel: 9,  toY: 0,  toX: 12, dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 11, fromX: 11, toLevel: 7,  toY: 5,  toX: 3,  dir: 'NORTH', requireGate: false },
    { fromLevel: 8,  fromY: 26, fromX: 12, toLevel: 7,  toY: 20, toX: 4,  dir: 'EAST',  requireGate: false },
    { fromLevel: 8,  fromY: 17, fromX: 14, toLevel: 9,  toY: 12, toX: 16, dir: 'WEST',  requireGate: false },
    { fromLevel: 8,  fromY: 25, fromX: 16, toLevel: 7,  toY: 19, toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 27, fromX: 16, toLevel: 9,  toY: 22, toX: 18, dir: 'SOUTH', requireGate: false },
    { fromLevel: 8,  fromY: 29, fromX: 17, toLevel: 7,  toY: 23, toX: 9,  dir: 'WEST',  requireGate: false },
    { fromLevel: 8,  fromY: 29, fromX: 19, toLevel: 9,  toY: 24, toX: 21, dir: 'EAST',  requireGate: false },
    { fromLevel: 9,  fromY: 0,  fromX: 4,  toLevel: 10, toY: 0,  toX: 4,  dir: 'WEST',  requireGate: false },
    { fromLevel: 9,  fromY: 0,  fromX: 12, toLevel: 8,  toY: 5,  toX: 10, dir: 'NORTH', requireGate: false },
    { fromLevel: 9,  fromY: 12, fromX: 16, toLevel: 8,  toY: 17, toX: 14, dir: 'EAST',  requireGate: false },
    { fromLevel: 9,  fromY: 22, fromX: 18, toLevel: 8,  toY: 27, toX: 16, dir: 'NORTH', requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 18, toLevel: 10, toY: 24, toX: 18, dir: 'SOUTH', requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 21, toLevel: 8,  toY: 29, toX: 19, dir: 'WEST',  requireGate: false },
    { fromLevel: 9,  fromY: 24, fromX: 23, toLevel: 10, toY: 24, toX: 23, dir: 'EAST',  requireGate: false },
    { fromLevel: 10, fromY: 0,  fromX: 4,  toLevel: 9,  toY: 0,  toX: 4,  dir: 'EAST',  requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 18, toLevel: 9,  toY: 24, toX: 18, dir: 'NORTH', requireGate: false },
    { fromLevel: 10, fromY: 26, fromX: 18, toLevel: 11, toY: 16, toX: 8,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 23, toLevel: 9,  toY: 24, toX: 23, dir: 'WEST',  requireGate: false },
    { fromLevel: 10, fromY: 28, fromX: 24, toLevel: 11, toY: 18, toX: 14, dir: 'NORTH', requireGate: false },
    { fromLevel: 10, fromY: 24, fromX: 25, toLevel: 11, toY: 14, toX: 15, dir: 'EAST',  requireGate: false },
    { fromLevel: 11, fromY: 16, fromX: 8,  toLevel: 10, toY: 26, toX: 18, dir: 'NORTH', requireGate: false },
    { fromLevel: 11, fromY: 18, fromX: 8,  toLevel: 12, toY: 8,  toX: 3,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 12, fromX: 10, toLevel: 12, toY: 2,  toX: 5,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 18, fromX: 14, toLevel: 10, toY: 28, toX: 24, dir: 'SOUTH', requireGate: false },
    { fromLevel: 11, fromY: 14, fromX: 15, toLevel: 10, toY: 24, toX: 25, dir: 'WEST',  requireGate: false },
    { fromLevel: 11, fromY: 16, fromX: 15, toLevel: 12, toY: 6,  toX: 10, dir: 'WEST',  requireGate: false },
    { fromLevel: 12, fromY: 8,  fromX: 3,  toLevel: 11, toY: 18, toX: 8,  dir: 'NORTH', requireGate: false },
    { fromLevel: 12, fromY: 10, fromX: 3,  toLevel: 13, toY: 8,  toX: 3,  dir: 'SOUTH', requireGate: false },
    { fromLevel: 12, fromY: 2,  fromX: 5,  toLevel: 11, toY: 12, toX: 10, dir: 'NORTH', requireGate: false },
    { fromLevel: 12, fromY: 11, fromX: 6,  toLevel: 13, toY: 9,  toX: 6,  dir: 'EAST',  requireGate: false },
    { fromLevel: 12, fromY: 6,  fromX: 10, toLevel: 11, toY: 16, toX: 15, dir: 'EAST',  requireGate: false },
    { fromLevel: 13, fromY: 8,  fromX: 3,  toLevel: 12, toY: 10, toX: 3,  dir: 'NORTH', requireGate: false },
    { fromLevel: 13, fromY: 9,  fromX: 6,  toLevel: 12, toY: 11, toX: 6,  dir: 'WEST',  requireGate: false },
];

// ─── Start position ───────────────────────────────────────────────────────────

const HALL_START: [number, number] = [3, 1];
const HALL_START_DIR: Direction = 'SOUTH';

// ─── State interface ───────────────────────────────────────────────────────────

interface GameState {
    level: number;
    position: [number, number];
    direction: Direction;
    party: Champion[];
    /** Index (0-3) of the currently selected party slot — picks up items. */
    selectedChampionIndex: number;
    gamePhase: GamePhase;
    activeMirrorChampionId: number | null;
    activePartyMemberId: number | null;
    gateOpen: boolean;
    openDoors: Set<string>;
    openTeleporters: Set<string>;
    firedSensors: Set<string>;
    visibleTexts: Set<string>;
    creatures: CreatureInstance[];
    floorItems: FloorItem[];
    /** Per-champion inventories, keyed by champion.id */
    championInventories: Record<number, FloorItem[]>;
    /** Per-champion equipment, keyed by champion.id */
    championEquipment: Record<number, ChampionEquipment>;
    /** Live HP / Stamina / Mana, keyed by champion.id */
    championVitals: Record<number, ChampionVitals>;
    /** Result of the most recent spell cast attempt */
    lastCastResult: CastResult | null;
    /** Per-champion accumulated XP, keyed by champion.id */
    championXP: Record<number, ChampionXP>;
    /** Per-champion combat state (cooldown), keyed by champion.id */
    championCombat: Record<number, ChampionCombat>;
    /** Floating damage numbers, cleared after ~600 ms */
    damageEvents: DamageEvent[];
    /** Doors currently crushing a creature: key → { phase, timer } */
    crushingDoors: Record<string, { phase: 'closing' | 'bouncing'; timer: number }>;
    /** Timestamp (ms) when each torch item (Weapon typeId 16) was first equipped */
    torchBurnStart: Record<string, number>;
    /** Active torch / light spells — extend fog visibility until expiry */
    spellLights: SpellLight[];
    /** Flying projectiles (fireball, lightning, …) */
    projectiles: Projectile[];
    /** Active magic / fire shields — reduce incoming damage */
    activeShields: PartyShield[];
    /** Party is invisible until this timestamp (0 = not invisible) */
    invisibleUntil: number;
    /** Magic vision active until this timestamp (0 = inactive) */
    magicVisionUntil: number;
    /** Footprint spell active until this timestamp (0 = inactive) */
    footprintsUntil: number;
    /** Tile positions visited while footprint spell was active */
    footprintHistory: FootprintEntry[];

    moveForward: () => void;
    moveBackward: () => void;
    strafeLeft: () => void;
    strafeRight: () => void;
    turnLeft: () => void;
    turnRight: () => void;

    addToParty: (champion: Champion) => void;
    removeFromParty: (championId: number) => void;
    openMirror: (championId: number) => void;
    closeMirror: () => void;
    openPartyMember: (championId: number) => void;
    closePartyMember: () => void;
    tryOpenGate: () => void;
    goToLevel: (level: number, pos: [number, number], dir: Direction) => void;
    toggleDoor: (x: number, y: number) => void;
    activateWallSensor: (mapIndex: number, x: number, y: number, sensorIndex: number) => void;
    killCreature: (id: string) => void;

    selectChampion: (index: number) => void;
    reorderParty: (fromIndex: number, toIndex: number) => void;
    castSpell: (championId: number, runeIds: string[]) => void;
    regenTick: (delta: number) => void;
    gainXP: (championId: number, skill: CastSkill, amount: number) => void;
    attackFront: (championId: number) => void;
    tickCombat: (delta: number) => void;
    tickMonsters: (delta: number) => void;
    tickDoors: (delta: number) => void;
    tickSpells: (now: number) => void;
    pickupItem: (id: string) => void;
    dropItem: (itemId: string, championId: number) => void;
    equipItem: (championId: number, slotKey: EquipSlotKey, itemId: string) => void;
    unequipItem: (championId: number, slotKey: EquipSlotKey) => void;
    giveItem: (fromChampionId: number, toChampionId: number, itemId: string) => void;
    giveEquippedItem: (fromChampionId: number, slotKey: EquipSlotKey, toChampionId: number) => void;
}

const DIRECTIONS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<GameState>((set) => ({
    level: 0,
    position: HALL_START,
    direction: HALL_START_DIR,
    party: [],
    selectedChampionIndex: 0,
    gamePhase: 'exploration',
    activeMirrorChampionId: null,
    activePartyMemberId: null,
    gateOpen: false,
    openDoors: new Set<string>(),
    openTeleporters: buildOpenTeleporters(),
    firedSensors: new Set<string>(),
    visibleTexts: buildVisibleTexts(),
    creatures: buildCreatureInstances(),
    floorItems: buildFloorItems(),
    championInventories: {},
    championEquipment: {},
    championVitals: {},
    lastCastResult: null,
    championXP: {},
    championCombat: {},
    damageEvents: [],
    crushingDoors: {},
    torchBurnStart: {},
    spellLights: [],
    projectiles: [],
    activeShields: [],
    invisibleUntil: 0,
    magicVisionUntil: 0,
    footprintsUntil: 0,
    footprintHistory: [],

    moveForward: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y - 1;
        if (state.direction === 'SOUTH') ny = y + 1;
        if (state.direction === 'EAST')  nx = x + 1;
        if (state.direction === 'WEST')  nx = x - 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors)) {
            const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
            const face = { NORTH: 'South', SOUTH: 'North', EAST: 'West', WEST: 'East' }[state.direction]!;
            const pushChanges = triggerWallPushSensors(state.level, nx, ny, state.direction, ss);
            const pushState = Object.keys(pushChanges).length > 0 ? { ...ss, ...pushChanges } as SensorState : ss;
            const { sensorChanges, newInventories } = triggerLockSensors(state.level, nx, ny, face, pushState, state.championInventories);
            const anyChange = Object.keys(pushChanges).length > 0 || Object.keys(sensorChanges).length > 0;
            if (!anyChange) return state;
            return {
                ...sensorChanges,
                ...(newInventories ? { championInventories: newInventories } : {}),
            };
        }
        const map = getMap(state.level);
        const tile = map.tiles[ny]?.[nx];
        if (!tile) return state;
        if (tile.type === 'Stairs') {
            const link = STAIR_CONNECTIONS.find(
                s => s.fromLevel === state.level && s.fromY === ny && s.fromX === nx
            );
            if (link) {
                if (link.requireGate && !state.gateOpen) return state;
                return { level: link.toLevel, position: [link.toY, link.toX] as [number, number], direction: link.dir };
            }
        }
        if (tile.type === 'Teleporter') {
            const tp = getTeleporter(tile);
            if (tp && tp.destMap !== state.level) {
                if (!state.gateOpen) return state;
                return { level: tp.destMap, position: [tp.destY, tp.destX] as [number, number], direction: state.direction };
            }
            if (tp && tp.destMap === state.level) {
                const tpKey = `${state.level},${ny},${nx}`;
                if (state.openTeleporters.has(tpKey)) {
                    const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
                    const sensorChanges = triggerFloorSensors(state.level, tp.destX, tp.destY, ss);
                    return { position: [tp.destY, tp.destX] as [number, number], ...sensorChanges };
                }
            }
        }
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const sensorChanges = triggerFloorSensors(state.level, nx, ny, ss);
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return { position: [ny, nx] as [number, number], ...sensorChanges, ...footprintChanges };
    }),

    moveBackward: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') ny = y + 1;
        if (state.direction === 'SOUTH') ny = y - 1;
        if (state.direction === 'EAST')  nx = x - 1;
        if (state.direction === 'WEST')  nx = x + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors)) return state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const sensorChanges = triggerFloorSensors(state.level, nx, ny, ss);
        const footprintChanges = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return { position: [ny, nx] as [number, number], ...sensorChanges, ...footprintChanges };
    }),

    strafeLeft: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x - 1;
        if (state.direction === 'SOUTH') nx = x + 1;
        if (state.direction === 'EAST')  ny = y - 1;
        if (state.direction === 'WEST')  ny = y + 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors)) return state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const fpL = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return { position: [ny, nx] as [number, number], ...triggerFloorSensors(state.level, nx, ny, ss), ...fpL };
    }),

    strafeRight: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const [y, x] = state.position;
        let ny = y, nx = x;
        if (state.direction === 'NORTH') nx = x + 1;
        if (state.direction === 'SOUTH') nx = x - 1;
        if (state.direction === 'EAST')  ny = y + 1;
        if (state.direction === 'WEST')  ny = y - 1;
        if (!isWalkable(state.level, ny, nx, state.openDoors)) return state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        const fpR = Date.now() < state.footprintsUntil
            ? { footprintHistory: [...state.footprintHistory, { x: nx, y: ny, level: state.level, ts: Date.now() }] }
            : {};
        return { position: [ny, nx] as [number, number], ...triggerFloorSensors(state.level, nx, ny, ss), ...fpR };
    }),

    turnLeft: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const index = DIRECTIONS.indexOf(state.direction);
        return { direction: DIRECTIONS[(index + 3) % 4] };
    }),

    turnRight: () => set((state) => {
        if (state.gamePhase !== 'exploration') return state;
        const index = DIRECTIONS.indexOf(state.direction);
        return { direction: DIRECTIONS[(index + 1) % 4] };
    }),

    addToParty: (champion) => set((state) => {
        if (state.party.find(c => c.id === champion.id)) return state;
        if (state.party.length >= MAX_PARTY) return state;
        const newParty = [...state.party, champion];
        return {
            party: newParty,
            gateOpen: newParty.length >= MAX_PARTY,
            championInventories: champion.id in state.championInventories
                ? state.championInventories
                : { ...state.championInventories, [champion.id]: [] },
            championEquipment: champion.id in state.championEquipment
                ? state.championEquipment
                : { ...state.championEquipment, [champion.id]: {} },
            championVitals: champion.id in state.championVitals
                ? state.championVitals
                : {
                    ...state.championVitals,
                    [champion.id]: {
                        hp:      champion.health,
                        stamina: champion.stamina,
                        mana:    champion.mana,
                    },
                },
            championXP: champion.id in state.championXP
                ? state.championXP
                : { ...state.championXP, [champion.id]: buildInitialXP(champion) },
            championCombat: champion.id in state.championCombat
                ? state.championCombat
                : { ...state.championCombat, [champion.id]: { cooldown: 0, cooldownMax: 1 } },
        };
    }),

    removeFromParty: (championId) => set((state) => {
        const newParty = state.party.filter(c => c.id !== championId);
        const [y, x] = state.position;
        const inv = state.championInventories[championId] ?? [];
        const equip = state.championEquipment[championId] ?? {};
        const dropped: FloorItem[] = [
            ...inv,
            ...(Object.values(equip).filter(Boolean) as FloorItem[]),
        ].map(item => ({ ...item, mapIndex: state.level, x, y, tilePos: 'North' as const }));
        return {
            party: newParty,
            gateOpen: newParty.length >= MAX_PARTY,
            floorItems: [...state.floorItems, ...dropped],
            championInventories: { ...state.championInventories, [championId]: [] },
            championEquipment: { ...state.championEquipment, [championId]: {} },
        };
    }),

    openMirror:       (championId) => set({ gamePhase: 'mirror_open', activeMirrorChampionId: championId }),
    closeMirror:      () => set({ gamePhase: 'exploration', activeMirrorChampionId: null }),
    openPartyMember:  (championId) => set({ activePartyMemberId: championId }),
    closePartyMember: () => set({ activePartyMemberId: null }),

    tryOpenGate: () => set((state) => ({ gateOpen: state.party.length >= MAX_PARTY })),

    goToLevel: (level, pos, dir) => set({ level, position: pos, direction: dir }),

    toggleDoor: (x, y) => set((state) => {
        const key = `${state.level},${y},${x}`;
        const next = new Set(state.openDoors);

        if (!next.has(key)) {
            // Door is closed → open it, cancel any crush
            next.add(key);
            const { [key]: _removed, ...remaining } = state.crushingDoors;
            return { openDoors: next, crushingDoors: remaining };
        }

        // Door is open → try to close it
        next.delete(key);
        const blocker = state.creatures.find(
            c => c.alive && c.mapIndex === state.level && c.x === x && c.y === y
        );
        if (blocker) {
            // Start crush cycle
            return {
                openDoors: next,
                crushingDoors: { ...state.crushingDoors, [key]: { phase: 'closing' as const, timer: 0.55 } },
            };
        }
        return { openDoors: next };
    }),

    activateWallSensor: (mapIndex, x, y, sensorIndex) => set((state) => {
        const tile = getMap(mapIndex).tiles[y]?.[x];
        if (!tile) return state;
        const sensor = tile.objects.find(
            o => o.category === 'Sensor' && (o as SensorObject).index === sensorIndex
        ) as SensorObject | undefined;
        if (!sensor) return state;
        const ss: SensorState = { openDoors: state.openDoors, openTeleporters: state.openTeleporters, firedSensors: state.firedSensors, visibleTexts: state.visibleTexts };
        return computeSensorEffect(sensor, mapIndex, ss);
    }),

    killCreature: (id) => set((state) => ({
        creatures: state.creatures.map(c => c.id === id ? { ...c, alive: false } : c),
    })),

    selectChampion: (index) => set({ selectedChampionIndex: index }),

    reorderParty: (fromIndex, toIndex) => set((state) => {
        if (fromIndex === toIndex) return state;
        const newParty = [...state.party];
        const [moved] = newParty.splice(fromIndex, 1);
        newParty.splice(toIndex, 0, moved);
        // Keep selectedChampionIndex pointing to the same champion
        const selectedId = state.party[state.selectedChampionIndex]?.id;
        const newSelectedIdx = selectedId !== undefined
            ? newParty.findIndex(c => c.id === selectedId)
            : state.selectedChampionIndex;
        return { party: newParty, selectedChampionIndex: Math.max(0, newSelectedIdx) };
    }),

    pickupItem: (id) => set((state) => {
        const item = state.floorItems.find(i => i.id === id);
        if (!item) return state;
        const activeChampion = state.party[state.selectedChampionIndex];
        if (!activeChampion) return state;
        const champInv = state.championInventories[activeChampion.id] ?? [];
        return {
            floorItems: state.floorItems.filter(i => i.id !== id),
            championInventories: { ...state.championInventories, [activeChampion.id]: [...champInv, item] },
        };
    }),

    dropItem: (itemId, championId) => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const item = inv.find(i => i.id === itemId);
        if (!item) return state;
        const [y, x] = state.position;
        const dropped: FloorItem = { ...item, mapIndex: state.level, x, y, tilePos: 'North' };
        return {
            championInventories: { ...state.championInventories, [championId]: inv.filter(i => i.id !== itemId) },
            floorItems: [...state.floorItems, dropped],
        };
    }),

    equipItem: (championId, slotKey, itemId) => set((state) => {
        const inv = state.championInventories[championId] ?? [];
        const item = inv.find(i => i.id === itemId);
        if (!item) return state;
        const curEquip = state.championEquipment[championId] ?? {};
        const displaced = curEquip[slotKey];
        const newInv = inv.filter(i => i.id !== itemId);
        if (displaced) newInv.push(displaced);
        // Light a torch the first time it is equipped
        const isTorch = item.category === 'Weapon' && item.typeId === 16;
        const torchChanges = isTorch && !state.torchBurnStart[item.id]
            ? { torchBurnStart: { ...state.torchBurnStart, [item.id]: Date.now() } }
            : {};
        return {
            championInventories: { ...state.championInventories, [championId]: newInv },
            championEquipment: { ...state.championEquipment, [championId]: { ...curEquip, [slotKey]: item } },
            ...torchChanges,
        };
    }),

    unequipItem: (championId, slotKey) => set((state) => {
        const curEquip = state.championEquipment[championId] ?? {};
        const item = curEquip[slotKey];
        if (!item) return state;
        const inv = state.championInventories[championId] ?? [];
        const newEquip = { ...curEquip };
        delete newEquip[slotKey];
        return {
            championInventories: { ...state.championInventories, [championId]: [...inv, item] },
            championEquipment: { ...state.championEquipment, [championId]: newEquip },
        };
    }),

    giveItem: (fromChampionId, toChampionId, itemId) => set((state) => {
        const fromInv = state.championInventories[fromChampionId] ?? [];
        const item = fromInv.find(i => i.id === itemId);
        if (!item) return state;
        const toInv = state.championInventories[toChampionId] ?? [];
        return {
            championInventories: {
                ...state.championInventories,
                [fromChampionId]: fromInv.filter(i => i.id !== itemId),
                [toChampionId]: [...toInv, item],
            },
        };
    }),

    giveEquippedItem: (fromChampionId, slotKey, toChampionId) => set((state) => {
        const fromEquip = state.championEquipment[fromChampionId] ?? {};
        const item = fromEquip[slotKey];
        if (!item) return state;
        const toInv = state.championInventories[toChampionId] ?? [];
        const newEquip = { ...fromEquip };
        delete newEquip[slotKey];
        return {
            championEquipment: { ...state.championEquipment, [fromChampionId]: newEquip },
            championInventories: { ...state.championInventories, [toChampionId]: [...toInv, item] },
        };
    }),

    // ─── Potion rune → typeId mapping (spell runes without power rune) ──────────
    // Source: Old_data/game_db.json potionTypes
    // vi,bro,ra → Health (8) | vi,bro → Antidote (11) | ya → Stamina (9)
    // ya,bro → Anti-Magic/Shield (17) | zo,bro,ra → Mana (10)

    // ─── Spell casting ────────────────────────────────────────────────────────
    castSpell: (championId, runeIds) => set((state) => {
        const champion = state.party.find(c => c.id === championId);
        if (!champion) return state;

        const spell = findSpell(runeIds);
        if (!spell) {
            return {
                lastCastResult: { success: false, message: 'Combinaison de runes inconnue.', ts: Date.now() },
            };
        }

        const vitals = state.championVitals[championId];
        if (!vitals) return state;

        if (vitals.mana < spell.manaCost) {
            return {
                lastCastResult: {
                    success: false,
                    message: `Mana insuffisant — ${spell.name} requiert ${spell.manaCost} points.`,
                    ts: Date.now(),
                },
            };
        }

        // Check casting skill (champion needs at least manaBase level to cast efficiently;
        // lower skill still casts but costs full mana — DM1 behaviour)
        const skillLevel = getSkillLevel(champion.skills, spell.castSkill);
        const lowSkill   = skillLevel < spell.manaBase;

        const newMana = vitals.mana - spell.manaCost;

        // Spell XP: manaBase × 15 in castSkill
        const spellXPGain = spell.manaBase * 15;
        const curXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
        const newXP = { ...curXP, [spell.castSkill]: curXP[spell.castSkill] + spellXPGain };

        const message = lowSkill
            ? `${spell.name} lancé avec difficulté. (${spell.castSkill} niv. ${skillLevel})`
            : `${spell.name} — ${spell.description}`;

        const now = Date.now();
        let newVitals = { ...vitals, mana: Math.max(0, newMana) };

        const base = {
            championXP: { ...state.championXP, [championId]: newXP },
            lastCastResult: { success: true, message, ts: now } as CastResult,
        };

        // ── Apply spell effect ────────────────────────────────────────────────
        switch (spell.effect) {

            case 'heal': {
                const healAmount = Math.round(spell.manaCost * 10);
                newVitals = { ...newVitals, hp: Math.min(champion.health, vitals.hp + healAmount) };
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
            }

            case 'light': {
                // FUL = +0.25 / 10 min ; OH IR RA = +0.50 / 15 min
                const isFul = spell.runes.slice(1).join(',') === 'ful';
                const lightContrib = isFul ? 0.25 : 0.50;
                const durationMs   = isFul ? 10 * 60_000 : 15 * 60_000;
                const newLight: SpellLight = {
                    id: `light_${now}_${Math.random().toString(36).slice(2)}`,
                    lightContrib,
                    expiresAt: now + durationMs,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    spellLights: [...state.spellLights, newLight],
                };
            }

            case 'open': {
                const [py, px] = state.position;
                let fy = py, fx = px;
                if (state.direction === 'NORTH') fy--;
                else if (state.direction === 'SOUTH') fy++;
                else if (state.direction === 'EAST') fx++;
                else fx--; // WEST
                const doorKey = `${state.level},${fy},${fx}`;
                const frontTile = getMap(state.level).tiles[fy]?.[fx];
                if (frontTile?.type === 'Door' && !state.openDoors.has(doorKey)) {
                    const newOpenDoors = new Set(state.openDoors);
                    newOpenDoors.add(doorKey);
                    return {
                        ...base,
                        championVitals: { ...state.championVitals, [championId]: newVitals },
                        openDoors: newOpenDoors,
                    };
                }
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
            }

            case 'fireball':
            case 'lightning':
            case 'poison':
            case 'plasma': {
                const [py, px] = state.position;
                // Start one tile ahead of the player so it's visible from cast
                let startX = px, startY = py;
                if      (state.direction === 'NORTH') startY--;
                else if (state.direction === 'SOUTH') startY++;
                else if (state.direction === 'EAST')  startX++;
                else                                   startX--;
                const newProj: Projectile = {
                    id: `proj_${now}_${Math.random().toString(36).slice(2)}`,
                    level: state.level,
                    x: startX,
                    y: startY,
                    direction: state.direction,
                    effect: spell.effect as ProjectileEffect,
                    damage: [Math.round(spell.manaCost * 3), Math.round(spell.manaCost * 5)],
                    nextMoveAt: now + 300,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    projectiles: [...state.projectiles, newProj],
                };
            }

            case 'darkness': {
                // Negative light contribution — inverse of light
                const durationMs = 10 * 60_000;
                const darkEntry: SpellLight = {
                    id: `dark_${now}_${Math.random().toString(36).slice(2)}`,
                    lightContrib: -0.5,
                    expiresAt: now + durationMs,
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    spellLights: [...state.spellLights, darkEntry],
                };
            }

            case 'shield':
            case 'fire_shield': {
                // protection: scales from ~25% (Lo) to ~75% (Mon), capped at 0.75
                const protection = Math.min(0.75, spell.manaCost * 0.022);
                const durationMs = Math.round(spell.manaCost * 8_000);
                const shield: PartyShield = {
                    id: `shield_${now}_${Math.random().toString(36).slice(2)}`,
                    expiresAt: now + durationMs,
                    protection,
                    fireOnly: spell.effect === 'fire_shield',
                };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    activeShields: [...state.activeShields, shield],
                };
            }

            case 'invisibility': {
                // mana costs (17,25,35,43,53,61) → duration 2m16s … 8m8s
                const durationMs = spell.manaCost * 8_000;
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    invisibleUntil: Math.max(state.invisibleUntil, now + durationMs),
                };
            }

            case 'magic_vision': {
                const durationMs = spell.manaCost * 10_000;
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    magicVisionUntil: Math.max(state.magicVisionUntil, now + durationMs),
                };
            }

            case 'footprints': {
                const durationMs = spell.manaCost * 20_000;
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    footprintsUntil: Math.max(state.footprintsUntil, now + durationMs),
                };
            }

            case 'potion': {
                // Requires an empty flask (Misc typeId 40) in caster's hand.
                // Rune combo (sans power rune) determines which potion is created.
                const POTION_RUNE_MAP: Record<string, number> = {
                    'ya': 9,            // Stamina Potion
                    'vi,bro': 11,       // Antidote
                    'vi,bro,ra': 8,     // Health Potion
                    'ya,bro': 17,       // Anti-Magic / Shield Potion
                    'zo,bro,ra': 10,    // Mana Potion
                };
                const spellRunes = spell.runes.slice(1).join(',');
                const potionTypeId = POTION_RUNE_MAP[spellRunes];
                if (potionTypeId === undefined) {
                    return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
                }
                const equip = state.championEquipment[championId] ?? {};
                const flaskSlot = (['rightHand', 'leftHand'] as const).find(
                    slot => equip[slot]?.category === 'Misc' && equip[slot]?.typeId === 40
                );
                if (!flaskSlot) {
                    return {
                        ...base,
                        championVitals: { ...state.championVitals, [championId]: newVitals },
                        lastCastResult: {
                            success: false,
                            message: 'Il faut une flasque vide dans la main.',
                            ts: now,
                        },
                    };
                }
                const flask = equip[flaskSlot]!;
                const potion = { ...flask, category: 'Potion' as const, typeId: potionTypeId };
                const newEquip = { ...equip, [flaskSlot]: potion };
                return {
                    ...base,
                    championVitals: { ...state.championVitals, [championId]: newVitals },
                    championEquipment: { ...state.championEquipment, [championId]: newEquip },
                };
            }

            default:
                return { ...base, championVitals: { ...state.championVitals, [championId]: newVitals } };
        }
    }),

    // ─── Vitals regeneration (call each frame with delta in seconds) ──────────
    // Rates (per second, based on DM1 approximations):
    //   HP      → vitality / 600   (≈ 12 s/pt for vit=50)
    //   Stamina → vitality / 200   (≈  4 s/pt for vit=50)
    //   Mana    → wisdom   / 150   (≈  3 s/pt for wis=50) — only if maxMana > 0
    regenTick: (delta) => set((state) => {
        const newVitals: Record<number, ChampionVitals> = {};
        let changed = false;
        for (const champ of state.party) {
            const v = state.championVitals[champ.id];
            if (!v) continue;
            const maxHP      = champ.health;
            const maxStamina = champ.stamina;
            const maxMana    = champ.mana;   // 0 for pure fighters

            const nextHP      = maxHP      > v.hp      ? Math.min(maxHP,      v.hp      + champ.vitality / 600 * delta) : v.hp;
            const nextStamina = maxStamina > v.stamina  ? Math.min(maxStamina, v.stamina + champ.vitality / 200 * delta) : v.stamina;
            const nextMana    = maxMana > 0 && maxMana > v.mana
                ? Math.min(maxMana, v.mana + champ.wisdom / 150 * delta)
                : v.mana;

            if (nextHP !== v.hp || nextStamina !== v.stamina || nextMana !== v.mana) {
                newVitals[champ.id] = { hp: nextHP, stamina: nextStamina, mana: nextMana };
                changed = true;
            }
        }
        return changed ? { championVitals: { ...state.championVitals, ...newVitals } } : state;
    }),

    // ─── XP ───────────────────────────────────────────────────────────────────
    gainXP: (championId, skill, amount) => set((state) => {
        const xp = state.championXP[championId];
        if (!xp || amount <= 0) return state;
        return {
            championXP: {
                ...state.championXP,
                [championId]: { ...xp, [skill]: xp[skill] + amount },
            },
        };
    }),

    // ─── Physical attack ──────────────────────────────────────────────────────
    attackFront: (championId) => set((state) => {
        const combat = state.championCombat[championId];
        if (!combat || combat.cooldown > 0) return state;

        const champion = state.party.find(c => c.id === championId);
        if (!champion) return state;

        // Determine champion's column: party[0/2] = left, party[1/3] = right
        const champIdx = state.party.findIndex(c => c.id === championId);
        const isLeftCol = champIdx === 0 || champIdx === 2;
        const preferredSide: CreatureSide = isLeftCol ? 'left' : 'right';

        const front = creaturesInFront(state.level, state.position, state.direction, state.creatures);
        // Prefer same-column side, fall back to any
        const target = front.find(c => c.side === preferredSide) ?? front[0] ?? null;

        // Start cooldown even if nothing to hit (swing in the air)
        const stats = getRightHandStats(state.championEquipment[championId]);
        const newCombat: ChampionCombat = { cooldown: stats.cooldownSec, cooldownMax: stats.cooldownSec };

        playPartyAttack();

        if (!target) {
            return { championCombat: { ...state.championCombat, [championId]: newCombat } };
        }

        // Damage
        const baseDmg = stats.dmgMin + Math.floor(Math.random() * (stats.dmgMax - stats.dmgMin + 1));
        const strBonus = Math.floor(champion.strength / 10);
        const totalDmg = Math.max(1, baseDmg + strBonus); // party attacks creatures — no shield applies here

        const newHP = target.currentHP - totalDmg;
        const killed = newHP <= 0;
        const newCreatures = state.creatures.map(c =>
            c.id === target.id ? { ...c, currentHP: Math.max(0, newHP), alive: !killed } : c
        );

        // XP: attacker gains fighter/wizard XP = damage dealt
        const attackerXP = state.championXP[championId] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
        let newChampXP: Record<number, ChampionXP> = {
            ...state.championXP,
            [championId]: { ...attackerXP, [stats.skill]: attackerXP[stats.skill] + totalDmg },
        };

        // Kill XP: shared equally among living party members
        if (killed) {
            const def = CREATURE_TYPES[target.typeId];
            const killXP = def?.exp ?? 0;
            const living = state.party.filter(c => (state.championVitals[c.id]?.hp ?? 0) > 0);
            const share = living.length > 0 ? Math.floor(killXP / living.length) : 0;
            if (share > 0) {
                for (const c of living) {
                    const cx = newChampXP[c.id] ?? { fighter: 0, ninja: 0, priest: 0, wizard: 0 };
                    newChampXP[c.id] = { ...cx, fighter: cx.fighter + share };
                }
            }
        }

        const newDmgEvent: DamageEvent = {
            id: `dmg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            x: target.x,
            y: target.y,
            amount: totalDmg,
            ts: Date.now(),
        };

        return {
            creatures: newCreatures,
            championXP: newChampXP,
            championCombat: { ...state.championCombat, [championId]: newCombat },
            damageEvents: [...state.damageEvents, newDmgEvent],
        };
    }),

    // ─── Door crush tick ─────────────────────────────────────────────────────
    tickDoors: (delta) => set((state) => {
        const keys = Object.keys(state.crushingDoors);
        if (keys.length === 0) return state;

        let crush   = state.crushingDoors;
        let doors   = state.openDoors;
        let crtrs   = state.creatures as CreatureInstance[];
        let dmgEvts = state.damageEvents;
        let changed = false;

        for (const key of keys) {
            const c = crush[key];
            // Parse key `level,y,x`
            const [, sY, sX] = key.split(',');
            const tx = parseInt(sX), ty = parseInt(sY);

            const blocker = crtrs.find(cr => cr.alive && cr.x === tx && cr.y === ty);

            if (!blocker) {
                // Creature gone — door stays closed, remove crush entry
                if (crush === state.crushingDoors) crush = { ...crush };
                delete crush[key];
                if (doors.has(key)) { doors = new Set(doors); doors.delete(key); }
                changed = true;
                continue;
            }

            const newTimer = c.timer - delta;

            if (c.phase === 'closing') {
                if (newTimer > 0) {
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { ...c, timer: newTimer };
                    changed = true;
                } else {
                    // Hit! Deal damage
                    const dmg = 25 + Math.floor(Math.random() * 16); // 25–40
                    const newHP = Math.max(0, blocker.currentHP - dmg);
                    const killed = newHP <= 0;

                    if (crtrs === state.creatures) crtrs = [...crtrs];
                    const idx = crtrs.findIndex(cr => cr.id === blocker.id);
                    if (idx >= 0) crtrs[idx] = { ...crtrs[idx], currentHP: newHP, alive: !killed };

                    dmgEvts = [...dmgEvts, {
                        id: `door_${Date.now()}_${key}`,
                        x: tx, y: ty, amount: dmg, ts: Date.now(),
                    }];

                    if (crush === state.crushingDoors) crush = { ...crush };
                    if (killed) {
                        delete crush[key]; // door stays closed, creature dead
                    } else {
                        // Bounce door open, then try again
                        crush[key] = { phase: 'bouncing', timer: 0.38 };
                        doors = new Set(doors); doors.add(key);
                    }
                    changed = true;
                }
            } else {
                // 'bouncing' — door is open briefly
                if (newTimer > 0) {
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { ...c, timer: newTimer };
                    changed = true;
                } else {
                    // Close again and start next crush countdown
                    doors = new Set(doors); doors.delete(key);
                    if (crush === state.crushingDoors) crush = { ...crush };
                    crush[key] = { phase: 'closing', timer: 0.50 };
                    changed = true;
                }
            }
        }

        if (!changed) return state;
        return {
            crushingDoors: crush,
            openDoors: doors,
            creatures: crtrs,
            damageEvents: dmgEvts,
        };
    }),

    // ─── Monster AI tick ─────────────────────────────────────────────────────
    tickMonsters: (delta) => set((state) => {
        if (state.party.length === 0) return state;
        const [py, px] = state.position;
        const map = getMap(state.level);

        // Walkability for monsters: no Wall, no Door (monsters can't open doors)
        const monsterWalkable = (y: number, x: number): boolean => {
            if (y < 0 || y >= map.height || x < 0 || x >= map.width) return false;
            const t = map.tiles[y]?.[x];
            return !!t && t.type !== 'Wall' && t.type !== 'Door';
        };

        // Pick an attack target based on creature side:
        //   left creature → prefers left column (party[0,2]), falls back to right (party[1,3])
        //   right creature → prefers right column (party[1,3]), falls back to left (party[0,2])
        const getTarget = (side: CreatureSide) => {
            const preferIdx = side === 'left' ? [0, 2] : [1, 3];
            const fallbackIdx = side === 'left' ? [1, 3] : [0, 2];
            for (const indices of [preferIdx, fallbackIdx]) {
                // Front row first within the column set
                const frontAlive = indices.filter(i => i <= 1)
                    .map(i => state.party[i])
                    .filter((c): c is import('../data/champions').Champion =>
                        !!c && (state.championVitals[c.id]?.hp ?? 0) > 0);
                if (frontAlive.length > 0)
                    return frontAlive[Math.floor(Math.random() * frontAlive.length)];
                const backAlive = indices.filter(i => i > 1)
                    .map(i => state.party[i])
                    .filter((c): c is import('../data/champions').Champion =>
                        !!c && (state.championVitals[c.id]?.hp ?? 0) > 0);
                if (backAlive.length > 0)
                    return backAlive[Math.floor(Math.random() * backAlive.length)];
            }
            return null;
        };

        let creatures = state.creatures as CreatureInstance[];
        let vitals    = state.championVitals;
        let dmgEvts   = state.damageEvents;
        let anyChange = false;

        for (let i = 0; i < creatures.length; i++) {
            const c = creatures[i];
            if (!c.alive || c.mapIndex !== state.level) continue;
            const def = CREATURE_TYPES[c.typeId];
            if (!def) continue;

            const moveSec = def.moveSpd / 6;
            const atkSec  = def.atkSpd  / 6;

            // Read timers from external mutable Map (avoids per-frame Zustand updates)
            const timers = creatureTimers.get(c.id) ?? { mt: Math.random() * moveSec, at: Math.random() * atkSec };
            let moveTimer = Math.max(0, timers.mt - delta);
            let atkTimer  = Math.max(0, timers.at  - delta);

            const dx   = px - c.x;
            const dy   = py - c.y;
            const dist = Math.abs(dx) + Math.abs(dy);
            const adjacent = dist === 1;
            const canSee   = dist <= 8 && hasLineOfSight(map, c.x, c.y, px, py);

            let nx = c.x, ny = c.y;

            // ── Movement ──────────────────────────────────────────────────────
            if (moveTimer === 0 && !adjacent) {
                moveTimer = moveSec * (0.85 + Math.random() * 0.3);

                // Count alive creatures per tile (max 2 per tile with different sides)
                const tileCounts: Record<string, number> = {};
                for (const o of creatures) {
                    if (!o.alive || o.id === c.id || o.mapIndex !== state.level) continue;
                    const k = `${o.x},${o.y}`;
                    tileCounts[k] = (tileCounts[k] ?? 0) + 1;
                }
                const tileAvailable = (tx: number, ty: number) =>
                    (tileCounts[`${tx},${ty}`] ?? 0) < 2;

                if (canSee) {
                    const candidates: [number, number][] = [];
                    if (dx !== 0) candidates.push([c.x + Math.sign(dx), c.y]);
                    if (dy !== 0) candidates.push([c.x, c.y + Math.sign(dy)]);
                    const valid = candidates.filter(
                        ([cx, cy]) => monsterWalkable(cy, cx) && tileAvailable(cx, cy)
                    );
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            if (canSee) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    }
                } else {
                    const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
                    const valid = dirs
                        .map(([ddx, ddy]) => [c.x + ddx, c.y + ddy] as [number, number])
                        .filter(([cx, cy]) => monsterWalkable(cy, cx) && tileAvailable(cx, cy));
                    if (valid.length > 0) {
                        [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
                        if (nx !== c.x || ny !== c.y) {
                            if (canSee) playCreatureMove(c.typeId);
                            notifyCreatureAction(c.id, 'move');
                        }
                    } else {
                        moveTimer = moveSec * (1.0 + Math.random() * 0.5);
                    }
                }
            }

            // ── Attack ────────────────────────────────────────────────────────
            const nowMs = Date.now();
            const partyInvisible = nowMs < state.invisibleUntil;
            if (atkTimer === 0 && adjacent && !partyInvisible) {
                atkTimer = atkSec * (0.9 + Math.random() * 0.2);
                playCreatureAttack(c.typeId);
                notifyCreatureAction(c.id, 'attack');

                const target = getTarget(c.side);
                if (target) {
                    const tv = vitals[target.id];
                    if (tv && tv.hp > 0) {
                        // Damage formula: based on creature exp reward (tier proxy)
                        const dmgMin = Math.max(1, Math.floor(def.exp / 8));
                        const dmgMax = Math.max(2, Math.floor(def.exp / 4));
                        const raw  = dmgMin + Math.floor(Math.random() * (dmgMax - dmgMin + 1));
                        // Apply non-fire shield protection
                        const shieldProt = state.activeShields
                            .filter(s => s.expiresAt > nowMs && !s.fireOnly)
                            .reduce((max, s) => Math.max(max, s.protection), 0);
                        const dmg  = Math.max(1, Math.round(raw * (1 - shieldProt)));
                        const newHP = Math.max(0, tv.hp - dmg);
                        vitals = { ...vitals, [target.id]: { ...tv, hp: newHP } };
                        dmgEvts = [...dmgEvts, {
                            id: `mdmg_${Date.now()}_${c.id}`,
                            x: c.x, y: c.y, amount: dmg, ts: Date.now(),
                        }];
                        anyChange = true;
                    }
                }
            }

            // Assign side at destination: pick available side
            let newSide = c.side;
            if (nx !== c.x || ny !== c.y) {
                const destOther = creatures.find(
                    o => o.alive && o.id !== c.id && o.mapIndex === state.level && o.x === nx && o.y === ny
                );
                newSide = destOther ? (destOther.side === 'left' ? 'right' : 'left') : 'left';
            }

            // Always persist updated timers to the external Map (no re-render cost)
            creatureTimers.set(c.id, { mt: moveTimer, at: atkTimer });

            // Only update Zustand state when something visible changes (position / side / alive)
            if (nx !== c.x || ny !== c.y || newSide !== c.side) {
                if (creatures === state.creatures) creatures = [...creatures];
                creatures[i] = { ...c, x: nx, y: ny, side: newSide };
                anyChange = true;
            }
        }

        if (!anyChange && creatures === state.creatures) return state;
        return {
            creatures,
            ...(vitals !== state.championVitals   ? { championVitals: vitals }   : {}),
            ...(dmgEvts !== state.damageEvents     ? { damageEvents: dmgEvts }    : {}),
        };
    }),

    // ─── Combat tick (cooldowns + damage event cleanup) ───────────────────────
    // ─── Spell tick (lights expiry + projectile movement) ─────────────────────
    tickSpells: (now) => set((state) => {
        // 1. Remove expired lights
        const spellLights = state.spellLights.filter(l => l.expiresAt > now);

        // 2. Advance projectiles
        const keepProjectiles: Projectile[] = [];
        let creatures = state.creatures as CreatureInstance[];
        let dmgEvts = state.damageEvents;

        for (const proj of state.projectiles) {
            // Not yet time to move
            if (proj.nextMoveAt > now) {
                keepProjectiles.push(proj);
                continue;
            }

            // Compute next tile
            let ny = proj.y, nx = proj.x;
            if      (proj.direction === 'NORTH') ny--;
            else if (proj.direction === 'SOUTH') ny++;
            else if (proj.direction === 'EAST')  nx++;
            else                                  nx--; // WEST

            // Wall / out-of-bounds / closed door → despawn
            const map = getMap(proj.level);
            const tile = map.tiles[ny]?.[nx];
            const doorKey = `${proj.level},${ny},${nx}`;
            if (!tile || tile.type === 'Wall' || (tile.type === 'Door' && !state.openDoors.has(doorKey))) {
                continue; // projectile absorbed by wall
            }

            // Creature hit → deal damage and despawn
            const hit = creatures.find(c => c.alive && c.mapIndex === proj.level && c.x === nx && c.y === ny);
            if (hit) {
                const dmg = proj.damage[0] + Math.floor(Math.random() * (proj.damage[1] - proj.damage[0] + 1));
                const newHP = Math.max(0, hit.currentHP - dmg);
                const killed = newHP <= 0;
                if (creatures === state.creatures) creatures = [...creatures];
                const idx = creatures.findIndex(c => c.id === hit.id);
                if (idx >= 0) creatures[idx] = { ...creatures[idx], currentHP: newHP, alive: !killed };
                dmgEvts = [...dmgEvts, {
                    id: `pdmg_${now}_${Math.random().toString(36).slice(2)}`,
                    x: nx, y: ny, amount: dmg, ts: now,
                }];
                continue; // projectile consumed
            }

            // Move forward, schedule next step in 300 ms
            keepProjectiles.push({ ...proj, x: nx, y: ny, nextMoveAt: now + 300 });
        }

        // 3. Clean expired shields
        const activeShields = state.activeShields.filter(s => s.expiresAt > now);
        // 4. Clean footprints older than 60 s
        const footprintHistory = state.footprintHistory.filter(e => now - e.ts < 60_000);

        const lightsChanged       = spellLights.length !== state.spellLights.length;
        const projectilesChanged  = keepProjectiles.length !== state.projectiles.length ||
            keepProjectiles.some((p, i) => p !== state.projectiles[i]);
        const creaturesChanged    = creatures !== state.creatures;
        const dmgChanged          = dmgEvts !== state.damageEvents;
        const shieldsChanged      = activeShields.length !== state.activeShields.length;
        const footprintsChanged   = footprintHistory.length !== state.footprintHistory.length;

        if (!lightsChanged && !projectilesChanged && !creaturesChanged &&
            !dmgChanged && !shieldsChanged && !footprintsChanged) return state;

        return {
            ...(lightsChanged      ? { spellLights }                   : {}),
            ...(projectilesChanged ? { projectiles: keepProjectiles }   : {}),
            ...(creaturesChanged   ? { creatures }                      : {}),
            ...(dmgChanged         ? { damageEvents: dmgEvts }          : {}),
            ...(shieldsChanged     ? { activeShields }                  : {}),
            ...(footprintsChanged  ? { footprintHistory }               : {}),
        };
    }),

    tickCombat: (delta) => set((state) => {
        const updates: Record<number, ChampionCombat> = {};
        let combatChanged = false;
        for (const c of state.party) {
            const cb = state.championCombat[c.id];
            if (cb && cb.cooldown > 0) {
                updates[c.id] = { ...cb, cooldown: Math.max(0, cb.cooldown - delta) };
                combatChanged = true;
            }
        }
        const now = Date.now();
        const newEvents = state.damageEvents.filter(e => now - e.ts < 600);
        const eventsChanged = newEvents.length !== state.damageEvents.length;
        if (!combatChanged && !eventsChanged) return state;
        return {
            ...(combatChanged ? { championCombat: { ...state.championCombat, ...updates } } : {}),
            ...(eventsChanged ? { damageEvents: newEvents } : {}),
        };
    }),
}));
