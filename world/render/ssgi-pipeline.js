import {RenderPipeline, UnsignedByteType, RendererUtils} from 'three/webgpu';
import {pass, mrt, output, diffuseColor, normalView, packNormalToRGB, unpackRGBToNormal, sample, vec4} from 'three/tsl';
import {ssgi} from 'three/addons/tsl/display/SSGINode.js';

/** Local Three0.186 SSGI: screen-visible indirect light, not path tracing. */
export function createSSGIPipeline({renderer, scene, camera}) {
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({output, diffuseColor, normal: packNormalToRGB(normalView)}));
  const color = scenePass.getTextureNode('output');
  const diffuse = scenePass.getTextureNode('diffuseColor');
  const depth = scenePass.getTextureNode('depth');
  const normals = scenePass.getTextureNode('normal');
  scenePass.getTexture('diffuseColor').type = UnsignedByteType;
  scenePass.getTexture('normal').type = UnsignedByteType;
  const normal = sample(uv => unpackRGBToNormal(normals.sample(uv)));
  const gi = ssgi(color, depth, normal, camera);
  // Bounded low preset without temporal filtering: 24 samples per pixel.
  gi.sliceCount.value = 2; gi.stepCount.value = 6;
  pipeline.outputNode = vec4(color.rgb.mul(gi.getAONode()).add(diffuse.rgb.mul(gi.getGINode().rgb)), color.a);
  let disposed = false;
  return {
    render() {
      // RenderPipeline restores these on success; also restore on shader failure.
      const saved = RendererUtils.saveRendererAndSceneState(renderer, scene);
      const xr = renderer.xr.enabled;
      try { pipeline.render(); }
      catch (error) { RendererUtils.restoreRendererAndSceneState(renderer, scene, saved); throw error; }
      finally { renderer.toneMapping = saved.toneMapping; renderer.outputColorSpace = saved.outputColorSpace; renderer.xr.enabled = xr; }
    },
    // PassNode sizes its targets from the renderer each frame, including DPR changes.
    dispose() { if (disposed) return; disposed = true; pipeline.dispose(); gi.dispose(); scenePass.dispose(); },
  };
}
