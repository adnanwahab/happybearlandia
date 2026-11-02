import { describe, expect, test } from "bun:test";
import { mountLiveParameterControls } from "../world/live-parameter-controls.js";

// Small DOM surface to exercise events without requiring a browser in unit tests.
class Element {
  constructor(ownerDocument) { this.ownerDocument = ownerDocument; this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; }
  append(...children) { this.children.push(...children); for (const child of children) child.parent = this; }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(event, fn) { (this.events[event] ||= new Set()).add(fn); }
  removeEventListener(event, fn) { this.events[event]?.delete(fn); }
  fire(event) { for (const fn of this.events[event] || []) fn(); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}
function setup(options = {}) {
  const doc = { createElement: () => new Element(doc) };
  const container = new Element(doc);
  const changes = [];
  const api = mountLiveParameterControls(container, {
    experiment: { worldModel: { variables: [{ id: "funding", label: "Funding", unit: "fraction", baseline: 0.7, range: { min: 0.1, max: 1 } }] } },
    onChange: (value) => changes.push(value), ...options,
  });
  const row = container.children[0].children[0]?.children[1];
  return { api, container, changes, row };
}

describe("live parameter controls", () => {
  test("numeric edits immediately synchronize the range and clamp emitted inspector overrides", () => {
    const { row, changes } = setup();
    const [, , range, , number] = row.children;
    number.value = "2";
    number.fire("input");
    expect(changes[0].funding).toMatchObject({ baseline: 1, min: 0.1, max: 1, locked: false });
    expect(range.value).toBe("1");
    number.value = "";
    number.fire("input");
    expect(changes.length).toBe(1);
    expect(number.attributes["aria-invalid"]).toBe("true");
    number.fire("blur");
    expect(number.value).toBe("1");
    expect(number.attributes["aria-invalid"]).toBeUndefined();
  });

  test("setValues is silent, reset clears overrides, and destroy removes listeners", () => {
    const { api, container, row, changes } = setup({ overrides: { funding: { baseline: 0.8 } } });
    const [, , range, , number, reset] = row.children;
    expect(number.value).toBe("0.8");
    api.setValues({ funding: 0.9 });
    expect(range.value).toBe("0.9");
    expect(changes).toEqual([]);
    reset.fire("click");
    expect(changes).toEqual([{}]);
    expect(number.value).toBe("0.7");
    api.destroy();
    number.value = "0.5";
    number.fire("input");
    expect(changes.length).toBe(1);
    expect(container.children.length).toBe(0);
  });

  test("missing variables display an explicit empty state", () => {
    const { container } = setup({ experiment: null });
    expect(container.children[0].children[0].textContent).toContain("No simulation parameters");
  });
});
