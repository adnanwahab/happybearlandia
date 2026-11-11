import { PMREMGenerator } from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
// Generate a reusable HDR reflection map once; never render cubemaps per frame.
export function createEnvironmentLight(renderer,scene) {
 if(renderer.isCanvasRenderer)return {update(){},dispose(){}};
 const room=new RoomEnvironment(),generator=new PMREMGenerator(renderer);
 const target=generator.fromScene(room,.04);room.dispose();generator.dispose();
 scene.environment=target.texture;
 return {update(daylight,enabled=true){scene.environment=enabled?target.texture:null;scene.environmentIntensity=.06+.24*daylight;},dispose(){scene.environment=null;target.dispose();}};
}
