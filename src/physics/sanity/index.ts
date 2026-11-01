/**
 * Dev-only self-test for the physics layer.
 *
 * The `physics-accuracy` skill lists five known values that any correct
 * simulation must be able to reproduce: "If a sim cannot reproduce these, the
 * sim is wrong — not the constants." This module is that list, executable, so a
 * bad constant or a unit slip surfaces on page load rather than in a readout
 * nobody double-checked.
 *
 * Every formula below is the standard physics form from the skill's "Formula
 * conventions" section, translated directly so the two read as the same thing.
 * Angles are radians internally and converted only for display.
 *
 * Called once from `main.tsx` behind `import.meta.env.DEV`. Nothing here runs
 * in a production build.
 *
 * One file per topic, named after the physics file it checks (`./kepler.ts`
 * checks `../kepler.ts`; `./cmb.ts` is the one exception, since the cosmic
 * microwave background's physics lives in `../cosmology.ts`), with the shared
 * tolerances, result types and logging
 * in `./core.ts` and the skill's five known values in `./skill.ts`. This file
 * only re-exports, so callers keep importing from `@/physics/sanity`.
 */
export type { CheckBlock, CheckResult } from './core';
export { runSanityChecks } from './skill';
export { verifyEscapeIntegrator } from './escape';
export { verifyKeplerModel } from './kepler';
export { verifyBlackHoleModel } from './blackhole';
export { verifyGravitationalWaveModel } from './gw';
export { verifyTransitModel } from './transit';
export { verifyAtmosphereModel } from './atmosphere';
export { verifyScaleLadder } from './scale';
export { verifyCosmologyModel } from './cosmology';
export { verifyCmbModel } from './cmb';
export { verifyEarlyUniverseModel } from './earlyuniverse';
export { verifyFusionModel } from './fusion';
export { verifySupernovaModel } from './supernova';
export { verifyHabitableModel } from './habitable';
export { verifyNebulaModel } from './nebula';
export { verifyLadderModel } from './ladder';
export { verifyRelativityModel } from './relativity';
export { verifyHawkingModel } from './hawking';
export { verifyWormholeModel } from './wormhole';
export { verifyNeutronStarModel } from './neutronstar';
export { verifyDarkMatterModel } from './darkmatter';
export { verifyGalaxyModel } from './galaxies';
export { verifyTideModel } from './tides';
