import { test } from "node:test";
import assert from "node:assert/strict";
import { overlap, placeTags, tagRect, type Rect, type TagBox } from "../lib/placement.ts";

const view = { width: 390, height: 640, top: 56 };

function rects(tags: TagBox[], out: Map<string, [number, number]>): Rect[] {
  return tags.map((t) => tagRect(t, ...out.get(t.id)!));
}

test("a lone tag sits straight above its dot", () => {
  const t: TagBox = { id: "a", x: 200, y: 300, w: 70, h: 48 };
  assert.deepEqual(placeTags([t], [], view).get("a"), [0, -22]);
});

test("two sites at the same spot get tags that do not overlap", () => {
  const tags: TagBox[] = [
    { id: "a", x: 200, y: 300, w: 70, h: 48 },
    { id: "b", x: 200, y: 300, w: 70, h: 40 },
  ];
  const r = rects(tags, placeTags(tags, [], view));
  assert.equal(overlap(r[0], r[1], 0), 0);
});

test("the first tag in the list keeps the default spot", () => {
  const tags: TagBox[] = [
    { id: "live", x: 200, y: 300, w: 70, h: 58 },
    { id: "gap", x: 205, y: 304, w: 70, h: 40 },
  ];
  assert.deepEqual(placeTags(tags, [], view).get("live"), [0, -22]);
});

test("a tag avoids another site's dot", () => {
  const t: TagBox = { id: "a", x: 200, y: 300, w: 70, h: 48 };
  const dot: Rect = [195, 250, 205, 260]; // sits where the default tag would go
  const r = tagRect(t, ...placeTags([t], [dot], view).get("a")!);
  assert.equal(overlap(r, dot, 0), 0);
});

test("tags stay inside the view and below the chips when there is room", () => {
  const t: TagBox = { id: "a", x: 20, y: 70, w: 70, h: 48 };
  const r = tagRect(t, ...placeTags([t], [], view).get("a")!);
  assert.ok(r[0] >= 4 && r[1] >= view.top && r[2] <= view.width - 4 && r[3] <= view.height - 4);
});

// The ten public sites at island scale on a 390 x 640 phone (rough equirectangular fit of the real coordinates).
const SITES: [string, number, number, number, number][] = [
  // id, lon, lat, w, h  (live sites first, as the map orders them)
  ["AH", 103.8002, 1.2855, 100, 64], ["KTPH", 103.8386, 1.4241, 66, 58], ["TTSH", 103.8457, 1.3214, 66, 58], ["WH", 103.7947, 1.4247, 96, 58],
  ["CGH", 103.9495, 1.3408, 62, 40], ["KKH", 103.8468, 1.3105, 62, 40], ["NTFGH", 103.7454, 1.3336, 66, 40],
  ["NUH", 103.7825, 1.2928, 62, 40], ["SGH", 103.8355, 1.2796, 62, 40], ["SKH", 103.8932, 1.3944, 62, 40],
];
const px = (lon: number) => 40 + ((lon - 103.6) / 0.45) * 310;
const py = (lat: number) => 90 + ((1.48 - lat) / 0.26) * 470;

test("all ten sites at island scale get tags that do not overlap each other", () => {
  const tags = SITES.map(([id, lon, lat, w, h]) => ({ id, x: px(lon), y: py(lat), w, h }));
  const dots: Rect[] = tags.map((t) => [t.x - 5, t.y - 5, t.x + 5, t.y + 5]);
  const out = placeTags(tags, dots, view);
  const r = rects(tags, out);
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) assert.equal(overlap(r[i], r[j], 0), 0, `${tags[i].id} and ${tags[j].id}`);
  }
});

test("when nothing is free it still returns a spot for every tag", () => {
  const tags: TagBox[] = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, x: 200, y: 300, w: 80, h: 50 }));
  assert.equal(placeTags(tags, [], view).size, 20);
});
