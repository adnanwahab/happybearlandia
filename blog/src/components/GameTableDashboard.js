import React, { useEffect, useRef } from "npm:react";
import * as THREE from "npm:three";

export default function GameTableDashboard() {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 12, 15);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    currentMount.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(8, 15, 8);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Helper to create box meshes
    function createCube(w, h, d, color) {
      const geometry = new THREE.BoxGeometry(w, h, d);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // 4. Table Construction
    const tableGroup = new THREE.Group();
    const tabletop = createCube(16, 0.6, 12, 0x5c4033);
    tableGroup.add(tabletop);

    const legPositions = [
      [-7.2, -3.3, -5.2],
      [7.2, -3.3, -5.2],
      [-7.2, -3.3, 5.2],
      [7.2, -3.3, 5.2],
    ];
    legPositions.forEach((pos) => {
      const leg = createCube(0.8, 6, 0.8, 0x3d2817);
      leg.position.set(...pos);
      tableGroup.add(leg);
    });
    scene.add(tableGroup);

    // 5. Board Construction
    const boardWidth = 8;
    const boardThickness = 0.2;
    const boardY = 0.3 + boardThickness / 2;

    const boardBase = createCube(boardWidth, boardThickness, boardWidth, 0x1e1e1e);
    boardBase.position.y = boardY;
    scene.add(boardBase);

    // Board Grid
    const gridTiles = 8;
    const tileSize = boardWidth / gridTiles;
    const tileThickness = 0.02;
    const tileYPos = boardY + boardThickness / 2 + tileThickness / 2;

    for (let row = 0; row < gridTiles; row++) {
      for (let col = 0; col < gridTiles; col++) {
        const isRed = (row + col) % 2 === 0;
        const tileColor = isRed ? 0xb22222 : 0xf0d9b5;

        const tile = createCube(tileSize, tileThickness, tileSize, tileColor);
        tile.position.set(
          (col - gridTiles / 2 + 0.5) * tileSize,
          tileYPos,
          (row - gridTiles / 2 + 0.5) * tileSize
        );
        scene.add(tile);
      }
    }

    // 6. Dice
    const diceSize = 1;
    const diceYPos = tileYPos + tileThickness / 2 + diceSize / 2;
    const dice = createCube(diceSize, diceSize, diceSize, 0xffffff);
    dice.position.set(1.5, diceYPos, 1.5);
    dice.rotation.set(Math.PI / 12, Math.PI / 6, 0);
    scene.add(dice);

    // 7. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      dice.rotation.y += 0.005; // Slow rotation
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!currentMount) return;
      const newWidth = currentMount.clientWidth;
      const newHeight = currentMount.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // 9. Cleanup on Unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      // Traverses scene to dispose geometries, materials, and renderer DOM node
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '500px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}
