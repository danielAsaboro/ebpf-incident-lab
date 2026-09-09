import { beforeEach, describe, expect, it } from "vitest";
import { readNotebook, saveNotebook, removeNotebook } from "./notebooks";

beforeEach(() => localStorage.clear());
describe("saved investigation notebooks", () => {
  it("restores draft notes and keeps manual evidence distinct from hosted events", () => {
    saveNotebook({ labId: "03", source: "local", phase: "observe", prediction: "A blocking connection returns an errno.", explanation: "", choice: null, events: [], localEvidence: "captured local output", runState: "idle", updatedAt: new Date().toISOString() });
    expect(readNotebook("03")?.source).toBe("local");
    expect(readNotebook("03")?.events).toEqual([]);
    expect(readNotebook("03")?.localEvidence).toBe("captured local output");
    removeNotebook("03");
    expect(readNotebook("03")).toBeUndefined();
  });
  it("ignores malformed storage instead of breaking navigation", () => {
    localStorage.setItem("incident-lab:notebooks:v1", "not json");
    expect(readNotebook("01")).toBeUndefined();
  });
});
