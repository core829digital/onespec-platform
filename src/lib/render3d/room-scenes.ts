/**
 * The furniture of the rooms the window can be seen in besides the kitchen: living room (balcony doors), master bedroom (balcony
 * doors) and bathroom (small windows). Everything is boxes and cylinders handed to the room's batch, which merges them by material.
 * Units are millimetres; the window wall is at z = wallFaceZ, the room extends towards +z; x is centred on the window.
 */
export interface BatchLike {
  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number): void;
  cyl(key: string, x: number, y: number, z: number, rTop: number, rBottom: number, h: number, seg?: number, rx?: number, ry?: number, rz?: number): void;
  sphere(key: string, x: number, y: number, z: number, r: number, seg?: number, sy?: number): void;
}

export interface SceneCtx {
  B: BatchLike;
  floorY: number;
  ceilingY: number;
  minX: number;
  maxX: number;
  wf: number;
  backZ: number;
  W: number;
  H: number;
  cx: number;
}

/** Curtains drawn open on both sides of the window, on a rod: they never cover the glass. */
function curtains({ B, floorY, ceilingY, wf, W, minX, maxX }: SceneCtx) {
  const top = ceilingY - 110;
  const rodY = ceilingY - 90;
  B.cyl("black", (minX + maxX) / 2, rodY, wf + 90, 9, 9, Math.min(maxX - minX - 200, W + 1400), 12, 0, 0, Math.PI / 2);
  for (const x0 of [-440, W + 70]) {
    for (let k = 0; k < 4; k++) B.box("curtain", x0 + k * 92, floorY + 20, wf + 70 + (k % 2) * 28, 80, top - floorY - 20, 36);
  }
}

function plant({ B }: SceneCtx, x: number, y: number, z: number, scale = 1) {
  B.cyl("pot", x, y + 160 * scale, z, 150 * scale, 110 * scale, 320 * scale, 16);
  for (let k = 0; k < 7; k++) B.sphere("leaf", x + (k - 3) * 55 * scale, y + (420 + (k % 3) * 120) * scale, z + ((k * 37) % 70) - 35, 150 * scale, 10, 1.4);
}

function floorLamp({ B }: SceneCtx, x: number, y: number, z: number) {
  B.cyl("black", x, y + 5, z, 140, 140, 10, 20);
  B.cyl("black", x, y + 780, z, 8, 8, 1560, 8);
  B.cyl("shade", x, y + 1600, z, 120, 170, 260, 24);
  B.sphere("bulb", x, y + 1560, z, 40, 12);
}

/** Living room: sofa, armchair, coffee table, TV unit, bookshelf, rug, plant, lamp and curtains. For balcony doors. */
export function furnishLiving(c: SceneCtx) {
  const { B, floorY, wf, minX, maxX, W, cx, ceilingY } = c;
  B.box("rug", cx - 1450, floorY, wf + 1500, 2700, 9, 2300);
  // Sofa against the left wall, facing the middle of the room.
  const sx = minX + 70;
  const sz = wf + 1450;
  const sl = 2300;
  B.box("sofa", sx, floorY + 80, sz, 920, 340, sl);
  B.box("sofa", sx, floorY + 420, sz, 230, 470, sl);
  B.box("sofa", sx, floorY + 80, sz, 920, 600, 230);
  B.box("sofa", sx, floorY + 80, sz + sl - 230, 920, 600, 230);
  for (let k = 0; k < 3; k++) B.box("sofaLight", sx + 250, floorY + 420, sz + 230 + k * ((sl - 460) / 3), 650, 130, (sl - 460) / 3 - 14);
  for (let k = 0; k < 3; k++) B.box("sofaLight", sx + 215, floorY + 550, sz + 230 + k * ((sl - 460) / 3), 120, 380, (sl - 460) / 3 - 14);
  for (const z of [sz + 60, sz + sl - 60]) B.box("black", sx + 30, floorY, z, 40, 80, 40);
  B.box("cushionA", sx + 300, floorY + 560, sz + 300, 110, 360, 380);
  B.box("cushionB", sx + 300, floorY + 560, sz + sl - 680, 110, 340, 360);
  // Coffee table with a few things on it.
  const tx = cx - 800;
  const tz = wf + 2250;
  B.box("wood", tx, floorY + 380, tz, 1100, 40, 620);
  for (const [dx, dz] of [[40, 40], [1000, 40], [40, 520], [1000, 520]] as const) B.box("black", tx + dx, floorY, tz + dz, 36, 380, 36);
  B.box("white", tx + 140, floorY + 420, tz + 140, 300, 40, 210);
  B.box("mug", tx + 170, floorY + 460, tz + 170, 220, 30, 150);
  B.cyl("ceramic", tx + 820, floorY + 500, tz + 300, 55, 70, 160, 18);
  B.sphere("leaf", tx + 820, floorY + 640, tz + 300, 85, 10, 0.9);
  // TV unit on the right wall, with the television.
  B.box("woodDark", maxX - 470, floorY + 40, wf + 1650, 470, 440, 1900);
  B.box("black", maxX - 470, floorY, wf + 1700, 400, 40, 1800);
  B.box("black", maxX - 70, floorY + 940, wf + 1950, 40, 700, 1300);
  B.box("steel", maxX - 70, floorY + 940, wf + 1950, 6, 700, 1300);
  B.box("black", maxX - 190, floorY + 480, wf + 2550, 150, 60, 100);
  // Bookshelf at the back, right wall.
  const bx = maxX - 360;
  const bz = wf + 3750;
  B.box("woodDark", bx, floorY, bz, 360, 2000, 24);
  B.box("woodDark", bx, floorY, bz + 776, 360, 2000, 24);
  for (let k = 0; k <= 5; k++) B.box("woodDark", bx, floorY + k * 395, bz, 360, 24, 800);
  const books = ["apple", "mug", "lemon", "leaf", "orange", "pot"];
  for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) B.box(books[(r + k) % books.length], bx + 60, floorY + r * 395 + 28, bz + 40 + k * 100, 220, 260 + ((r * 7 + k) % 4) * 30, 70 + ((k * 13) % 3) * 8);
  // Armchair beside the window, plant and lamp.
  B.box("sofa", W + 520, floorY + 70, wf + 280, 880, 320, 880);
  B.box("sofa", W + 520, floorY + 390, wf + 280, 880, 460, 200);
  B.box("sofa", W + 520, floorY + 70, wf + 280, 160, 540, 880);
  B.box("sofa", W + 1240, floorY + 70, wf + 280, 160, 540, 880);
  B.box("cushionB", W + 700, floorY + 390, wf + 520, 520, 120, 540);
  plant(c, minX + 380, floorY, wf + 420, 1.2);
  floorLamp(c, minX + 260, floorY, wf + 1250);
  curtains(c);
  // Pendant lamp over the table.
  const shadeY = Math.min(floorY + 2000, ceilingY - 420);
  B.cyl("black", cx - 300, (shadeY + ceilingY) / 2, wf + 2550, 2.5, 2.5, ceilingY - shadeY, 6);
  B.cyl("shade", cx - 300, shadeY, wf + 2550, 40, 200, 170, 28);
  B.sphere("bulb", cx - 300, shadeY - 50, wf + 2550, 36, 12);
}

/** Master bedroom: double bed with pillows and a throw, nightstands with lamps, wardrobe, bench, rug, plant and curtains. */
export function furnishBedroom(c: SceneCtx) {
  const { B, floorY, wf, minX, maxX, W, cx } = c;
  B.box("rug", minX + 700, floorY, wf + 1000, 2400, 9, 2800);
  // Bed: head against the left wall.
  const bz = wf + 1350;
  const bw = 1900;
  B.box("woodDark", minX, floorY, bz - 80, 90, 1150, bw + 160);
  B.box("sofaLight", minX + 90, floorY + 330, bz, 70, 700, bw);
  B.box("wood", minX + 160, floorY + 110, bz, 2000, 270, bw);
  B.box("linen", minX + 170, floorY + 380, bz + 20, 1980, 240, bw - 40);
  B.box("linenAccent", minX + 1150, floorY + 610, bz + 12, 1000, 36, bw - 24);
  B.box("linenAccent", minX + 2150, floorY + 380, bz + 12, 30, 270, bw - 24);
  for (const dz of [150, 160 + (bw - 700) / 2 + 150]) {
    B.box("linen", minX + 180, floorY + 620, bz + dz, 240, 150, 640);
    B.box("linen", minX + 250, floorY + 760, bz + dz + 40, 190, 300, 560);
  }
  B.box("cushionA", minX + 520, floorY + 620, bz + bw / 2 - 260, 150, 270, 520);
  // Nightstands with lamps.
  for (const z of [bz - 560, bz + bw + 110]) {
    B.box("wood", minX, floorY + 180, z, 460, 340, 450);
    B.box("woodDark", minX + 4, floorY + 560, z + 4, 450, 30, 442);
    B.box("carcass", minX + 10, floorY + 190, z + 440, 440, 320, 12);
    B.box("steel", minX + 200, floorY + 400, z + 452, 80, 12, 14);
    B.cyl("black", minX + 170, floorY + 620, z + 225, 70, 80, 30, 16);
    B.cyl("black", minX + 170, floorY + 780, z + 225, 9, 9, 300, 8);
    B.cyl("shade", minX + 170, floorY + 960, z + 225, 100, 140, 190, 22);
    B.sphere("bulb", minX + 170, floorY + 930, z + 225, 30, 10);
  }
  // Wardrobe on the right wall.
  const wx = maxX - 640;
  const wz = wf + 1700;
  B.box("cab", wx, floorY, wz, 640, 2300, 2400);
  for (let k = 1; k < 4; k++) B.box("carcass", wx - 3, floorY + 20, wz + k * 600 - 3, 6, 2260, 6);
  for (let k = 0; k < 4; k++) B.box("steel", wx - 8, floorY + 1050, wz + k * 600 + (k % 2 ? 40 : 530), 12, 220, 14);
  // Bench at the foot of the bed, plant, curtains.
  B.box("fabric", minX + 2450, floorY + 330, bz + 200, 460, 90, 1500);
  for (const [dx, dz] of [[20, 20], [400, 20], [20, 1440], [400, 1440]] as const) B.box("black", minX + 2450 + dx, floorY, bz + 200 + dz, 36, 330, 36);
  B.box("linenAccent", minX + 2480, floorY + 420, bz + 700, 400, 40, 500);
  plant(c, W + 560, floorY, wf + 420, 1.1);
  curtains(c);
  void cx;
}

/** Bathroom: tiled walls and floor, bathtub, toilet, vanity with mirror, towel rail and bath mat. For small windows. */
export function furnishBathroom(c: SceneCtx) {
  const { B, floorY, wf, minX, maxX, backZ, W, H } = c;
  const tileTop = floorY + 2100;
  // Wall tiles: the three plain walls to 2.1 m, the window wall under the sill and on both sides of the window.
  B.box("tiles", minX, floorY, wf, 14, 2100, backZ - wf);
  B.box("tiles", maxX - 14, floorY, wf, 14, 2100, backZ - wf);
  B.box("tiles", minX, floorY, backZ - 14, maxX - minX, 2100, 14);
  B.box("tiles", minX, floorY, wf, maxX - minX, -44 - floorY, 14);
  B.box("tiles", minX, -44, wf, -70 - minX, tileTop + 44, 14);
  B.box("tiles", W + 70, -44, wf, maxX - W - 70, tileTop + 44, 14);
  const above = H + 150;
  if (tileTop > above) B.box("tiles", -70, above, wf, W + 140, tileTop - above, 14);
  // Bathtub along the back wall.
  const tx = minX + 70;
  const tz = backZ - 800;
  const tl = 1700;
  B.box("ceramic", tx, floorY + 60, tz, tl, 70, 740);
  B.box("ceramic", tx, floorY + 60, tz, tl, 500, 80);
  B.box("ceramic", tx, floorY + 60, tz + 660, tl, 500, 80);
  B.box("ceramic", tx, floorY + 60, tz, 80, 500, 740);
  B.box("ceramic", tx + tl - 80, floorY + 60, tz, 80, 500, 740);
  B.box("water", tx + 80, floorY + 400, tz + 80, tl - 160, 6, 580);
  B.box("black", tx + 40, floorY, tz + 40, tl - 80, 60, 660);
  B.cyl("chrome", tx + tl - 40, floorY + 650, backZ - 60, 14, 14, 160, 12);
  B.cyl("chrome", tx + tl - 40, floorY + 720, backZ - 130, 12, 12, 140, 12, Math.PI / 2);
  // Toilet on the back wall, right.
  const wx = maxX - 700;
  B.box("ceramic", wx, floorY + 340, backZ - 230, 380, 420, 210);
  B.box("white", wx - 4, floorY + 760, backZ - 236, 388, 24, 222);
  B.box("ceramic", wx + 20, floorY, backZ - 700, 340, 430, 480);
  B.box("white", wx + 10, floorY + 430, backZ - 710, 360, 26, 500);
  B.cyl("chrome", wx + 190, floorY + 800, backZ - 130, 24, 24, 14, 14);
  // Vanity on the left wall with the mirror and a lamp.
  const vz = wf + 520;
  B.box("cab", minX + 14, floorY + 120, vz, 470, 700, 1000);
  B.box("black", minX + 40, floorY, vz + 20, 420, 120, 960);
  B.box("top", minX + 10, floorY + 820, vz - 20, 520, 36, 1040);
  B.cyl("ceramic", minX + 270, floorY + 860, vz + 500, 190, 150, 90, 28);
  B.cyl("chrome", minX + 70, floorY + 960, vz + 500, 12, 12, 220, 10);
  B.cyl("chrome", minX + 130, floorY + 1060, vz + 500, 9, 9, 110, 10, 0, 0, Math.PI / 2);
  for (let k = 0; k < 2; k++) B.box("white", minX + 20, floorY + 140 + k * 340, vz + 12, 8, 320, 464);
  B.box("steel", minX + 16, floorY + 1200, vz + 50, 22, 960, 900);
  B.box("mirror", minX + 38, floorY + 1230, vz + 74, 6, 900, 852);
  B.box("white", minX + 30, floorY + 1940, vz + 300, 40, 40, 400);
  // Towel rail, towels, bath mat and plant.
  B.cyl("chrome", maxX - 60, floorY + 1250, wf + 900, 9, 9, 900, 10);
  B.cyl("chrome", maxX - 60, floorY + 1000, wf + 900, 9, 9, 900, 10);
  B.box("linenAccent", maxX - 76, floorY + 1000, wf + 520, 28, 650, 300);
  B.box("sofaLight", maxX - 76, floorY + 1050, wf + 1050, 28, 600, 280);
  B.box("rug", maxX - 1300, floorY, backZ - 1500, 760, 12, 500);
  B.cyl("pot", minX + 280, floorY + 130, backZ - 1100, 110, 85, 260, 14);
  for (let k = 0; k < 5; k++) B.sphere("leaf", minX + 280 + (k - 2) * 40, floorY + 380 + (k % 2) * 90, backZ - 1100, 110, 10, 1.4);
}
