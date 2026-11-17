// Use the real installed Chromium WebGPU backend. Linux headless needs Vulkan
// enabled explicitly; keep software-renderer provenance and all GPU assertions.
// https://developer.chrome.com/blog/supercharge-web-ai-testing
export function nativeChromiumLaunchOptions({platform=process.platform,executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}={}){
 return {
  ...(executablePath?{executablePath}:{}),
  args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader',...(platform==='linux'?['--enable-features=Vulkan','--use-angle=vulkan','--disable-vulkan-surface']:[])],
 };
}
