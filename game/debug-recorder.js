const cloneValue = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

export class DebugRecorder {
  constructor({
    maxEvents = 20000,
    maxSnapshots = 600,
  } = {}) {
    this.events = [];
    this.snapshots = [];
    this.nextEventId = 1;
    this.maxEvents = maxEvents;
    this.maxSnapshots = maxSnapshots;
  }

  emit(event) {
    const fullEvent = {
      id: this.nextEventId++,
      ...cloneValue(event),
    };

    this.events.push(fullEvent);

    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    return fullEvent;
  }

  snapshot({ frame, time, objects }) {
    this.snapshots.push({
      frame,
      time,
      objects: cloneValue(objects),
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getEvents({
    startTime = 0,
    endTime = Number.POSITIVE_INFINITY,
    objectId = null,
    type = null,
  } = {}) {
    return this.events.filter((event) => {
      if (event.time < startTime || event.time > endTime) {
        return false;
      }

      if (type && event.type !== type) {
        return false;
      }

      if (!objectId) {
        return true;
      }

      if (event.objectId === objectId || event.a === objectId || event.b === objectId) {
        return true;
      }

      if (event.causedBy && typeof event.causedBy === "object" && event.causedBy.objectId === objectId) {
        return true;
      }

      return false;
    });
  }

  clear() {
    this.events.length = 0;
    this.snapshots.length = 0;
    this.nextEventId = 1;
  }

  toJSON() {
    return {
      events: cloneValue(this.events),
      snapshots: cloneValue(this.snapshots),
    };
  }
}
