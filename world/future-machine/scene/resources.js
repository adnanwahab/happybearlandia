/** Release stage-owned scene resources once, including shared materials/maps.
 * External/shared asset caches must retain ownership outside these scene trees.
 */
export function disposeObjectResources(root) {
  const resources = new Set();
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      resources.add(material);
    }
  });
  for (const resource of resources) resource.dispose();
}
