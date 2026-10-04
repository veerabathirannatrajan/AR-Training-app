/**
 * The modules' 3D scenes (three.js), kept out of the startup bundle: registry.ts loads them
 * lazily from here, and preloadEngine() fetches this chunk right after the first screen.
 */
export { ArBasicsScene } from './ar-basics/ArBasicsScene';
export { FireScene } from './fire-explosion/FireScene';
export { GasScene } from './gas-confined-space/GasScene';
