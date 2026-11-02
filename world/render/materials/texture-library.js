import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
// Assets and transcoder location are explicit. No uncompressed replacement is
// silently downloaded; the caller can keep its procedural material on failure.
export class TextureLibrary {
 constructor(renderer,{transcoderPath}={}) {
  if(!transcoderPath)throw new TypeError('A hosted Basis transcoderPath is required');
  this.loader=new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(renderer);this.cache=new Map();this.disposed=false;
 }
 load(url){if(this.disposed)return Promise.reject(new Error('Texture library disposed'));if(!this.cache.has(url))this.cache.set(url,this.loader.loadAsync(url).then(texture=>{if(this.disposed){texture.dispose();throw new Error('Texture library disposed');}texture.anisotropy=4;return texture;}).catch(error=>{this.cache.delete(url);throw error;}));return this.cache.get(url);}
 dispose(){this.disposed=true;for(const entry of this.cache.values())entry.then(texture=>texture.dispose()).catch(()=>{});this.cache.clear();this.loader.dispose();}
}
