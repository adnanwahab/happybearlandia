import { loadScene } from './scene-loader.js';
import { DebugRecorder } from './debug-recorder.js';
import initJolt from 'https://www.unpkg.com/jolt-physics/dist/jolt-physics.wasm-compat.js';
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from
  "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
// Graphics variables
var container, stats;
var camera, controls, scene, renderer;

// Timers
var clock = new THREE.Clock();
var time = 0;
var frame = 0;

const debugRecorder = new DebugRecorder();

const emitDebugEvent =
(event) =>
  debugRecorder.emit({
    frame,
    time,
    ...event,
  });

const debugSessionId =
  crypto.randomUUID();

const debugSessionStartedAt =
  new Date().toISOString();

let debugSessionSaved =
  false;

let debugSessionClosed =
  false;

let captureDebugSnapshot =
  null;

const persistDebugSession =
async ({
  reason = "manual",
  useBeacon = false,
} = {}) => {

  const payload = {
    sceneId: sceneIdFromRoute(),
    sceneFile: sceneFileFromRoute(),
    sessionId: debugSessionId,
    reason,

    startedAt:
      debugSessionStartedAt,

    endedAt:
      new Date().toISOString(),

    metadata: {
      userAgent:
        navigator.userAgent,
      locationPath:
        window.location.pathname,
    },

    ...debugRecorder.toJSON(),
  };

  const body =
    JSON.stringify(payload);

  if (
    useBeacon &&
    navigator.sendBeacon
  ) {
    const sent =
      navigator.sendBeacon(
        "/api/debug/events",
        new Blob(
          [body],
          {
            type: "application/json",
          }
        )
      );

    if (sent) {
      debugSessionSaved =
        true;
    }

    return sent;
  }

  try {
    const response =
      await fetch(
        "/api/debug/events",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body,
          keepalive: true,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    debugSessionSaved =
      true;

    return true;
  } catch (
    error
  ) {
    console.warn(
      "Unable to persist debug session:",
      error
    );

    return false;
  }
};

const closeAndPersistDebugSession =
(reason, useBeacon) => {
  if (
    debugSessionSaved
  ) {
    return;
  }

  if (
    !debugSessionClosed
  ) {
    emitDebugEvent({
      type: "state_change",
      objectId: "debug_session",

      from: {
        active: true,
      },

      to: {
        active: false,
      },

      causedBy: {
        type: "lifecycle",
        objectId: reason,
      },
    });

    debugSessionClosed =
      true;
  }

  captureDebugSnapshot?.();

  persistDebugSession({
    reason,
    useBeacon,
  });
};

// Physics variables
var jolt;
var physicsSystem;
var bodyInterface;

// List of objects spawned
var dynamicObjects = [];

// The update function
var onExampleUpdate;

const DegreesToRadians = (deg) => deg * (Math.PI / 180.0);

const wrapVec3 = (v) =>
  new THREE.Vector3(
    v.GetX(),
    v.GetY(),
    v.GetZ()
  );

const wrapRVec3 = wrapVec3;

const wrapQuat = (q) =>
  new THREE.Quaternion(
    q.GetX(),
    q.GetY(),
    q.GetZ(),
    q.GetW()
  );

const sceneIdFromRoute = () => {
  const pathParts = window.location.pathname
    .split('/')
    .filter(Boolean);

  if (pathParts[0] === 'game' && pathParts[1]) {
    return pathParts[1];
  }

  return 'scene';
};

const sceneFileFromRoute = () =>
  `${sceneIdFromRoute()}.json`;

// Object layers
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;


function onWindowResize() {

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
}


function initGraphics() {

  renderer =
    new THREE.WebGLRenderer();

  renderer.setClearColor(
    0xbfd1e5
  );

  renderer.setPixelRatio(
    window.devicePixelRatio
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  camera =
    new THREE.PerspectiveCamera(
      60,
      window.innerWidth /
        window.innerHeight,
      0.2,
      2000
    );

  camera.position.set(
    0,
    15,
    30
  );

  camera.lookAt(
    new THREE.Vector3(
      0,
      0,
      0
    )
  );

  scene =
    new THREE.Scene();

  var dirLight =
    new THREE.DirectionalLight(
      0xffffff,
      1
    );

  dirLight.position.set(
    10,
    10,
    5
  );

  scene.add(
    dirLight
  );

  controls =
    new OrbitControls(
      camera,
      container
    );

  container.appendChild(
    renderer.domElement
  );

  window.addEventListener(
    'resize',
    onWindowResize,
    false
  );
}


let setupCollisionFiltering =
function (settings) {

  // Layer that objects can be in,
  // determines which other objects
  // they can collide with.

  let objectFilter =
    new Jolt.ObjectLayerPairFilterTable(
      NUM_OBJECT_LAYERS
    );

  objectFilter.EnableCollision(
    LAYER_NON_MOVING,
    LAYER_MOVING
  );

  objectFilter.EnableCollision(
    LAYER_MOVING,
    LAYER_MOVING
  );

  const BP_LAYER_NON_MOVING =
    new Jolt.BroadPhaseLayer(0);

  const BP_LAYER_MOVING =
    new Jolt.BroadPhaseLayer(1);

  const NUM_BROAD_PHASE_LAYERS =
    2;

  let bpInterface =
    new Jolt.BroadPhaseLayerInterfaceTable(
      NUM_OBJECT_LAYERS,
      NUM_BROAD_PHASE_LAYERS
    );

  bpInterface.MapObjectToBroadPhaseLayer(
    LAYER_NON_MOVING,
    BP_LAYER_NON_MOVING
  );

  bpInterface.MapObjectToBroadPhaseLayer(
    LAYER_MOVING,
    BP_LAYER_MOVING
  );

  settings.mObjectLayerPairFilter =
    objectFilter;

  settings.mBroadPhaseLayerInterface =
    bpInterface;

  settings.mObjectVsBroadPhaseLayerFilter =
    new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      settings.mBroadPhaseLayerInterface,
      NUM_BROAD_PHASE_LAYERS,
      settings.mObjectLayerPairFilter,
      NUM_OBJECT_LAYERS
    );
};


function initPhysics() {

  const settings =
    new Jolt.JoltSettings();

  settings.mMaxWorkerThreads =
    3;

  const assertFailed =
    new Jolt.AssertFailedHandlerJS();

  assertFailed.OnAssertFailed =
  (
    expression,
    message,
    file,
    line
  ) => {

    console.error(
      `Assert failed: (${Jolt.UTF8ToString(expression)}) ` +
      `${Jolt.UTF8ToString(message)} at ` +
      `${Jolt.UTF8ToString(file)}:${line}`
    );
  };

  settings.mAssertFailedHandler =
    assertFailed;

  setupCollisionFiltering(
    settings
  );

  jolt =
    new Jolt.JoltInterface(
      settings
    );

  Jolt.destroy(
    settings
  );

  physicsSystem =
    jolt.GetPhysicsSystem();

  bodyInterface =
    physicsSystem.GetBodyInterface();
}


function updatePhysics(
  deltaTime
) {

  // When running below 55 Hz,
  // do 2 steps instead of 1.

  var numSteps =
    deltaTime > 1.0 / 55.0
      ? 2
      : 1;

  jolt.Step(
    deltaTime,
    numSteps
  );
}


function initExample(
  Jolt,
  updateFunction
) {

  window.Jolt =
    Jolt;

  window.debugRecorder =
    debugRecorder;

  window.getDebugEvents =
  (filters) =>
    debugRecorder.getEvents(
      filters
    );

  window.persistDebugEvents =
  (reason = "manual") =>
    persistDebugSession({
      reason,
      useBeacon: false,
    });

  container =
    document.getElementById(
      'container'
    );

  container.innerHTML =
    "";

  onExampleUpdate =
    updateFunction;

  initGraphics();

  initPhysics();

  // Start rendering once scene and character initialization are complete.

  let memoryprofilerCanvas =
    document.getElementById(
      "memoryprofiler_canvas"
    );

  if (
    memoryprofilerCanvas
  ) {

    memoryprofilerCanvas
      .parentElement
      .id =
      "memoryprofiler";
  }
}


function renderExample() {

  requestAnimationFrame(
    renderExample
  );

  var deltaTime =
    clock.getDelta();

  deltaTime =
    Math.min(
      deltaTime,
      1.0 / 30.0
    );

  if (
    onExampleUpdate != null
  ) {

    onExampleUpdate(
      time,
      deltaTime
    );
  }

  // Update dynamic Three.js
  // objects from Jolt.

  for (
    let i = 0,
        il = dynamicObjects.length;
    i < il;
    i++
  ) {

    let objThree =
      dynamicObjects[i];

    let body =
      objThree.userData.body;

    objThree.position.copy(
      wrapVec3(
        body.GetPosition()
      )
    );

    objThree.quaternion.copy(
      wrapQuat(
        body.GetRotation()
      )
    );

    if (
      body.GetBodyType() ==
      Jolt.EBodyType_SoftBody
    ) {

      if (
        objThree.userData
          .updateVertex
      ) {

        objThree
          .userData
          .updateVertex();

      } else {

        objThree.geometry =
          createMeshForShape(
            body.GetShape()
          );
      }
    }
  }

  time +=
    deltaTime;

  frame += 1;

  updatePhysics(
    deltaTime
  );

  controls.update(
    deltaTime
  );

  renderer.render(
    scene,
    camera
  );
}


function addToThreeScene(
  body,
  color
) {

  let threeObject =
    getThreeObjectForBody(
      body,
      color
    );

  threeObject
    .userData
    .body =
    body;

  scene.add(
    threeObject
  );

  dynamicObjects.push(
    threeObject
  );
}


function addToScene(
  body,
  color
) {

  bodyInterface.AddBody(
    body.GetID(),
    Jolt.EActivation_Activate
  );

  addToThreeScene(
    body,
    color
  );
}


function removeFromScene(
  threeObject
) {

  let id =
    threeObject
      .userData
      .body
      .GetID();

  bodyInterface.RemoveBody(
    id
  );

  bodyInterface.DestroyBody(
    id
  );

  delete threeObject
    .userData
    .body;

  scene.remove(
    threeObject
  );

  let idx =
    dynamicObjects.indexOf(
      threeObject
    );

  dynamicObjects.splice(
    idx,
    1
  );
}


function createBox(
  position,
  rotation,
  halfExtent,
  motionType,
  layer,
  color = 0xffffff,
  mass = null,
  friction = 0.2
) {

  let shape =
    new Jolt.BoxShape(
      halfExtent,
      0.05,
      null
    );

  let creationSettings =
    new Jolt.BodyCreationSettings(
      shape,
      position,
      rotation,
      motionType,
      layer
    );

  // Friction
  creationSettings.mFriction =
    friction;

  // If a mass was supplied for a dynamic body,
  // override Jolt's automatically calculated mass.
  if (
    motionType === Jolt.EMotionType_Dynamic &&
    mass !== null
  ) {

    creationSettings.mOverrideMassProperties =
      Jolt.EOverrideMassProperties_CalculateInertia;

    creationSettings
      .mMassPropertiesOverride
      .mMass =
      mass;
  }

  let body =
    bodyInterface.CreateBody(
      creationSettings
    );

  Jolt.destroy(
    creationSettings
  );

  addToScene(
    body,
    color
  );

  return body;
}



function createMeshForShape(
  shape
) {

  let scale =
    new Jolt.Vec3(
      1,
      1,
      1
    );

  let triContext =
    new Jolt.ShapeGetTriangles(
      shape,
      Jolt.AABox.prototype.sBiggest(),
      shape.GetCenterOfMass(),
      Jolt.Quat.prototype.sIdentity(),
      scale
    );

  Jolt.destroy(
    scale
  );

  let vertices =
    new Float32Array(
      Jolt.HEAPF32.buffer,
      triContext.GetVerticesData(),
      triContext.GetVerticesSize() /
        Float32Array.BYTES_PER_ELEMENT
    );

  let buffer =
    new THREE.BufferAttribute(
      vertices,
      3
    ).clone();

  Jolt.destroy(
    triContext
  );

  let geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    buffer
  );

  geometry.computeVertexNormals();

  return geometry;
}


function getSoftBodyMesh(
  body,
  material
) {

  const motionProperties =
    Jolt.castObject(
      body.GetMotionProperties(),
      Jolt.SoftBodyMotionProperties
    );

  const vertexSettings =
    motionProperties.GetVertices();

  const settings =
    motionProperties.GetSettings();

  const positionOffset =
    Jolt
      .SoftBodyVertexTraits
      .prototype
      .mPositionOffset;

  const faceData =
    settings.mFaces;

  const softVertex =
    [];

  for (
    let i = 0;
    i < vertexSettings.size();
    i++
  ) {

    softVertex.push(
      new Float32Array(
        Jolt.HEAP32.buffer,
        Jolt.getPointer(
          vertexSettings.at(i)
        ) + positionOffset,
        3
      )
    );
  }

  const faces =
    new Uint32Array(
      faceData.size() * 3
    );

  for (
    let i = 0;
    i < faceData.size();
    i++
  ) {

    faces.set(
      new Uint32Array(
        Jolt.HEAP32.buffer,
        Jolt.getPointer(
          faceData.at(i)
        ),
        3
      ),
      i * 3
    );
  }

  let geometry =
    new THREE.BufferGeometry();

  let vertices =
    new Float32Array(
      vertexSettings.size() * 3
    );

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      vertices,
      3
    )
  );

  geometry.setIndex(
    new THREE.BufferAttribute(
      faces,
      1
    )
  );

  material.side =
    THREE.DoubleSide;

  const threeObject =
    new THREE.Mesh(
      geometry,
      material
    );

  threeObject.userData.updateVertex =
  () => {

    for (
      let i = 0;
      i < softVertex.length;
      i++
    ) {

      vertices.set(
        softVertex[i],
        i * 3
      );
    }

    geometry.computeVertexNormals();

    geometry
      .getAttribute(
        'position'
      )
      .needsUpdate =
      true;

    geometry
      .getAttribute(
        'normal'
      )
      .needsUpdate =
      true;
  };

  threeObject
    .userData
    .updateVertex();

  return threeObject;
}


function getThreeObjectForBody(
  body,
  color
) {

  let material =
    new THREE.MeshPhongMaterial({
      color: color
    });

  let threeObject;

  let shape =
    body.GetShape();

  switch (
    shape.GetSubType()
  ) {

    case Jolt.EShapeSubType_Box: {

      let boxShape =
        Jolt.castObject(
          shape,
          Jolt.BoxShape
        );

      let extent =
        wrapVec3(
          boxShape.GetHalfExtent()
        ).multiplyScalar(
          2
        );

      threeObject =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            extent.x,
            extent.y,
            extent.z,
            1,
            1,
            1
          ),
          material
        );

      break;
    }

    case Jolt.EShapeSubType_Sphere: {

      let sphereShape =
        Jolt.castObject(
          shape,
          Jolt.SphereShape
        );

      threeObject =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            sphereShape.GetRadius(),
            32,
            32
          ),
          material
        );

      break;
    }

    case Jolt.EShapeSubType_Capsule: {

      let capsuleShape =
        Jolt.castObject(
          shape,
          Jolt.CapsuleShape
        );

      threeObject =
        new THREE.Mesh(
          new THREE.CapsuleGeometry(
            capsuleShape.GetRadius(),

            2 *
            capsuleShape
              .GetHalfHeightOfCylinder(),

            20,
            10
          ),
          material
        );

      break;
    }

    case Jolt.EShapeSubType_Cylinder: {

      let cylinderShape =
        Jolt.castObject(
          shape,
          Jolt.CylinderShape
        );

      threeObject =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            cylinderShape.GetRadius(),
            cylinderShape.GetRadius(),

            2 *
            cylinderShape
              .GetHalfHeight(),

            20,
            1
          ),
          material
        );

      break;
    }

    default: {

      if (
        body.GetBodyType() ==
        Jolt.EBodyType_SoftBody
      ) {

        threeObject =
          getSoftBodyMesh(
            body,
            material
          );

      } else {

        threeObject =
          new THREE.Mesh(
            createMeshForShape(
              shape
            ),
            material
          );
      }

      break;
    }
  }

  threeObject.position.copy(
    wrapVec3(
      body.GetPosition()
    )
  );

  threeObject.quaternion.copy(
    wrapQuat(
      body.GetRotation()
    )
  );

  return threeObject;
}


Promise.all([
  initJolt(),
  loadScene(new URL(`./${sceneFileFromRoute()}`, import.meta.url))
]).then(function ([Jolt, sceneData]) {

  initExample(
    Jolt,
    null
  );

  const characterHeightStanding =
    2;

  const characterRadiusStanding =
    1;

  // Character movement
  const controlMovementDuringJump =
    true;

  const characterSpeed =
    6.0;

  const jumpSpeed =
    15.0;

  const enableCharacterInertia =
    true;

  const upRotationX =
    0;

  const upRotationZ =
    0;

  const maxSlopeAngle =
    DegreesToRadians(
      45.0
    );

  // ============================================================
  // PUSH FORCE
  // Increasing this lets the CharacterVirtual push dynamic bodies.
  // ============================================================

  const maxStrength =
    1500.0;

  const characterPadding =
    0.02;

  const penetrationRecoverySpeed =
    1.0;

  const predictiveContactDistance =
    0.1;

  const enableWalkStairs =
    true;

  const enableStickToFloor =
    true;

  let standingShape;

  let character;

  let isCrouched =
    false;

  let allowSliding =
    false;

  const geometry =
    new THREE.BoxGeometry(
      1,
      1,
      1
    );

  const material =
    new THREE.MeshPhongMaterial({
      color: 0xffff00
    });

  let threeCharacter =
    new THREE.Mesh(
      geometry,
      material
    );

  let desiredVelocity =
    new THREE.Vector3();

  let tealCubeObject;
  let tealCubeMaterial;

  let tealCubeContactCount =
    0;

  let tealCubeWasContacted =
    false;

  let tealCubeGlowStartTime =
    null;

  const tealCubeOriginalEmissive =
    new THREE.Color(
      0x000000
    );

  const tealCubeOriginalEmissiveIntensity =
    0;

  const tealCubeGlowDuration =
    5;

  const audio =
    new Audio(
      new URL('./sound.m4a', import.meta.url).href
    );


  // =====================================================================
  // MULTIPLAYER
  // =====================================================================

  let socket =
    null;

  let localPlayerId =
    null;

  const remotePlayers =
    new Map();

  // Which player currently controls the networked teal cube.
  // The server is the source of truth for this ID.
  let cubeAuthorityPlayerId =
    null;

  let lastCubeStateSentAt =
    0;

  const CUBE_NETWORK_SEND_INTERVAL_MS =
    50;

  let lastStateSentAt =
    0;

  let lastSentPosition =
    new THREE.Vector3(
      Number.POSITIVE_INFINITY,
      0,
      0
    );

  let lastSentQuaternion =
    new THREE.Quaternion();

  let lastSentCrouched =
    null;

  const NETWORK_SEND_INTERVAL_MS =
    50;

  const POSITION_EPSILON_SQ =
    0.0001;

  const ROTATION_EPSILON =
    0.0001;


  const makeRemoteGeometry =
  () =>

    new THREE.CapsuleGeometry(
      characterRadiusStanding,
      characterHeightStanding,
      4,
      8
    ).translate(
      0,
      0.5 *
        characterHeightStanding +
        characterRadiusStanding,
      0
    );


  function applyRemotePlayerState(
    playerId,
    state
  ) {

    if (
      !playerId ||
      playerId ===
        localPlayerId
    ) {

      return;
    }

    let mesh =
      remotePlayers.get(
        playerId
      );

    if (
      !mesh
    ) {

      const material =
        new THREE.MeshPhongMaterial({
          color:
            0xff66cc
        });

      mesh =
        new THREE.Mesh(
          makeRemoteGeometry(),
          material
        );

      mesh.userData.playerId =
        playerId;

      scene.add(
        mesh
      );

      remotePlayers.set(
        playerId,
        mesh
      );

      console.log(
        "Created remote player:",
        playerId
      );
    }

    if (
      state.position
    ) {

      mesh.position.set(
        state.position.x ??
          0,

        state.position.y ??
          0,

        state.position.z ??
          0
      );
    }

    if (
      state.quaternion
    ) {

      mesh.quaternion.set(
        state.quaternion.x ??
          0,

        state.quaternion.y ??
          0,

        state.quaternion.z ??
          0,

        state.quaternion.w ??
          1
      );
    }
  }


  function removeRemotePlayer(
    playerId
  ) {

    const mesh =
      remotePlayers.get(
        playerId
      );

    if (
      !mesh
    ) {

      return;
    }

    scene.remove(
      mesh
    );

    mesh.geometry.dispose();

    mesh.material.dispose();

    remotePlayers.delete(
      playerId
    );

    console.log(
      "Removed remote player:",
      playerId
    );
  }


  function sendLocalPlayerState(
    force = false
  ) {

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN ||
      !character
    ) {

      return;
    }

    const now =
      performance.now();

    if (
      !force &&
      now -
        lastStateSentAt <
        NETWORK_SEND_INTERVAL_MS
    ) {

      return;
    }

    const position =
      wrapVec3(
        character.GetPosition()
      );

    const quaternion =
      wrapQuat(
        character.GetRotation()
      );

    const positionChanged =
      position.distanceToSquared(
        lastSentPosition
      ) >
      POSITION_EPSILON_SQ;

    const rotationChanged =
      1 -
      Math.abs(
        quaternion.dot(
          lastSentQuaternion
        )
      ) >
      ROTATION_EPSILON;

    if (
      !force &&
      !positionChanged &&
      !rotationChanged
    ) {

      return;
    }

    socket.send(
      JSON.stringify({

        type:
          "playerState",

        position: {

          x:
            position.x,

          y:
            position.y,

          z:
            position.z
        },

        quaternion: {

          x:
            quaternion.x,

          y:
            quaternion.y,

          z:
            quaternion.z,

          w:
            quaternion.w
        }
      })
    );

    lastStateSentAt =
      now;

    lastSentPosition.copy(
      position
    );

    lastSentQuaternion.copy(
      quaternion
    );
  }


  // =====================================================================
  // TEAL CUBE MULTIPLAYER
  // =====================================================================

  function claimTealCubeAuthority() {

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN ||
      !localPlayerId
    ) {

      return;
    }

    if (
      cubeAuthorityPlayerId ===
      localPlayerId
    ) {

      return;
    }

    // The server accepts cube claims, so optimistically mark this
    // client authoritative immediately. This prevents an incoming
    // stale cubeState from fighting the local push while the claim
    // is making its round trip to the server.
    cubeAuthorityPlayerId =
      localPlayerId;

    socket.send(
      JSON.stringify({
        type: "cubeClaim"
      })
    );
  }


  function sendTealCubeState(
    force = false
  ) {

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN ||
      !tealCube ||
      cubeAuthorityPlayerId !==
        localPlayerId
    ) {

      return;
    }

    const now =
      performance.now();

    if (
      !force &&
      now -
        lastCubeStateSentAt <
        CUBE_NETWORK_SEND_INTERVAL_MS
    ) {

      return;
    }

    const position =
      tealCube.GetPosition();

    const quaternion =
      tealCube.GetRotation();

    const linearVelocity =
      tealCube.GetLinearVelocity();

    const angularVelocity =
      tealCube.GetAngularVelocity();

    socket.send(
      JSON.stringify({
        type: "cubeState",

        position: {
          x: position.GetX(),
          y: position.GetY(),
          z: position.GetZ()
        },

        quaternion: {
          x: quaternion.GetX(),
          y: quaternion.GetY(),
          z: quaternion.GetZ(),
          w: quaternion.GetW()
        },

        linearVelocity: {
          x: linearVelocity.GetX(),
          y: linearVelocity.GetY(),
          z: linearVelocity.GetZ()
        },

        angularVelocity: {
          x: angularVelocity.GetX(),
          y: angularVelocity.GetY(),
          z: angularVelocity.GetZ()
        }
      })
    );

    lastCubeStateSentAt =
      now;
  }


  function applyRemoteTealCubeState(
    state
  ) {

    if (
      !tealCube ||
      !state
    ) {

      return;
    }

    const position =
      new Jolt.RVec3(
        state.position?.x ?? 0,
        state.position?.y ?? 0,
        state.position?.z ?? 0
      );

    const rotation =
      new Jolt.Quat(
        state.quaternion?.x ?? 0,
        state.quaternion?.y ?? 0,
        state.quaternion?.z ?? 0,
        state.quaternion?.w ?? 1
      );

    const linearVelocity =
      new Jolt.Vec3(
        state.linearVelocity?.x ?? 0,
        state.linearVelocity?.y ?? 0,
        state.linearVelocity?.z ?? 0
      );

    const angularVelocity =
      new Jolt.Vec3(
        state.angularVelocity?.x ?? 0,
        state.angularVelocity?.y ?? 0,
        state.angularVelocity?.z ?? 0
      );

    // Update the actual Jolt body rather than only moving its Three.js
    // mesh. The render loop copies the Jolt transform to the mesh.
    bodyInterface.SetPositionAndRotation(
      tealCube.GetID(),
      position,
      rotation,
      Jolt.EActivation_Activate
    );

    bodyInterface.SetLinearAndAngularVelocity(
      tealCube.GetID(),
      linearVelocity,
      angularVelocity
    );

    Jolt.destroy(
      position
    );

    Jolt.destroy(
      rotation
    );

    Jolt.destroy(
      linearVelocity
    );

    Jolt.destroy(
      angularVelocity
    );
  }


  function connectMultiplayer() {

    const scheme =
      location.protocol ===
        "https:"
        ? "wss"
        : "ws";

    const serverUrl =
      `${scheme}://${location.host}/ws`;

    console.log(
      "Connecting to:",
      serverUrl
    );

    socket =
      new WebSocket(
        serverUrl
      );


    socket.onopen =
    () => {

      console.log(
        "WebSocket connected"
      );

      sendLocalPlayerState(
        true
      );
    };


    socket.onmessage =
    (
      event
    ) => {

      let msg;

      try {

        msg =
          JSON.parse(
            event.data
          );

      } catch (
        error
      ) {

        console.warn(
          "Ignoring invalid multiplayer message",
          error
        );

        return;
      }

      switch (
        msg.type
      ) {

        case "welcome": {

          localPlayerId =
            msg.playerId;

          console.log(
            "My multiplayer player ID:",
            localPlayerId
          );

          // Receive the server's current cube authority and state.
          cubeAuthorityPlayerId =
            msg.cubeAuthorityPlayerId ??
            null;

          console.log(
            "Cube authority:",
            cubeAuthorityPlayerId
          );

          if (
            msg.cubeState
          ) {

            applyRemoteTealCubeState(
              msg.cubeState
            );
          }

          for (
            const player
            of msg.players ??
              []
          ) {

            if (
              player.id !==
              localPlayerId
            ) {

              applyRemotePlayerState(
                player.id,
                player.state ??
                  {}
              );
            }
          }

          sendLocalPlayerState(
            true
          );

          // If the server selected us as the cube authority,
          // immediately publish the current Jolt state.
          if (
            cubeAuthorityPlayerId ===
            localPlayerId
          ) {

            sendTealCubeState(
              true
            );
          }

          break;
        }


        case "playerJoined": {

          if (
            msg.playerId !==
            localPlayerId
          ) {

            applyRemotePlayerState(
              msg.playerId,
              msg.state ??
                {}
            );
          }

          break;
        }


        case "playerState": {

          applyRemotePlayerState(
            msg.playerId,
            msg
          );

          break;
        }


        case "playerLeft": {

          removeRemotePlayer(
            msg.playerId
          );

          break;
        }


        case "cubeAuthority": {

          cubeAuthorityPlayerId =
            msg.playerId ??
            null;

          console.log(
            "Cube authority is now:",
            cubeAuthorityPlayerId
          );

          if (
            cubeAuthorityPlayerId ===
            localPlayerId
          ) {

            sendTealCubeState(
              true
            );
          }

          break;
        }


        case "cubeState": {

          // The authoritative client owns its local simulation.
          // Everyone else applies the state received from the server.
          if (
            cubeAuthorityPlayerId !==
            localPlayerId
          ) {

            applyRemoteTealCubeState(
              msg
            );
          }

          break;
        }
      }
    };


    socket.onclose =
    () => {

      console.log(
        "WebSocket disconnected"
      );

      for (
        const playerId
        of [
          ...remotePlayers.keys()
        ]
      ) {

        removeRemotePlayer(
          playerId
        );
      }
    };


    socket.onerror =
    (
      error
    ) => {

      console.error(
        "WebSocket error:",
        error
      );
    };
  }


  const updateTealCubeGlow =
  (
    currentTime
  ) => {

    if (
      !tealCubeMaterial ||
      tealCubeGlowStartTime ===
        null
    ) {

      return;
    }

    const elapsed =
      currentTime -
      tealCubeGlowStartTime;

    const progress =
      Math.min(
        elapsed /
          tealCubeGlowDuration,
        1
      );

    tealCubeMaterial
      .emissive
      .lerp(
        tealCubeOriginalEmissive,
        progress
      );

    tealCubeMaterial
      .emissiveIntensity =
      THREE.MathUtils.lerp(
        1.5,
        tealCubeOriginalEmissiveIntensity,
        progress
      );

    if (
      progress >=
      1
    ) {

      tealCubeMaterial
        .emissive
        .copy(
          tealCubeOriginalEmissive
        );

      tealCubeMaterial
        .emissiveIntensity =
        tealCubeOriginalEmissiveIntensity;

      tealCubeGlowStartTime =
        null;
    }
  };


  const updateSettings =
    new Jolt.ExtendedUpdateSettings();

  const objectVsBroadPhaseLayerFilter =
    jolt.GetObjectVsBroadPhaseLayerFilter();

  const objectLayerPairFilter =
    jolt.GetObjectLayerPairFilter();

  const movingBPFilter =
    new Jolt.DefaultBroadPhaseLayerFilter(
      objectVsBroadPhaseLayerFilter,
      LAYER_MOVING
    );

  const movingLayerFilter =
    new Jolt.DefaultObjectLayerFilter(
      objectLayerPairFilter,
      LAYER_MOVING
    );

  const bodyFilter =
    new Jolt.BodyFilter();

  const shapeFilter =
    new Jolt.ShapeFilter();


  const initShape =
  () => {

    const positionStanding =
      new Jolt.Vec3(
        0,

        0.5 *
          characterHeightStanding +
          characterRadiusStanding,

        0
      );

    const rotation =
      Jolt.Quat.prototype
        .sIdentity();

    standingShape =
      new Jolt
        .RotatedTranslatedShapeSettings(

          positionStanding,

          rotation,

          new Jolt
            .CapsuleShapeSettings(
              0.5 *
                characterHeightStanding,

              characterRadiusStanding
            )

        )
        .Create()
        .Get();
  };


  // Stable IDs connect editable geometry to gameplay and multiplayer.
  const bodies = new Map();
  for (const object of sceneData.objects) {
    const position = new Jolt.RVec3(...object.position);
    const rotation = new Jolt.Quat(...(object.rotation ?? [0, 0, 0, 1]));
    const halfExtent = new Jolt.Vec3(...object.size.map(size => size / 2));
    const dynamic = object.motion === 'dynamic';
    const body = createBox(
      position, rotation, halfExtent,
      dynamic ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static,
      dynamic ? LAYER_MOVING : LAYER_NON_MOVING,
      object.color ?? '#ffffff', object.mass ?? null, object.friction ?? 0.2
    );
    bodies.set(object.id, body);
    Jolt.destroy(position);
    Jolt.destroy(rotation);
    Jolt.destroy(halfExtent);
  }

  const bodyIdToObjectId =
    new Map();

  for (
    const [objectId, body]
    of bodies.entries()
  ) {
    bodyIdToObjectId.set(
      body.GetID().GetIndexAndSequenceNumber(),
      objectId
    );
  }

  const objectIdFromBodyIndex =
  (bodyIndex) =>
    bodyIdToObjectId.get(
      bodyIndex
    ) ??
    `body_${bodyIndex}`;

  const snapshotIntervalSeconds =
    1;

  let nextSnapshotAt = 0;

  captureDebugSnapshot =
  () => {
    const objects = {};

    for (
      const [objectId, body]
      of bodies.entries()
    ) {
      const position =
        body.GetPosition();

      const rotation =
        body.GetRotation();

      objects[objectId] = {
        position: [
          position.GetX(),
          position.GetY(),
          position.GetZ(),
        ],

        rotation: [
          rotation.GetX(),
          rotation.GetY(),
          rotation.GetZ(),
          rotation.GetW(),
        ],
      };
    }

    const playerPosition =
      character
        ? character.GetPosition()
        : null;

    if (playerPosition) {
      objects.player_1 = {
        position: [
          playerPosition.GetX(),
          playerPosition.GetY(),
          playerPosition.GetZ(),
        ],
      };
    }

    debugRecorder.snapshot({
      frame,
      time,
      objects,
    });
  };

  emitDebugEvent({
    type: "state_change",
    objectId: "level",

    from: {
      loaded: false,
    },

    to: {
      loaded: true,
      scene: sceneFileFromRoute(),
      sessionId: debugSessionId,
    },

    causedBy: {
      type: "engine",
      objectId: "game_boot",
    },
  });

  emitDebugEvent({
    type: "state_change",
    objectId: "debug_session",

    from: {
      active: false,
    },

    to: {
      active: true,
      sceneId: sceneIdFromRoute(),
      sessionId: debugSessionId,
    },

    causedBy: {
      type: "engine",
      objectId: "debug_recorder",
    },
  });

  const lavaObjectId = bodies.get('lava').GetID().GetIndexAndSequenceNumber();
  const conveyorBeltObjectId = bodies.get('conveyor').GetID().GetIndexAndSequenceNumber();
  const conveyorSpeed = sceneData.objects.find(object => object.id === 'conveyor').speed ?? 5;
  const tealCube = bodies.get('teal-cube');
  const tealCubeId = tealCube.GetID().GetIndexAndSequenceNumber();
  let isInLava = false;
  tealCubeObject = dynamicObjects.find(object => object.userData.body === tealCube);

  tealCubeMaterial =
    tealCubeObject.material;


  // ============================================================
  // CHARACTER COLLISION LISTENER
  // ============================================================

  const characterContactListener =
    new Jolt
      .CharacterContactListenerJS();


  characterContactListener
    .OnAdjustBodyVelocity =
  (
    character,
    body2,
    linearVelocity,
    angularVelocity
  ) => {

    body2 =
      Jolt.wrapPointer(
        body2,
        Jolt.Body
      );

    linearVelocity =
      Jolt.wrapPointer(
        linearVelocity,
        Jolt.Vec3
      );

    if (
      body2
        .GetID()
        .GetIndexAndSequenceNumber() ==
      conveyorBeltObjectId
    ) {

      linearVelocity.SetX(
        linearVelocity.GetX() +
        conveyorSpeed
      );
    }
  };


  characterContactListener
    .OnContactValidate =
  (
    character,
    bodyID2,
    subShapeID2
  ) => {

    bodyID2 =
      Jolt.wrapPointer(
        bodyID2,
        Jolt.BodyID
      );

    character =
      Jolt.wrapPointer(
        character,
        Jolt.CharacterVirtual
      );

    if (
      bodyID2
        .GetIndexAndSequenceNumber() ==
      lavaObjectId
    ) {

      if (!isInLava) {
        emitDebugEvent({
          type: "state_change",
          objectId: "player_1",

          from: {
            inLava: false,
          },

          to: {
            inLava: true,
          },

          causedBy: {
            type: "collision",
            objectId: "lava",
          },
        });
      }

      isInLava =
        true;
    }

    return true;
  };


  characterContactListener
    .OnCharacterContactValidate =
  (
    character,
    otherCharacter,
    subShapeID2
  ) => {

    return true;
  };




  // ============================================================
  // PLAYER FIRST TOUCHES TEAL CUBE
  // ============================================================

  characterContactListener.OnContactAdded = (
    character,
    bodyID2,
    subShapeID2,
    contactPosition,
    contactNormal,
    settings
  ) => {

    bodyID2 = Jolt.wrapPointer(
      bodyID2,
      Jolt.BodyID
    );

    settings = Jolt.wrapPointer(
      settings,
      Jolt.CharacterContactSettings
    );

    if (
      bodyID2.GetIndexAndSequenceNumber() ===
      tealCubeId
    ) {

      settings.mCanReceiveImpulses = true;

      const contactedBodyIndex =
        bodyID2.GetIndexAndSequenceNumber();

      const cubePosition =
        tealCube.GetPosition();

      const cubeLinearVelocity =
        tealCube.GetLinearVelocity();

      const collisionEvent =
        emitDebugEvent({
          type: "collision",

          a: "player_1",
          b: objectIdFromBodyIndex(
            contactedBodyIndex
          ),

          position: [
            cubePosition.GetX(),
            cubePosition.GetY(),
            cubePosition.GetZ(),
          ],

          relativeVelocity:
            Math.hypot(
              cubeLinearVelocity.GetX(),
              cubeLinearVelocity.GetY(),
              cubeLinearVelocity.GetZ(),
            ),
        });

      tealCubeContactCount++;

      // The player touching the cube becomes its temporary
      // multiplayer authority.
      claimTealCubeAuthority();

      if (!tealCubeWasContacted) {

        console.log(
          "Player collided with the teal cube"
        );

        emitDebugEvent({
          type: "state_change",
          objectId: "teal-cube",

          from: {
            touched: false,
          },

          to: {
            touched: true,
          },

          causedBy: {
            type: "collision",
            objectId: "player_1",
          },

          parentEventId:
            collisionEvent.id,
        });

        tealCubeWasContacted = true;

        tealCubeGlowStartTime = time;

        tealCubeMaterial.emissive.set(
          0x00ffff
        );

        tealCubeMaterial.emissiveIntensity =
          1.5;

        audio.currentTime = 0;

        emitDebugEvent({
          type: "music",
          objectId: "teal-cube",

          event: "note_on",
          note: "collision_sfx",
          velocity: 1,

          causedBy: "player_1",

          parentEventId:
            collisionEvent.id,
        });

        audio.play().catch(error =>
          console.error(
            "Unable to play collision sound:",
            error
          )
        );
      }
    }
  };


  // ============================================================
  // PLAYER CONTINUES TOUCHING / PUSHING TEAL CUBE
  // ============================================================

  characterContactListener.OnContactPersisted = (
    character,
    bodyID2,
    subShapeID2,
    contactPosition,
    contactNormal,
    settings
  ) => {

    bodyID2 = Jolt.wrapPointer(
      bodyID2,
      Jolt.BodyID
    );

    settings = Jolt.wrapPointer(
      settings,
      Jolt.CharacterContactSettings
    );

    if (
      bodyID2.GetIndexAndSequenceNumber() ===
      tealCubeId
    ) {

      settings.mCanReceiveImpulses = true;
    }
  };


  // ============================================================
  // PLAYER STOPS TOUCHING TEAL CUBE
  // ============================================================

  characterContactListener.OnContactRemoved = (
    character,
    bodyID2,
    subShapeID2
  ) => {

    bodyID2 = Jolt.wrapPointer(
      bodyID2,
      Jolt.BodyID
    );

    if (
      bodyID2.GetIndexAndSequenceNumber() ===
      tealCubeId
    ) {

      const previousContactCount =
        tealCubeContactCount;

      tealCubeContactCount = Math.max(
        0,
        tealCubeContactCount - 1
      );

      if (
        previousContactCount > 0 &&
        tealCubeContactCount === 0
      ) {
        emitDebugEvent({
          type: "state_change",
          objectId: "teal-cube",

          from: {
            touched: true,
          },

          to: {
            touched: false,
          },

          causedBy: {
            type: "collision_end",
            objectId: "player_1",
          },
        });
      }

      console.log(
        "Player stopped touching teal cube"
      );
    }
  };


  characterContactListener
    .OnCharacterContactAdded =
  (
    character,
    otherCharacter,
    subShapeID2,
    contactPosition,
    contactNormal,
    settings
  ) => {

  };


  characterContactListener
    .OnCharacterContactPersisted =
  (
    character,
    otherCharacter,
    subShapeID2,
    contactPosition,
    contactNormal,
    settings
  ) => {

  };


  characterContactListener
    .OnCharacterContactRemoved =
  (
    character,
    otherCharacterID,
    subShapeID2
  ) => {

  };


  characterContactListener
    .OnContactSolve =
  (
    character,
    bodyID2,
    subShapeID2,
    contactPosition,
    contactNormal,
    contactVelocity,
    contactMaterial,
    characterVelocity,
    newCharacterVelocity
  ) => {

    character =
      Jolt.wrapPointer(
        character,
        Jolt.CharacterVirtual
      );

    contactVelocity =
      Jolt.wrapPointer(
        contactVelocity,
        Jolt.Vec3
      );

    newCharacterVelocity =
      Jolt.wrapPointer(
        newCharacterVelocity,
        Jolt.Vec3
      );

    contactNormal =
      Jolt.wrapPointer(
        contactNormal,
        Jolt.Vec3
      );

    if (
      !allowSliding &&
      contactVelocity.IsNearZero() &&
      !character.IsSlopeTooSteep(
        contactNormal
      )
    ) {

      newCharacterVelocity.SetX(
        0
      );

      newCharacterVelocity.SetY(
        0
      );

      newCharacterVelocity.SetZ(
        0
      );
    }
  };


  characterContactListener
    .OnCharacterContactSolve =
  (
    character,
    otherCharacter,
    subShapeID2,
    contactPosition,
    contactNormal,
    contactVelocity,
    contactMaterial,
    characterVelocity,
    newCharacterVelocity
  ) => {

  };


  const _tmpVec3 =
    new Jolt.Vec3();

  const _tmpRVec3 =
    new Jolt.RVec3();


  const prePhysicsUpdate =
  (
    deltaTime
  ) => {

    if (
      isInLava
    ) {

      emitDebugEvent({
        type: "state_change",
        objectId: "player_1",

        from: {
          inLava: true,
        },

        to: {
          inLava: false,
          respawned: true,
          respawnPosition:
            sceneData.respawnPosition,
        },

        causedBy: {
          type: "respawn",
          objectId: "lava",
        },
      });

      _tmpRVec3.Set(...sceneData.respawnPosition);

      character.SetPosition(
        _tmpRVec3
      );

      isInLava =
        false;
    }

    const characterUp =
      wrapVec3(
        character.GetUp()
      );

    if (
      !enableStickToFloor
    ) {

      updateSettings
        .mStickToFloorStepDown =
        Jolt.Vec3.prototype
          .sZero();

    } else {

      const vec =
        characterUp
          .clone()
          .multiplyScalar(
            -updateSettings
              .mStickToFloorStepDown
              .Length()
          );

      updateSettings
        .mStickToFloorStepDown
        .Set(
          vec.x,
          vec.y,
          vec.z
        );
    }

    if (
      !enableWalkStairs
    ) {

      updateSettings
        .mWalkStairsStepUp =
        Jolt.Vec3.prototype
          .sZero();

    } else {

      const vec =
        characterUp
          .clone()
          .multiplyScalar(
            updateSettings
              .mWalkStairsStepUp
              .Length()
          );

      updateSettings
        .mWalkStairsStepUp
        .Set(
          vec.x,
          vec.y,
          vec.z
        );
    }

    characterUp.multiplyScalar(
      -physicsSystem
        .GetGravity()
        .Length()
    );

    character.ExtendedUpdate(

      deltaTime,

      character.GetUp(),

      updateSettings,

      movingBPFilter,

      movingLayerFilter,

      bodyFilter,

      shapeFilter,

      jolt.GetTempAllocator()
    );

    threeCharacter.position.copy(
      wrapVec3(
        character.GetPosition()
      )
    );

    updateTealCubeGlow(
      time
    );

    if (
      tealCubeContactCount ===
      0
    ) {

      tealCubeWasContacted =
        false;
    }
  };


  const handleInput =
  (
    movementDirection,
    jump,
    deltaTime
  ) => {

    const playerControlsHorizontalVelocity =
      controlMovementDuringJump ||
      character.IsSupported();

    if (
      playerControlsHorizontalVelocity
    ) {

      allowSliding =
        !(
          movementDirection.length() <
          1.0e-12
        );

      if (
        enableCharacterInertia
      ) {

        desiredVelocity
          .multiplyScalar(
            0.75
          )
          .add(
            movementDirection
              .multiplyScalar(
                0.25 *
                characterSpeed
              )
          );

      } else {

        desiredVelocity
          .copy(
            movementDirection
          )
          .multiplyScalar(
            characterSpeed
          );
      }

    } else {

      allowSliding =
        true;
    }


    _tmpVec3.Set(
      upRotationX,
      0,
      upRotationZ
    );

    const characterUpRotation =
      Jolt.Quat.prototype
        .sEulerAngles(
          _tmpVec3
        );

    character.SetUp(
      characterUpRotation
        .RotateAxisY()
    );

    character.SetRotation(
      characterUpRotation
    );

    const upRotation =
      wrapQuat(
        characterUpRotation
      );


    character.UpdateGroundVelocity();


    const characterUp =
      wrapVec3(
        character.GetUp()
      );

    const linearVelocity =
      wrapVec3(
        character.GetLinearVelocity()
      );

    const currentVerticalVelocity =
      characterUp
        .clone()
        .multiplyScalar(
          linearVelocity.dot(
            characterUp
          )
        );

    const groundVelocity =
      wrapVec3(
        character.GetGroundVelocity()
      );

    const gravity =
      wrapVec3(
        physicsSystem.GetGravity()
      );


    let newVelocity;


    const movingTowardsGround =
      (
        currentVerticalVelocity.y -
        groundVelocity.y
      ) <
      0.1;


    if (
      character.GetGroundState() ==
        Jolt.EGroundState_OnGround &&

      (
        enableCharacterInertia
          ? movingTowardsGround
          : !character.IsSlopeTooSteep(
              character.GetGroundNormal()
            )
      )
    ) {

      newVelocity =
        groundVelocity;

      if (
        jump &&
        movingTowardsGround
      ) {

        newVelocity.add(
          characterUp
            .multiplyScalar(
              jumpSpeed
            )
        );
      }

    } else {

      newVelocity =
        currentVerticalVelocity
          .clone();
    }


    newVelocity.add(

      gravity
        .multiplyScalar(
          deltaTime
        )
        .applyQuaternion(
          upRotation
        )
    );


    if (
      playerControlsHorizontalVelocity
    ) {

      newVelocity.add(

        desiredVelocity
          .clone()
          .applyQuaternion(
            upRotation
          )
      );

    } else {

      const currentHorizontalVelocity =
        linearVelocity.sub(
          currentVerticalVelocity
        );

      newVelocity.add(
        currentHorizontalVelocity
      );
    }


    _tmpVec3.Set(
      newVelocity.x,
      newVelocity.y,
      newVelocity.z
    );

    character.SetLinearVelocity(
      _tmpVec3
    );
  };


  initShape();


  const settings =
    new Jolt.CharacterVirtualSettings();


  // Character weighs 1000 kg in your original setup.
  settings.mMass =
    1000;


  settings.mMaxSlopeAngle =
    maxSlopeAngle;


  // This is now 1500 instead of 100,
  // making dynamic-body pushing much stronger.
  settings.mMaxStrength =
    maxStrength;


  settings.mShape =
    standingShape;


  settings.mBackFaceMode =
    Jolt
      .EBackFaceMode_CollideWithBackFaces;


  settings.mCharacterPadding =
    characterPadding;


  settings.mPenetrationRecoverySpeed =
    penetrationRecoverySpeed;


  settings.mPredictiveContactDistance =
    predictiveContactDistance;


  settings.mSupportingVolume =
    new Jolt.Plane(

      Jolt.Vec3.prototype
        .sAxisY(),

      -characterRadiusStanding
    );


  character =
    new Jolt.CharacterVirtual(

      settings,

      new Jolt.RVec3(...sceneData.playerSpawn),

      Jolt.Quat.prototype
        .sIdentity(),

      physicsSystem
    );


  character.SetListener(
    characterContactListener
  );


  threeCharacter.geometry =
    new THREE.CapsuleGeometry(

      characterRadiusStanding,

      characterHeightStanding,

      4,

      8

    ).translate(

      0,

      0.5 *
        characterHeightStanding +
        characterRadiusStanding,

      0
    );


  threeCharacter.userData.body =
    character;


  controls.target =
    threeCharacter.position;


  scene.add(
    threeCharacter
  );


  const input = {

    forwardPressed:
      false,

    backwardPressed:
      false,

    leftPressed:
      false,

    rightPressed:
      false,

    jump:
      false
  };


  const cameraRotation =
    new THREE.Quaternion();


  onExampleUpdate =
  (
    time,
    deltaTime
  ) => {

    camera.getWorldQuaternion(
      cameraRotation
    );


    let forward =
      input.forwardPressed
        ? 1.0
        : (
            input.backwardPressed
              ? -1.0
              : 0.0
          );


    let right =
      input.rightPressed
        ? 1.0
        : (
            input.leftPressed
              ? -1.0
              : 0.0
          );


    const cameraDirectionV =
      new THREE.Vector3(

        right,

        0,

        -forward

      ).applyQuaternion(
        cameraRotation
      );


    cameraDirectionV.y =
      0;


    cameraDirectionV
      .normalize()
      .multiplyScalar(
        2
      );


    handleInput(

      cameraDirectionV,

      input.jump,

      deltaTime
    );


    const oldPosition =
      wrapVec3(
        character.GetPosition()
      );


    prePhysicsUpdate(
      deltaTime
    );


    sendLocalPlayerState();


    // Only the authoritative client actually sends this.
    sendTealCubeState();

    if (
      time >=
      nextSnapshotAt
    ) {
      captureDebugSnapshot();

      nextSnapshotAt =
        time +
        snapshotIntervalSeconds;
    }

    const newdPosition =
      wrapVec3(
        character.GetPosition()
      );


    camera.position.add(

      newdPosition.sub(
        oldPosition
      )
    );
  };


  document.addEventListener(
    "keydown",
    onDocumentKeyDown,
    false
  );


  document.addEventListener(
    "keyup",
    onDocumentKeyUp,
    false
  );


  function onDocumentKeyDown(
    event
  ) {

    var keyCode =
      event.which;


    if (
      keyCode ==
      87
    ) {

      input.forwardPressed =
        true;

    } else if (
      keyCode ==
      83
    ) {

      input.backwardPressed =
        true;

    } else if (
      keyCode ==
      65
    ) {

      input.leftPressed =
        true;

    } else if (
      keyCode ==
      68
    ) {

      input.rightPressed =
        true;

    } else if (
      keyCode ==
      32
    ) {

      input.jump =
        true;
    }
  }


  function onDocumentKeyUp(
    event
  ) {

    var keyCode =
      event.which;


    if (
      keyCode ==
      87
    ) {

      input.forwardPressed =
        false;

    } else if (
      keyCode ==
      83
    ) {

      input.backwardPressed =
        false;

    } else if (
      keyCode ==
      65
    ) {

      input.leftPressed =
        false;

    } else if (
      keyCode ==
      68
    ) {

      input.rightPressed =
        false;

    } else if (
      keyCode ==
      32
    ) {

      input.jump =
        false;
    }
  }


  physicsSystem.SetGravity(

    new Jolt.Vec3(...sceneData.gravity)
  );


  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        closeAndPersistDebugSession(
          "visibility_hidden",
          true
        );
      }
    },
    false
  );

  window.addEventListener(
    "pagehide",
    () => {
      closeAndPersistDebugSession(
        "pagehide",
        true
      );
    },
    false
  );

  window.addEventListener(
    "beforeunload",
    () => {
      closeAndPersistDebugSession(
        "beforeunload",
        true
      );
    },
    false
  );

  // Connect only after:
  // - Three.js exists
  // - Jolt exists
  // - character exists
  // - scene exists

  connectMultiplayer();
  renderExample();

}).catch(error => {
  console.error('Unable to start game:', error);
  document.getElementById('container').textContent = `Unable to start game: ${error.message}`;
});


// connectivity
var socket = null;
