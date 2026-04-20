import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChampionStarterLoadout } from '../src/data/championStarterItems.js';
import { getEquippableSlots, getStarterAutoEquipSlots } from '../src/data/equipment.js';
import { getArmorDef, getItemTypeIdByName, getSourceItemAllowedSlotsMask, resolveItemName } from '../src/data/items.js';
import type { FloorItem } from '../src/types/game.js';

test('source-backed starter armor names resolve through shared item lookup', () => {
    assert.equal(getItemTypeIdByName('Armor', 'Robe (Body)'), 5);
    assert.equal(getItemTypeIdByName('Armor', 'Robe (Legs)'), 6);
    assert.equal(getItemTypeIdByName('Armor', 'Robe'), undefined);
    assert.equal(getItemTypeIdByName('Armor', 'Tabard'), 11);
    assert.equal(getItemTypeIdByName('Armor', 'Hide Shield'), 29);
    assert.equal(getItemTypeIdByName('Potion', 'Empty Flask'), 20);
});

test('legacy negative armor shims no longer expose runtime slot or attack-class data', () => {
    assert.equal(getArmorDef(-4, 'Tabard'), undefined);
    assert.equal(getSourceItemAllowedSlotsMask('Armor', -4, 'Tabard'), undefined);

    const item: FloorItem = {
        id: 'legacy-tabard',
        category: 'Armor',
        typeId: -4,
        rawName: 'Tabard',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    assert.deepEqual(getEquippableSlots(item), []);
});

test('corrected armor ids resolve to the source-backed names we expect in runtime', () => {
    assert.equal(resolveItemName('Armor', 2), 'Barbarian Hide');
    assert.equal(resolveItemName('Armor', 5), 'Robe (Body)');
    assert.equal(resolveItemName('Armor', 6), 'Robe (Legs)');
    assert.equal(resolveItemName('Armor', 3), 'Sandals');
    assert.equal(resolveItemName('Armor', 11), 'Tabard');
    assert.equal(resolveItemName('Armor', 19), 'Blue Pants');
    assert.equal(resolveItemName('Armor', 29), 'Hide Shield');
    assert.equal(getArmorDef(2)?.slot, 'legs');
    assert.equal(getArmorDef(5)?.slot, 'torso');
    assert.equal(getArmorDef(6)?.slot, 'legs');
    assert.equal(getArmorDef(3)?.slot, 'feet');
    assert.equal(getArmorDef(11)?.slot, 'legs');
    assert.equal(getArmorDef(29)?.slot, 'hands');
});

test('starter auto-equip keeps wearable armor on body slots instead of hands', () => {
    const halk = buildChampionStarterLoadout(1);
    assert.equal(halk.equipment.head?.rawName, 'Bezerker Helm');
    assert.equal(halk.equipment.legs?.rawName, 'Barbarian Hide');
    assert.equal(halk.equipment.feet?.rawName, 'Sandals');
    assert.equal(halk.equipment.rightHand?.rawName, 'Club');
    assert.equal(halk.equipment.leftHand, undefined);
    assert.deepEqual(halk.inventory, []);

    const sonja = buildChampionStarterLoadout(19);
    assert.equal(sonja.equipment.torso?.rawName, 'Halter');
    assert.equal(sonja.equipment.legs?.rawName, 'Gunna');
    assert.equal(sonja.equipment.feet?.rawName, 'Sandals');
    assert.equal(sonja.equipment.rightHand?.rawName, 'Sword');
    assert.equal(sonja.equipment.neck?.rawName, 'Choker');
});

test('starter auto-equip prefers body and storage slots over generic carry slots', () => {
    const sandals: FloorItem = {
        id: 'starter-sandals',
        category: 'Armor',
        typeId: 3,
        rawName: 'Sandals',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    assert.deepEqual(getStarterAutoEquipSlots(sandals), ['feet']);

    const hideShield: FloorItem = {
        id: 'starter-hide-shield',
        category: 'Armor',
        typeId: 29,
        rawName: 'Hide Shield',
        mapIndex: 0,
        x: 0,
        y: 0,
        tilePos: 'North',
    };
    assert.deepEqual(getStarterAutoEquipSlots(hideShield), ['rightHand', 'leftHand']);
});
