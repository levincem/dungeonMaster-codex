import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as Photons from 'photons2';
import { sampleSpellVisualRange } from './spellVisualSeed';

function createProjectileSpriteTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        fallback.colorSpace = THREE.SRGBColorSpace;
        fallback.needsUpdate = true;
        return fallback;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.clip();

    const gradient = ctx.createRadialGradient(
        size * 0.48,
        size * 0.42,
        size * 0.08,
        size / 2,
        size / 2,
        size * 0.44,
    );
    for (const [offset, color] of stops) {
        gradient.addColorStop(offset, color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

function disposeObjectTree(root: THREE.Object3D) {
    root.traverse((child) => {
        const mesh = child as THREE.Mesh & {
            geometry?: { dispose?: () => void };
            material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
        };

        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material.dispose?.());
        } else {
            mesh.material?.dispose?.();
        }
    });
}

type PhotonsBundle = {
    root: THREE.Object3D;
    update: (elapsedTime: number, delta: number) => void;
    dispose: () => void;
};

type ProjectileVisualVariation = {
    baseScale: number;
    bobHeight: number;
    yawSwing: number;
    pitchSwing: number;
    rollSwing: number;
    phaseOffset: number;
    speed: number;
};

function resolveProjectileVisualVariation(seed = 0): ProjectileVisualVariation {
    return {
        baseScale: sampleSpellVisualRange(seed, 1, 0.97, 1.08),
        bobHeight: sampleSpellVisualRange(seed, 2, 0.008, 0.03),
        yawSwing: sampleSpellVisualRange(seed, 3, 0.04, 0.18),
        pitchSwing: sampleSpellVisualRange(seed, 4, 0.02, 0.14),
        rollSwing: sampleSpellVisualRange(seed, 5, 0.03, 0.16),
        phaseOffset: sampleSpellVisualRange(seed, 6, 0, Math.PI * 2),
        speed: sampleSpellVisualRange(seed, 7, 1.4, 2.7),
    };
}

function buildFireballBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, '#fff9d7'],
        [0.2, '#ffd36c'],
        [0.48, '#ff7b1f'],
        [0.78, '#7d1600'],
        [1, '#060000'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://fireball-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 48);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(140);

    const trailSampleState = trailSystem.getParticleStates().getState(0);
    const trailVector2Type = trailSampleState.size.constructor;
    const trailVector3Type = trailSampleState.acceleration.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(22));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.2, 0.16, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            trailVector2Type,
            new trailVector2Type(0.1, 0.1),
            new trailVector2Type(0.08, 0.08),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.08, 0.08, 0.08),
        new THREE.Vector3(-0.04, -0.04, -0.04),
    ));
    trailSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.7, 0.7, 0.7),
        new THREE.Vector3(-0.35, -0.25, -0.35),
        0.18,
        0.04,
        true,
    ));

    const trailOpacity = trailSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    trailOpacity.addElements([
        [0, 0],
        [0.95, 0.12],
        [0.5, 0.55],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[0.55, 0.55], 0],
        [[1, 1], 0.28],
        [[0.35, 0.35], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [[2.2, 1.85, 1.2], 0],
        [[2.1, 0.92, 0.2], 0.42],
        [[0.95, 0.16, 0.03], 0.82],
        [[0.22, 0.02, 0.01], 1],
    ]);

    trailSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            trailVector3Type,
            new trailVector3Type(0.16, 0.2, 0.16),
            new trailVector3Type(-0.08, 0.12, -0.08),
            0,
            0,
            false,
        ),
    ));
    trailSystem.setSimulateInWorldSpace(true);
    trailSystem.start();

    const auraRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 49);
    const auraSystem = new Photons.ParticleSystem(root, auraRenderer);
    auraSystem.init(72);

    const auraVector2Type = auraSystem.getParticleStates().getState(0).size.constructor;
    auraSystem.setEmitter(new Photons.ConstantParticleEmitter(12));
    auraSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.14, 0.1, 0, 0, false));
    auraSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            auraVector2Type,
            new auraVector2Type(0.18, 0.18),
            new auraVector2Type(0.14, 0.14),
            0,
            0,
            false,
        ),
    ));
    auraSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.04, 0.04, 0.04),
        new THREE.Vector3(-0.02, -0.02, -0.02),
    ));
    auraSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.22, 0.22, 0.22),
        new THREE.Vector3(-0.11, -0.11, -0.11),
        0.04,
        0.01,
        true,
    ));

    const auraOpacity = auraSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    auraOpacity.addElements([
        [0, 0],
        [0.85, 0.18],
        [0.45, 0.65],
        [0, 1],
    ]);

    const auraSize = auraSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    auraSize.addElementsFromParameters([
        [[0.65, 0.65], 0],
        [[1.12, 1.12], 0.38],
        [[0.72, 0.72], 1],
    ]);

    const auraColor = auraSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    auraColor.addElementsFromParameters([
        [[2.4, 2.2, 1.7], 0],
        [[2.3, 1.3, 0.42], 0.35],
        [[1.2, 0.26, 0.03], 0.85],
        [[0.28, 0.03, 0.01], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    const coreRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 32);
    const coreSystem = new Photons.ParticleSystem(root, coreRenderer);
    coreSystem.init(48);

    const coreSampleState = coreSystem.getParticleStates().getState(0);
    const coreVector2Type = coreSampleState.size.constructor;
    coreSystem.setEmitter(new Photons.ConstantParticleEmitter(18));
    coreSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.09, 0.04, 0, 0, false));
    coreSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            coreVector2Type,
            new coreVector2Type(0.22, 0.22),
            new coreVector2Type(0.12, 0.12),
            0,
            0,
            false,
        ),
    ));
    coreSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.025, 0.025, 0.025),
        new THREE.Vector3(-0.0125, -0.0125, -0.0125),
    ));
    coreSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.08, 0.08, 0.08),
        new THREE.Vector3(-0.04, -0.04, -0.04),
        0.015,
        0.005,
        true,
    ));

    const coreOpacity = coreSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    coreOpacity.addElements([
        [0, 0],
        [1, 0.12],
        [0.9, 0.55],
        [0, 1],
    ]);

    const coreSize = coreSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    coreSize.addElementsFromParameters([
        [[0.72, 0.72], 0],
        [[1.18, 1.18], 0.4],
        [[0.88, 0.88], 1],
    ]);

    const coreColor = coreSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    coreColor.addElementsFromParameters([
        [[2.8, 2.55, 2.2], 0],
        [[2.6, 1.95, 0.95], 0.28],
        [[2.2, 0.72, 0.12], 0.72],
        [[0.7, 0.08, 0.02], 1],
    ]);

    coreSystem.setSimulateInWorldSpace(false);
    coreSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            trailSystem.update(elapsedTime, delta);
            auraSystem.update(elapsedTime, delta);
            coreSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            trailSystem.pause();
            auraSystem.pause();
            coreSystem.pause();
            trailRenderer.dispose();
            auraRenderer.dispose();
            coreRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildPoisonBundle(effect: 'poison_bolt' | 'poison_cloud' | 'slime'): PhotonsBundle {
    const root = new THREE.Object3D();
    const isPoisonCloud = effect === 'poison_cloud';
    const isSlime = effect === 'slime';
    const atlasTexture = createProjectileSpriteTexture(isSlime
        ? [
            [0, '#f5ffcb'],
            [0.16, '#bdf06d'],
            [0.42, '#6ea13f'],
            [0.78, '#314b1d'],
            [1, '#0a1207'],
        ]
        : isPoisonCloud
            ? [
                [0, 'rgba(214,255,232,0.92)'],
                [0.22, 'rgba(76,240,156,0.84)'],
                [0.5, 'rgba(22,154,98,0.66)'],
                [0.82, 'rgba(10,74,48,0.12)'],
                [1, 'rgba(0,0,0,0)'],
            ]
            : [
                [0, 'rgba(208,255,228,0.94)'],
                [0.18, 'rgba(64,228,146,0.96)'],
                [0.45, 'rgba(18,148,92,0.82)'],
                [0.72, 'rgba(10,88,54,0.2)'],
                [0.9, 'rgba(10,88,54,0.05)'],
                [1, 'rgba(0,0,0,0)'],
            ]);
    const atlas = new Photons.Atlas(atlasTexture, `generated://${effect}-sprite`);
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const cloudScale = isPoisonCloud ? 1.58 : isSlime ? 1.02 : 1.14;
    const mistRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.NormalBlending, true, isPoisonCloud ? 64 : isSlime ? 44 : 40);
    const mistSystem = new Photons.ParticleSystem(root, mistRenderer);
    mistSystem.init(isPoisonCloud ? 120 : isSlime ? 112 : 104);

    const mistSampleState = mistSystem.getParticleStates().getState(0);
    const mistVector2Type = mistSampleState.size.constructor;
    const mistVector3Type = mistSampleState.acceleration.constructor;
    mistSystem.setEmitter(new Photons.ConstantParticleEmitter(isPoisonCloud ? 16 : isSlime ? 14 : 13));
    mistSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(isPoisonCloud ? 0.64 : isSlime ? 0.36 : 0.34, isPoisonCloud ? 0.24 : isSlime ? 0.16 : 0.14, 0, 0, false));
    mistSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            mistVector2Type,
            new mistVector2Type((isPoisonCloud ? 0.42 : 0.34) * cloudScale, (isPoisonCloud ? 0.42 : 0.34) * cloudScale),
            new mistVector2Type((isPoisonCloud ? 0.26 : 0.2) * cloudScale, (isPoisonCloud ? 0.26 : 0.2) * cloudScale),
            0,
            0,
            false,
        ),
    ));
    mistSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.1 * cloudScale, 0.1 * cloudScale, 0.1 * cloudScale),
        new THREE.Vector3(-0.05 * cloudScale, -0.05 * cloudScale, -0.05 * cloudScale),
    ));
    mistSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.1, 0.12, 0.1),
        new THREE.Vector3(-0.05, -0.02, -0.05),
        0.025,
        0.008,
        true,
    ));

    const mistOpacity = mistSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    mistOpacity.addElements([
        [0, 0],
        [isPoisonCloud ? 0.7 : 0.58, 0.12],
        [isPoisonCloud ? 0.58 : 0.46, isPoisonCloud ? 0.54 : 0.78],
        [0, 1],
    ]);

    const mistSize = mistSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    mistSize.addElementsFromParameters([
        [[isPoisonCloud ? 1.02 : 0.94, isPoisonCloud ? 1.02 : 0.94], 0],
        [[isPoisonCloud ? 1.72 : 1.5, isPoisonCloud ? 1.72 : 1.5], 0.42],
        [[isPoisonCloud ? 1.08 : 0.98, isPoisonCloud ? 1.08 : 0.98], 1],
    ]);

    const mistColor = mistSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    mistColor.addElementsFromParameters([
        [isPoisonCloud ? [0.26, 0.92, 0.56] : [0.18, 0.78, 0.42], 0],
        [isPoisonCloud ? [0.16, 0.64, 0.36] : [0.1, 0.5, 0.24], 0.46],
        [isPoisonCloud ? [0.08, 0.4, 0.2] : [0.05, 0.32, 0.16], 0.9],
        [isPoisonCloud ? [0.04, 0.24, 0.12] : [0.03, 0.2, 0.1], 1],
    ]);

    mistSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            mistVector3Type,
            new mistVector3Type(0.015, 0.018, 0.015),
            new mistVector3Type(-0.008, 0.002, -0.008),
            0,
            0,
            false,
        ),
    ));
    mistSystem.setSimulateInWorldSpace(false);
    mistSystem.start();

    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, isPoisonCloud ? THREE.AdditiveBlending : THREE.AdditiveBlending, true, isPoisonCloud ? 44 : isSlime ? 54 : 48);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(isPoisonCloud ? 56 : isSlime ? 140 : 132);

    const trailSampleState = trailSystem.getParticleStates().getState(0);
    const trailVector2Type = trailSampleState.size.constructor;
    const trailVector3Type = trailSampleState.acceleration.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(isPoisonCloud ? 7 : isSlime ? 22 : 20));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(isPoisonCloud ? 0.46 : isSlime ? 0.3 : 0.28, isPoisonCloud ? 0.18 : isSlime ? 0.16 : 0.14, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            trailVector2Type,
            new trailVector2Type((isPoisonCloud ? 0.2 : 0.24) * cloudScale, (isPoisonCloud ? 0.2 : 0.24) * cloudScale),
            new trailVector2Type((isPoisonCloud ? 0.12 : 0.14) * cloudScale, (isPoisonCloud ? 0.12 : 0.14) * cloudScale),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.12 * cloudScale, 0.12 * cloudScale, 0.12 * cloudScale),
        new THREE.Vector3(-0.06 * cloudScale, -0.06 * cloudScale, -0.06 * cloudScale),
    ));
    trailSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.22, 0.24, 0.22),
        new THREE.Vector3(-0.11, -0.05, -0.11),
        0.1,
        0.03,
        true,
    ));

    const trailOpacity = trailSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    trailOpacity.addElements([
        [0, 0],
        [0.42, 0.12],
        [0.34, isPoisonCloud ? 0.34 : 0.94],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[0.84, 0.84], 0],
        [[1.32, 1.32], 0.35],
        [[0.62, 0.62], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [isPoisonCloud ? [0.3, 1.5, 0.86] : [0.18, 1.12, 0.58], 0],
        [isPoisonCloud ? [0.14, 0.82, 0.44] : [0.08, 0.62, 0.3], 0.4],
        [isPoisonCloud ? [0.06, 0.42, 0.22] : [0.04, 0.34, 0.16], 0.88],
        [isPoisonCloud ? [0.02, 0.2, 0.1] : [0.02, 0.2, 0.09], 1],
    ]);

    trailSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            trailVector3Type,
            new trailVector3Type(0.06, 0.1, 0.06),
            new trailVector3Type(-0.03, 0.04, -0.03),
            0,
            0,
            false,
        ),
    ));
    trailSystem.setSimulateInWorldSpace(true);
    trailSystem.start();

    const auraRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 52);
    const auraSystem = new Photons.ParticleSystem(root, auraRenderer);
    auraSystem.init(isPoisonCloud ? 48 : 110);

    const auraVector2Type = auraSystem.getParticleStates().getState(0).size.constructor;
    auraSystem.setEmitter(new Photons.ConstantParticleEmitter(isPoisonCloud ? 6 : isSlime ? 14 : 12));
    auraSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(isPoisonCloud ? 0.18 : isSlime ? 0.2 : 0.18, 0.08, 0, 0, false));
    auraSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            auraVector2Type,
            new auraVector2Type(0.32 * cloudScale, 0.32 * cloudScale),
            new auraVector2Type(0.16 * cloudScale, 0.16 * cloudScale),
            0,
            0,
            false,
        ),
    ));
    auraSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.08 * cloudScale, 0.08 * cloudScale, 0.08 * cloudScale),
        new THREE.Vector3(-0.04 * cloudScale, -0.04 * cloudScale, -0.04 * cloudScale),
    ));
    auraSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.12, 0.12, 0.12),
        new THREE.Vector3(-0.06, -0.06, -0.06),
        0.03,
        0.01,
        true,
    ));

    const auraOpacity = auraSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    auraOpacity.addElements([
        [0, 0],
        [0.3, 0.15],
        [0.24, isPoisonCloud ? 0.18 : 0.9],
        [0, 1],
    ]);

    const auraSize = auraSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    auraSize.addElementsFromParameters([
        [[0.9, 0.9], 0],
        [[1.38, 1.38], 0.4],
        [[0.88, 0.88], 1],
    ]);

    const auraColor = auraSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    auraColor.addElementsFromParameters([
        [isPoisonCloud ? [0.18, 1.0, 0.54] : [0.14, 0.86, 0.38], 0],
        [isPoisonCloud ? [0.08, 0.56, 0.28] : [0.06, 0.5, 0.22], 0.42],
        [isPoisonCloud ? [0.03, 0.26, 0.13] : [0.03, 0.3, 0.13], 0.92],
        [isPoisonCloud ? [0.01, 0.1, 0.05] : [0.02, 0.18, 0.08], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    const coreRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 36);
    const coreSystem = new Photons.ParticleSystem(root, coreRenderer);
    coreSystem.init(isPoisonCloud ? 28 : 72);

    const coreVector2Type = coreSystem.getParticleStates().getState(0).size.constructor;
    coreSystem.setEmitter(new Photons.ConstantParticleEmitter(isPoisonCloud ? 4 : isSlime ? 10 : 9));
    coreSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(isPoisonCloud ? 0.12 : 0.16, 0.04, 0, 0, false));
    coreSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            coreVector2Type,
            new coreVector2Type(0.24 * cloudScale, 0.24 * cloudScale),
            new coreVector2Type(0.12 * cloudScale, 0.12 * cloudScale),
            0,
            0,
            false,
        ),
    ));
    coreSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.04, 0.04, 0.04),
        new THREE.Vector3(-0.02, -0.02, -0.02),
    ));
    coreSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.06, 0.06, 0.06),
        new THREE.Vector3(-0.03, -0.03, -0.03),
        0.012,
        0.004,
        true,
    ));

    const coreOpacity = coreSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    coreOpacity.addElements([
        [0, 0],
        [0.58, 0.1],
        [0.46, isPoisonCloud ? 0.14 : 0.78],
        [0, 1],
    ]);

    const coreSize = coreSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    coreSize.addElementsFromParameters([
        [[0.9, 0.9], 0],
        [[1.18, 1.18], 0.36],
        [[0.82, 0.82], 1],
    ]);

    const coreColor = coreSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    coreColor.addElementsFromParameters([
        [isPoisonCloud ? [0.36, 1.6, 0.92] : [0.24, 1.08, 0.56], 0],
        [isPoisonCloud ? [0.14, 0.78, 0.42] : [0.1, 0.58, 0.28], 0.3],
        [isPoisonCloud ? [0.04, 0.3, 0.15] : [0.04, 0.32, 0.15], 0.85],
        [isPoisonCloud ? [0.015, 0.12, 0.06] : [0.02, 0.18, 0.08], 1],
    ]);

    coreSystem.setSimulateInWorldSpace(false);
    coreSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            mistSystem.update(elapsedTime, delta);
            trailSystem.update(elapsedTime, delta);
            auraSystem.update(elapsedTime, delta);
            coreSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            mistSystem.pause();
            trailSystem.pause();
            auraSystem.pause();
            coreSystem.pause();
            mistRenderer.dispose();
            trailRenderer.dispose();
            auraRenderer.dispose();
            coreRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildDisruptBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, 'rgba(255,251,230,0.98)'],
        [0.18, 'rgba(255,239,164,0.78)'],
        [0.45, 'rgba(255,222,94,0.42)'],
        [0.82, 'rgba(112,86,12,0.14)'],
        [1, 'rgba(0,0,0,0)'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://disrupt-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 32);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(88);

    const trailSampleState = trailSystem.getParticleStates().getState(0);
    const trailVector2Type = trailSampleState.size.constructor;
    const trailVector3Type = trailSampleState.acceleration.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(10));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.16, 0.08, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            trailVector2Type,
            new trailVector2Type(0.12, 0.12),
            new trailVector2Type(0.08, 0.08),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.04, 0.04, 0.04),
        new THREE.Vector3(-0.02, -0.02, -0.02),
    ));
    trailSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.14, 0.14, 0.14),
        new THREE.Vector3(-0.07, -0.07, -0.07),
        0.05,
        0.015,
        true,
    ));

    const trailOpacity = trailSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    trailOpacity.addElements([
        [0, 0],
        [0.14, 0.16],
        [0.08, 0.72],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[0.7, 0.7], 0],
        [[1.1, 1.1], 0.42],
        [[0.55, 0.55], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [[2.6, 2.45, 1.55], 0],
        [[2.0, 1.76, 0.72], 0.4],
        [[0.82, 0.55, 0.16], 0.88],
        [[0.16, 0.08, 0.01], 1],
    ]);

    trailSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            trailVector3Type,
            new trailVector3Type(0.03, 0.03, 0.03),
            new trailVector3Type(-0.015, -0.015, -0.015),
            0,
            0,
            false,
        ),
    ));
    trailSystem.setSimulateInWorldSpace(true);
    trailSystem.start();

    const auraRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 24);
    const auraSystem = new Photons.ParticleSystem(root, auraRenderer);
    auraSystem.init(48);

    const auraVector2Type = auraSystem.getParticleStates().getState(0).size.constructor;
    auraSystem.setEmitter(new Photons.ConstantParticleEmitter(6));
    auraSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.14, 0.05, 0, 0, false));
    auraSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            auraVector2Type,
            new auraVector2Type(0.18, 0.18),
            new auraVector2Type(0.1, 0.1),
            0,
            0,
            false,
        ),
    ));
    auraSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.03, 0.03, 0.03),
        new THREE.Vector3(-0.015, -0.015, -0.015),
    ));
    auraSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.08, 0.08, 0.08),
        new THREE.Vector3(-0.04, -0.04, -0.04),
        0.02,
        0.008,
        true,
    ));

    const auraOpacity = auraSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    auraOpacity.addElements([
        [0, 0],
        [0.1, 0.18],
        [0.06, 0.7],
        [0, 1],
    ]);

    const auraSize = auraSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    auraSize.addElementsFromParameters([
        [[0.84, 0.84], 0],
        [[1.22, 1.22], 0.46],
        [[0.78, 0.78], 1],
    ]);

    const auraColor = auraSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    auraColor.addElementsFromParameters([
        [[2.15, 2.05, 1.25], 0],
        [[1.2, 1.0, 0.34], 0.5],
        [[0.42, 0.24, 0.04], 0.92],
        [[0.08, 0.03, 0.01], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            trailSystem.update(elapsedTime, delta);
            auraSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            trailSystem.pause();
            auraSystem.pause();
            trailRenderer.dispose();
            auraRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildLightningBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, '#f7feff'],
        [0.18, '#dbf9ff'],
        [0.46, '#8fe6ff'],
        [0.8, '#2d98c8'],
        [1, '#07121c'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://lightning-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const boltGroup = new THREE.Group();
    boltGroup.rotation.x = -0.12;
    root.add(boltGroup);

    const boltHaloMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#86dcff'),
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const boltCoreMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#e2f7ff'),
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const boltAccentMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#58c4ff'),
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const haloGeometry = new THREE.BoxGeometry(0.08, 0.1, 1.18);
    const spineGeometry = new THREE.BoxGeometry(0.05, 0.05, 1.02);
    const segmentGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.28);
    const branchGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.2);
    const tipGeometry = new THREE.BoxGeometry(0.055, 0.055, 0.14);

    const haloA = new THREE.Mesh(haloGeometry, boltHaloMaterial);
    const haloB = new THREE.Mesh(haloGeometry, boltHaloMaterial.clone());
    haloA.rotation.y = 0.08;
    haloA.rotation.z = 0.1;
    haloB.rotation.y = -0.08;
    haloB.rotation.z = -0.1;
    boltGroup.add(haloA, haloB);

    const coreSpine = new THREE.Mesh(spineGeometry, boltCoreMaterial.clone());
    coreSpine.scale.set(0.94, 1, 1.04);
    boltGroup.add(coreSpine);

    const segments = [
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial), baseX: -0.02, baseY: 0.03, baseZ: -0.4, phase: 0.0, amp: 0.009, yaw: 0.05, yawAmp: 0.018, roll: 0.14, rollAmp: 0.045 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: 0.018, baseY: -0.008, baseZ: -0.18, phase: 1.2, amp: 0.01, yaw: -0.06, yawAmp: 0.02, roll: -0.18, rollAmp: 0.05 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: -0.012, baseY: 0.012, baseZ: 0.04, phase: 2.1, amp: 0.009, yaw: 0.04, yawAmp: 0.018, roll: 0.12, rollAmp: 0.04 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: 0.02, baseY: -0.014, baseZ: 0.26, phase: 3.2, amp: 0.01, yaw: -0.05, yawAmp: 0.02, roll: -0.16, rollAmp: 0.05 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: -0.016, baseY: 0.026, baseZ: 0.46, phase: 4.1, amp: 0.009, yaw: 0.05, yawAmp: 0.018, roll: 0.14, rollAmp: 0.04 },
    ];

    for (const segment of segments) {
        segment.mesh.position.set(segment.baseX, segment.baseY, segment.baseZ);
        segment.mesh.rotation.y = segment.yaw;
        segment.mesh.rotation.z = segment.roll;
        boltGroup.add(segment.mesh);
    }

    const accentSegments = [
        { mesh: new THREE.Mesh(branchGeometry, boltAccentMaterial), baseX: -0.048, baseY: 0.046, baseZ: -0.22, phase: 0.8, amp: 0.009, yaw: -0.12, yawAmp: 0.028, roll: 0.36, rollAmp: 0.08, scale: 0.72 },
        { mesh: new THREE.Mesh(branchGeometry, boltAccentMaterial.clone()), baseX: 0.044, baseY: -0.028, baseZ: 0.02, phase: 2.0, amp: 0.01, yaw: 0.14, yawAmp: 0.03, roll: -0.42, rollAmp: 0.09, scale: 0.68 },
        { mesh: new THREE.Mesh(branchGeometry, boltAccentMaterial.clone()), baseX: -0.038, baseY: 0.02, baseZ: 0.3, phase: 3.4, amp: 0.008, yaw: -0.1, yawAmp: 0.026, roll: 0.32, rollAmp: 0.08, scale: 0.64 },
    ];

    for (const accent of accentSegments) {
        accent.mesh.scale.set(accent.scale, accent.scale, accent.scale);
        accent.mesh.position.set(accent.baseX, accent.baseY, accent.baseZ);
        accent.mesh.rotation.y = accent.yaw;
        accent.mesh.rotation.z = accent.roll;
        boltGroup.add(accent.mesh);
    }

    const tipFront = new THREE.Mesh(tipGeometry, boltCoreMaterial.clone());
    const tipBack = new THREE.Mesh(tipGeometry, boltAccentMaterial.clone());
    tipFront.position.set(0.018, 0.028, 0.62);
    tipBack.position.set(-0.024, -0.012, -0.58);
    tipFront.rotation.z = 0.12;
    tipBack.rotation.z = -0.1;
    boltGroup.add(tipFront, tipBack);

    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 44);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(120);

    const trailSampleState = trailSystem.getParticleStates().getState(0);
    const trailVector2Type = trailSampleState.size.constructor;
    const trailVector3Type = trailSampleState.acceleration.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(18));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.18, 0.08, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            trailVector2Type,
            new trailVector2Type(0.11, 0.08),
            new trailVector2Type(0.06, 0.04),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.05, 0.05, 0.05),
        new THREE.Vector3(-0.025, -0.025, -0.025),
    ));
    trailSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.3, 0.3, 0.3),
        new THREE.Vector3(-0.15, -0.15, -0.15),
        0.08,
        0.02,
        true,
    ));

    const trailOpacity = trailSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    trailOpacity.addElements([
        [0, 0],
        [0.32, 0.08],
        [0.18, 0.55],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[1.05, 0.55], 0],
        [[1.55, 0.72], 0.32],
        [[0.72, 0.28], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [[1.82, 2.38, 2.82], 0],
        [[0.88, 1.82, 2.5], 0.34],
        [[0.22, 0.82, 1.82], 0.86],
        [[0.03, 0.11, 0.24], 1],
    ]);

    trailSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            trailVector3Type,
            new trailVector3Type(0.04, 0.04, 0.04),
            new trailVector3Type(-0.02, -0.02, -0.02),
            0,
            0,
            false,
        ),
    ));
    trailSystem.setSimulateInWorldSpace(true);
    trailSystem.start();

    const auraRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 28);
    const auraSystem = new Photons.ParticleSystem(root, auraRenderer);
    auraSystem.init(64);

    const auraVector2Type = auraSystem.getParticleStates().getState(0).size.constructor;
    auraSystem.setEmitter(new Photons.ConstantParticleEmitter(10));
    auraSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.1, 0.04, 0, 0, false));
    auraSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            auraVector2Type,
            new auraVector2Type(0.22, 0.14),
            new auraVector2Type(0.12, 0.08),
            0,
            0,
            false,
        ),
    ));
    auraSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.03, 0.03, 0.03),
        new THREE.Vector3(-0.015, -0.015, -0.015),
    ));
    auraSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.12, 0.12, 0.12),
        new THREE.Vector3(-0.06, -0.06, -0.06),
        0.03,
        0.01,
        true,
    ));

    const auraOpacity = auraSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    auraOpacity.addElements([
        [0, 0],
        [0.4, 0.06],
        [0.2, 0.5],
        [0, 1],
    ]);

    const auraSize = auraSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    auraSize.addElementsFromParameters([
        [[1.08, 0.62], 0],
        [[1.48, 0.82], 0.4],
        [[0.86, 0.44], 1],
    ]);

    const auraColor = auraSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    auraColor.addElementsFromParameters([
        [[1.6, 2.22, 2.76], 0],
        [[0.76, 1.58, 2.34], 0.38],
        [[0.18, 0.64, 1.58], 0.9],
        [[0.03, 0.09, 0.22], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            const pulse = 1 + Math.sin(elapsedTime * 26) * 0.06;
            boltGroup.scale.set(0.98, 0.94 + Math.sin(elapsedTime * 31) * 0.04, 1.04 + (pulse - 1) * 1.3);
            boltGroup.rotation.x = -0.12 + Math.sin(elapsedTime * 12) * 0.016;
            coreSpine.scale.set(
                0.84 + Math.sin(elapsedTime * 18) * 0.04,
                0.92 + Math.cos(elapsedTime * 16) * 0.05,
                1.04 + Math.sin(elapsedTime * 24) * 0.06,
            );
            (coreSpine.material as THREE.MeshBasicMaterial).opacity = 0.72 + Math.sin(elapsedTime * 26) * 0.08;
            haloA.material.opacity = 0.1 + (Math.sin(elapsedTime * 20) * 0.03 + 0.03);
            (haloB.material as THREE.MeshBasicMaterial).opacity = 0.085 + (Math.sin(elapsedTime * 23 + 0.8) * 0.025 + 0.025);

            for (const segment of segments) {
                const wobble = Math.sin(elapsedTime * 32 + segment.phase);
                segment.mesh.position.x = segment.baseX + wobble * segment.amp;
                segment.mesh.position.y = segment.baseY + Math.cos(elapsedTime * 18 + segment.phase) * 0.012;
                segment.mesh.rotation.y = segment.yaw + wobble * segment.yawAmp;
                segment.mesh.rotation.z = segment.roll + wobble * segment.rollAmp;
            }

            for (const accent of accentSegments) {
                const wobble = Math.sin(elapsedTime * 28 + accent.phase);
                accent.mesh.position.x = accent.baseX + wobble * accent.amp;
                accent.mesh.position.y = accent.baseY + Math.cos(elapsedTime * 16 + accent.phase) * 0.014;
                accent.mesh.rotation.y = accent.yaw + wobble * accent.yawAmp;
                accent.mesh.rotation.z = accent.roll + wobble * accent.rollAmp;
            }

            tipFront.position.x = 0.018 + Math.sin(elapsedTime * 30) * 0.012;
            tipFront.position.y = 0.028 + Math.cos(elapsedTime * 22) * 0.008;
            tipBack.position.x = -0.024 + Math.sin(elapsedTime * 27 + 1.4) * 0.012;
            tipBack.position.y = -0.012 + Math.cos(elapsedTime * 18 + 0.7) * 0.008;
            trailSystem.update(elapsedTime, delta);
            auraSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            trailSystem.pause();
            auraSystem.pause();
            trailRenderer.dispose();
            auraRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildOpenDoorBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, '#fffbe3'],
        [0.2, '#ffe8a2'],
        [0.48, '#ffd163'],
        [0.82, '#6e4b0f'],
        [1, '#010508'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://open-door-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 40);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(88);

    const sampleState = trailSystem.getParticleStates().getState(0);
    const vector2Type = sampleState.size.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(14));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.18, 0.1, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            vector2Type,
            new vector2Type(0.12, 0.12),
            new vector2Type(0.08, 0.08),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.05, 0.05, 0.05),
        new THREE.Vector3(-0.025, -0.025, -0.025),
    ));
    trailSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.18, 0.18, 0.18),
        new THREE.Vector3(-0.09, -0.09, -0.09),
        0.035,
        0.008,
        true,
    ));

    const trailOpacity = trailSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    trailOpacity.addElements([
        [0, 0],
        [0.9, 0.18],
        [0.44, 0.62],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[0.58, 0.58], 0],
        [[1.04, 1.04], 0.4],
        [[0.42, 0.42], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [[2.8, 2.6, 1.55], 0],
        [[2.25, 1.8, 0.62], 0.38],
        [[0.95, 0.58, 0.12], 0.78],
        [[0.18, 0.1, 0.02], 1],
    ]);
    trailSystem.setSimulateInWorldSpace(true);
    trailSystem.start();

    const coreRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 28);
    const coreSystem = new Photons.ParticleSystem(root, coreRenderer);
    coreSystem.init(48);
    const coreVector2Type = coreSystem.getParticleStates().getState(0).size.constructor;
    coreSystem.setEmitter(new Photons.ConstantParticleEmitter(10));
    coreSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.12, 0.06, 0, 0, false));
    coreSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            coreVector2Type,
            new coreVector2Type(0.18, 0.18),
            new coreVector2Type(0.12, 0.12),
            0,
            0,
            false,
        ),
    ));
    coreSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.018, 0.018, 0.018),
        new THREE.Vector3(-0.009, -0.009, -0.009),
    ));
    coreSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.05, 0.05, 0.05),
        new THREE.Vector3(-0.025, -0.025, -0.025),
        0.008,
        0.003,
        true,
    ));

    const coreOpacity = coreSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    coreOpacity.addElements([
        [0, 0],
        [1, 0.12],
        [0.94, 0.52],
        [0, 1],
    ]);
    const coreSize = coreSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    coreSize.addElementsFromParameters([
        [[0.72, 0.72], 0],
        [[1.18, 1.18], 0.38],
        [[0.82, 0.82], 1],
    ]);
    const coreColor = coreSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    coreColor.addElementsFromParameters([
        [[3.0, 2.8, 2.0], 0],
        [[2.2, 1.85, 0.82], 0.42],
        [[1.05, 0.62, 0.16], 0.84],
        [[0.22, 0.12, 0.02], 1],
    ]);
    coreSystem.setSimulateInWorldSpace(false);
    coreSystem.start();

    const ringGeometry = new THREE.TorusGeometry(0.18, 0.025, 10, 28);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: '#fff2b2',
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
    const ringA = new THREE.Mesh(ringGeometry, ringMaterial);
    const ringB = new THREE.Mesh(ringGeometry, ringMaterial.clone());
    ringB.rotation.x = Math.PI / 2;
    root.add(ringA);
    root.add(ringB);

    return {
        root,
        update: (elapsedTime, delta) => {
            const wobble = Math.sin(elapsedTime * 7.5) * 0.08;
            ringA.rotation.z += delta * 1.65;
            ringA.rotation.y = wobble;
            ringB.rotation.y -= delta * 1.3;
            ringB.rotation.z = wobble * 0.8;
            const ringScale = 0.92 + Math.sin(elapsedTime * 8.5) * 0.08;
            ringA.scale.setScalar(ringScale);
            ringB.scale.setScalar(1.02 - Math.sin(elapsedTime * 7.2 + 0.8) * 0.06);
            trailSystem.update(elapsedTime, delta);
            coreSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            trailSystem.pause();
            coreSystem.pause();
            trailRenderer.dispose();
            coreRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildTeleporterBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, 'rgba(246,255,255,0.98)'],
        [0.16, 'rgba(188,244,255,0.92)'],
        [0.46, 'rgba(92,188,238,0.55)'],
        [0.8, 'rgba(20,66,126,0.18)'],
        [1, 'rgba(1,6,19,0)'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://teleporter-cloud-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const floorDiscGeometry = new THREE.CircleGeometry(0.42, 48);
    const floorDiscMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#66d9ff'),
        map: atlasTexture,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
    });
    const floorDisc = new THREE.Mesh(floorDiscGeometry, floorDiscMaterial);
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = -0.475;
    root.add(floorDisc);

    const veilGeometry = new THREE.PlaneGeometry(0.96, 0.34);
    const veilMaterial = new THREE.MeshBasicMaterial({
        map: atlasTexture,
        color: new THREE.Color('#8be6ff'),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
    });
    const veilAngles = [0, Math.PI / 3, (Math.PI * 2) / 3];
    const veils = veilAngles.map((angle, index) => {
        const veil = new THREE.Mesh(
            veilGeometry,
            index === 0 ? veilMaterial : veilMaterial.clone(),
        );
        veil.position.set(0, -0.32, 0);
        veil.rotation.y = angle;
        root.add(veil);
        return veil;
    });

    const mistRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.NormalBlending, true, 84);
    const mistSystem = new Photons.ParticleSystem(root, mistRenderer);
    mistSystem.init(260);

    const mistSampleState = mistSystem.getParticleStates().getState(0);
    const mistVector2Type = mistSampleState.size.constructor;
    const mistVector3Type = mistSampleState.acceleration.constructor;
    mistSystem.setEmitter(new Photons.ConstantParticleEmitter(34));
    mistSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.62, 0.22, 0, 0, false));
    mistSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            mistVector2Type,
            new mistVector2Type(0.4, 0.28),
            new mistVector2Type(0.2, 0.14),
            0,
            0,
            false,
        ),
    ));
    mistSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.4, 0.05, 0.4),
        new THREE.Vector3(-0.2, -0.48, -0.2),
    ));
    mistSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.08, 0.06, 0.08),
        new THREE.Vector3(-0.04, 0.01, -0.04),
        0.025,
        0.008,
        true,
    ));

    const mistOpacity = mistSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    mistOpacity.addElements([
        [0, 0],
        [0.22, 0.14],
        [0.16, 0.56],
        [0, 1],
    ]);

    const mistSize = mistSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    mistSize.addElementsFromParameters([
        [[0.82, 0.76], 0],
        [[1.28, 1.18], 0.44],
        [[1.12, 1.02], 1],
    ]);

    const mistColor = mistSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    mistColor.addElementsFromParameters([
        [[1.15, 2.05, 2.35], 0],
        [[0.64, 1.52, 2.0], 0.42],
        [[0.18, 0.64, 1.18], 0.88],
        [[0.04, 0.12, 0.28], 1],
    ]);

    mistSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            mistVector3Type,
            new mistVector3Type(0.015, 0.015, 0.015),
            new mistVector3Type(-0.0075, 0.002, -0.0075),
            0,
            0,
            false,
        ),
    ));
    mistSystem.setSimulateInWorldSpace(false);
    mistSystem.start();

    const accentRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 36);
    const accentSystem = new Photons.ParticleSystem(root, accentRenderer);
    accentSystem.init(92);

    const accentVector2Type = accentSystem.getParticleStates().getState(0).size.constructor;
    accentSystem.setEmitter(new Photons.ConstantParticleEmitter(9));
    accentSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.24, 0.1, 0, 0, false));
    accentSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            accentVector2Type,
            new accentVector2Type(0.1, 0.08),
            new accentVector2Type(0.05, 0.04),
            0,
            0,
            false,
        ),
    ));
    accentSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.24, 0.03, 0.24),
        new THREE.Vector3(-0.12, -0.44, -0.12),
    ));
    accentSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.1, 0.08, 0.1),
        new THREE.Vector3(-0.05, 0.02, -0.05),
        0.03,
        0.01,
        true,
    ));

    const accentOpacity = accentSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    accentOpacity.addElements([
        [0, 0],
        [0.22, 0.12],
        [0.1, 0.5],
        [0, 1],
    ]);

    const accentSize = accentSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    accentSize.addElementsFromParameters([
        [[0.72, 0.72], 0],
        [[1.05, 1.05], 0.32],
        [[0.46, 0.46], 1],
    ]);

    const accentColor = accentSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    accentColor.addElementsFromParameters([
        [[1.5, 2.4, 2.9], 0],
        [[0.7, 1.6, 2.25], 0.34],
        [[0.22, 0.82, 1.55], 0.9],
        [[0.04, 0.12, 0.3], 1],
    ]);

    accentSystem.setSimulateInWorldSpace(false);
    accentSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            floorDisc.material.opacity = 0.16 + (Math.sin(elapsedTime * 2.4) * 0.03 + 0.03);
            floorDisc.scale.setScalar(0.96 + Math.sin(elapsedTime * 2.8) * 0.05);
            veils.forEach((veil, index) => {
                veil.material.opacity = 0.16 + (Math.sin(elapsedTime * (1.7 + index * 0.23) + index) * 0.035 + 0.035);
                veil.position.y = -0.33 + Math.sin(elapsedTime * (1.35 + index * 0.18) + index * 1.7) * 0.02;
                veil.scale.setScalar(0.98 + Math.sin(elapsedTime * (1.1 + index * 0.14) + index * 0.9) * 0.05);
            });
            mistSystem.update(elapsedTime, delta);
            accentSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            mistSystem.pause();
            accentSystem.pause();
            mistRenderer.dispose();
            accentRenderer.dispose();
            floorDiscGeometry.dispose();
            floorDiscMaterial.dispose();
            veilGeometry.dispose();
            veilMaterial.dispose();
            veils.slice(1).forEach((veil) => veil.material.dispose());
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

function buildFluxcageBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, 'rgba(248,255,214,0.98)'],
        [0.18, 'rgba(188,255,124,0.94)'],
        [0.48, 'rgba(82,208,82,0.5)'],
        [0.82, 'rgba(18,72,26,0.14)'],
        [1, 'rgba(0,0,0,0)'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://fluxcage-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const driftRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 52);
    const driftSystem = new Photons.ParticleSystem(root, driftRenderer);
    driftSystem.init(132);

    const driftSampleState = driftSystem.getParticleStates().getState(0);
    const driftVector2Type = driftSampleState.size.constructor;
    const driftVector3Type = driftSampleState.acceleration.constructor;
    driftSystem.setEmitter(new Photons.ConstantParticleEmitter(14));
    driftSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.54, 0.18, 0, 0, false));
    driftSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            driftVector2Type,
            new driftVector2Type(0.08, 0.12),
            new driftVector2Type(0.04, 0.06),
            0,
            0,
            false,
        ),
    ));
    driftSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.2, 0.56, 0.2),
        new THREE.Vector3(-0.1, 0.02, -0.1),
    ));
    driftSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.08, 0.22, 0.08),
        new THREE.Vector3(-0.04, 0.04, -0.04),
        0.035,
        0.01,
        true,
    ));

    const driftOpacity = driftSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    driftOpacity.addElements([
        [0, 0],
        [0.32, 0.14],
        [0.26, 0.78],
        [0, 1],
    ]);

    const driftSize = driftSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    driftSize.addElementsFromParameters([
        [[0.74, 0.74], 0],
        [[1.2, 1.34], 0.42],
        [[0.42, 0.54], 1],
    ]);

    const driftColor = driftSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    driftColor.addElementsFromParameters([
        [[2.45, 2.85, 1.4], 0],
        [[1.15, 2.6, 0.72], 0.34],
        [[0.3, 1.12, 0.28], 0.84],
        [[0.04, 0.18, 0.05], 1],
    ]);

    driftSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            driftVector3Type,
            new driftVector3Type(0.02, 0.018, 0.02),
            new driftVector3Type(-0.01, 0.004, -0.01),
            0,
            0,
            false,
        ),
    ));
    driftSystem.setSimulateInWorldSpace(false);
    driftSystem.start();

    const sparkRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 36);
    const sparkSystem = new Photons.ParticleSystem(root, sparkRenderer);
    sparkSystem.init(88);

    const sparkVector2Type = sparkSystem.getParticleStates().getState(0).size.constructor;
    const sparkVector3Type = sparkSystem.getParticleStates().getState(0).acceleration.constructor;
    sparkSystem.setEmitter(new Photons.ConstantParticleEmitter(8));
    sparkSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.22, 0.08, 0, 0, false));
    sparkSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            sparkVector2Type,
            new sparkVector2Type(0.06, 0.08),
            new sparkVector2Type(0.03, 0.04),
            0,
            0,
            false,
        ),
    ));
    sparkSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.32, 0.5, 0.32),
        new THREE.Vector3(-0.16, 0.08, -0.16),
    ));
    sparkSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.22, 0.08, 0.22),
        new THREE.Vector3(-0.11, -0.03, -0.11),
        0.055,
        0.016,
        true,
    ));

    const sparkOpacity = sparkSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    sparkOpacity.addElements([
        [0, 0],
        [0.8, 0.1],
        [0.36, 0.42],
        [0, 1],
    ]);

    const sparkSize = sparkSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    sparkSize.addElementsFromParameters([
        [[0.78, 0.78], 0],
        [[1.18, 1.08], 0.32],
        [[0.46, 0.42], 1],
    ]);

    const sparkColor = sparkSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    sparkColor.addElementsFromParameters([
        [[2.8, 3.1, 1.3], 0],
        [[1.3, 2.8, 0.82], 0.28],
        [[0.36, 1.42, 0.32], 0.82],
        [[0.04, 0.2, 0.06], 1],
    ]);

    sparkSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            sparkVector3Type,
            new sparkVector3Type(0.04, 0.02, 0.04),
            new sparkVector3Type(-0.02, -0.01, -0.02),
            0,
            0,
            false,
        ),
    ));
    sparkSystem.setSimulateInWorldSpace(false);
    sparkSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            root.rotation.y += delta * 0.38;
            root.position.y = -0.02 + Math.sin(elapsedTime * 1.9) * 0.012;
            driftSystem.update(elapsedTime, delta);
            sparkSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            driftSystem.pause();
            sparkSystem.pause();
            driftRenderer.dispose();
            sparkRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

export const PhotonsFireball: React.FC<{ scale?: number; seed?: number }> = ({ scale = 1, seed = 0 }) => {
    const bundle = useMemo(() => buildFireballBundle(), []);
    const variation = useMemo(() => resolveProjectileVisualVariation(seed), [seed]);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
        if (groupRef.current) {
            const phase = (state.clock.elapsedTime * variation.speed) + variation.phaseOffset;
            groupRef.current.position.y = Math.sin(phase * 1.4) * variation.bobHeight;
            groupRef.current.rotation.y = Math.sin(phase) * variation.yawSwing;
            groupRef.current.rotation.z = Math.cos(phase * 1.15) * variation.rollSwing;
        }
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale * variation.baseScale);
    }, [bundle, scale, variation.baseScale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group ref={(node) => { groupRef.current = node; }}>
            <primitive object={bundle.root} />
        </group>
    );
};

export const PhotonsPoisonProjectile: React.FC<{ effect: 'poison_bolt' | 'poison_cloud' | 'slime'; scale?: number; seed?: number }> = ({ effect, scale = 1, seed = 0 }) => {
    const bundle = useMemo(() => buildPoisonBundle(effect), [effect]);
    const variation = useMemo(() => resolveProjectileVisualVariation(seed), [seed]);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
        if (groupRef.current) {
            const phase = (state.clock.elapsedTime * variation.speed) + variation.phaseOffset;
            groupRef.current.position.y = Math.sin(phase * 1.25) * variation.bobHeight;
            groupRef.current.rotation.y = Math.sin(phase) * variation.yawSwing;
            groupRef.current.rotation.x = Math.cos(phase * 1.1) * variation.pitchSwing;
        }
    });

    useEffect(() => {
        const effectScale = effect === 'poison_cloud' ? 1.28 : effect === 'slime' ? 1.04 : 1.08;
        bundle.root.scale.setScalar(scale * effectScale * variation.baseScale);
    }, [bundle, effect, scale, variation.baseScale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group ref={(node) => { groupRef.current = node; }}>
            <primitive object={bundle.root} />
        </group>
    );
};

export const PhotonsDisruptProjectile: React.FC<{ scale?: number; seed?: number }> = ({ scale = 1, seed = 0 }) => {
    const bundle = useMemo(() => buildDisruptBundle(), []);
    const variation = useMemo(() => resolveProjectileVisualVariation(seed), [seed]);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
        if (groupRef.current) {
            const phase = (state.clock.elapsedTime * variation.speed) + variation.phaseOffset;
            groupRef.current.position.y = Math.sin(phase * 1.55) * (variation.bobHeight * 0.8);
            groupRef.current.rotation.y = Math.sin(phase * 0.8) * variation.yawSwing;
            groupRef.current.rotation.z = Math.cos(phase * 1.2) * (variation.rollSwing * 0.8);
        }
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale * variation.baseScale);
    }, [bundle, scale, variation.baseScale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group ref={(node) => { groupRef.current = node; }}>
            <primitive object={bundle.root} />
        </group>
    );
};

export const PhotonsLightningProjectile: React.FC<{ scale?: number; directionRotation?: number; seed?: number }> = ({
    scale = 1,
    directionRotation = 0,
    seed = 0,
}) => {
    const bundle = useMemo(() => buildLightningBundle(), []);
    const variation = useMemo(() => resolveProjectileVisualVariation(seed), [seed]);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
        if (groupRef.current) {
            const phase = (state.clock.elapsedTime * variation.speed) + variation.phaseOffset;
            groupRef.current.position.y = Math.sin(phase * 1.6) * (variation.bobHeight * 0.55);
            groupRef.current.rotation.x = -0.08 + Math.sin(phase * 1.2) * 0.02;
            groupRef.current.rotation.z = Math.cos(phase * 1.25) * (variation.rollSwing * 0.65);
        }
    });

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group rotation={[0, directionRotation, 0]} scale={[scale * variation.baseScale, scale * variation.baseScale, scale * variation.baseScale]}>
            <group ref={(node) => { groupRef.current = node; }}>
                <primitive object={bundle.root} />
            </group>
        </group>
    );
};

export const PhotonsOpenDoorProjectile: React.FC<{ scale?: number; seed?: number }> = ({ scale = 1, seed = 0 }) => {
    const bundle = useMemo(() => buildOpenDoorBundle(), []);
    const variation = useMemo(() => resolveProjectileVisualVariation(seed), [seed]);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
        if (groupRef.current) {
            const phase = (state.clock.elapsedTime * variation.speed) + variation.phaseOffset;
            groupRef.current.position.y = Math.sin(phase * 1.22) * (variation.bobHeight * 0.72);
            groupRef.current.rotation.y = Math.sin(phase) * (variation.yawSwing * 0.75);
            groupRef.current.rotation.z = Math.cos(phase * 1.18) * (variation.rollSwing * 0.7);
        }
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale * 0.88 * variation.baseScale);
    }, [bundle, scale, variation.baseScale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group ref={(node) => { groupRef.current = node; }}>
            <primitive object={bundle.root} />
        </group>
    );
};

export const PhotonsTeleporterCloud: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
    const bundle = useMemo(() => buildTeleporterBundle(), []);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale);
    }, [bundle, scale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return <primitive object={bundle.root} />;
};

export const PhotonsFluxcageParticles: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
    const bundle = useMemo(() => buildFluxcageBundle(), []);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale);
    }, [bundle, scale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return <primitive object={bundle.root} />;
};
