import base from './world-visual-pass.browser.config.js';
export default {...base,use:{...base.use,actionTimeout:30000}, testMatch:['world-visual-pass.e2e.js','world-visual-accessibility.e2e.js','world-visual-integration.e2e.js'],outputDir:process.env.HBL_VISUAL_ARTIFACT_DIR||'../test-results/world-visual-integration'};
