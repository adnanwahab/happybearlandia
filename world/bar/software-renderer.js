import * as THREE from 'three';

/**
 * Small Canvas2D renderer for this fixed lounge when a browser has no WebGL.
 * It renders the actual Three scene, so picking, poses and camera framing stay
 * identical. Opaque faces use painter ordering and flat lighting; canvas signs
 * and name sprites retain their textures. It deliberately omits GPU shadows.
 */
export class SoftwareRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.domElement.dataset.renderer = 'canvas2d';
    this.context = this.domElement.getContext('2d', { alpha: false });
    if (!this.context) throw new Error('Canvas rendering is unavailable.');
    this.isSoftwareRenderer = true;
    this.shadowMap = {};
    this.toneMappingExposure = 1;
    this.info = { render: { triangles: 0, calls: 0 } };
    this._width = 1; this._height = 1; this._ratio = 1;
    this._geometry = new WeakMap(); this._objects = new WeakMap();
    this._colors = new Map(); this._cameraVersion = 0;
    this._viewProjection = new THREE.Matrix4();
    this._previousView = new THREE.Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
  }

  setPixelRatio(ratio) { this._ratio = Math.max(1, Math.min(1.25, ratio || 1)); }

  setSize(width, height, updateStyle = true) {
    this._width = Math.max(1, width); this._height = Math.max(1, height);
    this.domElement.width = Math.round(this._width * this._ratio);
    this.domElement.height = Math.round(this._height * this._ratio);
    if (updateStyle) {
      this.domElement.style.width = `${this._width}px`;
      this.domElement.style.height = `${this._height}px`;
    }
    this._cameraVersion++;
  }

  _geometryData(geometry) {
    let data = this._geometry.get(geometry);
    if (data) return data;
    const position = geometry.attributes.position;
    if (!position) return null;
    const indices = geometry.index?.array || Uint32Array.from({ length: position.count }, (_, i) => i);
    const normal = geometry.attributes.normal;
    const faceNormals = new Float32Array(indices.length);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
      if (normal) {
        a.fromBufferAttribute(normal, ia); b.fromBufferAttribute(normal, ib); c.fromBufferAttribute(normal, ic);
        a.add(b).add(c).normalize();
      } else {
        a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
        b.sub(a); c.sub(a); a.crossVectors(b, c).normalize();
      }
      faceNormals[i] = a.x; faceNormals[i + 1] = a.y; faceNormals[i + 2] = a.z;
    }
    data = { position, indices, faceNormals, uv: geometry.attributes.uv };
    this._geometry.set(geometry, data); return data;
  }

  _project(x, y, z, matrix) {
    const e = matrix.elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= .001) return null;
    return [
      ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w + 1) * this._width / 2,
      (1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w) * this._height / 2,
      (e[2] * x + e[6] * y + e[10] * z + e[14]) / w,
    ];
  }

  _shade(material, nx, ny, nz, lighting, fog) {
    if (material.isMeshBasicMaterial || material.isSpriteMaterial) return material.color?.getStyle() || '#ffffff';
    let r = .22, g = .22, b = .22;
    for (const light of lighting) {
      let strength;
      if (light.kind === 'hemisphere') {
        const sky = Math.max(0, Math.min(1, ny * .5 + .5));
        r += light.strength * (light.r * sky + light.gr * (1 - sky));
        g += light.strength * (light.g * sky + light.gg * (1 - sky));
        b += light.strength * (light.b * sky + light.gb * (1 - sky));
        continue;
      }
      strength = light.strength * Math.max(0, nx * light.x + ny * light.y + nz * light.z);
      r += light.r * strength; g += light.g * strength; b += light.b * strength;
    }
    // Quantized light levels share CSS colors across many faces and frames.
    r = Math.round(r * 24) / 24; g = Math.round(g * 24) / 24; b = Math.round(b * 24) / 24;
    const key = `${material.id}:${r}:${g}:${b}:${Math.round(fog.factor * 24)}`;
    const cached = this._colors.get(key); if (cached) return cached;
    const color = material.color || { r: 1, g: 1, b: 1 };
    const emission = material.emissive || { r: 0, g: 0, b: 0 };
    const emit = material.emissiveIntensity || 0, exposure = this.toneMappingExposure;
    const channel = (base, shade, emissive, fogColor) => {
      let value = (base * shade + emissive * emit) * exposure;
      value = Math.max(0, Math.min(1, value * (2.51 * value + .03) / (value * (2.43 * value + .59) + .14)));
      value = value * (1 - fog.factor) + fogColor * fog.factor;
      return Math.round(255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055));
    };
    const css = `rgb(${channel(color.r, r, emission.r, fog.r)},${channel(color.g, g, emission.g, fog.g)},${channel(color.b, b, emission.b, fog.b)})`;
    this._colors.set(key, css); return css;
  }

  _meshCommands(object, lights, fog) {
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!material || material.visible === false || material.opacity === 0) return [];
    const data = this._geometryData(object.geometry); if (!data) return [];
    const transform = new THREE.Matrix4().multiplyMatrices(this._viewProjection, object.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld).elements;
    const pos = data.position, projected = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) projected[i] = this._project(pos.getX(i), pos.getY(i), pos.getZ(i), transform);
    const image = material.map?.image, commands = [];
    for (let i = 0; i < data.indices.length; i += 3) {
      const ia = data.indices[i], ib = data.indices[i + 1], ic = data.indices[i + 2];
      const a = projected[ia], b = projected[ib], c = projected[ic];
      if (!a || !b || !c) continue;
      if (Math.max(a[0], b[0], c[0]) < 0 || Math.min(a[0], b[0], c[0]) > this._width || Math.max(a[1], b[1], c[1]) < 0 || Math.min(a[1], b[1], c[1]) > this._height) continue;
      if (Math.min(a[2], b[2], c[2]) > 1 || Math.max(a[2], b[2], c[2]) < -1) continue;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < .03 || (material.side === THREE.FrontSide && area >= 0) || (material.side === THREE.BackSide && area <= 0)) continue;
      const x = data.faceNormals[i], y = data.faceNormals[i + 1], z = data.faceNormals[i + 2];
      let nx = normalMatrix[0] * x + normalMatrix[3] * y + normalMatrix[6] * z;
      let ny = normalMatrix[1] * x + normalMatrix[4] * y + normalMatrix[7] * z;
      let nz = normalMatrix[2] * x + normalMatrix[5] * y + normalMatrix[8] * z;
      const length = Math.hypot(nx, ny, nz) || 1;
      const sign = area > 0 ? -1 : 1; nx *= sign / length; ny *= sign / length; nz *= sign / length;
      const cmd = { a, b, c, layer: object.userData.softwareLayer || 0, depth: (a[2] + b[2] + c[2]) / 3, color: this._shade(material, nx, ny, nz, lights, fog), opacity: material.opacity, overlay: material.depthTest === false };
      if (image && data.uv && image.width && image.height) {
        cmd.image = image;
        const uv = data.uv;
        cmd.uv = [ia, ib, ic].map(index => [uv.getX(index) * image.width, (material.map.flipY === false ? uv.getY(index) : 1 - uv.getY(index)) * image.height]);
      }
      commands.push(cmd);
    }
    return commands;
  }

  _spriteCommands(object, camera) {
    const material = object.material, image = material?.map?.image;
    if (!material || material.opacity === 0 || !image?.width) return [];
    const e = object.matrixWorld.elements, ce = camera.matrixWorld.elements;
    const width = Math.hypot(e[0], e[1], e[2]), height = Math.hypot(e[4], e[5], e[6]);
    const center = object.center || { x: .5, y: .5 };
    const points = [[0,1],[1,1],[1,0],[0,0]].map(([u,v]) => {
      const x = (u - center.x) * width, y = (v - center.y) * height;
      return this._project(e[12] + ce[0] * x + ce[4] * y, e[13] + ce[1] * x + ce[5] * y, e[14] + ce[2] * x + ce[6] * y, this._viewProjection);
    });
    if (points.some(point => !point)) return [];
    const uv = [[0,0],[image.width,0],[image.width,image.height],[0,image.height]];
    return [[0,1,2],[0,2,3]].map(ids => ({ a: points[ids[0]], b: points[ids[1]], c: points[ids[2]], depth: points[0][2], image, uv: ids.map(id => uv[id]), opacity: material.opacity, overlay: material.depthTest === false }));
  }

  _draw(command) {
    const ctx = this.context, { a, b, c, image } = command;
    ctx.globalAlpha = command.opacity ?? 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
    if (!image) {
      ctx.fillStyle = command.color; ctx.fill();
      // Cover subpixel seams between adjacent opaque triangles.
      if (ctx.globalAlpha === 1) { ctx.strokeStyle = command.color; ctx.lineWidth = .35; ctx.stroke(); }
      return;
    }
    const [u, v, w] = command.uv;
    const determinant = (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]);
    if (Math.abs(determinant) < .00001) return;
    const sx = ((b[0] - a[0]) * (w[1] - u[1]) - (c[0] - a[0]) * (v[1] - u[1])) / determinant;
    const sy = ((b[1] - a[1]) * (w[1] - u[1]) - (c[1] - a[1]) * (v[1] - u[1])) / determinant;
    const kx = ((c[0] - a[0]) * (v[0] - u[0]) - (b[0] - a[0]) * (w[0] - u[0])) / determinant;
    const ky = ((c[1] - a[1]) * (v[0] - u[0]) - (b[1] - a[1]) * (w[0] - u[0])) / determinant;
    ctx.save(); ctx.clip();
    ctx.transform(sx, sy, kx, ky, a[0] - sx * u[0] - kx * u[1], a[1] - sy * u[0] - ky * u[1]);
    ctx.drawImage(image, 0, 0); ctx.restore();
  }

  render(scene, camera) {
    if (!this.context) return;
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    this._viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!this._viewProjection.equals(this._previousView)) { this._cameraVersion++; this._previousView.copy(this._viewProjection); }
    const lights = [], objects = [];
    scene.traverseVisible(object => { if (object.isLight) lights.push(object); else if (object.isMesh || object.isSprite) objects.push(object); });
    const lightSignature = lights.map(light => `${light.id}:${light.intensity}`).join('|');
    const commands = [], overlays = [], world = new THREE.Vector3(), toward = new THREE.Vector3();
    const background = scene.background?.isColor ? scene.background : new THREE.Color('#111a24');
    for (const object of objects) {
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!material || material.visible === false) continue;
      let entry = this._objects.get(object);
      const signature = `${this._cameraVersion}:${lightSignature}:${material.opacity}:${material.visible}`;
      if (!entry || entry.signature !== signature || !entry.world.equals(object.matrixWorld)) {
        world.setFromMatrixPosition(object.matrixWorld);
        const lighting = lights.map(light => {
          const base = { r: light.color.r, g: light.color.g, b: light.color.b };
          if (light.isHemisphereLight) return { ...base, kind: 'hemisphere', strength: light.intensity * .2, gr: light.groundColor.r, gg: light.groundColor.g, gb: light.groundColor.b };
          toward.setFromMatrixPosition(light.matrixWorld);
          if (light.isDirectionalLight) {
            const target = new THREE.Vector3().setFromMatrixPosition(light.target.matrixWorld);
            toward.sub(target).normalize();
            return { ...base, kind: 'directional', strength: light.intensity * .3, x: toward.x, y: toward.y, z: toward.z };
          }
          toward.sub(world);
          const distance = toward.length(); toward.normalize();
          const falloff = light.distance ? Math.max(0, 1 - distance / light.distance) ** 2 : 1;
          return { ...base, kind: 'point', strength: light.intensity * .35 * falloff / (1 + distance * distance), x: toward.x, y: toward.y, z: toward.z };
        });
        const distance = world.distanceTo(camera.position);
        const fog = { r: background.r, g: background.g, b: background.b, factor: scene.fog ? Math.max(0, Math.min(.65, (distance - scene.fog.near) / (scene.fog.far - scene.fog.near))) : 0 };
        entry = { signature, world: object.matrixWorld.clone(), commands: object.isSprite ? this._spriteCommands(object, camera) : this._meshCommands(object, lighting, fog) };
        this._objects.set(object, entry);
      }
      for (const command of entry.commands) (command.overlay ? overlays : commands).push(command);
    }
    commands.sort((a, b) => (a.layer || 0) - (b.layer || 0) || b.depth - a.depth); overlays.sort((a, b) => b.depth - a.depth);
    const ctx = this.context;
    ctx.setTransform(this._ratio, 0, 0, this._ratio, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = background.getStyle(); ctx.fillRect(0, 0, this._width, this._height);
    for (const command of commands) this._draw(command);
    for (const command of overlays) this._draw(command);
    ctx.globalAlpha = 1;
    this.info.render.triangles = commands.length + overlays.length; this.info.render.calls = objects.length;
    if (this._colors.size > 24000) this._colors.clear();
  }

  dispose() {
    this._colors.clear(); this._geometry = new WeakMap(); this._objects = new WeakMap(); this.context = null;
  }
}
