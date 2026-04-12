declare module '../../node_modules/three/build/three.module.js' {
    export * from 'three';
    const threeModule: typeof import('three');
    export default threeModule;
}
