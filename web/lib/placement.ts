// Tag placement for the map (D-014). Each site keeps its dot on the true coordinate; its tag is offset from the dot,
// at the first spot that overlaps nothing already placed. Pure, so it can be tested without a browser.

export type Rect = [number, number, number, number]; // left, top, right, bottom

export type TagBox = {
  id: string;
  x: number; // the dot, in pixels
  y: number;
  w: number; // the tag's size
  h: number;
};

export type View = { width: number; height: number; top: number }; // top: space kept free for the chips

export function overlap(a: Rect, b: Rect, pad = 3): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]) + pad;
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]) + pad;
  return w > 0 && h > 0 ? w * h : 0;
}

// Offsets are from the dot to the bottom-centre of the tag. The default is straight above the dot.
export function candidateOffsets(w: number, h: number): [number, number][] {
  const side = w / 2 + 12;
  const out: [number, number][] = [];
  for (const k of [1, 1.8, 2.6]) {
    out.push([0, -22 * k], [side * k, -10 * k], [-side * k, -10 * k], [0, (h + 22) * k], [side * k, (h + 10) * k], [-side * k, (h + 10) * k]);
  }
  return out;
}

export function tagRect(t: TagBox, dx: number, dy: number): Rect {
  return [t.x + dx - t.w / 2, t.y + dy - t.h, t.x + dx + t.w / 2, t.y + dy];
}

// Tags are placed in the order given, so earlier ones keep the best spots. Obstacles (dots, figures) are never covered if a free spot exists.
export function placeTags(tags: TagBox[], obstacles: Rect[], view: View): Map<string, [number, number]> {
  const result = new Map<string, [number, number]>();
  const placed: Rect[] = [];
  for (const t of tags) {
    const offsets = candidateOffsets(t.w, t.h);
    let best = offsets[0];
    let bestCost = Infinity;
    for (const [dx, dy] of offsets) {
      const r = tagRect(t, dx, dy);
      let cost = 0;
      for (const o of obstacles) cost += overlap(r, o);
      for (const o of placed) cost += overlap(r, o) * 4;
      if (r[0] < 4 || r[2] > view.width - 4 || r[1] < view.top || r[3] > view.height - 4) cost += 5000;
      if (cost < bestCost) {
        bestCost = cost;
        best = [dx, dy];
        if (cost === 0) break;
      }
    }
    placed.push(tagRect(t, best[0], best[1]));
    result.set(t.id, best);
  }
  return result;
}
