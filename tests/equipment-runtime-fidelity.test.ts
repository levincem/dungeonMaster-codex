import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS,
    getEquippableSlots,
    getStarterAutoEquipSlots,
} from '../src/data/equipment.js';
import {
    ARMOR_TYPES,
    MISC_TYPES,
    POTION_TYPES,
    WEAPON_TYPES,
    getArmorDef,
    resolveItemName,
} from '../src/data/items.js';
import type { FloorItem } from '../src/types/game.js';
import type { ArmorSlot, EquipSlotKey } from '../src/types/items.js';

type SourceAllowedSlots = {
    mouth: boolean;
    head: boolean;
    neck: boolean;
    torso: boolean;
    legs: boolean;
    feet: boolean;
    quiver1: boolean;
    quiver2: boolean;
    pouch: boolean;
    hands: boolean;
    chest: boolean;
};

type SourceGameDb = {
    originalAtari?: {
        weaponAttackReference?: Array<{
            weaponIndex: number;
            allowedSlotsMask: number;
        }>;
        i559?: {
            objectInfo?: Array<{
                allowedSlots?: SourceAllowedSlots;
            }>;
        };
    };
};

const SOURCE_GAME_DB_PATH = `${process.cwd()}\\assets\\OriginalDataExtraction\\output\\game_db.json`;
const SOURCE_ITEM_OBJECT_INDEX_OFFSETS = {
    Scroll: 0,
    Container: 1,
    Potion: 2,
    Weapon: 23,
    Armor: 69,
    Misc: 127,
} as const;

function readSourceGameDb(): SourceGameDb {
    return JSON.parse(readFileSync(SOURCE_GAME_DB_PATH, 'utf8')) as SourceGameDb;
}

function pushUniqueSlots(target: EquipSlotKey[], ...entries: EquipSlotKey[]): void {
    for (const entry of entries) {
        if (!target.includes(entry)) target.push(entry);
    }
}

function addCarrySlots(target: EquipSlotKey[]): void {
    pushUniqueSlots(target, 'rightHand', 'leftHand');
}

function addStorageSlots(target: EquipSlotKey[], allowed?: SourceAllowedSlots): void {
    if (!allowed) return;
    if (allowed.quiver1) pushUniqueSlots(target, 'quiver1', 'quiver2');
    if (allowed.quiver2) pushUniqueSlots(target, 'quiver3', 'quiver4');
    if (allowed.pouch) pushUniqueSlots(target, 'pocket1', 'pocket2');
}

function addWearSlots(target: EquipSlotKey[], allowed?: SourceAllowedSlots): void {
    if (!allowed) return;
    if (allowed.head) pushUniqueSlots(target, 'head');
    if (allowed.neck) pushUniqueSlots(target, 'neck');
    if (allowed.torso) pushUniqueSlots(target, 'torso');
    if (allowed.legs) pushUniqueSlots(target, 'legs');
    if (allowed.feet) pushUniqueSlots(target, 'feet');
}

function mapArmorWearSlot(slot: ArmorSlot): EquipSlotKey[] {
    switch (slot) {
        case 'head':
            return ['head'];
        case 'neck':
            return ['neck'];
        case 'torso':
            return ['torso'];
        case 'legs':
            return ['legs'];
        case 'feet':
            return ['feet'];
        case 'hands':
            return ['rightHand', 'leftHand'];
        case 'belt':
            return [];
        default:
            return [];
    }
}

function createItem(category: FloorItem['category'], typeId: number): FloorItem {
    return {
        id: `${category}-${typeId}`,
        category,
        typeId,
        rawName: category === 'Scroll' ? 'Scroll' : resolveItemName(category, typeId),
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
}

function getObjectInfoAllowedSlots(
    source: SourceGameDb,
    category: 'Armor' | 'Potion' | 'Misc' | 'Scroll' | 'Container',
    typeId: number,
): SourceAllowedSlots | undefined {
    const offset = SOURCE_ITEM_OBJECT_INDEX_OFFSETS[category];
    return source.originalAtari?.i559?.objectInfo?.[offset + typeId]?.allowedSlots;
}

function getWeaponAllowedSlots(source: SourceGameDb, typeId: number): SourceAllowedSlots | undefined {
    const mask = source.originalAtari?.weaponAttackReference?.find((entry) => entry.weaponIndex === typeId)?.allowedSlotsMask;
    if (mask == null) return undefined;
    return {
        mouth: Boolean(mask & 1),
        head: Boolean(mask & 2),
        neck: Boolean(mask & 4),
        torso: Boolean(mask & 8),
        legs: Boolean(mask & 16),
        feet: Boolean(mask & 32),
        quiver1: Boolean(mask & 64),
        quiver2: Boolean(mask & 128),
        pouch: Boolean(mask & 256),
        hands: Boolean(mask & 512),
        chest: Boolean(mask & 1024),
    };
}

function expectedWeaponEquippableSlots(typeId: number, allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    const preferStorageFirst = WEAPON_TYPES[typeId]?.type === 'Ammo' || WEAPON_TYPES[typeId]?.thrown === true;

    if (preferStorageFirst) {
        addStorageSlots(slots, allowed);
        addCarrySlots(slots);
        return slots;
    }

    addCarrySlots(slots);
    addStorageSlots(slots, allowed);
    return slots;
}

function expectedArmorEquippableSlots(typeId: number, rawName: string | undefined, allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    const def = getArmorDef(typeId, rawName);
    if (def) {
        pushUniqueSlots(slots, ...mapArmorWearSlot(def.slot));
    }
    addWearSlots(slots, allowed);
    addCarrySlots(slots);
    addStorageSlots(slots, allowed);
    return slots;
}

function expectedMiscEquippableSlots(allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    addWearSlots(slots, allowed);
    addStorageSlots(slots, allowed);
    addCarrySlots(slots);
    return slots;
}

function expectedConsumableEquippableSlots(allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    addStorageSlots(slots, allowed);
    addCarrySlots(slots);
    return slots;
}

function expectedStarterArmorSlots(typeId: number, rawName: string | undefined, allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    const def = getArmorDef(typeId, rawName);
    if (def) {
        pushUniqueSlots(slots, ...mapArmorWearSlot(def.slot));
    }
    addWearSlots(slots, allowed);
    if (allowed?.hands) {
        addCarrySlots(slots);
    }
    return slots;
}

function expectedStarterMiscSlots(allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    addWearSlots(slots, allowed);
    addStorageSlots(slots, allowed);
    if (slots.length === 0) {
        addCarrySlots(slots);
    }
    return slots;
}

function expectedStarterConsumableSlots(allowed?: SourceAllowedSlots): EquipSlotKey[] {
    const slots: EquipSlotKey[] = [];
    addStorageSlots(slots, allowed);
    if (slots.length === 0) {
        addCarrySlots(slots);
    }
    return slots;
}

function hasExplicitSourceSlotSignal(allowed?: SourceAllowedSlots): boolean {
    if (!allowed) return false;
    return Object.values(allowed).some(Boolean);
}

test('equipment runtime preserves source-backed slot semantics for equippable items', () => {
    const source = readSourceGameDb();

    for (const typeId of Object.keys(WEAPON_TYPES).map(Number).sort((left, right) => left - right)) {
        const item = createItem('Weapon', typeId);
        const allowed = getWeaponAllowedSlots(source, typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getEquippableSlots(item),
            expectedWeaponEquippableSlots(typeId, allowed),
            `weapon ${typeId} equippable slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(ARMOR_TYPES).map(Number).sort((left, right) => left - right)) {
        const item = createItem('Armor', typeId);
        const allowed = getObjectInfoAllowedSlots(source, 'Armor', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getEquippableSlots(item),
            expectedArmorEquippableSlots(typeId, item.rawName, allowed),
            `armor ${typeId} equippable slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(MISC_TYPES).map(Number).sort((left, right) => left - right)) {
        const item = createItem('Misc', typeId);
        const allowed = getObjectInfoAllowedSlots(source, 'Misc', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getEquippableSlots(item),
            expectedMiscEquippableSlots(allowed),
            `misc ${typeId} equippable slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(POTION_TYPES).map(Number).sort((left, right) => left - right)) {
        const item = createItem('Potion', typeId);
        const allowed = getObjectInfoAllowedSlots(source, 'Potion', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getEquippableSlots(item),
            expectedConsumableEquippableSlots(allowed),
            `potion ${typeId} equippable slots drifted from source-backed semantics`,
        );
    }

    const scroll = createItem('Scroll', 0);
    const scrollAllowed = getObjectInfoAllowedSlots(source, 'Scroll', 0);
    if (hasExplicitSourceSlotSignal(scrollAllowed)) {
        assert.deepEqual(
            getEquippableSlots(scroll),
            expectedConsumableEquippableSlots(scrollAllowed),
            'scroll equippable slots drifted from source-backed semantics',
        );
    }

    const container = createItem('Container', 0);
    const containerAllowed = getObjectInfoAllowedSlots(source, 'Container', 0);
    if (hasExplicitSourceSlotSignal(containerAllowed)) {
        assert.deepEqual(
            getEquippableSlots(container),
            expectedConsumableEquippableSlots(containerAllowed),
            'container equippable slots drifted from source-backed semantics',
        );
    }
});

test('starter auto-equip preserves source-backed priority and never invents extra slot families', () => {
    const source = readSourceGameDb();

    for (const typeId of Object.keys(WEAPON_TYPES).map(Number).sort((left, right) => left - right)) {
        const allowed = getWeaponAllowedSlots(source, typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getStarterAutoEquipSlots(createItem('Weapon', typeId)),
            expectedWeaponEquippableSlots(typeId, allowed),
            `weapon ${typeId} starter auto-equip slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(ARMOR_TYPES).map(Number).sort((left, right) => left - right)) {
        const item = createItem('Armor', typeId);
        const allowed = getObjectInfoAllowedSlots(source, 'Armor', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getStarterAutoEquipSlots(item),
            expectedStarterArmorSlots(typeId, item.rawName, allowed),
            `armor ${typeId} starter auto-equip slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(MISC_TYPES).map(Number).sort((left, right) => left - right)) {
        const allowed = getObjectInfoAllowedSlots(source, 'Misc', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getStarterAutoEquipSlots(createItem('Misc', typeId)),
            expectedStarterMiscSlots(allowed),
            `misc ${typeId} starter auto-equip slots drifted from source-backed semantics`,
        );
    }

    for (const typeId of Object.keys(POTION_TYPES).map(Number).sort((left, right) => left - right)) {
        const allowed = getObjectInfoAllowedSlots(source, 'Potion', typeId);
        if (!hasExplicitSourceSlotSignal(allowed)) continue;
        assert.deepEqual(
            getStarterAutoEquipSlots(createItem('Potion', typeId)),
            expectedStarterConsumableSlots(allowed),
            `potion ${typeId} starter auto-equip slots drifted from source-backed semantics`,
        );
    }

    const scrollAllowed = getObjectInfoAllowedSlots(source, 'Scroll', 0);
    if (hasExplicitSourceSlotSignal(scrollAllowed)) {
        assert.deepEqual(
            getStarterAutoEquipSlots(createItem('Scroll', 0)),
            expectedStarterConsumableSlots(scrollAllowed),
            'scroll starter auto-equip slots drifted from source-backed semantics',
        );
    }

    const containerAllowed = getObjectInfoAllowedSlots(source, 'Container', 0);
    if (hasExplicitSourceSlotSignal(containerAllowed)) {
        assert.deepEqual(
            getStarterAutoEquipSlots(createItem('Container', 0)),
            expectedStarterConsumableSlots(containerAllowed),
            'container starter auto-equip slots drifted from source-backed semantics',
        );
    }
});

test('source zero-slot items are explicitly enumerated and match the runtime fallback exceptions', () => {
    const source = readSourceGameDb();
    const zeroSlotItems: Array<{ category: string; typeId: number; name: string | undefined }> = [];

    for (const typeId of Object.keys(MISC_TYPES).map(Number).sort((left, right) => left - right)) {
        const allowed = getObjectInfoAllowedSlots(source, 'Misc', typeId);
        if (!allowed || hasExplicitSourceSlotSignal(allowed)) continue;
        zeroSlotItems.push({
            category: 'Misc',
            typeId,
            name: resolveItemName('Misc', typeId),
        });
    }

    assert.deepEqual(zeroSlotItems, [
        { category: 'Misc', typeId: 51, name: 'Zokathra' },
    ]);

    assert.deepEqual(EXPLICIT_ZERO_SLOT_ITEM_FALLBACKS, {
        Misc: {
            51: {
                rawName: 'Zokathra',
                equippableSlots: ['rightHand', 'leftHand'],
                starterAutoEquipSlots: ['rightHand', 'leftHand'],
            },
        },
    });

    assert.deepEqual(
        getEquippableSlots(createItem('Misc', 51)),
        ['rightHand', 'leftHand'],
        'Zokathra should only remain equippable through the explicit zero-slot fallback',
    );

    assert.deepEqual(
        getStarterAutoEquipSlots(createItem('Misc', 51)),
        ['rightHand', 'leftHand'],
        'Zokathra starter fallback should stay aligned with the explicit zero-slot exception',
    );
});
