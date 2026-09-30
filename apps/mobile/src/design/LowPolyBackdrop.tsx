const WIDTH = 400;
const HEIGHT = 860;
const COLUMNS = 6;
const ROWS = 11;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Triangle {
  points: string;
  fill: string;
  opacity: number;
}

/** Faceted low-poly field behind the glass panels, computed once. */
function buildTriangles(): Triangle[] {
  const random = mulberry32(2026);
  const cellW = WIDTH / COLUMNS;
  const cellH = HEIGHT / ROWS;
  const grid: Array<Array<[number, number]>> = [];
  for (let row = 0; row <= ROWS; row += 1) {
    const line: Array<[number, number]> = [];
    for (let col = 0; col <= COLUMNS; col += 1) {
      const edge = row === 0 || row === ROWS || col === 0 || col === COLUMNS;
      const jitterX = edge ? 0 : (random() - 0.5) * cellW * 0.7;
      const jitterY = edge ? 0 : (random() - 0.5) * cellH * 0.7;
      line.push([col * cellW + jitterX, row * cellH + jitterY]);
    }
    grid.push(line);
  }

  const triangles: Triangle[] = [];
  const point = (row: number, col: number) => grid[row]?.[col] ?? [0, 0];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      const a = point(row, col);
      const b = point(row, col + 1);
      const c = point(row + 1, col);
      const d = point(row + 1, col + 1);
      const halves =
        (row + col) % 2 === 0
          ? [
              [a, b, d],
              [a, d, c],
            ]
          : [
              [a, b, c],
              [b, d, c],
            ];
      for (const corners of halves) {
        // Warm tint towards the top right, cool towards the bottom left.
        const cx = corners.reduce((sum, [x]) => sum + x, 0) / 3 / WIDTH;
        const cy = corners.reduce((sum, [, y]) => sum + y, 0) / 3 / HEIGHT;
        const warm = Math.max(0, cx - cy + 0.2);
        const shade = random();
        triangles.push({
          points: corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
          fill: warm > 0.55 ? '#ffb27a' : shade > 0.5 ? '#ffffff' : '#c9d3dd',
          opacity: 0.12 + shade * 0.22,
        });
      }
    }
  }
  return triangles;
}

const TRIANGLES = buildTriangles();

export function LowPolyBackdrop() {
  return (
    <div className="screen-bg" aria-hidden>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice">
        {TRIANGLES.map((triangle, index) => (
          <polygon
            key={index}
            points={triangle.points}
            fill={triangle.fill}
            fillOpacity={triangle.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
