import base from './city-xray-columns.browser.config.js';
export default {...base,use:{...base.use,channel:'chrome',launchOptions:{args:['--enable-unsafe-webgpu']}},grep:/native GPU/};
