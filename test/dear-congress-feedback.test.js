import { describe, expect, test } from "bun:test";
import {
  buildDearCongressRevisionDraft,
  buildRevisionNarrative,
  postDearCongressRevisionDraft,
} from "../world/dear-congress-feedback.js";

const experiment = {
  id: "exp_1",
  plan: { id: "plan_1", title: "Affordable Housing" },
};
const improvement = {
  id: "improve_permits",
  title: "Reduce permitting delay",
  description: "Create a fast-track path for qualifying projects.",
  targetVariableLabel: "Permitting delay",
};
const comparison = {
  worldCount: 1000,
  scoreDelta: 3.2,
  before: { robustness: 0.68, expectedScore: 71.1 },
  after: { robustness: 0.79, expectedScore: 74.3 },
};

describe("Dear Congress feedback", () => {
  test("builds an auditable revision narrative", () => {
    const text = buildRevisionNarrative({ experiment, improvement, comparison });
    expect(text).toContain("Affordable Housing");
    expect(text).toContain("same sampled worlds");
    expect(text).toContain("68.0% -> 79.0%");
    expect(text).toContain("not causal evidence");
  });

  test("builds a journal-shaped revision draft", () => {
    const draft = buildDearCongressRevisionDraft({ experiment, improvement, comparison, recordId: "record_1" });
    expect(draft.kind).toBe("journal");
    expect(draft.source).toBe("happybearlandia");
    expect(draft.metadata.schemaVersion).toBe("hbl-revision-feedback.v1");
    expect(draft.metadata.recordId).toBe("record_1");
  });

  test("posts only when explicitly invoked and supports a mapping hook", async () => {
    let request;
    const fetchImpl = async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, async json() { return { ok: true }; } };
    };
    const draft = buildDearCongressRevisionDraft({ experiment, improvement, comparison });
    const result = await postDearCongressRevisionDraft(draft, {
      fetchImpl,
      voterId: "voter-test",
      globalObject: { HBL_DEAR_CONGRESS_REVISION_MAPPER: (value) => ({ entry: value.text }) },
    });
    expect(result.ok).toBe(true);
    expect(request.url).toBe("/api/publish_draft");
    expect(request.init.headers["x-voter-id"]).toBe("voter-test");
    expect(JSON.parse(request.init.body).entry).toContain("Simulation revision hypothesis");
  });
});
