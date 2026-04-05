import React, { useState, useEffect } from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion, ChampionClass } from '../../data/champions';
import { useStore } from '../../engine/store';
import { WEAPON_TYPES, ARMOR_TYPES, POTION_TYPES, MISC_TYPES } from '../../data/items';
import type { ArmorSlot } from '../../types/items';
import type { EquipSlotKey } from '../../types/items';
import type { FloorItem, ChampionEquipment } from '../../types/game';
import { getItemImage, getTorchImage } from '../../data/itemImages';

const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#c0392b',
    Ninja:   '#27ae60',
    Wizard:  '#8e44ad',
    Priest:  '#2980b9',
};

// ─── Portrait image ───────────────────────────────────────────────────────────
const Portrait: React.FC<{ champion: Champion; size: number }> = ({ champion, size }) => (
    <img
        src={champion.portrait}
        alt={champion.name}
        style={{
            width: size, height: size,
            objectFit: 'cover',
            objectPosition: 'top center',
            flexShrink: 0,
            borderRadius: 4,
            border: '2px solid rgba(200,150,60,0.35)',
        }}
    />
);

// ─── Item helpers ─────────────────────────────────────────────────────────────
const PLACEHOLDER_RE = /^[A-Za-z]+_\d+$/;

function getItemName(item: FloorItem): string {
    switch (item.category) {
        case 'Weapon':    { const d = WEAPON_TYPES[item.typeId]; if (d) return d.name; break; }
        case 'Armor':     { const d = ARMOR_TYPES[item.typeId];  if (d) return d.name; break; }
        case 'Potion':    { const d = POTION_TYPES[item.typeId]; if (d) return d.name; break; }
        case 'Misc':      { const d = MISC_TYPES[item.typeId];   if (d) return d.name; break; }
        case 'Container': return 'Coffre';
        case 'Scroll':    break;
    }
    if (item.rawName && !PLACEHOLDER_RE.test(item.rawName)) return item.rawName;
    const labels: Record<string, string> = {
        Weapon: 'Arme', Armor: 'Armure', Potion: 'Potion',
        Scroll: 'Parchemin', Container: 'Coffre', Misc: 'Objet',
    };
    return `${labels[item.category] ?? item.category} #${item.typeId}`;
}

function getEquippableSlots(item: FloorItem): EquipSlotKey[] {
    switch (item.category) {
        case 'Weapon':    return ['rightHand', 'leftHand'];
        case 'Armor': {
            const def = ARMOR_TYPES[item.typeId];
            if (!def) return [];
            const map: Record<ArmorSlot, EquipSlotKey> = {
                head: 'head', neck: 'neck', torso: 'torso',
                legs: 'legs', feet: 'feet', hands: 'hands', belt: 'belt',
            };
            return [map[def.slot]];
        }
        case 'Misc':
        case 'Potion':
        case 'Scroll':
            return ['rightHand', 'leftHand'];
        default:
            return [];
    }
}

// ─── Combat stats computation ─────────────────────────────────────────────────
interface CombatStats {
    armor: number;
    dmgMin: number;
    dmgMax: number;
    atkSpeed: number;   // lower = faster (0 = unarmed)
    weight: number;     // total carried weight
}

function computeCombatStats(equip: ChampionEquipment, champion: Champion): CombatStats {
    let armor = 0;
    let weight = 0;
    let dmgMin = champion.strength > 40 ? Math.floor((champion.strength - 40) / 10) : 1;
    let dmgMax = dmgMin + 3;
    let atkSpeed = 18; // unarmed baseline

    for (const [slot, item] of Object.entries(equip)) {
        if (!item) continue;
        if (item.category === 'Armor') {
            const def = ARMOR_TYPES[item.typeId];
            if (def) { armor += def.armor; weight += def.weight; }
        }
        if (item.category === 'Weapon' && (slot === 'rightHand' || slot === 'leftHand')) {
            const def = WEAPON_TYPES[item.typeId];
            if (def) {
                dmgMin = def.damage[0] + Math.floor(champion.strength / 20);
                dmgMax = def.damage[1] + Math.floor(champion.strength / 15);
                atkSpeed = def.atkSpd;
                weight += def.weight;
            }
        }
    }
    return { armor, dmgMin, dmgMax, atkSpeed, weight };
}

// ─── Stat bar ─────────────────────────────────────────────────────────────────
const StatBar: React.FC<{ label: string; value: number; max?: number; color: string; bonus?: number }> = ({
    label, value, max = 100, color, bonus = 0,
}) => (
    <div style={{ marginBottom: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 2 }}>
            <span style={{ letterSpacing: 1 }}>{label}</span>
            <span style={{ color, fontWeight: 'bold' }}>
                {value}
                {bonus > 0 && <span style={{ color: '#4ec94e', fontSize: 9 }}> +{bonus}</span>}
            </span>
        </div>
        <div style={{ height: 4, background: '#111', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
                height: '100%',
                width: `${Math.min(100, ((value + bonus) / max) * 100)}%`,
                background: `linear-gradient(90deg, ${color}77, ${color})`,
                borderRadius: 3,
                transition: 'width 0.4s ease',
            }} />
        </div>
    </div>
);

// ─── Item image thumbnail ─────────────────────────────────────────────────────
function useSharedVisualTick(enabled: boolean, intervalMs: number): number {
    const [tick, setTick] = useState(() => Math.floor(Date.now() / intervalMs));

    useEffect(() => {
        if (!enabled) return;

        const updateTick = () => setTick(Math.floor(Date.now() / intervalMs));
        updateTick();
        const id = window.setInterval(updateTick, intervalMs);
        return () => window.clearInterval(id);
    }, [enabled, intervalMs]);

    return tick;
}

const ItemThumb: React.FC<{ item: FloorItem; size?: number }> = ({ item, size = 36 }) => {
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const isTorch = item.category === 'Weapon' && item.typeId === 16;

    // Shared time bucket: each torch still computes its own state from its own lit timestamp.
    useSharedVisualTick(isTorch, 30_000);

    const src = isTorch
        ? getTorchImage(item.id, torchBurnStart)
        : getItemImage(item.category, item.typeId);
    return (
        <img
            src={src}
            alt=""
            style={{
                width: size, height: size,
                objectFit: 'contain',
                imageRendering: 'crisp-edges',
                flexShrink: 0,
            }}
        />
    );
};

// ─── Drag-and-drop helpers ────────────────────────────────────────────────────
interface DragPayload {
    itemId: string;
    fromChampionId: number;
    fromSlot: EquipSlotKey | 'inventory';
}

function setDrag(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
}
function getDrag(e: React.DragEvent): DragPayload | null {
    try { return JSON.parse(e.dataTransfer.getData('application/json')); }
    catch { return null; }
}

// ─── Slot labels ──────────────────────────────────────────────────────────────
const SLOT_LABELS: Record<EquipSlotKey, string> = {
    head: 'TÊTE', neck: 'COU', torso: 'TORSE',
    rightHand: 'MAIN D.', leftHand: 'MAIN G.',
    hands: 'MAINS', belt: 'CEINTURE', legs: 'JAMBES', feet: 'PIEDS',
};

const EQUIP_SLOT_ORDER: EquipSlotKey[] = [
    'head', 'neck', 'torso', 'rightHand', 'leftHand', 'hands', 'belt', 'legs', 'feet',
];

// ─── Equipment slot box ───────────────────────────────────────────────────────
const EquipSlotBox: React.FC<{
    slotKey: EquipSlotKey;
    item: FloorItem | undefined;
    championId: number;
    onDrop: (payload: DragPayload, targetSlot: EquipSlotKey) => void;
    onUnequip: () => void;
}> = ({ slotKey, item, championId, onDrop, onUnequip }) => {
    const [over, setOver] = useState(false);

    return (
        <div
            style={{
                gridArea: slotKey === 'rightHand' ? 'rhand' : slotKey === 'leftHand' ? 'lhand' : slotKey,
                border: `1px solid ${over ? '#c8a96e' : item ? '#4a3820' : '#1e1e28'}`,
                borderRadius: 4,
                background: over ? '#1a1000' : item ? '#0e0a05' : '#060610',
                padding: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: item ? 'grab' : 'default',
                transition: 'border-color 0.15s, background 0.15s',
                minHeight: 52,
                position: 'relative',
            }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDrag(e); if (p) onDrop(p, slotKey); }}
        >
            <div style={{ fontSize: 7, letterSpacing: 1, color: '#3a3a4a' }}>{SLOT_LABELS[slotKey]}</div>
            {item ? (
                <>
                    <span
                        draggable
                        onDragStart={e => setDrag(e, { itemId: item.id, fromChampionId: championId, fromSlot: slotKey })}
                        style={{ cursor: 'grab' }}
                    >
                        <ItemThumb item={item} size={34} />
                    </span>
                    <div style={{
                        fontSize: 8, color: '#c8b870', textAlign: 'center',
                        maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                    }}>
                        {getItemName(item).substring(0, 10)}
                    </div>
                    <button
                        onClick={onUnequip}
                        title="Déséquiper"
                        style={{
                            position: 'absolute', top: 2, right: 2,
                            background: 'none', border: 'none', color: '#333',
                            fontSize: 8, cursor: 'pointer', padding: 0, lineHeight: 1,
                        }}
                    >↩</button>
                </>
            ) : (
                <div style={{ fontSize: 18, color: '#1a1a2a', marginTop: 4 }}>—</div>
            )}
        </div>
    );
};

// ─── Body silhouette SVG ──────────────────────────────────────────────────────
const BodySilhouette = () => (
    <svg
        viewBox="0 0 100 220"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* Head */}
        <ellipse cx="50" cy="20" rx="12" ry="14" fill="#c8a96e" />
        {/* Neck */}
        <rect x="45" y="33" width="10" height="10" fill="#c8a96e" />
        {/* Torso */}
        <path d="M28 43 Q20 55 22 90 L78 90 Q80 55 72 43 Z" fill="#c8a96e" />
        {/* Left arm */}
        <path d="M28 45 Q16 50 12 85 Q14 90 18 88 Q22 70 30 60 Z" fill="#c8a96e" />
        {/* Right arm */}
        <path d="M72 45 Q84 50 88 85 Q86 90 82 88 Q78 70 70 60 Z" fill="#c8a96e" />
        {/* Hips/Belt */}
        <rect x="27" y="90" width="46" height="14" rx="4" fill="#c8a96e" />
        {/* Left leg */}
        <path d="M28 104 Q25 140 26 170 L38 170 Q40 140 42 104 Z" fill="#c8a96e" />
        {/* Right leg */}
        <path d="M72 104 Q75 140 74 170 L62 170 Q60 140 58 104 Z" fill="#c8a96e" />
        {/* Left foot */}
        <ellipse cx="32" cy="176" rx="8" ry="5" fill="#c8a96e" />
        {/* Right foot */}
        <ellipse cx="68" cy="176" rx="8" ry="5" fill="#c8a96e" />
    </svg>
);

// ─── Equipment panel ──────────────────────────────────────────────────────────
const EquipmentPanel: React.FC<{
    equip: ChampionEquipment;
    championId: number;
    onDrop: (payload: DragPayload, targetSlot: EquipSlotKey) => void;
    onUnequip: (slotKey: EquipSlotKey) => void;
}> = ({ equip, championId, onDrop, onUnequip }) => (
    <div style={{ position: 'relative', padding: 8 }}>
        <BodySilhouette />
        <div style={{
            display: 'grid',
            gridTemplateAreas: `
                ". head ."
                ". neck ."
                "lhand torso rhand"
                ". hands ."
                ". belt ."
                ". legs ."
                ". feet ."
            `,
            gridTemplateColumns: '68px 1fr 68px',
            gridTemplateRows: 'repeat(7, auto)',
            gap: 4,
            position: 'relative',
            zIndex: 1,
        }}>
            {EQUIP_SLOT_ORDER.map(slotKey => (
                <EquipSlotBox
                    key={slotKey}
                    slotKey={slotKey}
                    item={equip[slotKey]}
                    championId={championId}
                    onDrop={onDrop}
                    onUnequip={() => onUnequip(slotKey)}
                />
            ))}
        </div>
    </div>
);

// ─── Mini champion portrait (transfer target) ─────────────────────────────────
const MiniPortrait: React.FC<{ champion: Champion; onDrop: (p: DragPayload) => void }> = ({ champion, onDrop }) => {
    const [over, setOver] = useState(false);
    const color = CLASS_COLORS[champion.class];
    return (
        <div
            title={`Donner à ${champion.name}`}
            style={{
                width: 48,
                border: `2px solid ${over ? color : color + '55'}`,
                borderRadius: 4,
                background: over ? `${color}22` : '#08080f',
                cursor: 'copy',
                transition: 'border-color 0.15s, background 0.15s',
                overflow: 'hidden',
            }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDrag(e); if (p) onDrop(p); }}
        >
            <Portrait champion={champion} size={48} />
            <div style={{ fontSize: 8, textAlign: 'center', color, padding: '2px 0', background: '#060608', letterSpacing: 1 }}>
                {champion.name.substring(0, 6).toUpperCase()}
            </div>
        </div>
    );
};

// ─── Scroll reader ────────────────────────────────────────────────────────────
const ScrollReader: React.FC<{ item: FloorItem; onClose: () => void }> = ({ item, onClose }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'linear-gradient(160deg, #0d0a08, #1a1208)', border: '1px solid #6a5430', borderRadius: 8, padding: 28, fontFamily: '"Courier New", monospace', color: '#c8a96e', boxShadow: '0 0 40px rgba(200,169,110,0.15)' }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#6a5430', textAlign: 'center', marginBottom: 16 }}>✦ PARCHEMIN ✦</div>
            <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>{getItemName(item)}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: '#a08050', textAlign: 'center', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                {item.rawName && !PLACEHOLDER_RE.test(item.rawName) ? item.rawName : 'Le parchemin est couvert de runes\nillisibles pour le moment.'}
            </div>
            <button onClick={onClose} style={{ display: 'block', margin: '20px auto 0', background: 'none', border: '1px solid #6a5430', borderRadius: 4, color: '#6a5430', fontSize: 11, letterSpacing: 2, cursor: 'pointer', padding: '6px 20px', fontFamily: '"Courier New", monospace' }}>FERMER</button>
        </div>
    </div>
);

// ─── Speed bar (inverted: lower atkSpd = faster) ──────────────────────────────
const SpeedDots: React.FC<{ atkSpd: number }> = ({ atkSpd }) => {
    // atkSpd 0 = unarmed (fast), 30 = slow. Map to 1-5 dots
    const dots = atkSpd === 0 ? 5 : Math.max(1, Math.round(5 - (atkSpd / 30) * 4));
    return (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: i < dots ? '#f1c40f' : '#1a1a2a',
                    border: `1px solid ${i < dots ? '#f1c40f88' : '#222'}`,
                }} />
            ))}
        </div>
    );
};

// ─── Main ChampionSheet ────────────────────────────────────────────────────────
export const ChampionSheet: React.FC = () => {
    const {
        activePartyMemberId, party, level,
        closePartyMember, removeFromParty,
        championInventories, championEquipment,
        equipItem, unequipItem, dropItem, giveItem, giveEquippedItem,
    } = useStore();

    const [scrollItem, setScrollItem] = useState<FloorItem | null>(null);

    if (activePartyMemberId === null) return null;
    const champion = CHAMPIONS.find(c => c.id === activePartyMemberId);
    if (!champion) return null;

    const color = CLASS_COLORS[champion.class];
    const inv = championInventories[champion.id] ?? [];
    const equip = championEquipment[champion.id] ?? {};
    const combat = computeCombatStats(equip, champion);
    const otherPartyMembers = party.filter(c => c.id !== champion.id);

    const handleDropOnSlot = (payload: DragPayload, targetSlot: EquipSlotKey) => {
        if (payload.fromChampionId !== champion.id) {
            giveItem(payload.fromChampionId, champion.id, payload.itemId);
            return;
        }
        if (payload.fromSlot === 'inventory') {
            const item = inv.find(i => i.id === payload.itemId);
            if (!item) return;
            if (!getEquippableSlots(item).includes(targetSlot)) return;
            equipItem(champion.id, targetSlot, payload.itemId);
        } else {
            const srcSlot = payload.fromSlot as EquipSlotKey;
            if (srcSlot === targetSlot) return;
            const srcItem = equip[srcSlot];
            if (!srcItem || !getEquippableSlots(srcItem).includes(targetSlot)) return;
            unequipItem(champion.id, srcSlot);
            equipItem(champion.id, targetSlot, srcItem.id);
        }
    };

    const handleDropOnInventory = (e: React.DragEvent) => {
        e.preventDefault();
        const payload = getDrag(e);
        if (!payload || payload.fromChampionId !== champion.id || payload.fromSlot === 'inventory') return;
        unequipItem(champion.id, payload.fromSlot as EquipSlotKey);
    };

    const handleDropOnOtherChampion = (toChampion: Champion, payload: DragPayload) => {
        if (payload.fromChampionId !== champion.id) return;
        if (payload.fromSlot === 'inventory') giveItem(champion.id, toChampion.id, payload.itemId);
        else giveEquippedItem(champion.id, payload.fromSlot as EquipSlotKey, toChampion.id);
    };

    return (
        <div
            onClick={closePartyMember}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: '"Courier New", Courier, monospace' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: 720, maxHeight: '94vh', overflowY: 'auto', background: 'linear-gradient(160deg, #0b0b16 0%, #130f1c 50%, #0d0a14 100%)', border: `2px solid ${color}`, borderRadius: 10, boxShadow: `0 0 50px ${color}44, 0 20px 60px rgba(0,0,0,0.9)`, padding: 18, color: '#e0d5ba', position: 'relative' }}
            >
                <button onClick={closePartyMember} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer' }}>×</button>

                <div style={{ fontSize: 10, letterSpacing: 4, color: '#6a5430', marginBottom: 12, textAlign: 'center' }}>✦ FICHE DU CHAMPION ✦</div>

                {/* Header: portrait + identity */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                    <Portrait champion={champion} size={80} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 2, color: '#e8dbb8', textShadow: `0 0 12px ${color}88`, marginBottom: 2 }}>{champion.name}</div>
                        <div style={{ fontSize: 11, color: '#777', fontStyle: 'italic', marginBottom: 6 }}>{champion.title}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 4, padding: '2px 10px', fontSize: 11, color, fontWeight: 'bold', letterSpacing: 1 }}>
                            {champion.class.toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Three-column: Stats | Equipment | Combat */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>

                    {/* Stats */}
                    <div style={{ flex: '0 0 170px', background: '#08080f', border: '1px solid #1a1a28', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 8 }}>CARACTÉRISTIQUES</div>
                        <StatBar label="FORCE"      value={champion.strength}  color="#e74c3c" />
                        <StatBar label="DEXTÉRITÉ"  value={champion.dexterity} color="#2ecc71" />
                        <StatBar label="SAGESSE"    value={champion.wisdom}    color="#9b59b6" />
                        <StatBar label="VITALITÉ"   value={champion.vitality}  color="#3498db" />
                        <div style={{ borderTop: '1px solid #1a1a2a', margin: '7px 0' }} />
                        <StatBar label="SANTÉ"      value={champion.health}    max={500} color="#e67e22" />
                        <StatBar label="ENDURANCE"  value={champion.stamina}   max={500} color="#f39c12" />
                        {champion.mana > 0 && <StatBar label="MANA" value={champion.mana} max={500} color="#8e44ad" />}
                        <div style={{ borderTop: '1px solid #1a1a2a', margin: '7px 0' }} />
                        <StatBar label="ANTI-MAGIE" value={champion.antiMagic} color="#1abc9c" />
                        <StatBar label="ANTI-FEU"   value={champion.antiFire}  color="#e67e22" />
                    </div>

                    {/* Equipment silhouette */}
                    <div style={{ flex: 1, background: '#08080f', border: '1px solid #1a1a28', borderRadius: 6, minWidth: 0 }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', padding: '8px 10px 0' }}>ÉQUIPEMENT</div>
                        <div style={{ fontSize: 8, color: '#2a2a3a', padding: '1px 10px 4px', fontStyle: 'italic' }}>Glisser-déposer pour équiper</div>
                        <EquipmentPanel equip={equip} championId={champion.id} onDrop={handleDropOnSlot} onUnequip={slotKey => unequipItem(champion.id, slotKey)} />
                    </div>

                    {/* Combat stats */}
                    <div style={{ flex: '0 0 150px', background: '#08080f', border: '1px solid #1a1a28', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 10 }}>COMBAT</div>

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 3 }}>ARMURE</div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#aab8cc' }}>{combat.armor}</div>
                            <div style={{ height: 3, background: '#111', borderRadius: 2, marginTop: 3 }}>
                                <div style={{ height: '100%', width: `${Math.min(100, (combat.armor / 150) * 100)}%`, background: 'linear-gradient(90deg, #aab8cc77, #aab8cc)', borderRadius: 2 }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 3 }}>DÉGÂTS</div>
                            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#e74c3c' }}>
                                {combat.dmgMin}–{combat.dmgMax}
                            </div>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 4 }}>VITESSE ATK</div>
                            <SpeedDots atkSpd={combat.atkSpeed} />
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 3 }}>PRÉCISION</div>
                            <div style={{ fontSize: 15, fontWeight: 'bold', color: '#2ecc71' }}>
                                {Math.min(99, Math.round(50 + champion.dexterity / 3))}%
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #1a1a2a', marginTop: 8, paddingTop: 8 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 3 }}>CHARGE</div>
                            <div style={{ fontSize: 12, color: combat.weight > champion.strength * 2 ? '#e74c3c' : '#888' }}>
                                {combat.weight} / {champion.strength * 2}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory */}
                <div
                    style={{ background: '#08080f', border: '1px solid #1a1a28', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDropOnInventory}
                >
                    <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 8 }}>
                        INVENTAIRE ({inv.length})
                    </div>
                    {inv.length === 0 ? (
                        <div style={{ fontSize: 11, color: '#2a2a2a', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>— vide —</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 4 }}>
                            {inv.map(item => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={e => setDrag(e, { itemId: item.id, fromChampionId: champion.id, fromSlot: 'inventory' })}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: '#0a0a10', border: '1px solid #1e1e28', borderRadius: 4, cursor: 'grab' }}
                                >
                                    <ItemThumb item={item} size={28} />
                                    <span style={{ fontSize: 10, color: '#c8b870', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {getItemName(item)}
                                    </span>
                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                        {getEquippableSlots(item).length > 0 && (
                                            <button
                                                onClick={() => {
                                                    const slots = getEquippableSlots(item);
                                                    const slot = slots.find(s => !equip[s]) ?? slots[0];
                                                    equipItem(champion.id, slot, item.id);
                                                }}
                                                title="Équiper"
                                                style={{ background: 'none', border: '1px solid #3a3020', borderRadius: 2, color: '#8a6820', fontSize: 9, cursor: 'pointer', padding: '1px 4px' }}
                                            >↑</button>
                                        )}
                                        {item.category === 'Scroll' && (
                                            <button onClick={() => setScrollItem(item)} style={{ background: 'none', border: '1px solid #3a3020', borderRadius: 2, color: '#8a6820', fontSize: 9, cursor: 'pointer', padding: '1px 4px' }}>📜</button>
                                        )}
                                        <button onClick={() => dropItem(item.id, champion.id)} title="Poser au sol" style={{ background: 'none', border: '1px solid #333', borderRadius: 2, color: '#555', fontSize: 9, cursor: 'pointer', padding: '1px 4px' }}>↓</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Transfer to other champions */}
                {otherPartyMembers.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 6 }}>DONNER À…</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {otherPartyMembers.map(other => (
                                <MiniPortrait key={other.id} champion={other} onDrop={p => handleDropOnOtherChampion(other, p)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Party slots */}
                <div style={{ borderTop: '1px solid #1a1a2a', paddingTop: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 5 }}>ÉQUIPE ({party.length}/4)</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {Array.from({ length: 4 }).map((_, i) => {
                            const m = party[i];
                            const mc = m ? CLASS_COLORS[m.class] : '#222';
                            const isThis = m?.id === champion.id;
                            return (
                                <div key={i} style={{ width: 44, height: 18, border: `1px ${m ? 'solid' : 'dashed'} ${mc}`, borderRadius: 3, background: isThis ? `${color}33` : m ? `${mc}11` : '#0a0a10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: isThis ? color : '#444', letterSpacing: 1 }}>
                                    {m ? m.name.substring(0, 5) : '—'}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {level === 0 && (
                    <button
                        onClick={() => { removeFromParty(champion.id); closePartyMember(); }}
                        style={{ width: '100%', padding: '10px 0', background: 'linear-gradient(135deg, #5a0f0f, #8b0000)', border: '1px solid #c0392b', borderRadius: 6, color: '#ffaaaa', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, cursor: 'pointer', fontFamily: '"Courier New", monospace', boxShadow: '0 0 12px #c0392b33' }}
                    >
                        RENVOYER {champion.name.toUpperCase()}
                    </button>
                )}
            </div>

            {scrollItem && <ScrollReader item={scrollItem} onClose={() => setScrollItem(null)} />}
        </div>
    );
};
