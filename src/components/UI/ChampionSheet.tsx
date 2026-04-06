import React, { useState } from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion } from '../../data/champions';
import { useStore, xpToLevel } from '../../engine/store';
import { WEAPON_TYPES, ARMOR_TYPES, POTION_TYPES, MISC_TYPES } from '../../data/items';
import type { EquipSlotKey } from '../../types/items';
import type { FloorItem, ChampionEquipment } from '../../types/game';
import { getItemImage, getTorchImage } from '../../data/itemImages';
import {
    getEquippableSlots,
    getTotalWeight,
    getChampionMaxLoad,
    getEffectiveChampionStats,
} from '../../data/equipment';

// ─── Slot highlight animation ─────────────────────────────────────────────────
const PULSE_STYLE = `
@keyframes slot-pulse {
  0%,100% { box-shadow: 0 0 0 2px #e0c050, 0 0 6px 1px #e0a83066; }
  50%      { box-shadow: 0 0 0 2px #ffe080, 0 0 14px 4px #e0a830aa; }
}
.slot-valid { animation: slot-pulse 1s ease-in-out infinite; border-color: #e0c050 !important; }
`;

// ─── Skill level names (DM1 original) ─────────────────────────────────────────
const SKILL_LEVEL_NAMES: string[] = [
    'None', 'Novice', 'Apprentice', 'Neophyte', 'Journeyman',
    'Craftsman', 'Artisan', 'Adept', 'Expert', 'LoreKeeper',
    'Wizard', 'Artist', 'Champion', 'Hero', 'Master',
    'HighMaster', 'LegendMaster', 'ArchMaster', 'GrandMaster', 'TimeStone',
];

function getSkillLevelName(xp: number): string {
    const lvl = xpToLevel(xp);
    return SKILL_LEVEL_NAMES[Math.min(lvl, SKILL_LEVEL_NAMES.length - 1)] ?? 'GrandMaster';
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    parchment:   '#d4b87a',   // background parchment
    parchmentDk: '#b8963e',
    panelBg:     'rgba(0,0,0,0.72)',
    panelBorder: '#7a5c20',
    gold:        '#e0a830',
    goldDim:     '#8a6418',
    cream:       '#f0e0b0',
    creamDim:    '#b0904a',
    red:         '#d83030',
    green:       '#30b050',
    blue:        '#3080c8',
    yellow:      '#d4a820',
    slotBg:      'rgba(0,0,0,0.6)',
    slotBorder:  '#5a3e10',
    text:        '#f4dfa0',
};

const SKILL_COLORS: Record<string, string> = {
    fighter: '#d04030',
    ninja:   '#40b060',
    priest:  '#4080c0',
    wizard:  '#8060c0',
};

// ─── Item helpers ─────────────────────────────────────────────────────────────
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

function isConsumable(item: FloorItem): boolean {
    if (item.category === 'Potion') return true;
    if (item.category === 'Misc') return !!(MISC_TYPES[item.typeId]?.food) || item.typeId === 1;
    return false;
}

// ─── Drag/drop ────────────────────────────────────────────────────────────────
interface DragPayload { itemId: string; fromChampionId: number; fromSlot: EquipSlotKey | 'inventory'; }
function setDrag(e: React.DragEvent, p: DragPayload) { e.dataTransfer.setData('application/json', JSON.stringify(p)); e.dataTransfer.effectAllowed = 'move'; }
function getDrag(e: React.DragEvent): DragPayload | null { try { return JSON.parse(e.dataTransfer.getData('application/json')); } catch { return null; } }

// ─── Item thumbnail ───────────────────────────────────────────────────────────
const ItemThumb: React.FC<{ item: FloorItem; size?: number }> = ({ item, size = 32 }) => {
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const isTorch = item.category === 'Weapon' && item.typeId === 16;
    const src = isTorch ? getTorchImage(item.id, torchBurnStart) : getItemImage(item.category, item.typeId);
    return (
        <img
            src={src}
            alt=""
            draggable={false}
            style={{
                width: size,
                height: size,
                objectFit: 'contain',
                imageRendering: 'crisp-edges',
                flexShrink: 0,
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        />
    );
};

// ─── Vital bar ────────────────────────────────────────────────────────────────
const VitalBar: React.FC<{ icon: string; label: string; value: number; max: number; color: string }> = ({ icon, label, value, max, color }) => (
    <div style={{ marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 13, lineHeight: 1, width: 16, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontSize: 12, color: T.creamDim, letterSpacing: 1, flex: 1 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 'bold', color, fontVariantNumeric: 'tabular-nums' }}>
                {Math.ceil(value)}<span style={{ fontSize: 10, color: T.creamDim, fontWeight: 'normal' }}>/{max}</span>
            </span>
        </div>
        <div style={{ height: 9, background: 'rgba(0,0,0,0.5)', borderRadius: 4, border: `1px solid ${T.slotBorder}`, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 4, transition: 'width 0.3s ease', boxShadow: `0 0 5px ${color}55` }} />
        </div>
    </div>
);

// ─── Equipment slot ───────────────────────────────────────────────────────────
const SLOT_LABELS: Record<EquipSlotKey, string> = {
    head:'TÊTE', neck:'COU', torso:'TORSE', rightHand:'DR.', leftHand:'GA.',
    hands:'MAINS', belt:'CEINTURE', legs:'JAMBES', feet:'PIEDS',
    quiver1:'CARR.1', quiver2:'CARR.2', quiver3:'CARR.3', quiver4:'CARR.4',
    pocket1:'POCHE1', pocket2:'POCHE2',
};

const EquipSlot: React.FC<{
    slotKey: EquipSlotKey; item?: FloorItem; championId: number;
    size?: number; highlight?: boolean;
    onDrop: (p: DragPayload, slot: EquipSlotKey) => void; onUnequip: () => void;
    onDragBegin?: (p: DragPayload) => void; onDragEnd?: () => void;
}> = ({ slotKey, item, championId, size = 48, highlight = false, onDrop, onUnequip, onDragBegin, onDragEnd }) => {
    const [over, setOver] = useState(false);
    return (
        <div
            className={highlight && !over ? 'slot-valid' : undefined}
            style={{ width: size, height: size, border: `1px solid ${over ? T.gold : item ? T.panelBorder : T.slotBorder}`, borderRadius: 3, background: over ? 'rgba(30,18,0,0.9)' : T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: item ? 'grab' : 'default', position: 'relative', transition: over ? undefined : 'border-color 0.1s', padding: 2, boxSizing: 'border-box' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDrag(e); if (p) onDrop(p, slotKey); }}
        >
            <div style={{ fontSize: 6, color: T.goldDim, letterSpacing: 0.5, lineHeight: 1 }}>{SLOT_LABELS[slotKey]}</div>
            {item ? (
                <>
                    <span draggable
                        onDragStart={e => { setDrag(e, { itemId: item.id, fromChampionId: championId, fromSlot: slotKey }); onDragBegin?.({ itemId: item.id, fromChampionId: championId, fromSlot: slotKey }); }}
                        onDragEnd={onDragEnd}
                    >
                        <ItemThumb item={item} size={size - 16} />
                    </span>
                    <button onClick={onUnequip} title="Déséquiper" style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', color: T.goldDim, fontSize: 8, cursor: 'pointer', padding: 0, lineHeight: 1 }}>↩</button>
                </>
            ) : (
                <div style={{ width: size - 18, height: size - 18, border: `1px dashed ${T.slotBorder}`, borderRadius: 2, opacity: 0.35 }} />
            )}
        </div>
    );
};

// ─── Scroll reader ─────────────────────────────────────────────────────────────
const ScrollPopup: React.FC<{ item: FloorItem; onClose: () => void }> = ({ item, onClose }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'linear-gradient(160deg, #1a1408, #241c08)', border: `1px solid ${T.gold}`, borderRadius: 8, padding: 28, fontFamily: '"Courier New", monospace', color: T.cream }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: T.goldDim, textAlign: 'center', marginBottom: 14 }}>✦ PARCHEMIN ✦</div>
            <div style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 18, color: T.gold }}>{getItemName(item)}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: T.creamDim, textAlign: 'center', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                {item.rawName && !PLACEHOLDER_RE.test(item.rawName) ? item.rawName : 'Le parchemin est couvert\nde runes illisibles.'}
            </div>
            <button onClick={onClose} style={{ display: 'block', margin: '20px auto 0', background: 'none', border: `1px solid ${T.goldDim}`, borderRadius: 4, color: T.goldDim, fontSize: 11, letterSpacing: 2, cursor: 'pointer', padding: '6px 20px', fontFamily: '"Courier New", monospace' }}>FERMER</button>
        </div>
    </div>
);

// ─── Interactive drop zone (eye / mouth) ──────────────────────────────────────
const DropZone: React.FC<{ icon: string; label: string; title: string; borderColor: string; highlight?: boolean; onDrop: (p: DragPayload) => void }> = ({ icon, label, title, borderColor, highlight = false, onDrop }) => {
    const [over, setOver] = useState(false);
    return (
        <div title={title}
            className={highlight && !over ? 'slot-valid' : undefined}
            style={{ width: 48, height: 48, border: `1px solid ${over ? borderColor : T.slotBorder}`, borderRadius: 3, background: over ? 'rgba(30,15,0,0.9)' : T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'default', transition: over ? undefined : 'border-color 0.1s' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDrag(e); if (p) onDrop(p); }}
        >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: 7, color: T.goldDim, letterSpacing: 1 }}>{label}</span>
        </div>
    );
};

const PartyMemberDropTarget: React.FC<{
    championId: number;
    other: Champion;
    onGiveInventory: (targetId: number, itemId: string) => void;
    onGiveEquipped: (targetId: number, slot: EquipSlotKey) => void;
}> = ({ championId, other, onGiveInventory, onGiveEquipped }) => {
    const [over, setOver] = useState(false);

    return (
        <div title={`Donner à ${other.name}`}
            style={{ width: 56, border: `2px solid ${over ? T.gold : T.slotBorder}`, borderRadius: 4, background: over ? 'rgba(30,18,0,0.9)' : T.slotBg, cursor: 'copy', transition: 'border-color 0.12s', overflow: 'hidden' }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
                e.preventDefault();
                setOver(false);
                const p = getDrag(e);
                if (!p || p.fromChampionId !== championId) return;
                if (p.fromSlot === 'inventory') onGiveInventory(other.id, p.itemId);
                else onGiveEquipped(other.id, p.fromSlot as EquipSlotKey);
            }}
        >
            <img src={other.portrait} alt={other.name} style={{ width: 56, height: 56, objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
            <div style={{ fontSize: 8, textAlign: 'center', padding: '3px 0', background: 'rgba(0,0,0,0.6)', letterSpacing: 1, color: T.creamDim }}>{other.name.substring(0, 7).toUpperCase()}</div>
        </div>
    );
};

// ─── Backpack (17 slots, 5 cols) ──────────────────────────────────────────────
const BACKPACK_SLOTS = 17;
const BackpackGrid: React.FC<{
    inv: FloorItem[]; equip: ChampionEquipment; champion: Champion;
    onEquip: (item: FloorItem) => void; onDropToFloor: (id: string) => void;
    onReadScroll: (item: FloorItem) => void; onUseItem: (id: string) => void;
    onUnequipToInventory: (e: React.DragEvent) => void;
    onItemDragStart: (p: DragPayload) => void; onItemDragEnd: () => void;
}> = ({ inv, champion, onEquip, onDropToFloor, onReadScroll, onUseItem, onUnequipToInventory, onItemDragStart, onItemDragEnd }) => (
    <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
        onDragOver={e => e.preventDefault()} onDrop={onUnequipToInventory}
    >
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.gold, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>SAC À DOS</span>
            <span style={{ color: inv.length >= BACKPACK_SLOTS ? T.red : T.creamDim, fontSize: 10 }}>{inv.length}/{BACKPACK_SLOTS}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {Array.from({ length: BACKPACK_SLOTS }).map((_, i) => {
                const item = inv[i];
                if (!item) return <div key={i} style={{ aspectRatio: '1', border: `1px dashed ${T.slotBorder}`, borderRadius: 3, background: T.slotBg, opacity: 0.5 }} />;
                return (
                    <div key={item.id} draggable
                        onMouseDown={() => {
                            onItemDragStart({ itemId: item.id, fromChampionId: champion.id, fromSlot: 'inventory' });
                        }}
                        onDragStart={e => { const p: DragPayload = { itemId: item.id, fromChampionId: champion.id, fromSlot: 'inventory' }; setDrag(e, p); onItemDragStart(p); }}
                        onDragEnd={onItemDragEnd}
                        title={getItemName(item)}
                        style={{ aspectRatio: '1', border: `1px solid ${T.slotBorder}`, borderRadius: 3, background: T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'grab', padding: 3, position: 'relative', overflow: 'hidden' }}>
                        <ItemThumb item={item} size={44} />
                        <div style={{ fontSize: 7, color: T.creamDim, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                            {getItemName(item).substring(0, 9)}
                        </div>
                        <div style={{ display: 'flex', gap: 1, position: 'absolute', bottom: 1, right: 1 }}>
                            {getEquippableSlots(item).length > 0 && <button onClick={() => onEquip(item)} title="Équiper" style={{ background: T.goldDim, border: 'none', borderRadius: 2, color: '#000', fontSize: 7, cursor: 'pointer', padding: '1px 2px', lineHeight: 1 }}>↑</button>}
                            {item.category === 'Scroll' && <button onClick={() => onReadScroll(item)} title="Lire" style={{ background: '#4a3010', border: 'none', borderRadius: 2, color: T.cream, fontSize: 7, cursor: 'pointer', padding: '1px 2px', lineHeight: 1 }}>📜</button>}
                            {isConsumable(item) && <button onClick={() => onUseItem(item.id)} title="Utiliser" style={{ background: '#103010', border: 'none', borderRadius: 2, color: '#60d060', fontSize: 7, cursor: 'pointer', padding: '1px 2px', lineHeight: 1 }}>✓</button>}
                            <button onClick={() => onDropToFloor(item.id)} title="Poser" style={{ background: '#180808', border: 'none', borderRadius: 2, color: T.red, fontSize: 7, cursor: 'pointer', padding: '1px 2px', lineHeight: 1 }}>↓</button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ChampionSheet: React.FC = () => {
    const {
        activePartyMemberId, party, level,
        closePartyMember, removeFromParty,
        championInventories, championEquipment, championVitals, championXP,
        equipItem, unequipItem, dropItem, giveItem, giveEquippedItem,
        useItem: consumeItem, sleep,
    } = useStore();

    const [scrollItem, setScrollItem] = useState<FloorItem | null>(null);
    const [draggingItem, setDraggingItem] = useState<FloorItem | null>(null);

    const validSlots = new Set<EquipSlotKey>(draggingItem ? getEquippableSlots(draggingItem) : []);
    const highlightEye   = draggingItem?.category === 'Scroll';
    const highlightMouth = draggingItem ? isConsumable(draggingItem) : false;

    const handleDragBegin = (p: DragPayload, localEquip: ChampionEquipment, localInv: FloorItem[]) => {
        const item = p.fromSlot === 'inventory'
            ? localInv.find(i => i.id === p.itemId)
            : localEquip[p.fromSlot as EquipSlotKey];
        setDraggingItem(item ?? null);
    };
    const handleDragEnd = () => setDraggingItem(null);

    if (activePartyMemberId === null) return null;
    const champion = CHAMPIONS.find(c => c.id === activePartyMemberId);
    if (!champion) return null;

    const inv        = championInventories[champion.id] ?? [];
    const equip      = championEquipment[champion.id]   ?? {};
    const vitals     = championVitals[champion.id];
    const xp         = championXP?.[champion.id];
    const effectiveStats = getEffectiveChampionStats(champion, equip);
    const weight     = getTotalWeight(equip, inv);
    const maxWeight  = getChampionMaxLoad(champion, equip, vitals?.stamina);
    const overloaded = weight > maxWeight;

    const hp      = vitals?.hp      ?? champion.health;
    const stamina = vitals?.stamina ?? champion.stamina;
    const mana    = vitals?.mana    ?? effectiveStats.mana;

    const handleDropOnSlot = (payload: DragPayload, targetSlot: EquipSlotKey) => {
        if (payload.fromChampionId !== champion.id) { giveItem(payload.fromChampionId, champion.id, payload.itemId); return; }
        if (payload.fromSlot === 'inventory') {
            const item = inv.find(i => i.id === payload.itemId);
            if (!item || !getEquippableSlots(item).includes(targetSlot)) return;
            equipItem(champion.id, targetSlot, payload.itemId);
        } else {
            const src = payload.fromSlot as EquipSlotKey;
            if (src === targetSlot) return;
            const srcItem = equip[src];
            if (!srcItem || !getEquippableSlots(srcItem).includes(targetSlot)) return;
            unequipItem(champion.id, src);
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

    const handleConsume = (payload: DragPayload) => {
        if (payload.fromSlot === 'inventory') consumeItem(champion.id, payload.itemId);
    };

    const handleReadScroll = (payload: DragPayload) => {
        const item = inv.find(i => i.id === payload.itemId);
        if (item?.category === 'Scroll') setScrollItem(item);
    };

    const skills = [
        { key: 'fighter', label: 'GUERRIER' },
        { key: 'ninja',   label: 'NINJA'    },
        { key: 'priest',  label: 'PRÊTRE'   },
        { key: 'wizard',  label: 'MAGE'     },
    ] as const;

    // Equipment layout — 7 body slots only (no 'hands', no 'belt')
    const BODY_SLOTS: EquipSlotKey[] = ['head','neck','torso','rightHand','leftHand','legs','feet'];
    const QUIVER_SLOTS: EquipSlotKey[] = ['quiver1','quiver2','quiver3','quiver4'];
    const POCKET_SLOTS: EquipSlotKey[] = ['pocket1','pocket2'];

    const otherMembers = party.filter(c => c.id !== champion.id);

    return (
        <div onClick={closePartyMember} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: '"Courier New", Courier, monospace' }}>
            <style>{PULSE_STYLE}</style>
            <div onClick={e => e.stopPropagation()} style={{
                width: 'min(1100px, 98vw)',
                maxHeight: '96vh',
                overflowY: 'auto',
                backgroundImage: 'url(/misc/parchemin.png)',
                backgroundRepeat: 'repeat',
                backgroundSize: 'auto',
                border: `3px solid ${T.goldDim}`,
                borderRadius: 8,
                boxShadow: `0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.15)`,
                padding: 16,
                color: T.text,
                position: 'relative',
            }}>
                {/* ── Header bar ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.goldDim}` }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1a0800', letterSpacing: 3, textShadow: '1px 1px 0 rgba(255,200,80,0.4)' }}>
                        {champion.name.toUpperCase()}
                        {champion.title && <span style={{ fontSize: 12, fontWeight: 'normal', color: T.goldDim, marginLeft: 12 }}>{champion.title}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => sleep()} title="Dormir (restaure tous les stats)" style={{ width: 36, height: 36, background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 4, color: T.cream, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🛏</button>
                        <button onClick={() => alert('Sauvegarde non implémentée.')} title="Sauvegarder" style={{ width: 36, height: 36, background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 4, color: T.cream, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💾</button>
                        <button onClick={closePartyMember} style={{ width: 36, height: 36, background: 'none', border: 'none', color: T.goldDim, fontSize: 28, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                </div>

                {/* ── 3-column ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr 500px', gap: 12, alignItems: 'start' }}>

                    {/* ── COL 1: Portrait + Vitals + Stats ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'stretch' }}>

                        {/* Portrait — fills available space */}
                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, overflow: 'hidden', flex: 1, minHeight: 140 }}>
                            <img src={champion.portrait} alt={champion.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
                        </div>

                        {/* Vitals */}
                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                            <VitalBar icon="❤" label="SANTÉ"     value={hp}      max={champion.health}  color={T.red}    />
                            <VitalBar icon="⚡" label="ENDURANCE" value={stamina} max={champion.stamina} color={T.yellow} />
                            {effectiveStats.mana > 0 && <VitalBar icon="🔮" label="MANA" value={mana} max={effectiveStats.mana} color={T.blue} />}
                        </div>

                        {/* Base stats */}
                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                            <div style={{ fontSize: 9, letterSpacing: 3, color: T.gold, marginBottom: 8 }}>CARACTÉRISTIQUES</div>
                            {[
                                { label: 'FORCE',       val: effectiveStats.strength,  color: T.red    },
                                { label: 'DEXTÉRITÉ',   val: effectiveStats.dexterity, color: T.green  },
                                { label: 'SAGESSE',     val: effectiveStats.wisdom,    color: T.blue   },
                                { label: 'VITALITÉ',    val: effectiveStats.vitality,  color: T.yellow },
                                { label: 'CHANCE',      val: effectiveStats.luck,      color: T.gold   },
                                { label: 'ANTI-MAGIE',  val: effectiveStats.antiMagic, color: '#60c0a0'},
                                { label: 'ANTI-FEU',    val: effectiveStats.antiFire,  color: '#d08030'},
                            ].map(s => (
                                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                    <span style={{ fontSize: 10, color: T.creamDim }}>{s.label}</span>
                                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                        <div style={{ width: 50, height: 3, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${s.val}%`, background: s.color, borderRadius: 2 }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 'bold', color: s.color, minWidth: 22, textAlign: 'right' }}>{s.val}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* ── COL 2: Equipment silhouette ── */}
                    <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>

                        {/* Header: title + weight on same line */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 9, letterSpacing: 3, color: T.gold }}>ÉQUIPEMENT</span>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: overloaded ? T.red : T.cream }}>
                                ⚖ {weight}<span style={{ fontSize: 10, color: T.creamDim, fontWeight: 'normal' }}>/{maxWeight} kg</span>{overloaded && <span style={{ color: T.red }}> ⚠</span>}
                            </span>
                        </div>

                        {/* Eye + Mouth at top */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
                            <DropZone icon="👁" label="LIRE" title="Déposer un parchemin pour le lire" borderColor="#d4a840" highlight={highlightEye} onDrop={handleReadScroll} />
                            <DropZone icon="👄" label="MANGER" title="Déposer nourriture/potion pour consommer" borderColor="#d04040" highlight={highlightMouth} onDrop={handleConsume} />
                        </div>

                        {/* Equipment grid with silhouette */}
                        <div style={{ position: 'relative' }}>
                            {/* Silhouette */}
                            <svg viewBox="0 0 200 480" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
                                <ellipse cx="100" cy="38" rx="26" ry="30" fill="#f0d090" />
                                <rect x="90" y="66" width="20" height="20" fill="#f0d090" />
                                <path d="M56 86 Q40 110 44 180 L156 180 Q160 110 144 86 Z" fill="#f0d090" />
                                <path d="M56 90 Q32 100 24 170 Q28 182 36 178 Q44 142 60 122 Z" fill="#f0d090" />
                                <path d="M144 90 Q168 100 176 170 Q172 182 164 178 Q156 142 140 122 Z" fill="#f0d090" />
                                <rect x="54" y="180" width="92" height="28" rx="8" fill="#f0d090" />
                                <path d="M56 208 Q50 280 52 340 L76 340 Q80 280 84 208 Z" fill="#f0d090" />
                                <path d="M144 208 Q150 280 148 340 L124 340 Q120 280 116 208 Z" fill="#f0d090" />
                                <ellipse cx="64" cy="352" rx="16" ry="10" fill="#f0d090" />
                                <ellipse cx="136" cy="352" rx="16" ry="10" fill="#f0d090" />
                            </svg>

                            {/* Slots grid — quivers under rhand, pockets under lhand */}
                            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateAreas: `
                                ". head ."
                                ". neck ."
                                "lhand torso rhand"
                                "pockets legs quivers"
                                ". feet ."
                            `, gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>

                                {/* Body slots */}
                                {BODY_SLOTS.map(s => (
                                    <div key={s} style={{ gridArea: s === 'rightHand' ? 'rhand' : s === 'leftHand' ? 'lhand' : s, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <EquipSlot slotKey={s} item={equip[s]} championId={champion.id} size={80} highlight={validSlots.has(s)}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />
                                    </div>
                                ))}

                                {/* Quivers: 2×2 under right hand */}
                                <div style={{ gridArea: 'quivers', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ fontSize: 7, color: T.goldDim, letterSpacing: 2 }}>CARQUOIS</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                                        {QUIVER_SLOTS.map(s => <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={46} highlight={validSlots.has(s)}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />)}
                                    </div>
                                </div>

                                {/* Pockets: 1×2 under left hand */}
                                <div style={{ gridArea: 'pockets', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ fontSize: 7, color: T.goldDim, letterSpacing: 2 }}>POCHES</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                                        {POCKET_SLOTS.map(s => <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={46} highlight={validSlots.has(s)}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skills block — below equipment silhouette */}
                        <div style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: '8px 12px', marginTop: 4 }}>
                            <div style={{ fontSize: 9, letterSpacing: 3, color: T.gold, marginBottom: 6 }}>CLASSES</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                                {skills.map(({ key, label }) => {
                                    const skillXP = xp?.[key] ?? 0;
                                    const name = getSkillLevelName(skillXP);
                                    const color = SKILL_COLORS[key];
                                    if (name === 'None') return null;
                                    return (
                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                                            <span style={{ fontSize: 10, color: T.creamDim }}>{label}</span>
                                            <span style={{ fontSize: 10, fontWeight: 'bold', color }}>{name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {skills.every(({ key }) => (xp?.[key] ?? 0) === 0) && (
                                <div style={{ fontSize: 10, color: T.goldDim, fontStyle: 'italic' }}>Débutant</div>
                            )}
                        </div>
                    </div>

                    {/* ── COL 3: Backpack + Team portraits ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <BackpackGrid
                            inv={inv} equip={equip} champion={champion}
                            onEquip={handleEquipItem}
                            onDropToFloor={id => dropItem(id, champion.id)}
                            onReadScroll={setScrollItem}
                            onUseItem={id => consumeItem(champion.id, id)}
                            onUnequipToInventory={handleUnequipToInventory}
                            onItemDragStart={p => handleDragBegin(p, equip, inv)}
                            onItemDragEnd={handleDragEnd}
                        />

                        {otherMembers.length > 0 && (
                            <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: '8px 10px' }}>
                                <div style={{ fontSize: 9, letterSpacing: 3, color: T.gold, marginBottom: 8 }}>DONNER À</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {otherMembers.map(other => (
                                        <PartyMemberDropTarget
                                            key={other.id}
                                            championId={champion.id}
                                            other={other}
                                            onGiveInventory={(targetId, itemId) => giveItem(champion.id, targetId, itemId)}
                                            onGiveEquipped={(targetId, slot) => giveEquippedItem(champion.id, slot, targetId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {level === 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.goldDim}`, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => { removeFromParty(champion.id); closePartyMember(); }}
                            style={{ padding: '6px 14px', background: 'rgba(80,10,10,0.8)', border: `1px solid ${T.red}`, borderRadius: 4, color: '#ffaaaa', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontFamily: '"Courier New", monospace' }}>
                            RENVOYER
                        </button>
                    </div>
                )}
            </div>

            {scrollItem && <ScrollPopup item={scrollItem} onClose={() => setScrollItem(null)} />}
        </div>
    );
};
