import React, { useState } from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion, ChampionClass } from '../../data/champions';
import { useStore } from '../../engine/store';
import { WEAPON_TYPES, ARMOR_TYPES, POTION_TYPES, MISC_TYPES } from '../../data/items';
import type { ArmorSlot } from '../../types/items';
import type { EquipSlotKey } from '../../types/items';
import type { FloorItem, ChampionEquipment } from '../../types/game';
import { getItemImage, getTorchImage } from '../../data/itemImages';

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    bg:          '#120d08',
    panel:       '#1a1208',
    panelBorder: '#5a4020',
    gold:        '#c8952a',
    goldDim:     '#6a4e18',
    cream:       '#e8d5a0',
    creamDim:    '#9a8660',
    red:         '#d94040',
    green:       '#40c060',
    blue:        '#4090d0',
    yellow:      '#d4b040',
    slotBg:      '#100a04',
    slotBorder:  '#3a2810',
};

const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#d04030',
    Ninja:   '#40b060',
    Wizard:  '#8060c0',
    Priest:  '#4080c0',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLACEHOLDER_RE = /^[A-Za-z]+_\d+$/;

function getItemName(item: FloorItem): string {
    switch (item.category) {
        case 'Weapon':    { const d = WEAPON_TYPES[item.typeId]; if (d) return d.name; break; }
        case 'Armor':     { const d = ARMOR_TYPES[item.typeId];  if (d) return d.name; break; }
        case 'Potion':    { const d = POTION_TYPES[item.typeId]; if (d) return d.name; break; }
        case 'Misc':      { const d = MISC_TYPES[item.typeId];   if (d) return d.name; break; }
        case 'Container': return 'Coffre';
    }
    if (item.rawName && !PLACEHOLDER_RE.test(item.rawName)) return item.rawName;
    return `${item.category} #${item.typeId}`;
}

function getItemWeight(item: FloorItem): number {
    if (item.category === 'Weapon') return WEAPON_TYPES[item.typeId]?.weight ?? 0;
    if (item.category === 'Armor')  return ARMOR_TYPES[item.typeId]?.weight  ?? 0;
    return 0;
}

function getTotalWeight(equip: ChampionEquipment, inv: FloorItem[]): number {
    return [...Object.values(equip).filter(Boolean) as FloorItem[], ...inv]
        .reduce((s, i) => s + getItemWeight(i), 0);
}

function getEquippableSlots(item: FloorItem): EquipSlotKey[] {
    switch (item.category) {
        case 'Weapon': {
            const def = WEAPON_TYPES[item.typeId];
            if (def?.type === 'Ammo' || def?.thrown) return ['quiver1','quiver2','quiver3','quiver4'];
            return ['rightHand','leftHand'];
        }
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
            return ['pocket1','pocket2','rightHand','leftHand'];
        default: return [];
    }
}

function isConsumable(item: FloorItem): boolean {
    if (item.category === 'Potion') return true;
    if (item.category === 'Misc') {
        const def = MISC_TYPES[item.typeId];
        return !!def?.food || item.typeId === 1;
    }
    return false;
}

// ─── Drag/drop ────────────────────────────────────────────────────────────────
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

// ─── Item thumbnail ───────────────────────────────────────────────────────────
const ItemThumb: React.FC<{ item: FloorItem; size?: number }> = ({ item, size = 36 }) => {
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const isTorch = item.category === 'Weapon' && item.typeId === 16;
    const src = isTorch ? getTorchImage(item.id, torchBurnStart) : getItemImage(item.category, item.typeId);
    return (
        <img src={src} alt="" style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'crisp-edges', flexShrink: 0 }} />
    );
};

// ─── Vital bar (large) ────────────────────────────────────────────────────────
const VitalBar: React.FC<{ icon: string; value: number; max: number; color: string; label: string }> = ({ icon, value, max, color, label }) => (
    <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 13, color: T.creamDim, letterSpacing: 1, flex: 1 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 'bold', color, minWidth: 70, textAlign: 'right' }}>
                {Math.ceil(value)} <span style={{ fontSize: 10, color: T.creamDim }}>/ {max}</span>
            </span>
        </div>
        <div style={{ height: 10, background: '#0a0604', borderRadius: 5, border: `1px solid ${T.slotBorder}`, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 5, transition: 'width 0.4s ease', boxShadow: `0 0 6px ${color}66` }} />
        </div>
    </div>
);

// ─── Stat row (compact) ───────────────────────────────────────────────────────
const StatRow: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color = T.cream }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: T.creamDim, letterSpacing: 1 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 60, height: 4, background: '#0a0604', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 'bold', color, minWidth: 26, textAlign: 'right' }}>{value}</span>
        </div>
    </div>
);

// ─── Equipment slot ───────────────────────────────────────────────────────────
const SLOT_LABELS: Record<EquipSlotKey, string> = {
    head: 'TÊTE', neck: 'COU', torso: 'TORSE', rightHand: 'M.DR.', leftHand: 'M.GA.',
    hands: 'MAINS', belt: 'CEINTURE', legs: 'JAMBES', feet: 'PIEDS',
    quiver1: 'CAR.1', quiver2: 'CAR.2', quiver3: 'CAR.3', quiver4: 'CAR.4',
    pocket1: 'POCHE1', pocket2: 'POCHE2',
};

const EquipSlot: React.FC<{
    slotKey: EquipSlotKey;
    item?: FloorItem;
    championId: number;
    size?: number;
    label?: boolean;
    onDrop: (p: DragPayload, slot: EquipSlotKey) => void;
    onUnequip: () => void;
}> = ({ slotKey, item, championId, size = 44, label = true, onDrop, onUnequip }) => {
    const [over, setOver] = useState(false);
    return (
        <div
            style={{
                width: size, minHeight: size,
                border: `1px solid ${over ? T.gold : item ? T.panelBorder : T.slotBorder}`,
                borderRadius: 4,
                background: over ? '#1a1000' : item ? '#100a04' : T.slotBg,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, cursor: item ? 'grab' : 'default',
                position: 'relative', transition: 'border-color 0.12s',
                padding: 2,
            }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDrag(e); if (p) onDrop(p, slotKey); }}
        >
            {label && <div style={{ fontSize: 7, letterSpacing: 1, color: T.goldDim, lineHeight: 1 }}>{SLOT_LABELS[slotKey]}</div>}
            {item ? (
                <>
                    <span draggable onDragStart={e => setDrag(e, { itemId: item.id, fromChampionId: championId, fromSlot: slotKey })}>
                        <ItemThumb item={item} size={size - 12} />
                    </span>
                    <button onClick={onUnequip} title="Déséquiper" style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', color: T.goldDim, fontSize: 9, cursor: 'pointer', padding: 0, lineHeight: 1 }}>↩</button>
                </>
            ) : (
                <div style={{ width: size - 16, height: size - 16, border: `1px dashed ${T.slotBorder}`, borderRadius: 3, opacity: 0.4 }} />
            )}
        </div>
    );
};

// ─── Eye slot (scroll reader) ─────────────────────────────────────────────────
const EyeSlot: React.FC<{ onScroll: (item: FloorItem) => void }> = ({ onScroll }) => {
    const [over, setOver] = useState(false);
    return (
        <div
            title="Déposer un parchemin pour le lire"
            style={{ width: 44, height: 44, border: `1px solid ${over ? '#d4a840' : T.slotBorder}`, borderRadius: 4, background: over ? '#1a1200' : T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'default', transition: 'border-color 0.12s' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
                e.preventDefault(); setOver(false);
                const p = getDrag(e);
                if (!p) return;
                // Find the item from the store via a custom event
                const ev = new CustomEvent('championsheet:read-scroll', { detail: p.itemId });
                window.dispatchEvent(ev);
            }}
        >
            <span style={{ fontSize: 20, lineHeight: 1 }}>👁</span>
            <span style={{ fontSize: 7, color: T.goldDim, letterSpacing: 1 }}>LIRE</span>
        </div>
    );
};

// ─── Mouth slot (consume food/potion) ────────────────────────────────────────
const MouthSlot: React.FC<{ championId: number; onConsume: (itemId: string) => void }> = ({ onConsume }) => {
    const [over, setOver] = useState(false);
    return (
        <div
            title="Déposer nourriture ou potion pour consommer"
            style={{ width: 44, height: 44, border: `1px solid ${over ? '#d04040' : T.slotBorder}`, borderRadius: 4, background: over ? '#1a0800' : T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'default', transition: 'border-color 0.12s' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
                e.preventDefault(); setOver(false);
                const p = getDrag(e);
                if (p) onConsume(p.itemId);
            }}
        >
            <span style={{ fontSize: 20, lineHeight: 1 }}>👄</span>
            <span style={{ fontSize: 7, color: T.goldDim, letterSpacing: 1 }}>MANGER</span>
        </div>
    );
};

// ─── Scroll reader popup ──────────────────────────────────────────────────────
const ScrollPopup: React.FC<{ item: FloorItem; onClose: () => void }> = ({ item, onClose }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'linear-gradient(160deg, #130e08, #1e1608)', border: `1px solid ${T.gold}`, borderRadius: 8, padding: 28, fontFamily: '"Courier New", monospace', color: T.cream }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: T.goldDim, textAlign: 'center', marginBottom: 14 }}>✦ PARCHEMIN ✦</div>
            <div style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 18, color: T.gold }}>{getItemName(item)}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: T.creamDim, textAlign: 'center', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                {item.rawName && !PLACEHOLDER_RE.test(item.rawName) ? item.rawName : 'Le parchemin est couvert\nde runes illisibles.'}
            </div>
            <button onClick={onClose} style={{ display: 'block', margin: '20px auto 0', background: 'none', border: `1px solid ${T.goldDim}`, borderRadius: 4, color: T.goldDim, fontSize: 11, letterSpacing: 2, cursor: 'pointer', padding: '6px 20px', fontFamily: '"Courier New", monospace' }}>FERMER</button>
        </div>
    </div>
);

// ─── Backpack grid (17 slots) ─────────────────────────────────────────────────
const BACKPACK_SLOTS = 17;
const BackpackGrid: React.FC<{
    inv: FloorItem[];
    equip: ChampionEquipment;
    champion: Champion;
    onEquip: (item: FloorItem) => void;
    onDrop: (itemId: string) => void;
    onReadScroll: (item: FloorItem) => void;
    onUseItem: (itemId: string) => void;
    onUnequipToInventory: (e: React.DragEvent) => void;
}> = ({ inv, equip, champion, onEquip, onDrop, onReadScroll, onUseItem, onUnequipToInventory }) => {
    const [over, setOver] = useState(false);
    return (
        <div
            style={{ background: '#0e0904', border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: 8, height: '100%' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { setOver(false); onUnequipToInventory(e); }}
        >
            <div style={{ fontSize: 11, letterSpacing: 3, color: T.goldDim, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>SAC À DOS</span>
                <span style={{ color: inv.length >= BACKPACK_SLOTS ? T.red : T.creamDim }}>{inv.length}/{BACKPACK_SLOTS}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                {Array.from({ length: BACKPACK_SLOTS }).map((_, i) => {
                    const item = inv[i];
                    if (!item) return (
                        <div key={i} style={{ height: 52, border: `1px dashed ${T.slotBorder}`, borderRadius: 4, background: T.slotBg, opacity: 0.5 }} />
                    );
                    return (
                        <div
                            key={item.id}
                            draggable
                            onDragStart={e => setDrag(e, { itemId: item.id, fromChampionId: champion.id, fromSlot: 'inventory' })}
                            title={getItemName(item)}
                            style={{ height: 52, border: `1px solid ${over ? T.gold : T.slotBorder}`, borderRadius: 4, background: '#120c06', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'grab', position: 'relative', padding: 2 }}
                        >
                            <ItemThumb item={item} size={28} />
                            <div style={{ fontSize: 8, color: T.creamDim, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getItemName(item).substring(0, 8)}
                            </div>
                            {/* Quick action buttons */}
                            <div style={{ position: 'absolute', bottom: 1, right: 1, display: 'flex', gap: 1 }}>
                                {getEquippableSlots(item).length > 0 && (
                                    <button onClick={() => onEquip(item)} title="Équiper" style={{ background: T.goldDim, border: 'none', borderRadius: 2, color: T.bg, fontSize: 8, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>↑</button>
                                )}
                                {item.category === 'Scroll' && (
                                    <button onClick={() => onReadScroll(item)} title="Lire" style={{ background: '#4a3010', border: 'none', borderRadius: 2, color: T.cream, fontSize: 8, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>📜</button>
                                )}
                                {isConsumable(item) && (
                                    <button onClick={() => onUseItem(item.id)} title="Utiliser" style={{ background: '#103010', border: 'none', borderRadius: 2, color: '#60d060', fontSize: 8, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>✓</button>
                                )}
                                <button onClick={() => onDrop(item.id)} title="Poser au sol" style={{ background: '#1a0808', border: 'none', borderRadius: 2, color: '#d04040', fontSize: 8, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>↓</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const ChampionSheet: React.FC = () => {
    const {
        activePartyMemberId, party, level,
        closePartyMember, removeFromParty,
        championInventories, championEquipment, championVitals, championXP,
        equipItem, unequipItem, dropItem, giveItem, giveEquippedItem,
        useItem, sleep,
    } = useStore();

    const [scrollItem, setScrollItem] = useState<FloorItem | null>(null);

    // Listen for scroll-read events from eye slot
    React.useEffect(() => {
        const handler = (e: Event) => {
            const itemId = (e as CustomEvent).detail as string;
            const champ = CHAMPIONS.find(c => c.id === activePartyMemberId);
            if (!champ) return;
            const inv = championInventories[champ.id] ?? [];
            const item = inv.find(i => i.id === itemId);
            if (item?.category === 'Scroll') setScrollItem(item);
        };
        window.addEventListener('championsheet:read-scroll', handler);
        return () => window.removeEventListener('championsheet:read-scroll', handler);
    }, [activePartyMemberId, championInventories]);

    if (activePartyMemberId === null) return null;
    const champion = CHAMPIONS.find(c => c.id === activePartyMemberId);
    if (!champion) return null;

    const color = CLASS_COLORS[champion.class];
    const inv   = championInventories[champion.id] ?? [];
    const equip = championEquipment[champion.id]   ?? {};
    const vitals = championVitals[champion.id];
    const xp     = championXP?.[champion.id];
    const weight = getTotalWeight(equip, inv);
    const maxWeight = champion.strength * 2;
    const overloaded = weight > maxWeight;
    const otherMembers = party.filter(c => c.id !== champion.id);

    const hp      = vitals?.hp      ?? champion.health;
    const stamina = vitals?.stamina ?? champion.stamina;
    const mana    = vitals?.mana    ?? champion.mana;

    const handleDropOnSlot = (payload: DragPayload, targetSlot: EquipSlotKey) => {
        if (payload.fromChampionId !== champion.id) {
            giveItem(payload.fromChampionId, champion.id, payload.itemId);
            return;
        }
        if (payload.fromSlot === 'inventory') {
            const item = inv.find(i => i.id === payload.itemId);
            if (!item || !getEquippableSlots(item).includes(targetSlot)) return;
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

    const handleUnequipToInventory = (e: React.DragEvent) => {
        e.preventDefault();
        const p = getDrag(e);
        if (!p || p.fromChampionId !== champion.id || p.fromSlot === 'inventory') return;
        unequipItem(champion.id, p.fromSlot as EquipSlotKey);
    };

    const handleEquipItem = (item: FloorItem) => {
        const slots = getEquippableSlots(item);
        const slot = slots.find(s => !equip[s]) ?? slots[0];
        if (slot) equipItem(champion.id, slot, item.id);
    };

    const handleGiveToDrop = (payload: DragPayload, other: Champion) => {
        if (payload.fromChampionId !== champion.id) return;
        if (payload.fromSlot === 'inventory') giveItem(champion.id, other.id, payload.itemId);
        else giveEquippedItem(champion.id, payload.fromSlot as EquipSlotKey, other.id);
    };

    // Skills summary
    const skills = xp ? [
        { label: 'GUERRIER', val: xp.fighter, color: '#d04030' },
        { label: 'NINJA',    val: xp.ninja,   color: '#40b060' },
        { label: 'PRÊTRE',   val: xp.priest,  color: '#4080c0' },
        { label: 'MAGE',     val: xp.wizard,  color: '#8060c0' },
    ] : [];

    const EQUIP_SLOTS_BODY: EquipSlotKey[] = ['head','neck','torso','rightHand','leftHand','hands','belt','legs','feet'];
    const QUIVER_SLOTS: EquipSlotKey[] = ['quiver1','quiver2','quiver3','quiver4'];
    const POCKET_SLOTS: EquipSlotKey[] = ['pocket1','pocket2'];

    return (
        <div
            onClick={closePartyMember}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: '"Courier New", Courier, monospace' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ width: 960, maxHeight: '95vh', overflowY: 'auto', background: T.bg, border: `2px solid ${T.gold}`, borderRadius: 10, boxShadow: `0 0 60px ${color}44, 0 24px 80px rgba(0,0,0,0.95)`, padding: 20, color: T.cream, position: 'relative' }}
            >
                {/* ── Header ── */}
                <button onClick={closePartyMember} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#666', fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
                <div style={{ fontSize: 10, letterSpacing: 5, color: T.goldDim, textAlign: 'center', marginBottom: 14 }}>✦ FICHE DU CHAMPION ✦</div>

                {/* ── 3-column body ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 12, marginBottom: 12 }}>

                    {/* ── COL 1: Portrait + Vitals + Stats ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Portrait + identity */}
                        <div style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <img src={champion.portrait} alt={champion.name} style={{ width: 72, height: 72, objectFit: 'cover', objectPosition: 'top center', borderRadius: 4, border: `2px solid ${color}55`, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 'bold', color: T.cream, textShadow: `0 0 10px ${color}88`, marginBottom: 2, letterSpacing: 1 }}>{champion.name}</div>
                                <div style={{ fontSize: 10, color: T.creamDim, fontStyle: 'italic', marginBottom: 6, lineHeight: 1.3 }}>{champion.title}</div>
                                <div style={{ display: 'inline-flex', background: `${color}22`, border: `1px solid ${color}66`, borderRadius: 4, padding: '2px 8px', fontSize: 10, color, letterSpacing: 2, fontWeight: 'bold' }}>
                                    {champion.class.toUpperCase()}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 10, color: overloaded ? T.red : T.creamDim }}>
                                    ⚖ {weight}/{maxWeight} kg {overloaded ? '⚠' : ''}
                                </div>
                            </div>
                        </div>

                        {/* Vitals — prominent */}
                        <div style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, letterSpacing: 3, color: T.goldDim, marginBottom: 10 }}>VITALITÉ</div>
                            <VitalBar icon="❤" label="SANTÉ"     value={hp}      max={champion.health}  color={T.red}    />
                            <VitalBar icon="⚡" label="ENDURANCE" value={stamina} max={champion.stamina} color={T.yellow} />
                            {champion.mana > 0 && <VitalBar icon="🔮" label="MANA" value={mana} max={champion.mana} color={T.blue} />}
                        </div>

                        {/* Base stats */}
                        <div style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: '10px 12px', flex: 1 }}>
                            <div style={{ fontSize: 9, letterSpacing: 3, color: T.goldDim, marginBottom: 8 }}>CARACTÉRISTIQUES</div>
                            <StatRow label="FORCE"      value={champion.strength}  color={T.red}    />
                            <StatRow label="DEXTÉRITÉ"  value={champion.dexterity} color={T.green}  />
                            <StatRow label="SAGESSE"    value={champion.wisdom}    color={T.blue}   />
                            <StatRow label="VITALITÉ"   value={champion.vitality}  color={T.yellow} />
                            <StatRow label="CHANCE"     value={champion.luck}      color={T.gold}   />
                            <div style={{ borderTop: `1px solid ${T.slotBorder}`, margin: '6px 0' }} />
                            <StatRow label="ANTI-MAGIE" value={champion.antiMagic} color="#60c0a0" />
                            <StatRow label="ANTI-FEU"   value={champion.antiFire}  color="#d08030" />
                            {skills.length > 0 && <>
                                <div style={{ borderTop: `1px solid ${T.slotBorder}`, margin: '6px 0' }} />
                                <div style={{ fontSize: 9, letterSpacing: 3, color: T.goldDim, marginBottom: 6 }}>CLASSES</div>
                                {skills.map(s => <StatRow key={s.label} label={s.label} value={Math.min(100, s.val / 20)} color={s.color} />)}
                            </>}
                        </div>
                    </div>

                    {/* ── COL 2: Equipment silhouette ── */}
                    <div style={{ background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: T.goldDim, marginBottom: 8 }}>ÉQUIPEMENT</div>
                        <div style={{ display: 'flex', gap: 6, height: 'calc(100% - 28px)' }}>

                            {/* Left: quiver slots */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-start', paddingTop: 20 }}>
                                {QUIVER_SLOTS.map(s => (
                                    <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={46} onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)} />
                                ))}
                            </div>

                            {/* Center: body grid */}
                            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {/* Silhouette SVG */}
                                <svg viewBox="0 0 100 220" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
                                    <ellipse cx="50" cy="20" rx="13" ry="15" fill={T.cream} />
                                    <rect x="45" y="34" width="10" height="10" fill={T.cream} />
                                    <path d="M28 44 Q20 56 22 92 L78 92 Q80 56 72 44 Z" fill={T.cream} />
                                    <path d="M28 46 Q16 52 12 86 Q14 91 18 89 Q22 71 30 61 Z" fill={T.cream} />
                                    <path d="M72 46 Q84 52 88 86 Q86 91 82 89 Q78 71 70 61 Z" fill={T.cream} />
                                    <rect x="27" y="92" width="46" height="14" rx="4" fill={T.cream} />
                                    <path d="M28 106 Q25 142 26 172 L38 172 Q40 142 42 106 Z" fill={T.cream} />
                                    <path d="M72 106 Q75 142 74 172 L62 172 Q60 142 58 106 Z" fill={T.cream} />
                                    <ellipse cx="32" cy="178" rx="9" ry="5" fill={T.cream} />
                                    <ellipse cx="68" cy="178" rx="9" ry="5" fill={T.cream} />
                                </svg>
                                <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateAreas: `". head ." ". neck ." "lhand torso rhand" ". hands ." ". belt ." ". legs ." ". feet ."`, gridTemplateColumns: '54px 1fr 54px', gap: 4, width: '100%' }}>
                                    {EQUIP_SLOTS_BODY.map(s => (
                                        <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id}
                                            size={52}
                                            onDrop={handleDropOnSlot}
                                            onUnequip={() => unequipItem(champion.id, s)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Right: pocket + eye + mouth */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-start', paddingTop: 20 }}>
                                {POCKET_SLOTS.map(s => (
                                    <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={46} onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)} />
                                ))}
                                <div style={{ marginTop: 8 }}>
                                    <EyeSlot onScroll={setScrollItem} />
                                </div>
                                <MouthSlot championId={champion.id} onConsume={(itemId) => useItem(champion.id, itemId)} />
                            </div>
                        </div>
                    </div>

                    {/* ── COL 3: Backpack ── */}
                    <BackpackGrid
                        inv={inv}
                        equip={equip}
                        champion={champion}
                        onEquip={handleEquipItem}
                        onDrop={itemId => dropItem(itemId, champion.id)}
                        onReadScroll={setScrollItem}
                        onUseItem={itemId => useItem(champion.id, itemId)}
                        onUnequipToInventory={handleUnequipToInventory}
                    />
                </div>

                {/* ── Footer ── */}
                <div style={{ borderTop: `1px solid ${T.panelBorder}`, paddingTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

                    {/* Transfer to other party members */}
                    {otherMembers.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 9, letterSpacing: 2, color: T.goldDim }}>DONNER À</span>
                            {otherMembers.map(other => {
                                const [over2, setOver2] = React.useState(false);
                                const oc = CLASS_COLORS[other.class];
                                return (
                                    <div key={other.id} title={`Donner à ${other.name}`}
                                        style={{ width: 48, border: `2px solid ${over2 ? oc : oc + '55'}`, borderRadius: 4, background: over2 ? `${oc}22` : '#080810', cursor: 'copy', transition: 'border-color 0.12s', overflow: 'hidden' }}
                                        onDragOver={e => { e.preventDefault(); setOver2(true); }}
                                        onDragLeave={() => setOver2(false)}
                                        onDrop={e => { e.preventDefault(); setOver2(false); const p = getDrag(e); if (p) handleGiveToDrop(p, other); }}
                                    >
                                        <img src={other.portrait} alt={other.name} style={{ width: 48, height: 48, objectFit: 'cover', objectPosition: 'top center' }} />
                                        <div style={{ fontSize: 8, textAlign: 'center', color: oc, padding: '2px 0', background: '#060608', letterSpacing: 1 }}>{other.name.substring(0, 6).toUpperCase()}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div style={{ flex: 1 }} />

                    {/* Sleep + Save icons */}
                    <button
                        onClick={() => sleep()}
                        title="Dormir (restaure tous les stats)"
                        style={{ width: 44, height: 44, background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, color: T.cream, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >🛏</button>
                    <button
                        onClick={() => { /* TODO: save system */ alert('Sauvegarde non implémentée.'); }}
                        title="Sauvegarder"
                        style={{ width: 44, height: 44, background: T.panel, border: `1px solid ${T.panelBorder}`, borderRadius: 6, color: T.cream, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >💾</button>

                    {level === 0 && (
                        <button
                            onClick={() => { removeFromParty(champion.id); closePartyMember(); }}
                            style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #5a0f0f, #8b0000)', border: `1px solid ${T.red}`, borderRadius: 6, color: '#ffaaaa', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, cursor: 'pointer', fontFamily: '"Courier New", monospace' }}
                        >
                            RENVOYER
                        </button>
                    )}
                </div>
            </div>

            {scrollItem && <ScrollPopup item={scrollItem} onClose={() => setScrollItem(null)} />}
        </div>
    );
};
