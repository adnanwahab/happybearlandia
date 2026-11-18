import policy from './policy-impact.browser.config.js';
export default {...policy,projects:[{name:'native-webgpu'}],outputDir:'../test-results/policy-impact-native',use:{...policy.use,launchOptions:{...policy.use.launchOptions,args:[]}}};
