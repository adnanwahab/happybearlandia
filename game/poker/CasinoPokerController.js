import * as THREE from "three";

import { PokerGame } from "./PokerGame.js";
import { getPlayerSeatPosition } from "./utils/getPlayerSeatPosition.js";

export const POKER_UI_EVENT_NAME = "hbl:poker-ui";
export const POKER_ACTION_EVENT_NAME = "hbl:poker-action";

function publishPokerUi(uiState) {
  window.__hblPokerUi = uiState;

  window.dispatchEvent(
    new CustomEvent(POKER_UI_EVENT_NAME, {
      detail: uiState,
    }),
  );
}

function quaternionLookAt(from, to) {
  const probe = new THREE.Object3D();
  probe.position.copy(from);
  probe.lookAt(to);
  return probe.quaternion.clone();
}

function easeInOutQuint(t) {
  if (t < 0.5) {
    return 16 * t * t * t * t * t;
  }

  const f = -2 * t + 2;
  return 1 - (f * f * f * f * f) / 2;
}

function cubicBezier3(out, p0, p1, p2, p3, t) {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const t2 = t * t;
  const t3 = t2 * t;

  out.set(0, 0, 0)
    .addScaledVector(p0, inv3)
    .addScaledVector(p1, 3 * inv2 * t)
    .addScaledVector(p2, 3 * inv * t2)
    .addScaledVector(p3, t3);

  return out;
}

export function createCasinoPokerController({
  scene,
  camera,
  renderer,
  controls,
  tableCenter,
  tableY,
  getPlayerPosition,
  interactionRange = 5.8,
}) {
  const internalState = {
    active: false,
    nearTable: false,
    disposed: false,
    latestGameUi: null,

    cameraTransition: null,
    cameraTransitionId: 0,

    savedCameraState: null,
    controlsRestorePending: false,

    motionToken: 0,
    handStartTimeoutId: null,
    controlsRestoreTimeoutId: null,
  };

  const bezierPoint = new THREE.Vector3();

  const pokerGame = new PokerGame({
    scene,
    camera,
    renderer,
    tableCenter,
    tableY,
    onUiStateChange: uiState => {
      internalState.latestGameUi = uiState;
      publishState();
    },
  });

  function clearTimers() {
    if (internalState.handStartTimeoutId) {
      clearTimeout(internalState.handStartTimeoutId);
      internalState.handStartTimeoutId = null;
    }

    if (internalState.controlsRestoreTimeoutId) {
      clearTimeout(internalState.controlsRestoreTimeoutId);
      internalState.controlsRestoreTimeoutId = null;
    }
  }

  function getDistanceToTable() {
    const playerPosition = getPlayerPosition?.();

    if (!playerPosition) {
      return Number.POSITIVE_INFINITY;
    }

    const dx = playerPosition.x - tableCenter.x;
    const dz = playerPosition.z - tableCenter.z;

    return Math.hypot(dx, dz);
  }

  function getCameraSeatPose() {
    const seat = getPlayerSeatPosition(0, 4, {
      center: tableCenter,
      radiusX: 3.35,
      radiusZ: 2.2,
      y: tableY - 1.25,
    });

    const lookTarget = tableCenter.clone().add(new THREE.Vector3(0, 0.12, 0));

    const towardTable = lookTarget.clone().sub(seat);
    towardTable.y = 0;
    towardTable.normalize();

    const right = new THREE.Vector3(-towardTable.z, 0, towardTable.x).normalize();

    const cameraPosition = seat
      .clone()
      .add(new THREE.Vector3(0, 1.05, 0))
      .add(towardTable.clone().multiplyScalar(0.26))
      .add(right.multiplyScalar(0.05));

    return {
      position: cameraPosition,
      quaternion: quaternionLookAt(cameraPosition, lookTarget),
    };
  }

  function startCameraTransition({
    toPosition,
    toQuaternion,
    durationSeconds,
    arcHeight = 0.65,
  }) {
    const fromPosition = camera.position.clone();
    const fromQuaternion = camera.quaternion.clone();

    const direction = toPosition.clone().sub(fromPosition);
    const distance = direction.length();

    const upArc = arcHeight + Math.min(1.2, distance * 0.08);

    const p0 = fromPosition;
    const p3 = toPosition.clone();
    const p1 = fromPosition.clone().add(new THREE.Vector3(0, upArc, 0));
    const p2 = toPosition.clone().add(new THREE.Vector3(0, upArc * 0.58, 0));

    internalState.cameraTransitionId += 1;

    internalState.cameraTransition = {
      id: internalState.cameraTransitionId,
      elapsed: 0,
      duration: Math.max(0.01, durationSeconds),
      p0,
      p1,
      p2,
      p3,
      fromQuaternion,
      toQuaternion: toQuaternion.clone(),
    };

    return internalState.cameraTransition.id;
  }

  function updateCameraTransition(deltaTime) {
    const transition = internalState.cameraTransition;

    if (!transition) {
      return;
    }

    transition.elapsed += deltaTime;

    const t = Math.min(1, transition.elapsed / transition.duration);
    const eased = easeInOutQuint(t);

    cubicBezier3(bezierPoint, transition.p0, transition.p1, transition.p2, transition.p3, eased);
    camera.position.copy(bezierPoint);

    camera.quaternion.slerpQuaternions(
      transition.fromQuaternion,
      transition.toQuaternion,
      eased,
    );

    if (t >= 1) {
      internalState.cameraTransition = null;
    }
  }

  function publishState() {
    const gameUi = internalState.latestGameUi;

    const uiState = {
      active: internalState.active,
      nearTable: internalState.nearTable,
      canSit: !internalState.active && internalState.nearTable,
      canStand: internalState.active,
      promptText: "Press E to play poker",
      ...(gameUi ?? {
        running: false,
        message: "",
        state: "waiting",
        players: [],
        communityCards: [],
        humanCards: [],
        pot: 0,
        currentBet: 0,
        availableActions: {
          fold: false,
          check: false,
          call: false,
          raise: false,
        },
        callAmount: 0,
        minRaiseTo: 0,
        maxRaiseTo: 0,
        suggestedRaiseTo: 0,
        isHumanTurn: false,
      }),
    };

    window.__hblPokerDialogActive = internalState.active === true;
    publishPokerUi(uiState);
  }

  function enterPoker() {
    if (internalState.active || internalState.disposed) {
      return;
    }

    clearTimers();

    internalState.active = true;
    internalState.motionToken += 1;
    const motionToken = internalState.motionToken;

    internalState.savedCameraState = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      controlsEnabled: controls.enabled,
    };

    controls.enabled = false;

    pokerGame.setHumanSeatBearVisible(false);

    const seatPose = getCameraSeatPose();

    startCameraTransition({
      toPosition: seatPose.position,
      toQuaternion: seatPose.quaternion,
      durationSeconds: 1.15,
      arcHeight: 0.72,
    });

    internalState.handStartTimeoutId = setTimeout(() => {
      internalState.handStartTimeoutId = null;

      if (internalState.disposed || !internalState.active || motionToken !== internalState.motionToken) {
        return;
      }

      pokerGame.start();
      publishState();
    }, 980);

    publishState();
  }

  function exitPoker() {
    if (!internalState.active) {
      return;
    }

    clearTimers();

    internalState.active = false;
    internalState.motionToken += 1;
    const motionToken = internalState.motionToken;

    const saved = internalState.savedCameraState;

    if (saved) {
      startCameraTransition({
        toPosition: saved.position,
        toQuaternion: saved.quaternion,
        durationSeconds: 0.95,
        arcHeight: 0.62,
      });

      internalState.controlsRestorePending = true;

      internalState.controlsRestoreTimeoutId = setTimeout(() => {
        internalState.controlsRestoreTimeoutId = null;

        if (internalState.disposed || motionToken !== internalState.motionToken) {
          return;
        }

        controls.enabled = saved.controlsEnabled;
        internalState.controlsRestorePending = false;
      }, 980);
    } else {
      controls.enabled = true;
      internalState.controlsRestorePending = false;
    }

    pokerGame.stop();
    pokerGame.setHumanSeatBearVisible(true);
    publishState();
  }

  function handlePokerAction(action, amount) {
    if (action === "start") {
      if (internalState.nearTable) {
        enterPoker();
      }

      return;
    }

    if (action === "stand") {
      exitPoker();
      return;
    }

    if (!internalState.active) {
      return;
    }

    switch (action) {
      case "fold":
        pokerGame.fold();
        break;
      case "check":
        pokerGame.check();
        break;
      case "call":
        pokerGame.call();
        break;
      case "raise":
        pokerGame.raise(amount);
        break;
      default:
        break;
    }
  }

  function onPokerActionEvent(event) {
    const action = event?.detail?.action;
    const amount = event?.detail?.amount;

    if (typeof action !== "string") {
      return;
    }

    handlePokerAction(action, amount);
  }

  function onKeyDown(event) {
    if (internalState.disposed) {
      return false;
    }

    if (event.key === "e" || event.key === "E") {
      if (internalState.active) {
        exitPoker();
        event.preventDefault();
        return true;
      }

      if (internalState.nearTable) {
        enterPoker();
        event.preventDefault();
        return true;
      }
    }

    if (event.key === "Escape" && internalState.active) {
      exitPoker();
      event.preventDefault();
      return true;
    }

    return false;
  }

  function update(deltaTime) {
    if (internalState.disposed) {
      return;
    }

    const nearTableNow = getDistanceToTable() <= interactionRange;

    if (nearTableNow !== internalState.nearTable) {
      internalState.nearTable = nearTableNow;
      publishState();
    }

    updateCameraTransition(deltaTime);
    pokerGame.update(deltaTime);
  }

  async function init() {
    await pokerGame.init();
    publishState();
    window.addEventListener(POKER_ACTION_EVENT_NAME, onPokerActionEvent);
  }

  function dispose() {
    if (internalState.disposed) {
      return;
    }

    internalState.disposed = true;

    clearTimers();

    window.removeEventListener(POKER_ACTION_EVENT_NAME, onPokerActionEvent);

    pokerGame.stop();
    pokerGame.setHumanSeatBearVisible(true);

    if (internalState.savedCameraState && internalState.controlsRestorePending) {
      controls.enabled = internalState.savedCameraState.controlsEnabled;
      internalState.controlsRestorePending = false;
    }

    window.__hblPokerDialogActive = false;
    publishPokerUi({
      active: false,
      nearTable: false,
      canSit: false,
      canStand: false,
      running: false,
      promptText: "Press E to play poker",
      players: [],
      communityCards: [],
      humanCards: [],
      state: "waiting",
      message: "",
      pot: 0,
      currentBet: 0,
      availableActions: {
        fold: false,
        check: false,
        call: false,
        raise: false,
      },
      callAmount: 0,
      minRaiseTo: 0,
      maxRaiseTo: 0,
      suggestedRaiseTo: 0,
      isHumanTurn: false,
    });
  }

  return {
    init,
    update,
    onKeyDown,
    dispose,
    isActive: () => internalState.active,
  };
}
