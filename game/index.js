    import initJolt from 'https://www.unpkg.com/jolt-physics/dist/jolt-physics.wasm-compat.js';
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from
  "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
class WebGL {

 static isWebGLAvailable() {

  try {

   const canvas = document.createElement( 'canvas' );
   return !! ( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );

  } catch ( e ) {

   return false;

  }

 }

 static isWebGL2Available() {

  try {

   const canvas = document.createElement( 'canvas' );
   return !! ( window.WebGL2RenderingContext && canvas.getContext( 'webgl2' ) );

  } catch ( e ) {

   return false;

  }

 }

 static getWebGLErrorMessage() {

  return this.getErrorMessage( 1 );

 }

 static getWebGL2ErrorMessage() {

  return this.getErrorMessage( 2 );

 }

 static getErrorMessage( version ) {

  const names = {
   1: 'WebGL',
   2: 'WebGL 2'
  };

  const contexts = {
   1: window.WebGLRenderingContext,
   2: window.WebGL2RenderingContext
  };

  let message = 'Your $0 does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">$1</a>';

  const element = document.createElement( 'div' );
  element.id = 'webglmessage';
  element.style.fontFamily = 'monospace';
  element.style.fontSize = '13px';
  element.style.fontWeight = 'normal';
  element.style.textAlign = 'center';
  element.style.background = '#fff';
  element.style.color = '#000';
  element.style.padding = '1.5em';
  element.style.width = '400px';
  element.style.margin = '5em auto 0';

  if ( contexts[ version ] ) {

   message = message.replace( '$0', 'graphics card' );

  } else {

   message = message.replace( '$0', 'browser' );

  }

  message = message.replace( '$1', names[ version ] );

  element.innerHTML = message;

  return element;

 }

}
// In case you haven't built the library yourself, replace URL with: https://www.unpkg.com/jolt-physics/dist/jolt-physics.wasm-compat.js
// Graphics variables
var container, stats;
var camera, controls, scene, renderer;

// Timers
var clock = new THREE.Clock();
var time = 0;

// Physics variables
var jolt;
var physicsSystem;
var bodyInterface;

// List of objects spawned
var dynamicObjects = [];

// The update function
var onExampleUpdate;

const DegreesToRadians = (deg) => deg * (Math.PI / 180.0);

const wrapVec3 = (v) => new THREE.Vector3(v.GetX(), v.GetY(), v.GetZ());
const unwrapVec3 = (v) => new Jolt.Vec3(v.x, v.y, v.z);
const wrapRVec3 = wrapVec3;
const unwrapRVec3 = (v) => new Jolt.RVec3(v.x, v.y, v.z);
const wrapQuat = (q) => new THREE.Quaternion(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
const unwrapQuat = (q) => new Jolt.Quat(q.x, q.y, q.z, q.w);

// Object layers
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;

function getRandomQuat() {
 let vec = new Jolt.Vec3(0.001 + Math.random(), Math.random(), Math.random());
 let quat = Jolt.Quat.prototype.sRotation(vec.Normalized(), 2 * Math.PI * Math.random());
 Jolt.destroy(vec);
 return quat;
}

function onWindowResize() {

 camera.aspect = window.innerWidth / window.innerHeight;
 camera.updateProjectionMatrix();

 renderer.setSize(window.innerWidth, window.innerHeight);
}

function initGraphics() {

 renderer = new THREE.WebGLRenderer();
 renderer.setClearColor(0xbfd1e5);
 renderer.setPixelRatio(window.devicePixelRatio);
 renderer.setSize(window.innerWidth, window.innerHeight);

 camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
 camera.position.set(0, 15, 30);
 camera.lookAt(new THREE.Vector3(0, 0, 0));

 scene = new THREE.Scene();

 var dirLight = new THREE.DirectionalLight(0xffffff, 1);
 dirLight.position.set(10, 10, 5);
 scene.add(dirLight);

 controls = new OrbitControls(camera, container);

 container.appendChild(renderer.domElement);

 window.addEventListener('resize', onWindowResize, false);
}

let setupCollisionFiltering = function (settings) {
 // Layer that objects can be in, determines which other objects it can collide with
 // Typically you at least want to have 1 layer for moving bodies and 1 layer for static bodies, but you can have more
 // layers if you want. E.g. you could have a layer for high detail collision (which is not used by the physics simulation
 // but only if you do collision testing).
 let objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
 objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
 objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

 // Each broadphase layer results in a separate bounding volume tree in the broad phase. You at least want to have
 // a layer for non-moving and moving objects to avoid having to update a tree full of static objects every frame.
 // You can have a 1-on-1 mapping between object layers and broadphase layers (like in this case) but if you have
 // many object layers you'll be creating many broad phase trees, which is not efficient.
 const BP_LAYER_NON_MOVING = new Jolt.BroadPhaseLayer(0);
 const BP_LAYER_MOVING = new Jolt.BroadPhaseLayer(1);
 const NUM_BROAD_PHASE_LAYERS = 2;
 let bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_BROAD_PHASE_LAYERS);
 bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_LAYER_NON_MOVING);
 bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_LAYER_MOVING);

 settings.mObjectLayerPairFilter = objectFilter;
 settings.mBroadPhaseLayerInterface = bpInterface;
 settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(settings.mBroadPhaseLayerInterface, NUM_BROAD_PHASE_LAYERS, settings.mObjectLayerPairFilter, NUM_OBJECT_LAYERS);
};
function initPhysics() {

    // Initialize Jolt
    const settings = new Jolt.JoltSettings();

    settings.mMaxWorkerThreads = 3;

    const assertFailed = new Jolt.AssertFailedHandlerJS();

    assertFailed.OnAssertFailed = (expression, message, file, line) => {
        console.error(
            `Assert failed: (${Jolt.UTF8ToString(expression)}) ` +
            `${Jolt.UTF8ToString(message)} at ` +
            `${Jolt.UTF8ToString(file)}:${line}`
        );
    };

    settings.mAssertFailedHandler = assertFailed;

    setupCollisionFiltering(settings);

    jolt = new Jolt.JoltInterface(settings);

    Jolt.destroy(settings);

    physicsSystem = jolt.GetPhysicsSystem();
    bodyInterface = physicsSystem.GetBodyInterface();
}
function updatePhysics(deltaTime) {

 // When running below 55 Hz, do 2 steps instead of 1
 var numSteps = deltaTime > 1.0 / 55.0 ? 2 : 1;

 // Step the physics world
 jolt.Step(deltaTime, numSteps);
}

function initExample(Jolt, updateFunction) {
 window.Jolt = Jolt;

 container = document.getElementById('container');
 container.innerHTML = "";

 if (WebGL.isWebGLAvailable()) {
  onExampleUpdate = updateFunction;

  initGraphics();
  initPhysics();
  renderExample();
 } else {
  const warning = WebGL.getWebGLErrorMessage();
  container.appendChild(warning);
 }

 // The memory profiler doesn't have an ID so we can't mess with it in css, set an ID here
 let memoryprofilerCanvas = document.getElementById("memoryprofiler_canvas");
 if (memoryprofilerCanvas)
  memoryprofilerCanvas.parentElement.id = "memoryprofiler";
}

function renderExample() {

 requestAnimationFrame(renderExample);

 // Don't go below 30 Hz to prevent spiral of death
 var deltaTime = clock.getDelta();
 deltaTime = Math.min(deltaTime, 1.0 / 30.0);

 if (onExampleUpdate != null)
  onExampleUpdate(time, deltaTime);

 // Update object transforms
 for (let i = 0, il = dynamicObjects.length; i < il; i++) {
  let objThree = dynamicObjects[i];
  let body = objThree.userData.body;
  objThree.position.copy(wrapVec3(body.GetPosition()));
  objThree.quaternion.copy(wrapQuat(body.GetRotation()));

  if (body.GetBodyType() == Jolt.EBodyType_SoftBody) {
   if (objThree.userData.updateVertex) {
    objThree.userData.updateVertex();
   } else {
    objThree.geometry = createMeshForShape(body.GetShape());
   }
  }
 }

 time += deltaTime;

 updatePhysics(deltaTime);

 controls.update(deltaTime);

 renderer.render(scene, camera);
}

function addToThreeScene(body, color) {
 let threeObject = getThreeObjectForBody(body, color);
 threeObject.userData.body = body;

 scene.add(threeObject);
 dynamicObjects.push(threeObject);
}

function addToScene(body, color) {
 bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);

 addToThreeScene(body, color);
}

function removeFromScene(threeObject) {
 let id = threeObject.userData.body.GetID();
 bodyInterface.RemoveBody(id);
 bodyInterface.DestroyBody(id);
 delete threeObject.userData.body;

 scene.remove(threeObject);
 let idx = dynamicObjects.indexOf(threeObject);
 dynamicObjects.splice(idx, 1);
}

function createFloor(size = 50) {
 var shape = new Jolt.BoxShape(new Jolt.Vec3(size, 0.5, size), 0.05, null);
 var creationSettings = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(0, -0.5, 0), new Jolt.Quat(0, 0, 0, 1), Jolt.EMotionType_Static, LAYER_NON_MOVING);
 let body = bodyInterface.CreateBody(creationSettings);
 Jolt.destroy(creationSettings);
 addToScene(body, 0xc7c7c7);
 return body;
}

function createBox(position, rotation, halfExtent, motionType, layer, color = 0xffffff) {
 let shape = new Jolt.BoxShape(halfExtent, 0.05, null);
 let creationSettings = new Jolt.BodyCreationSettings(shape, position, rotation, motionType, layer);
 let body = bodyInterface.CreateBody(creationSettings);
 Jolt.destroy(creationSettings);
 addToScene(body, color);
 return body;
}

function createSphere(position, radius, motionType, layer, color = 0xffffff) {
 let shape = new Jolt.SphereShape(radius, null);
 let creationSettings = new Jolt.BodyCreationSettings(shape, position, Jolt.Quat.prototype.sIdentity(), motionType, layer);
 let body = bodyInterface.CreateBody(creationSettings);
 Jolt.destroy(creationSettings);
 addToScene(body, color);
 return body;
}

function createMeshForShape(shape) {
 // Get triangle data
 let scale = new Jolt.Vec3(1, 1, 1);
 let triContext = new Jolt.ShapeGetTriangles(shape, Jolt.AABox.prototype.sBiggest(), shape.GetCenterOfMass(), Jolt.Quat.prototype.sIdentity(), scale);
 Jolt.destroy(scale);

 // Get a view on the triangle data (does not make a copy)
 let vertices = new Float32Array(Jolt.HEAPF32.buffer, triContext.GetVerticesData(), triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT);

 // Now move the triangle data to a buffer and clone it so that we can free the memory from the C++ heap (which could be limited in size)
 let buffer = new THREE.BufferAttribute(vertices, 3).clone();
 Jolt.destroy(triContext);

 // Create a three mesh
 let geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', buffer);
 geometry.computeVertexNormals();

 return geometry;
}

function getSoftBodyMesh(body, material) {
 const motionProperties = Jolt.castObject(body.GetMotionProperties(), Jolt.SoftBodyMotionProperties);
 const vertexSettings = motionProperties.GetVertices();
 const settings = motionProperties.GetSettings();
 const positionOffset = Jolt.SoftBodyVertexTraits.prototype.mPositionOffset;
 const faceData = settings.mFaces;

 // Get a view on the triangle data
 const softVertex = [];
 for (let i = 0; i < vertexSettings.size(); i++) {
  softVertex.push(new Float32Array(Jolt.HEAP32.buffer, Jolt.getPointer(vertexSettings.at(i))+positionOffset, 3));
 }

 // Define faces (indices of vertices for the triangles)
 const faces = new Uint32Array(faceData.size()*3);
 for (let i = 0; i < faceData.size(); i++) {
  faces.set(new Uint32Array(Jolt.HEAP32.buffer, Jolt.getPointer(faceData.at(i)), 3), i * 3);
 }

 // Create a three mesh
 let geometry = new THREE.BufferGeometry();
 let vertices = new Float32Array(vertexSettings.size() * 3);
 geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
 geometry.setIndex(new THREE.BufferAttribute(faces, 1));
 material.side = THREE.DoubleSide;
 const threeObject = new THREE.Mesh(geometry, material);
 threeObject.userData.updateVertex = () => {
  for (let i = 0; i < softVertex.length; i++) {
   vertices.set(softVertex[i], i * 3);
  }
  geometry.computeVertexNormals();
  geometry.getAttribute('position').needsUpdate = true;
  geometry.getAttribute('normal').needsUpdate = true;
 }
 threeObject.userData.updateVertex();
 return threeObject;
}

function getThreeObjectForBody(body, color) {
 let material = new THREE.MeshPhongMaterial({ color: color });

 let threeObject;

 let shape = body.GetShape();
 switch (shape.GetSubType()) {
  case Jolt.EShapeSubType_Box:
   let boxShape = Jolt.castObject(shape, Jolt.BoxShape);
   let extent = wrapVec3(boxShape.GetHalfExtent()).multiplyScalar(2);
   threeObject = new THREE.Mesh(new THREE.BoxGeometry(extent.x, extent.y, extent.z, 1, 1, 1), material);
   break;
  case Jolt.EShapeSubType_Sphere:
   let sphereShape = Jolt.castObject(shape, Jolt.SphereShape);
   threeObject = new THREE.Mesh(new THREE.SphereGeometry(sphereShape.GetRadius(), 32, 32), material);
   break;
  case Jolt.EShapeSubType_Capsule:
   let capsuleShape = Jolt.castObject(shape, Jolt.CapsuleShape);
   threeObject = new THREE.Mesh(new THREE.CapsuleGeometry(capsuleShape.GetRadius(), 2 * capsuleShape.GetHalfHeightOfCylinder(), 20, 10), material);
   break;
  case Jolt.EShapeSubType_Cylinder:
   let cylinderShape = Jolt.castObject(shape, Jolt.CylinderShape);
   threeObject = new THREE.Mesh(new THREE.CylinderGeometry(cylinderShape.GetRadius(), cylinderShape.GetRadius(), 2 * cylinderShape.GetHalfHeight(), 20, 1), material);
   break;
  default:
   if (body.GetBodyType() == Jolt.EBodyType_SoftBody)
    threeObject = getSoftBodyMesh(body, material);
   else
    threeObject = new THREE.Mesh(createMeshForShape(shape), material);
   break;
 }

 threeObject.position.copy(wrapVec3(body.GetPosition()));
 threeObject.quaternion.copy(wrapQuat(body.GetRotation()));

 return threeObject;
}

  initJolt().then(function (Jolt) {
   // Initialize this example
   initExample(Jolt, null);

   const characterHeightStanding = 2;
   const characterRadiusStanding = 1;
   const characterHeightCrouching = 1;
   const characterRadiusCrouching = 0.8;

   // Character movement properties
   const controlMovementDuringJump = true;
   const characterSpeed = 6.0;
   const jumpSpeed = 15.0;

   const enableCharacterInertia = true;

   const upRotationX = 0;
   const upRotationZ = 0;
   const maxSlopeAngle = DegreesToRadians(45.0);
   const maxStrength = 100.0;
   const characterPadding = 0.02;
   const penetrationRecoverySpeed = 1.0;
   const predictiveContactDistance = 0.1;
   const enableWalkStairs = true;
   const enableStickToFloor = true;

   let shapeType = 'Capsule';
   let standingShape;
   let crouchingShape;
   let threeStandingGeometry;
   let threeCrouchingGeometry;

   let character;
   let isCrouched = false;
   let allowSliding = false;

   const geometry = new THREE.BoxGeometry(1, 1, 1);
   const material = new THREE.MeshPhongMaterial({ color: 0xffff00 });
   let threeCharacter = new THREE.Mesh(geometry, material);
   let desiredVelocity = new THREE.Vector3();
   let tealCubeObject;
   let tealCubeMaterial;
   let tealCubeContactCount = 0;
   let tealCubeWasContacted = false;
   let tealCubeGlowStartTime = null;
   const tealCubeOriginalEmissive = new THREE.Color(0x000000);
   const tealCubeOriginalEmissiveIntensity = 0;
   const tealCubeGlowDuration = 5;
   const audio = new Audio('./game/sound.m4a');

   const updateTealCubeGlow = (currentTime) => {
    if (!tealCubeMaterial || tealCubeGlowStartTime === null)
     return;

    const elapsed = currentTime - tealCubeGlowStartTime;
    const progress = Math.min(elapsed / tealCubeGlowDuration, 1);
    tealCubeMaterial.emissive.lerp(tealCubeOriginalEmissive, progress);
    tealCubeMaterial.emissiveIntensity = THREE.MathUtils.lerp(1.5, tealCubeOriginalEmissiveIntensity, progress);

    if (progress >= 1) {
     tealCubeMaterial.emissive.copy(tealCubeOriginalEmissive);
     tealCubeMaterial.emissiveIntensity = tealCubeOriginalEmissiveIntensity;
     tealCubeGlowStartTime = null;
    }
   };

   const updateSettings = new Jolt.ExtendedUpdateSettings();

   const objectVsBroadPhaseLayerFilter = jolt.GetObjectVsBroadPhaseLayerFilter();
   const objectLayerPairFilter = jolt.GetObjectLayerPairFilter();

   const movingBPFilter = new Jolt.DefaultBroadPhaseLayerFilter(objectVsBroadPhaseLayerFilter, LAYER_MOVING);
   const movingLayerFilter = new Jolt.DefaultObjectLayerFilter(objectLayerPairFilter, LAYER_MOVING);
   const bodyFilter = new Jolt.BodyFilter();
   const shapeFilter = new Jolt.ShapeFilter();

   const initShape = () => {
    const positionStanding = new Jolt.Vec3(0, 0.5 * characterHeightStanding + characterRadiusStanding, 0);
    const positionCrouching = new Jolt.Vec3(0, 0.5 * characterHeightCrouching + characterRadiusCrouching, 0);
    const rotation = Jolt.Quat.prototype.sIdentity();

    switch (shapeType) {
     case 'Capsule':
      standingShape = new Jolt.RotatedTranslatedShapeSettings(positionStanding, rotation, new Jolt.CapsuleShapeSettings(0.5 * characterHeightStanding, characterRadiusStanding)).Create().Get();
      crouchingShape = new Jolt.RotatedTranslatedShapeSettings(positionCrouching, rotation, new Jolt.CapsuleShapeSettings(0.5 * characterHeightCrouching, characterRadiusCrouching)).Create().Get();

      threeStandingGeometry = new THREE.CapsuleGeometry(characterRadiusStanding, characterHeightStanding, 4, 8).translate(0, 0.5 * characterHeightStanding + characterRadiusStanding, 0);
      threeCrouchingGeometry = new THREE.CapsuleGeometry(characterRadiusCrouching, characterHeightCrouching, 4, 8).translate(0, 0.5 * characterHeightCrouching + characterRadiusCrouching, 0);
      break;

     case 'Cylinder':
      standingShape = new Jolt.RotatedTranslatedShapeSettings(positionStanding, rotation, new Jolt.CylinderShapeSettings(0.5 * characterHeightStanding + characterRadiusStanding, characterRadiusStanding)).Create().Get();
      crouchingShape = new Jolt.RotatedTranslatedShapeSettings(positionCrouching, rotation, new Jolt.CylinderShapeSettings(0.5 * characterHeightCrouching + characterRadiusCrouching, characterRadiusCrouching)).Create().Get();

      threeStandingGeometry = new THREE.CylinderGeometry(characterRadiusStanding, characterRadiusStanding, 2 * characterRadiusStanding + characterHeightStanding, 8, 4).translate(0, 0.5 * characterHeightStanding + characterRadiusStanding, 0);
      threeCrouchingGeometry = new THREE.CylinderGeometry(characterRadiusCrouching, characterRadiusCrouching, 2 * characterRadiusCrouching + characterHeightCrouching, 8, 4).translate(0, 0.5 * characterHeightCrouching + characterRadiusCrouching, 0);
      break;

     case 'Box':
      standingShape = new Jolt.RotatedTranslatedShapeSettings(positionStanding, rotation, new Jolt.BoxShapeSettings(new Jolt.Vec3(characterRadiusStanding, 0.5 * characterHeightStanding + characterRadiusStanding, characterRadiusStanding))).Create().Get();
      crouchingShape = new Jolt.RotatedTranslatedShapeSettings(positionCrouching, rotation, new Jolt.BoxShapeSettings(new Jolt.Vec3(characterRadiusCrouching, 0.5 * characterHeightCrouching + characterRadiusCrouching, characterRadiusCrouching))).Create().Get();

      threeStandingGeometry = new THREE.BoxGeometry(2 * characterRadiusStanding, 2 * characterRadiusStanding + characterHeightStanding, 2 * characterRadiusStanding).translate(0, 0.5 * characterHeightStanding + characterRadiusStanding, 0);
      threeCrouchingGeometry = new THREE.BoxGeometry(2 * characterRadiusCrouching, 2 * characterRadiusCrouching + characterHeightCrouching, 2 * characterRadiusCrouching).translate(0, 0.5 * characterHeightCrouching + characterRadiusCrouching, 0);
      break;
    }
   }

   const lavaObject = createBox(new Jolt.RVec3(0, -50, 0), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(1000, 2, 1000), Jolt.EMotionType_Static, LAYER_NON_MOVING, 0xcc2222);
   const lavaObjectId = lavaObject.GetID().GetIndexAndSequenceNumber();
   let isInLava = false;

   const conveyorBeltObject = createBox(new Jolt.RVec3(0, 0, -10), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(10, 0.25, 2), Jolt.EMotionType_Static, LAYER_NON_MOVING, 0x2222cc);
   const conveyorBeltObjectId = conveyorBeltObject.GetID().GetIndexAndSequenceNumber();

   const tealCube = createBox(new Jolt.RVec3(-10.0, 5.0, 10.0), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(0.75, 0.75, 0.75), Jolt.EMotionType_Dynamic, LAYER_MOVING, 0x00ffff);
   const tealCubeId = tealCube.GetID().GetIndexAndSequenceNumber();
   tealCubeObject = dynamicObjects[dynamicObjects.length - 1];
   tealCubeMaterial = tealCubeObject.material;

   const characterContactListener = new Jolt.CharacterContactListenerJS();
   characterContactListener.OnAdjustBodyVelocity = (character, body2, linearVelocity, angularVelocity) => {
    body2 = Jolt.wrapPointer(body2, Jolt.Body);
    linearVelocity = Jolt.wrapPointer(linearVelocity, Jolt.Vec3);
    // Apply artificial velocity to the character when standing on the conveyor belt
    if (body2.GetID().GetIndexAndSequenceNumber() == conveyorBeltObjectId) {
     linearVelocity.SetX(linearVelocity.GetX() + 5);
    }
   };
   characterContactListener.OnContactValidate = (character, bodyID2, subShapeID2) => {
    bodyID2 = Jolt.wrapPointer(bodyID2, Jolt.BodyID);
    character = Jolt.wrapPointer(character, Jolt.CharacterVirtual);
    if (bodyID2.GetIndexAndSequenceNumber() == lavaObjectId)
     isInLava = true; // Can't modify velocity or position at this point, marking that we want to teleport
    return true;
   };
   characterContactListener.OnCharacterContactValidate = (character, otherCharacter, subShapeID2) => {
    return true;
   };
   characterContactListener.OnContactAdded = (character, bodyID2, subShapeID2, contactPosition, contactNormal, settings) => {
    bodyID2 = Jolt.wrapPointer(bodyID2, Jolt.BodyID);
    if (bodyID2.GetIndexAndSequenceNumber() == tealCubeId) {
     tealCubeContactCount++;
     if (!tealCubeWasContacted) {
      console.log("Player collided with the teal cube");
      tealCubeWasContacted = true;
      tealCubeGlowStartTime = time;
      tealCubeMaterial.emissive.set(0x00ffff);
      tealCubeMaterial.emissiveIntensity = 1.5;
      audio.currentTime = 0;
      audio.play().catch(error => console.error("Unable to play collision sound:", error));
     }
   }
   };
   characterContactListener.OnContactPersisted = (character, bodyID2, subShapeID2, contactPosition, contactNormal, settings) => {
    bodyID2 = Jolt.wrapPointer(bodyID2, Jolt.BodyID);
    if (bodyID2.GetIndexAndSequenceNumber() == tealCubeId)
     tealCubeContactCount++;
   };
   characterContactListener.OnContactRemoved = (character, bodyID2, subShapeID2) => {
    bodyID2 = Jolt.wrapPointer(bodyID2, Jolt.BodyID);
    if (bodyID2.GetIndexAndSequenceNumber() == tealCubeId)
     tealCubeContactCount = Math.max(0, tealCubeContactCount - 1);
   };
   characterContactListener.OnCharacterContactAdded = (character, otherCharacter, subShapeID2, contactPosition, contactNormal, settings) => {
   };
   characterContactListener.OnCharacterContactPersisted = (character, otherCharacter, subShapeID2, contactPosition, contactNormal, settings) => {
   };
   characterContactListener.OnCharacterContactRemoved = (character, otherCharacterID, subShapeID2) => {
   };
   characterContactListener.OnContactSolve = (character, bodyID2, subShapeID2, contactPosition, contactNormal, contactVelocity, contactMaterial, characterVelocity, newCharacterVelocity) => {
    // Don't allow the player to slide down static not-too-steep surfaces when not actively moving and when not on a moving platform
    character = Jolt.wrapPointer(character, Jolt.CharacterVirtual);
    contactVelocity = Jolt.wrapPointer(contactVelocity, Jolt.Vec3);
    newCharacterVelocity = Jolt.wrapPointer(newCharacterVelocity, Jolt.Vec3);
    contactNormal = Jolt.wrapPointer(contactNormal, Jolt.Vec3);
    if (!allowSliding && contactVelocity.IsNearZero() && !character.IsSlopeTooSteep(contactNormal)) {
     newCharacterVelocity.SetX(0);
     newCharacterVelocity.SetY(0);
     newCharacterVelocity.SetZ(0);
    }
   };
   characterContactListener.OnCharacterContactSolve = (character, otherCharacter, subShapeID2, contactPosition, contactNormal, contactVelocity, contactMaterial, characterVelocity, newCharacterVelocity) => {
   };

   const _tmpVec3 = new Jolt.Vec3();
   const _tmpRVec3 = new Jolt.RVec3();
   const prePhysicsUpdate = (deltaTime) => {
    if (isInLava) {
     // Teleport the user back to the origin if they fall off the platform
     _tmpRVec3.Set(0, 10, 0);
     character.SetPosition(_tmpRVec3);
     isInLava = false;
    }
    const characterUp = wrapVec3(character.GetUp());
    if (!enableStickToFloor) {
     updateSettings.mStickToFloorStepDown = Jolt.Vec3.prototype.sZero();
    } else {
     const vec = characterUp.clone().multiplyScalar(-updateSettings.mStickToFloorStepDown.Length());
     updateSettings.mStickToFloorStepDown.Set(vec.x, vec.y, vec.z);
    }

    if (!enableWalkStairs) {
     updateSettings.mWalkStairsStepUp = Jolt.Vec3.prototype.sZero();
    } else {
     const vec = characterUp.clone().multiplyScalar(updateSettings.mWalkStairsStepUp.Length());
     updateSettings.mWalkStairsStepUp.Set(vec.x, vec.y, vec.z);
    }
    characterUp.multiplyScalar(-physicsSystem.GetGravity().Length());
    character.ExtendedUpdate(deltaTime,
     character.GetUp(),
     updateSettings,
     movingBPFilter,
     movingLayerFilter,
     bodyFilter,
     shapeFilter,
     jolt.GetTempAllocator());

    threeCharacter.position.copy(wrapVec3(character.GetPosition()));
    updateTealCubeGlow(time);
    if (tealCubeContactCount === 0)
     tealCubeWasContacted = false;
   };

   const handleInput = (movementDirection, jump, switchStance, deltaTime) => {
    const playerControlsHorizontalVelocity = controlMovementDuringJump || character.IsSupported();
    if (playerControlsHorizontalVelocity) {
     // True if the player intended to move
     allowSliding = !(movementDirection.length() < 1.0e-12);
     // Smooth the player input
     if (enableCharacterInertia) {
      desiredVelocity.multiplyScalar(0.75).add(movementDirection.multiplyScalar(0.25 * characterSpeed));
     } else {
      desiredVelocity.copy(movementDirection).multiplyScalar(characterSpeed);
     }
    } else {
     // While in air we allow sliding
     allowSliding = true;
    }
    _tmpVec3.Set(upRotationX, 0, upRotationZ);
    const characterUpRotation = Jolt.Quat.prototype.sEulerAngles(_tmpVec3);
    character.SetUp(characterUpRotation.RotateAxisY());
    character.SetRotation(characterUpRotation);
    const upRotation = wrapQuat(characterUpRotation);

    character.UpdateGroundVelocity();
    const characterUp = wrapVec3(character.GetUp());
    const linearVelocity = wrapVec3(character.GetLinearVelocity());
    const currentVerticalVelocity = characterUp.clone().multiplyScalar(linearVelocity.dot(characterUp));
    const groundVelocity = wrapVec3(character.GetGroundVelocity());
    const gravity = wrapVec3(physicsSystem.GetGravity());

    let newVelocity;
    const movingTowardsGround = (currentVerticalVelocity.y - groundVelocity.y) < 0.1;
    if (character.GetGroundState() == Jolt.EGroundState_OnGround
     && (enableCharacterInertia ?
      movingTowardsGround
      : !character.IsSlopeTooSteep(character.GetGroundNormal())))
    {
     // Assume velocity of ground when on ground
     newVelocity = groundVelocity;

     // Jump
     if (jump && movingTowardsGround)
      newVelocity.add(characterUp.multiplyScalar(jumpSpeed));
    }
    else
     newVelocity = currentVerticalVelocity.clone();

    // Gravity
    newVelocity.add(gravity.multiplyScalar(deltaTime).applyQuaternion(upRotation));

    if (playerControlsHorizontalVelocity) {
     // Player input
     newVelocity.add(desiredVelocity.clone().applyQuaternion(upRotation));
    } else {
     // Preserve horizontal velocity
     const currentHorizontalVelocity = linearVelocity.sub(currentVerticalVelocity);
     newVelocity.add(currentHorizontalVelocity);
    }

    _tmpVec3.Set(newVelocity.x, newVelocity.y, newVelocity.z);
    character.SetLinearVelocity(_tmpVec3);
   };

   const setCrouched = (crouched, forceUpdate) => {
    if (crouched != isCrouched || forceUpdate) {
     let newShape;
     let newGeometry;
     if (crouched) {
      newShape = crouchingShape;
      newGeometry = threeCrouchingGeometry;
     } else {
      newShape = standingShape;
      newGeometry = threeStandingGeometry;
     }
     if (character.SetShape(newShape,
      1.5 * physicsSystem.GetPhysicsSettings().mPenetrationSlop,
      movingBPFilter,
      movingLayerFilter,
      bodyFilter,
      shapeFilter,
      jolt.GetTempAllocator())) {
      // Accept the new shape only when the SetShape call was successful
      isCrouched = crouched;
      threeCharacter.geometry = newGeometry;
     }
    }
   };

   // Create a basic floor
   createFloor();

   createBox(new Jolt.RVec3(-45, 1, 0), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(0.5, 2, 45), Jolt.EMotionType_Static, LAYER_NON_MOVING);
   createBox(new Jolt.RVec3(45, 1, 0), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(0.5, 2, 45), Jolt.EMotionType_Static, LAYER_NON_MOVING);

   // Stairs
   for (let j = 0; j < 5; j++) {
    let stepHeight = 0.3 + 0.1 * j;
    for (let i = 1; i < 10; i++) {
     createBox(new Jolt.RVec3(15 + 5 * j, i * stepHeight - 0.5 + stepHeight / 2, -20 - i * 3), Jolt.Quat.prototype.sIdentity(), new Jolt.Vec3(2, stepHeight / 2, 2), Jolt.EMotionType_Static, LAYER_NON_MOVING);
    }
   }

   // Slopes
   for (let i = 0; i < 10; i++) {
    createBox(new Jolt.RVec3(-40 + 5 * i, 2, -25), Jolt.Quat.prototype.sRotation(new Jolt.Vec3(1, 0, 0), DegreesToRadians(70 - i * 5.0)), new Jolt.Vec3(2.5, 0.6, 8), Jolt.EMotionType_Static, LAYER_NON_MOVING);
   }

   initShape();

   const settings = new Jolt.CharacterVirtualSettings();
   settings.mMass = 1000;
   settings.mMaxSlopeAngle = maxSlopeAngle;
   settings.mMaxStrength = maxStrength;
   settings.mShape = standingShape;
   settings.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
   settings.mCharacterPadding = characterPadding;
   settings.mPenetrationRecoverySpeed = penetrationRecoverySpeed;
   settings.mPredictiveContactDistance = predictiveContactDistance;
   settings.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -characterRadiusStanding);
   character = new Jolt.CharacterVirtual(settings, Jolt.RVec3.prototype.sZero(), Jolt.Quat.prototype.sIdentity(), physicsSystem);
   character.SetListener(characterContactListener);

   threeCharacter.geometry = threeStandingGeometry;
   threeCharacter.userData.body = character;

   controls.target = threeCharacter.position;
   scene.add(threeCharacter);

   const input = {
    forwardPressed: false,
    backwardPressed: false,
    leftPressed: false,
    rightPressed: false,
    jump: false,
    crouched: false
   };

   const cameraRotation = new THREE.Quaternion();
   onExampleUpdate = (time, deltaTime) => {
    setCrouched(input.crouched);
    camera.getWorldQuaternion(cameraRotation);
    let forward = input.forwardPressed ? 1.0 : (input.backwardPressed ? -1.0 : 0.0);
    let right = input.rightPressed ? 1.0 : (input.leftPressed ? -1.0 : 0.0);
    const cameraDirectionV = new THREE.Vector3(right, 0, -forward).applyQuaternion(cameraRotation);
    cameraDirectionV.y = 0;
    cameraDirectionV.normalize().multiplyScalar(2);
    handleInput(cameraDirectionV, input.jump, input.switchStance, deltaTime);

    const oldPosition = wrapVec3(character.GetPosition());
    prePhysicsUpdate(deltaTime);
    const newdPosition = wrapVec3(character.GetPosition());
    camera.position.add(newdPosition.sub(oldPosition));
   };

   document.addEventListener("keydown", onDocumentKeyDown, false);
   document.addEventListener("keyup", onDocumentKeyUp, false);
   function onDocumentKeyDown(event) {
    var keyCode = event.which;
    if (keyCode == 87) {
     input.forwardPressed = true;
    } else if (keyCode == 83) {
     input.backwardPressed = true;
    } else if (keyCode == 65) {
     input.leftPressed = true;
    } else if (keyCode == 68) {
     input.rightPressed = true;
    } else if (keyCode == 32) {
     input.jump = true;
    } else if (keyCode == 16) {
     input.crouched = true;
    }
   };
   function onDocumentKeyUp(event) {
    var keyCode = event.which;
    if (keyCode == 87) {
     input.forwardPressed = false;
    } else if (keyCode == 83) {
     input.backwardPressed = false;
    } else if (keyCode == 65) {
     input.leftPressed = false;
    } else if (keyCode == 68) {
     input.rightPressed = false;
    } else if (keyCode == 32) {
     input.jump = false;
    } else if (keyCode == 16) {
     input.crouched = false;
    }
   };

   const collisionShapeElement = document.getElementById('collision-shape');
   collisionShapeElement.addEventListener('change', () => {
    shapeType = collisionShapeElement.value;
    initShape();
    setCrouched(input.crouched, true);
   });

   physicsSystem.SetGravity(new Jolt.Vec3(0, -25, 0));
  });

//connectivityvar socket = null;
var socket = null;

function connect() {
  const scheme =
    location.protocol === "https:"
      ? "wss"
      : "ws";

  const serverUrl =
    `${scheme}://${location.host}/ws`;

  socket = new WebSocket(serverUrl);

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onmessage = event => {
    const msg = JSON.parse(event.data);

    console.log("Received:", msg);
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
  };

  socket.onerror = error => {
    console.error("WebSocket error:", error);
  };
}

connect();
