const fs = require("fs");
const path = require("path");
const { decodeI559 } = require("./decode_i559_blob.cjs");

function mapCreature(creature, index) {
  return {
    index,
    creatureAspectIndex: creature.creatureAspectIndex,
    attackSoundOrdinal: creature.attackSoundOrdinal,
    sizeOnTile: creature.attributes & 0x0003,
    attackFromAllSides: !!((creature.attributes >> 2) & 1),
    preferBackRow: !!((creature.attributes >> 3) & 1),
    attackAnyChampion: !!((creature.attributes >> 4) & 1),
    levitates: !!((creature.attributes >> 5) & 1),
    nonMaterial: !!((creature.attributes >> 6) & 1),
    dropFixedPossessions: !!((creature.attributes >> 9) & 1),
    absorbMissiles: !!((creature.attributes >> 10) & 1),
    seeInvisible: !!((creature.attributes >> 11) & 1),
    nightVision: !!((creature.attributes >> 12) & 1),
    archenemy: !!((creature.attributes >> 13) & 1),
    additionalFrontGraphics: creature.graphicInfo & 0x0003,
    canMirrorImage: !!((creature.graphicInfo >> 2) & 1),
    hasSideImage: !!((creature.graphicInfo >> 3) & 1),
    hasBackImage: !!((creature.graphicInfo >> 4) & 1),
    hasAttackImage: !!((creature.graphicInfo >> 5) & 1),
    canMirrorAttackImage: !!((creature.graphicInfo >> 9) & 1),
    cannotMirrorWhileAttacking: !!((creature.graphicInfo >> 10) & 1),
    xShiftGroup: (creature.graphicInfo >> 12) & 0x0003,
    yShiftGroup: (creature.graphicInfo >> 14) & 0x0003,
    movementTicks: creature.movementTicks,
    attackTicks: creature.attackTicks,
    defense: creature.defense,
    baseHealth: creature.baseHealth,
    attack: creature.attack,
    poisonAttack: creature.poisonAttack,
    dexterity: creature.dexterity,
    byte13: creature.byte13,
    ranges: {
      sight: creature.ranges & 0x000f,
      smell: (creature.ranges >> 8) & 0x000f,
      attack: (creature.ranges >> 12) & 0x000f,
    },
    properties: {
      fearResistance: (creature.properties >> 4) & 0x000f,
      experienceClass: (creature.properties >> 8) & 0x000f,
      wariness: (creature.properties >> 12) & 0x000f,
    },
    resistances: {
      fire: (creature.resistances >> 4) & 0x000f,
      poison: (creature.resistances >> 8) & 0x000f,
    },
    word20: creature.word20,
    behaviorAfterAttack: creature.word20 & 0x000f,
    nonAttackAspect: (creature.word20 >> 4) & 0x000f,
    attackAspect: (creature.word20 >> 8) & 0x000f,
    byte22: creature.byte22,
  };
}

function mapWeapon(weapon, index) {
  return {
    index,
    weightKg: weapon.weight / 10,
    rawClass: weapon.weaponClass,
    damage: weapon.strength,
    kineticEnergy: weapon.kineticEnergy,
    shootDamage: weapon.attributes & 0x00ff,
    throwGraphic: (weapon.attributes >> 8) & 0x001f,
  };
}

function mapCloth(cloth, index) {
  return {
    index,
    weightKg: cloth.weight / 10,
    protection: cloth.defense,
    sharpDefense: cloth.attributes & 0x0007,
    isShield: !!((cloth.attributes >> 7) & 1),
  };
}

function mapObjectInfo(objectInfo, index) {
  return {
    index,
    type: objectInfo.type,
    graphicClass: objectInfo.objectAspectIndex,
    attackClass: objectInfo.actionSetIndex,
    allowedSlotsMask: objectInfo.allowedSlots,
    allowedSlots: {
      mouth: !!(objectInfo.allowedSlots & 0x0001),
      head: !!(objectInfo.allowedSlots & 0x0002),
      neck: !!(objectInfo.allowedSlots & 0x0004),
      torso: !!(objectInfo.allowedSlots & 0x0008),
      legs: !!(objectInfo.allowedSlots & 0x0010),
      feet: !!(objectInfo.allowedSlots & 0x0020),
      quiver1: !!(objectInfo.allowedSlots & 0x0040),
      quiver2: !!(objectInfo.allowedSlots & 0x0080),
      pouch: !!(objectInfo.allowedSlots & 0x0100),
      hands: !!(objectInfo.allowedSlots & 0x0200),
      chest: !!(objectInfo.allowedSlots & 0x0400),
    },
  };
}

function exportStats(decoded) {
  return {
    _meta: {
      source: "I559 decoded payload",
      endian: decoded.endian,
      start: decoded.start,
      consumedBytes: decoded.consumedBytes,
    },
    creatureFacings: decoded.creatureFacings,
    foodValues: decoded.foodValues,
    miscWeightsKg: decoded.miscWeights.map((value) => value / 10),
    protection: decoded.protection & 0x00ff,
    creatures: decoded.creatures.map(mapCreature),
    weapons: decoded.weapons.map(mapWeapon),
    cloths: decoded.cloths.map(mapCloth),
    objectInfo: decoded.objects.map(mapObjectInfo),
    extraDBEntries: decoded.extraDBEntries,
    sizeDBEntries: decoded.sizeDBEntries,
    deltaY: decoded.deltaY,
    deltaX: decoded.deltaX,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node export_i559_stats.cjs <file> [startOffset] [be|le] [outputPath]");
    process.exit(1);
  }

  const start = Number(process.argv[3] ?? 0);
  const endian = (process.argv[4] ?? "be").toLowerCase();
  const outputPath = process.argv[5];
  const buffer = fs.readFileSync(path.resolve(inputPath));
  const decoded = decodeI559(buffer, { start, endian });
  const exported = exportStats(decoded);

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), JSON.stringify(exported, null, 2));
  } else {
    console.log(JSON.stringify(exported, null, 2));
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  exportStats,
};
