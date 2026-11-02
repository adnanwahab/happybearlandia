import { describe, expect, test } from "bun:test";
import {
  buildPensieveHandoff,
  buildPensieveLaunchUrl,
  postPensieveHandoff,
  validatePensieveHandoff,
} from "../world/pensieve-handoff.js";

const record = {
  id: "record_1",
  experiment: {
    id: "experiment_1",
    plan: { id: "plan_1", title: "Housing plan" },
    lineage: { revision: 2 },
  },
  worldBatch: { runs: 1000 },
};

describe("Pensieve handoff", () => {
  test("packages a complete experiment snapshot", () => {
    const handoff = buildPensieveHandoff({ record, sourceUrl: "http://localhost/world/experiment-lab.html" });
    expect(validatePensieveHandoff(handoff).ok).toBe(true);
    expect(handoff.source.recordId).toBe("record_1");
    expect(handoff.source.revision).toBe(2);
    expect(handoff.snapshot.worldBatch.runs).toBe(1000);
  });

  test("builds a compact launch URL without serializing the snapshot", () => {
    const handoff = buildPensieveHandoff({ record });
    const url = new URL(buildPensieveLaunchUrl("https://example.test/museum/", handoff));
    expect(url.searchParams.get("hbl_record")).toBe("record_1");
    expect(url.searchParams.get("hbl_handoff")).toBe("pensieve-civic-handoff.v1");
    expect(url.href.length).toBeLessThan(500);
  });

  test("posts the handoff with a stable event type", () => {
    const messages = [];
    const targetWindow = { postMessage(value, origin) { messages.push({ value, origin }); } };
    const handoff = buildPensieveHandoff({ record });
    postPensieveHandoff(targetWindow, "https://pensieve.example", handoff);
    expect(messages[0].value.type).toBe("hbl:pensieve-civic-handoff");
    expect(messages[0].origin).toBe("https://pensieve.example");
  });
});
