import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Point = [number, number];
type Anchor = { world: Point; pixel: Point };
type ArtEntry = {
  image: string;
  width: number;
  height: number;
  matrix: { x: [number, number, number]; y: [number, number, number] };
  meta?: unknown;
};

const [, , course, holeText, image, widthText, heightText, ...anchorText] = process.argv;
if (!course || !holeText || !image || !widthText || !heightText || anchorText.length !== 3) {
  throw new Error(
    "Usage: calibrateIllustration <course> <hole> <image> <width> <height> " +
      '"worldX,worldY:pixelX,pixelY" (three anchors)',
  );
}

function parsePoint(value: string): Point {
  const numbers = value.split(",").map(Number);
  if (numbers.length !== 2 || numbers.some((number) => !Number.isFinite(number))) {
    throw new Error(`Invalid point: ${value}`);
  }
  return numbers as Point;
}

function parseAnchor(value: string): Anchor {
  const [world, pixel, extra] = value.split(":");
  if (!world || !pixel || extra) throw new Error(`Invalid anchor: ${value}`);
  return { world: parsePoint(world), pixel: parsePoint(pixel) };
}

function solve(values: [number, number, number], anchors: Anchor[]): [number, number, number] {
  const matrix = anchors.map((anchor, index) => [anchor.world[0], anchor.world[1], 1, values[index]!]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    const pivotRow = matrix[column]!;
    const divisor = pivotRow[column]!;
    if (Math.abs(divisor) < 1e-9) throw new Error("Anchors are collinear; choose three distinct landmarks");
    for (let item = column; item < 4; item++) pivotRow[item] = pivotRow[item]! / divisor;
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const targetRow = matrix[row]!;
      const factor = targetRow[column]!;
      for (let item = column; item < 4; item++) targetRow[item] = targetRow[item]! - factor * pivotRow[item]!;
    }
  }
  return matrix.map((row) => Number(row[3]!.toFixed(6))) as [number, number, number];
}

const anchors = anchorText.map(parseAnchor);
const width = Number(widthText);
const height = Number(heightText);
const hole = Number(holeText);
if (![width, height, hole].every(Number.isFinite)) throw new Error("Hole, width, and height must be numbers");

const registryPath = path.resolve("src/ui/illustratedArt.generated.json");
const registry = JSON.parse(await readFile(registryPath, "utf8")) as Record<string, ArtEntry>;
const key = `${course}:${hole}`;
const prior = registry[key];
registry[key] = {
  image: image.replaceAll("\\", "/").replace(/^public\//, ""),
  width,
  height,
  matrix: {
    x: solve(anchors.map((anchor) => anchor.pixel[0]) as [number, number, number], anchors),
    y: solve(anchors.map((anchor) => anchor.pixel[1]) as [number, number, number], anchors),
  },
  ...(prior?.meta === undefined ? {} : { meta: prior.meta }),
};
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Calibrated ${key} in ${registryPath}`);
console.log(JSON.stringify(registry[key]!.matrix));
