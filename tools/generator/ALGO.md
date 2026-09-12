# ArrowFlow board generator

Input: `{ width, height, mask?, seed, minTurns? }`.  
Default mask is a full rectangle (every cell playable).  
Graph: 4-connected orthogonal only. Minimum piece = 2 adjacent nodes.

The engine’s `exitRay` walks in the piece’s **heading** through vacant cells — including mask holes — until it leaves the bounding rectangle. Own cells on that ray are ignored. Peel uses that rule only; a rigid whole-body sweep is not the legality test.

## Reverse-insert (peel order)

1. Build playable set `P` from the mask. Reject a mask with any isolated cell (component size 1).
2. While `P` is nonempty, carve one simple path of length ≥ 2 and delete those cells from `P`.
3. A legal **exit** is a cell `h ∈ P` plus heading `d` such that:
   - the neighbor opposite `d` is also in `P` (so the piece can be at least 2 cells);
   - the engine exit ray from `h` along `d` hits no remaining cell of `P`.
4. Prefer exits on the rim of remaining `P` (low remaining degree). If several exist, shuffle with the seed.
5. Grow a **self-avoiding walk backward** from `h` into `P`: first step is opposite `d`, then weighted random steps that prefer turns (U / S / zigzag, typically 2–6 corners) over straight I-bars.
6. Target length is mixed (short and long), never leaving exactly one leftover cell.
7. After each candidate step, leftover `P` must stay coverable by paths of length ≥ 2. A leftover singleton is allowed only if it touches the current tail (it will be absorbed). Small leftover blobs that cannot be path-covered (T-tetromino, plus) are rejected; grow into them or pick another exit.
8. Absorb leftover singletons onto the walk tail. If a last orphan remains after carving, merge it onto a neighbor piece’s tail so the piece stays a simple path (no branch, heading unchanged).
9. Reverse the walk so the last cell is the exit head. Heading = last segment. That piece is appended in **peel order** (first carved = first to leave).
10. When remaining `P` is a single small component (≤ 18) that has a Hamiltonian path, take that whole path as one piece if an endpoint heading has a clear ray.
11. Repeat until `P` is empty. Every playable cell belongs to exactly one piece. No 1-cell pieces.
12. Build a `BoardModel` and **peel-validate**: while the board is nonempty, remove any piece whose heading ray is free of *other* pieces; if none exist, the board is invalid. Reverse-insert makes this succeed: each piece’s ray was clear of cells that became later pieces, and earlier pieces peel first.
13. Reject the attempt if occupancy ≠ `|P₀|`, if any piece is not a 4-path, or if peel gets stuck. Self-occlusion under a rigid sweep is allowed when the heading ray is still free.
14. Score the board for wiggliness. Cap straight I-pieces at **< 35%** on boards with ≥ 20 playable cells. Retry with `seed + attempt × 10007` until a packed, peelable, wiggly fill is found.
15. `minTurns` only biases growth (floor on desired corners). Leftover length-2 corridors may still be I-pieces; the I-ratio cap is the hard bound.
16. Non-rectangular masks (heart, donut, car) use the same loop. Holes are vacant, not walls: a shot across a donut hole is blocked if the far side still holds another piece.

## What we do not do

- Diagonals, 1-cell pieces, or leaving mask-true cells empty.
- Treating own body as a peel blocker (the engine skips it).
- Using “any of 4 directions” as the real escape test. That is debug-only; heading is the only legal exit.

## Files

- `generate.ts` — `generateLevel`
- `peel.ts` — heading peel + solvability
- `masks/` — heart, donut, car boolean grids
- `fixtures/` — packed solvable fills of those masks
