export type OriginalGeneratorConfig = {
    typeId: number;
    countRaw: number;
    randomized: boolean;
    hpMultiplier: number;
    ticks: number;
    spawnX: number;
    spawnY: number;
};

const ORIGINAL_GENERATOR_CONFIGS: Record<string, OriginalGeneratorConfig> = {
    '2_81': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 7, ticks: 106, spawnX: 9, spawnY: 13 },
    '2_545': { typeId: 16, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 141, spawnX: 20, spawnY: 17 },
    '3_415': { typeId: 6, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 131, spawnX: 12, spawnY: 16 },
    '3_119': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 155, spawnX: 12, spawnY: 19 },
    '3_118': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '3_125': { typeId: 7, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '3_123': { typeId: 6, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '3_122': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '3_128': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '3_131': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '4_542': { typeId: 1, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 131, spawnX: 12, spawnY: 16 },
    '4_383': { typeId: 13, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 136, spawnX: 0, spawnY: 17 },
    '5_135': { typeId: 3, countRaw: 1, randomized: false, hpMultiplier: 4, ticks: 163, spawnX: 13, spawnY: 20 },
    '5_519': { typeId: 3, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 141, spawnX: 20, spawnY: 17 },
    '5_560': { typeId: 12, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 130, spawnX: 8, spawnY: 16 },
    '5_561': { typeId: 17, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 144, spawnX: 0, spawnY: 18 },
    '5_563': { typeId: 12, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '5_194': { typeId: 12, countRaw: 4, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '5_318': { typeId: 3, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '5_616': { typeId: 4, countRaw: 1, randomized: false, hpMultiplier: 7, ticks: 155, spawnX: 13, spawnY: 19 },
    '7_237': { typeId: 12, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 217, spawnX: 4, spawnY: 27 },
    '7_446': { typeId: 10, countRaw: 3, randomized: true, hpMultiplier: 0, ticks: 154, spawnX: 8, spawnY: 19 },
    '7_445': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 136, spawnX: 0, spawnY: 17 },
    '7_248': { typeId: 12, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '7_240': { typeId: 8, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '7_241': { typeId: 8, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 163, spawnX: 12, spawnY: 20 },
    '8_514': { typeId: 4, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 150, spawnX: 24, spawnY: 18 },
    '8_484': { typeId: 4, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 127, spawnX: 28, spawnY: 15 },
    '9_453': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 138, spawnX: 8, spawnY: 17 },
    '9_526': { typeId: 3, countRaw: 4, randomized: true, hpMultiplier: 3, ticks: 134, spawnX: 24, spawnY: 16 },
    '9_455': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 138, spawnX: 8, spawnY: 17 },
    '9_472': { typeId: 0, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '9_474': { typeId: 3, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 129, spawnX: 4, spawnY: 16 },
    '10_498': { typeId: 16, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 5, spawnY: 16 },
    '10_501': { typeId: 20, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '10_486': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '10_492': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 5, spawnY: 16 },
    '10_493': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 5, spawnY: 16 },
    '11_421': { typeId: 3, countRaw: 1, randomized: false, hpMultiplier: 12, ticks: 54, spawnX: 27, spawnY: 6 },
    '11_470': { typeId: 19, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '11_488': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '11_673': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '11_672': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '12_465': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 3, ticks: 137, spawnX: 4, spawnY: 17 },
    '12_308': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 5, ticks: 170, spawnX: 9, spawnY: 21 },
    '12_347': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_457': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_458': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_459': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_345': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_504': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '12_349': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 18 },
    '12_506': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
    '12_507': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 24, spawnY: 16 },
};

export function getOriginalGeneratorConfig(level: number, sensorIndex: number): OriginalGeneratorConfig | null {
    return ORIGINAL_GENERATOR_CONFIGS[`${level}_${sensorIndex}`] ?? null;
}
