import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPION_STARTER_LOADOUTS, buildChampionStarterLoadout } from '../src/data/championStarterItems.js';
import { canEquipItemInSlot, getStarterAutoEquipSlots } from '../src/data/equipment.js';
import type { ChampionEquipment, FloorItem } from '../src/types/game.js';
import type { EquipSlotKey } from '../src/types/items.js';

const HAND_SLOTS = new Set<EquipSlotKey>(['rightHand', 'leftHand']);
const STORAGE_SLOTS = new Set<EquipSlotKey>(['quiver1', 'quiver2', 'quiver3', 'quiver4', 'pocket1', 'pocket2']);

function getEquippedEntries(equipment: ChampionEquipment): Array<[EquipSlotKey, FloorItem]> {
    return Object.entries(equipment)
        .filter((entry): entry is [EquipSlotKey, FloorItem] => Boolean(entry[1]));
}

function assertSlot(loadout: ReturnType<typeof buildChampionStarterLoadout>, slot: EquipSlotKey, rawName: string): void {
    assert.equal(loadout.equipment[slot]?.rawName, rawName, `Expected ${rawName} in ${slot}`);
}

function getInventoryNames(loadout: ReturnType<typeof buildChampionStarterLoadout>): string[] {
    return loadout.inventory
        .map((item) => item.rawName)
        .filter((name): name is string => Boolean(name));
}

test('starter auto-equip keeps every equipped starter item on an allowed slot', () => {
    for (const championId of Object.keys(CHAMPION_STARTER_LOADOUTS).map(Number).sort((left, right) => left - right)) {
        const loadout = buildChampionStarterLoadout(championId);

        for (const [slot, item] of getEquippedEntries(loadout.equipment)) {
            assert.ok(
                canEquipItemInSlot(item, slot),
                `Champion ${championId}: ${item.rawName} ended up in non-equippable slot ${slot}`,
            );

            const starterSlots = getStarterAutoEquipSlots(item);
            assert.ok(
                starterSlots.includes(slot),
                `Champion ${championId}: ${item.rawName} ended up in unexpected starter slot ${slot}`,
            );

            if (item.category !== 'Armor') continue;

            const wearableBodySlots = starterSlots.filter((entry) => !HAND_SLOTS.has(entry) && !STORAGE_SLOTS.has(entry));
            if (wearableBodySlots.length === 0) continue;

            assert.ok(
                !HAND_SLOTS.has(slot),
                `Champion ${championId}: wearable armor ${item.rawName} should not auto-equip into ${slot}`,
            );
        }

        for (const item of loadout.inventory) {
            if (item.category !== 'Armor') continue;

            const wearableBodySlots = getStarterAutoEquipSlots(item)
                .filter((entry) => !HAND_SLOTS.has(entry) && !STORAGE_SLOTS.has(entry));

            if (wearableBodySlots.length === 0) continue;

            assert.ok(
                wearableBodySlots.every((slot) => Boolean(loadout.equipment[slot])),
                `Champion ${championId}: wearable armor ${item.rawName} was left in inventory while a body slot was still free`,
            );
        }
    }
});

test('reference-sensitive Hall starters still land on the expected equipment slots', () => {
    const halk = buildChampionStarterLoadout(1);
    assertSlot(halk, 'head', 'Bezerker Helm');
    assertSlot(halk, 'legs', 'Barbarian Hide');
    assertSlot(halk, 'feet', 'Sandals');
    assertSlot(halk, 'rightHand', 'Club');

    const zed = buildChampionStarterLoadout(4);
    assertSlot(zed, 'torso', 'Mail Aketon');
    assertSlot(zed, 'legs', 'Blue Pants');
    assertSlot(zed, 'feet', 'Hosen');
    assertSlot(zed, 'rightHand', 'Torch');

    const mophus = buildChampionStarterLoadout(8);
    assertSlot(mophus, 'torso', 'Robe (Body)');
    assertSlot(mophus, 'legs', 'Robe (Legs)');
    assertSlot(mophus, 'feet', 'Sandals');
    assert.deepEqual(getInventoryNames(mophus).sort(), ['Apple']);

    const elija = buildChampionStarterLoadout(0);
    assertSlot(elija, 'torso', 'Robe (Body)');
    assertSlot(elija, 'legs', 'Robe (Legs)');
    assertSlot(elija, 'feet', 'Sandals');
    assertSlot(elija, 'pocket1', 'Magical Box (Blue)');
});

test('starter ammo and thrown weapons prefer quivers over hands', () => {
    const hawk = buildChampionStarterLoadout(6);
    assertSlot(hawk, 'torso', 'Leather Jerkin');
    assertSlot(hawk, 'legs', 'Leather Pants');
    assertSlot(hawk, 'feet', 'Suede Boots');
    assertSlot(hawk, 'quiver1', 'Arrow');
    assertSlot(hawk, 'quiver2', 'Arrow');

    const wuTse = buildChampionStarterLoadout(10);
    assertSlot(wuTse, 'torso', 'Silk Shirt');
    assertSlot(wuTse, 'legs', 'Tabard');
    assertSlot(wuTse, 'feet', 'Sandals');
    assertSlot(wuTse, 'quiver1', 'Throwing Star');
    assertSlot(wuTse, 'quiver2', 'Throwing Star');
    assertSlot(wuTse, 'quiver3', 'Throwing Star');

    const gando = buildChampionStarterLoadout(15);
    assertSlot(gando, 'torso', 'Leather Jerkin');
    assertSlot(gando, 'legs', 'Blue Pants');
    assertSlot(gando, 'feet', 'Leather Boots');
    assertSlot(gando, 'quiver1', 'Poison Dart');
    assertSlot(gando, 'quiver2', 'Poison Dart');
});
