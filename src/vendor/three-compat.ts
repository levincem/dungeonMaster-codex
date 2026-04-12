// @ts-expect-error Local compat layer imports the concrete Three ESM bundle on purpose.
import * as THREE from '../../node_modules/three/build/three.module.js';

class Clock {
    autoStart: boolean;
    startTime: number;
    oldTime: number;
    elapsedTime: number;
    running: boolean;

    constructor(autoStart = true) {
        this.autoStart = autoStart;
        this.startTime = 0;
        this.oldTime = 0;
        this.elapsedTime = 0;
        this.running = false;
    }

    start(): void {
        this.startTime = performance.now();
        this.oldTime = this.startTime;
        this.elapsedTime = 0;
        this.running = true;
    }

    stop(): void {
        this.getElapsedTime();
        this.running = false;
        this.autoStart = false;
    }

    getElapsedTime(): number {
        this.getDelta();
        return this.elapsedTime;
    }

    getDelta(): number {
        let diff = 0;

        if (this.autoStart && !this.running) {
            this.start();
            return 0;
        }

        if (this.running) {
            const newTime = performance.now();
            diff = (newTime - this.oldTime) / 1000;
            this.oldTime = newTime;
            this.elapsedTime += diff;
        }

        return diff;
    }
}

// @ts-expect-error Local compat layer re-exports the concrete Three ESM bundle on purpose.
export * from '../../node_modules/three/build/three.module.js';
export { Clock };
export default { ...THREE, Clock };
