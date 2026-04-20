import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as Photons from 'photons2';

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
    const atlasTexture = createProjectileSpriteTexture(effect === 'slime'
        ? [
            [0, '#f5ffcb'],
            [0.16, '#bdf06d'],
            [0.42, '#6ea13f'],
            [0.78, '#314b1d'],
            [1, '#0a1207'],
        ]
        : [
            [0, '#e8ffe0'],
            [0.18, '#9cff72'],
            [0.45, '#42b93c'],
            [0.8, '#103d10'],
            [1, '#020902'],
        ]);
    const atlas = new Photons.Atlas(atlasTexture, `generated://${effect}-sprite`);
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const cloudScale = effect === 'poison_cloud' ? 1.22 : effect === 'slime' ? 0.98 : 0.92;
    const trailRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, effect === 'poison_cloud' ? 56 : effect === 'slime' ? 46 : 40);
    const trailSystem = new Photons.ParticleSystem(root, trailRenderer);
    trailSystem.init(effect === 'poison_cloud' ? 144 : effect === 'slime' ? 116 : 104);

    const trailSampleState = trailSystem.getParticleStates().getState(0);
    const trailVector2Type = trailSampleState.size.constructor;
    const trailVector3Type = trailSampleState.acceleration.constructor;
    trailSystem.setEmitter(new Photons.ConstantParticleEmitter(effect === 'poison_cloud' ? 24 : effect === 'slime' ? 18 : 15));
    trailSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(effect === 'poison_cloud' ? 0.32 : effect === 'slime' ? 0.26 : 0.22, effect === 'poison_cloud' ? 0.18 : effect === 'slime' ? 0.14 : 0.12, 0, 0, false));
    trailSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            trailVector2Type,
            new trailVector2Type(0.16 * cloudScale, 0.16 * cloudScale),
            new trailVector2Type(0.1 * cloudScale, 0.1 * cloudScale),
            0,
            0,
            false,
        ),
    ));
    trailSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.08 * cloudScale, 0.08 * cloudScale, 0.08 * cloudScale),
        new THREE.Vector3(-0.04 * cloudScale, -0.04 * cloudScale, -0.04 * cloudScale),
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
        [0.22, 0.12],
        [0.18, 0.74],
        [0, 1],
    ]);

    const trailSize = trailSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    trailSize.addElementsFromParameters([
        [[0.72, 0.72], 0],
        [[1.15, 1.15], 0.35],
        [[0.48, 0.48], 1],
    ]);

    const trailColor = trailSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    trailColor.addElementsFromParameters([
        [[1.1, 2.4, 0.8], 0],
        [[0.45, 1.4, 0.35], 0.4],
        [[0.12, 0.48, 0.11], 0.88],
        [[0.02, 0.12, 0.03], 1],
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

    const auraRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 42);
    const auraSystem = new Photons.ParticleSystem(root, auraRenderer);
    auraSystem.init(84);

    const auraVector2Type = auraSystem.getParticleStates().getState(0).size.constructor;
    auraSystem.setEmitter(new Photons.ConstantParticleEmitter(effect === 'poison_cloud' ? 14 : effect === 'slime' ? 11 : 10));
    auraSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(effect === 'poison_cloud' ? 0.2 : effect === 'slime' ? 0.18 : 0.16, 0.08, 0, 0, false));
    auraSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            auraVector2Type,
            new auraVector2Type(0.24 * cloudScale, 0.24 * cloudScale),
            new auraVector2Type(0.12 * cloudScale, 0.12 * cloudScale),
            0,
            0,
            false,
        ),
    ));
    auraSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.05 * cloudScale, 0.05 * cloudScale, 0.05 * cloudScale),
        new THREE.Vector3(-0.025 * cloudScale, -0.025 * cloudScale, -0.025 * cloudScale),
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
        [0.18, 0.15],
        [0.14, 0.7],
        [0, 1],
    ]);

    const auraSize = auraSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    auraSize.addElementsFromParameters([
        [[0.8, 0.8], 0],
        [[1.26, 1.26], 0.4],
        [[0.74, 0.74], 1],
    ]);

    const auraColor = auraSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    auraColor.addElementsFromParameters([
        [[1.2, 2.8, 1.0], 0],
        [[0.52, 1.55, 0.42], 0.42],
        [[0.1, 0.38, 0.12], 0.92],
        [[0.02, 0.1, 0.04], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    const coreRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 28);
    const coreSystem = new Photons.ParticleSystem(root, coreRenderer);
    coreSystem.init(52);

    const coreVector2Type = coreSystem.getParticleStates().getState(0).size.constructor;
    coreSystem.setEmitter(new Photons.ConstantParticleEmitter(effect === 'poison_cloud' ? 10 : effect === 'slime' ? 9 : 8));
    coreSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.11, 0.04, 0, 0, false));
    coreSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            coreVector2Type,
            new coreVector2Type(0.18 * cloudScale, 0.18 * cloudScale),
            new coreVector2Type(0.09 * cloudScale, 0.09 * cloudScale),
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
        new THREE.Vector3(0.06, 0.06, 0.06),
        new THREE.Vector3(-0.03, -0.03, -0.03),
        0.012,
        0.004,
        true,
    ));

    const coreOpacity = coreSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    coreOpacity.addElements([
        [0, 0],
        [0.4, 0.1],
        [0.32, 0.58],
        [0, 1],
    ]);

    const coreSize = coreSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    coreSize.addElementsFromParameters([
        [[0.8, 0.8], 0],
        [[1.08, 1.08], 0.36],
        [[0.72, 0.72], 1],
    ]);

    const coreColor = coreSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    coreColor.addElementsFromParameters([
        [[1.8, 2.9, 1.35], 0],
        [[0.9, 2.0, 0.55], 0.3],
        [[0.2, 0.7, 0.16], 0.85],
        [[0.03, 0.14, 0.05], 1],
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

function buildDisruptBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, 'rgba(255,255,255,0.95)'],
        [0.18, 'rgba(206,255,255,0.7)'],
        [0.45, 'rgba(112,220,255,0.38)'],
        [0.82, 'rgba(38,76,116,0.12)'],
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
        [[1.5, 2.2, 2.5], 0],
        [[0.82, 1.55, 1.82], 0.4],
        [[0.24, 0.52, 0.72], 0.88],
        [[0.02, 0.08, 0.14], 1],
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
        [[1.1, 1.95, 2.2], 0],
        [[0.45, 1.0, 1.25], 0.5],
        [[0.08, 0.24, 0.38], 0.92],
        [[0.01, 0.04, 0.08], 1],
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
        [0, '#ffffff'],
        [0.16, '#dff8ff'],
        [0.42, '#8fd7ff'],
        [0.78, '#215ba8'],
        [1, '#010612'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://lightning-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const boltGroup = new THREE.Group();
    root.add(boltGroup);

    const boltHaloMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#7fd4ff'),
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const boltCoreMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#f2fbff'),
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const boltAccentMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#4da6ff'),
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const haloGeometry = new THREE.BoxGeometry(0.18, 0.16, 1.02);
    const segmentGeometry = new THREE.BoxGeometry(0.085, 0.085, 0.48);
    const tipGeometry = new THREE.BoxGeometry(0.065, 0.065, 0.18);

    const haloA = new THREE.Mesh(haloGeometry, boltHaloMaterial);
    const haloB = new THREE.Mesh(haloGeometry, boltHaloMaterial.clone());
    haloA.rotation.y = 0.24;
    haloB.rotation.y = -0.24;
    boltGroup.add(haloA, haloB);

    const segments = [
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial), baseX: -0.135, baseY: 0.016, baseZ: -0.29, phase: 0.0, amp: 0.016, yaw: 0.82, yawAmp: 0.08 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: 0.02, baseY: -0.008, baseZ: -0.01, phase: 1.6, amp: 0.018, yaw: -0.88, yawAmp: 0.09 },
        { mesh: new THREE.Mesh(segmentGeometry, boltCoreMaterial.clone()), baseX: 0.145, baseY: 0.012, baseZ: 0.27, phase: 3.1, amp: 0.016, yaw: 0.84, yawAmp: 0.08 },
    ];

    for (const segment of segments) {
        segment.mesh.position.set(segment.baseX, segment.baseY, segment.baseZ);
        segment.mesh.rotation.y = segment.yaw;
        boltGroup.add(segment.mesh);
    }

    const accentSegments = [
        { mesh: new THREE.Mesh(segmentGeometry, boltAccentMaterial), baseX: -0.072, baseY: 0.03, baseZ: -0.13, phase: 0.9, amp: 0.013, yaw: -0.62, yawAmp: 0.07, scale: 0.7 },
        { mesh: new THREE.Mesh(segmentGeometry, boltAccentMaterial.clone()), baseX: 0.086, baseY: -0.022, baseZ: 0.13, phase: 2.3, amp: 0.013, yaw: 0.66, yawAmp: 0.07, scale: 0.66 },
    ];

    for (const accent of accentSegments) {
        accent.mesh.scale.set(accent.scale, accent.scale, accent.scale);
        accent.mesh.position.set(accent.baseX, accent.baseY, accent.baseZ);
        accent.mesh.rotation.y = accent.yaw;
        boltGroup.add(accent.mesh);
    }

    const tipFront = new THREE.Mesh(tipGeometry, boltCoreMaterial.clone());
    const tipBack = new THREE.Mesh(tipGeometry, boltAccentMaterial.clone());
    tipFront.position.set(0.155, 0.004, 0.45);
    tipBack.position.set(-0.155, 0.004, -0.45);
    tipFront.rotation.y = 0.74;
    tipBack.rotation.y = 0.74;
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
        [[2.4, 2.8, 3.0], 0],
        [[1.3, 2.0, 2.7], 0.36],
        [[0.35, 0.7, 1.5], 0.88],
        [[0.03, 0.08, 0.2], 1],
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
        [[2.0, 2.6, 3.0], 0],
        [[0.95, 1.8, 2.5], 0.4],
        [[0.22, 0.55, 1.25], 0.92],
        [[0.03, 0.06, 0.18], 1],
    ]);

    auraSystem.setSimulateInWorldSpace(false);
    auraSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            root.visible = true;
            const pulse = 1 + Math.sin(elapsedTime * 26) * 0.06;
            boltGroup.scale.set(1.02, 0.95 + Math.sin(elapsedTime * 31) * 0.04, pulse);
            haloA.material.opacity = 0.09 + (Math.sin(elapsedTime * 20) * 0.03 + 0.03);
            (haloB.material as THREE.MeshBasicMaterial).opacity = 0.075 + (Math.sin(elapsedTime * 23 + 0.8) * 0.025 + 0.025);

            for (const segment of segments) {
                const wobble = Math.sin(elapsedTime * 32 + segment.phase);
                segment.mesh.position.x = segment.baseX + wobble * segment.amp;
                segment.mesh.position.y = segment.baseY + Math.cos(elapsedTime * 18 + segment.phase) * 0.01;
                segment.mesh.rotation.y = segment.yaw + wobble * segment.yawAmp;
                segment.mesh.rotation.z = wobble * 0.04;
            }

            for (const accent of accentSegments) {
                const wobble = Math.sin(elapsedTime * 28 + accent.phase);
                accent.mesh.position.x = accent.baseX + wobble * accent.amp;
                accent.mesh.position.y = accent.baseY + Math.cos(elapsedTime * 16 + accent.phase) * 0.012;
                accent.mesh.rotation.y = accent.yaw + wobble * accent.yawAmp;
                accent.mesh.rotation.z = wobble * 0.035;
            }

            tipFront.position.x = 0.155 + Math.sin(elapsedTime * 30) * 0.018;
            tipFront.position.y = 0.004 + Math.cos(elapsedTime * 22) * 0.006;
            tipBack.position.x = -0.155 + Math.sin(elapsedTime * 27 + 1.4) * 0.016;
            tipBack.position.y = 0.004 + Math.cos(elapsedTime * 18 + 0.7) * 0.006;
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
        [0, '#fff7cf'],
        [0.2, '#d9ffff'],
        [0.48, '#7fefff'],
        [0.82, '#0d5f78'],
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
        [[2.4, 2.35, 1.75], 0],
        [[1.05, 2.1, 2.15], 0.38],
        [[0.22, 0.92, 1.05], 0.78],
        [[0.02, 0.18, 0.26], 1],
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
        [[2.8, 2.6, 2.1], 0],
        [[1.4, 2.45, 2.6], 0.42],
        [[0.4, 0.98, 1.2], 0.84],
        [[0.03, 0.2, 0.3], 1],
    ]);
    coreSystem.setSimulateInWorldSpace(false);
    coreSystem.start();

    const ringGeometry = new THREE.TorusGeometry(0.18, 0.025, 10, 28);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: '#b9ffff',
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

function buildRaDoorCurtainBundle(): PhotonsBundle {
    const root = new THREE.Object3D();
    const atlasTexture = createProjectileSpriteTexture([
        [0, '#ffffff'],
        [0.16, '#d9fbff'],
        [0.42, '#7cecff'],
        [0.72, '#1d8dff'],
        [1, '#02050d'],
    ]);
    const atlas = new Photons.Atlas(atlasTexture, 'generated://ra-door-curtain-sprite');
    atlas.addFrameSet(1, 0, 0, 1, 1);

    const veilRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 44);
    const veilSystem = new Photons.ParticleSystem(root, veilRenderer);
    veilSystem.init(180);

    const veilSampleState = veilSystem.getParticleStates().getState(0);
    const veilVector2Type = veilSampleState.size.constructor;
    const veilVector3Type = veilSampleState.acceleration.constructor;
    veilSystem.setEmitter(new Photons.ConstantParticleEmitter(34));
    veilSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.42, 0.18, 0, 0, false));
    veilSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            veilVector2Type,
            new veilVector2Type(0.18, 0.44),
            new veilVector2Type(0.08, 0.2),
            0,
            0,
            false,
        ),
    ));
    veilSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.38, 0.82, 0.035),
        new THREE.Vector3(-0.19, -0.41, -0.0175),
    ));
    veilSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.16, 0.6, 0.08),
        new THREE.Vector3(-0.08, 0.22, -0.04),
        0.08,
        0.02,
        true,
    ));

    const veilOpacity = veilSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    veilOpacity.addElements([
        [0, 0],
        [0.16, 0.08],
        [0.28, 0.55],
        [0.22, 1],
    ]);

    const veilSize = veilSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    veilSize.addElementsFromParameters([
        [[0.85, 0.85], 0],
        [[1.2, 1.08], 0.46],
        [[0.72, 0.9], 1],
    ]);

    const veilColor = veilSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    veilColor.addElementsFromParameters([
        [[1.85, 2.55, 3.2], 0],
        [[0.95, 2.1, 3.15], 0.34],
        [[0.24, 0.92, 2.35], 0.8],
        [[0.02, 0.08, 0.22], 1],
    ]);

    veilSystem.addParticleStateOperator(new Photons.AccelerationOperator(
        new Photons.RandomGenerator(
            veilVector3Type,
            new veilVector3Type(0.06, 0.18, 0.04),
            new veilVector3Type(-0.03, -0.08, -0.02),
            0,
            0,
            false,
        ),
    ));
    veilSystem.setSimulateInWorldSpace(false);
    veilSystem.start();

    const sparkRenderer = new Photons.AnimatedSpriteRenderer(true, atlas, true, THREE.AdditiveBlending, true, 45);
    const sparkSystem = new Photons.ParticleSystem(root, sparkRenderer);
    sparkSystem.init(72);

    const sparkVector2Type = sparkSystem.getParticleStates().getState(0).size.constructor;
    sparkSystem.setEmitter(new Photons.ConstantParticleEmitter(12));
    sparkSystem.addParticleStateInitializer(new Photons.LifetimeInitializer(0.14, 0.05, 0, 0, false));
    sparkSystem.addParticleStateInitializer(new Photons.SizeInitializer(
        new Photons.RandomGenerator(
            sparkVector2Type,
            new sparkVector2Type(0.1, 0.18),
            new sparkVector2Type(0.04, 0.08),
            0,
            0,
            false,
        ),
    ));
    sparkSystem.addParticleStateInitializer(new Photons.BoxPositionInitializer(
        new THREE.Vector3(0.4, 0.8, 0.025),
        new THREE.Vector3(-0.2, -0.4, -0.0125),
    ));
    sparkSystem.addParticleStateInitializer(new Photons.RandomVelocityInitializer(
        new THREE.Vector3(0.6, 0.6, 0.3),
        new THREE.Vector3(-0.3, -0.05, -0.15),
        0.09,
        0.03,
        true,
    ));

    const sparkOpacity = sparkSystem.addParticleStateOperator(new Photons.OpacityInterpolatorOperator());
    sparkOpacity.addElements([
        [0, 0],
        [0.75, 0.12],
        [0.36, 0.48],
        [0, 1],
    ]);

    const sparkSize = sparkSystem.addParticleStateOperator(new Photons.SizeInterpolatorOperator(true));
    sparkSize.addElementsFromParameters([
        [[0.72, 0.72], 0],
        [[1.16, 1.04], 0.32],
        [[0.55, 0.6], 1],
    ]);

    const sparkColor = sparkSystem.addParticleStateOperator(new Photons.ColorInterpolatorOperator(true));
    sparkColor.addElementsFromParameters([
        [[2.8, 2.75, 2.2], 0],
        [[1.25, 2.4, 2.8], 0.28],
        [[0.36, 1.1, 2.0], 0.82],
        [[0.02, 0.08, 0.18], 1],
    ]);

    sparkSystem.setSimulateInWorldSpace(false);
    sparkSystem.start();

    root.visible = true;

    return {
        root,
        update: (elapsedTime, delta) => {
            veilSystem.update(elapsedTime, delta);
            sparkSystem.update(elapsedTime, delta);
        },
        dispose: () => {
            veilSystem.pause();
            sparkSystem.pause();
            veilRenderer.dispose();
            sparkRenderer.dispose();
            disposeObjectTree(root);
            atlasTexture.dispose();
            root.removeFromParent();
            root.clear();
        },
    };
}

export const PhotonsFireball: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
    const bundle = useMemo(() => buildFireballBundle(), []);

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

export const PhotonsPoisonProjectile: React.FC<{ effect: 'poison_bolt' | 'poison_cloud' | 'slime'; scale?: number }> = ({ effect, scale = 1 }) => {
    const bundle = useMemo(() => buildPoisonBundle(effect), [effect]);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => {
        const effectScale = effect === 'poison_cloud' ? 1.08 : effect === 'slime' ? 0.96 : 0.92;
        bundle.root.scale.setScalar(scale * effectScale);
    }, [bundle, effect, scale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return <primitive object={bundle.root} />;
};

export const PhotonsDisruptProjectile: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
    const bundle = useMemo(() => buildDisruptBundle(), []);

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

export const PhotonsLightningProjectile: React.FC<{ scale?: number; directionRotation?: number }> = ({
    scale = 1,
    directionRotation = 0,
}) => {
    const bundle = useMemo(() => buildLightningBundle(), []);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return (
        <group rotation={[0, directionRotation, 0]} scale={[scale, scale, scale]}>
            <primitive object={bundle.root} />
        </group>
    );
};

export const PhotonsOpenDoorProjectile: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
    const bundle = useMemo(() => buildOpenDoorBundle(), []);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => {
        bundle.root.scale.setScalar(scale * 0.88);
    }, [bundle, scale]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return <primitive object={bundle.root} />;
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

export const PhotonsRaDoorCurtain: React.FC<{ scaleX?: number; scaleY?: number; scaleZ?: number }> = ({
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
}) => {
    const bundle = useMemo(() => buildRaDoorCurtainBundle(), []);

    useFrame((state, delta) => {
        bundle.update(state.clock.elapsedTime, delta);
    });

    useEffect(() => {
        bundle.root.scale.set(scaleX, scaleY, scaleZ);
    }, [bundle, scaleX, scaleY, scaleZ]);

    useEffect(() => () => {
        bundle.dispose();
    }, [bundle]);

    return <primitive object={bundle.root} />;
};
