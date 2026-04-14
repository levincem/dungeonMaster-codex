declare module 'photons2' {
    type Vector2Ctor = new (x?: number, y?: number) => { x: number; y: number };
    type Vector3Ctor = new (x?: number, y?: number, z?: number) => { x: number; y: number; z: number };

    interface ParticleStateSample {
        size: { constructor: Vector2Ctor };
        acceleration: { constructor: Vector3Ctor };
    }

    interface ParticleStateStore {
        getState(index: number): ParticleStateSample;
    }

    interface ParticleOperatorHandle {
        addElements(elements: Array<[number, number]>): void;
        addElementsFromParameters(elements: unknown[]): void;
    }

    export class Atlas {
        constructor(texture: unknown, texturePath?: string);
        addFrameSet(length: number, x: number, y: number, width: number, height: number): void;
    }

    export class AnimatedSpriteRenderer {
        constructor(
            instanced: boolean,
            atlas: Atlas,
            interpolateAtlasFrames?: boolean,
            blending?: number,
            calculateBoundingSphereFromBox?: boolean,
            renderOrder?: number,
        );
        dispose(): void;
    }

    export class ParticleSystem {
        constructor(owner: unknown, particleSystemRenderer: AnimatedSpriteRenderer);
        init(maximumActiveParticles: number): void;
        getParticleStates(): ParticleStateStore;
        setEmitter(emitter: unknown): unknown;
        addParticleStateInitializer(initializer: unknown): unknown;
        addParticleStateOperator(operator: unknown): ParticleOperatorHandle;
        setSimulateInWorldSpace(simulateInWorldSpace: boolean): void;
        start(): void;
        pause(): void;
        update(currentTime?: number, timeDelta?: number): void;
    }

    export class ConstantParticleEmitter {
        constructor(emissionRate: number);
    }

    export class LifetimeInitializer {
        constructor(range: number, offset: number, uniformRange: number, uniformOffset: number, normalize: boolean);
    }

    export class BoxPositionInitializer {
        constructor(range: { x: number; y: number; z: number }, offset: { x: number; y: number; z: number });
    }

    export class SizeInitializer {
        constructor(generator: RandomGenerator);
    }

    export class RandomVelocityInitializer {
        constructor(
            directionRange: { x: number; y: number; z: number },
            directionOffset: { x: number; y: number; z: number },
            speedRange: number,
            speedOffset: number,
            normalizeDirection?: boolean,
        );
    }

    export class RandomGenerator {
        constructor(
            outType: Vector2Ctor | Vector3Ctor | number,
            range: unknown,
            offset: unknown,
            uniformRange: number,
            uniformOffset: number,
            normalize: boolean,
        );
    }

    export class OpacityInterpolatorOperator {}
    export class SizeInterpolatorOperator {
        constructor(relativeToInitialValue: boolean);
    }
    export class ColorInterpolatorOperator {
        constructor(relativeToInitialValue: boolean);
    }
    export class AccelerationOperator {
        constructor(generator: RandomGenerator);
    }
}
