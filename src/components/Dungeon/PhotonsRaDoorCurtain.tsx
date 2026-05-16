import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as Photons from 'photons2';

type PhotonsBundle = {
    root: THREE.Object3D;
    update: (elapsedTime: number, delta: number) => void;
    dispose: () => void;
};

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
