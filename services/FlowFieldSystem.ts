import { GRID_HEIGHT, GRID_WIDTH, TILE_SIZE } from "../constants";
import { TileType } from "../types";
import { WorldState } from "./WorldState";

// Directions: 0=None, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W, 8=NW
const DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];

export class FlowFieldSystem {
  private world: WorldState;
  private distanceGrid: Int32Array;
  private queue: Int32Array; // Reusable queue for BFS to avoid GC

  constructor(world: WorldState) {
    this.world = world;
    this.distanceGrid = new Int32Array(GRID_WIDTH * GRID_HEIGHT);
    this.queue = new Int32Array(GRID_WIDTH * GRID_HEIGHT);
  }

  public updateFields() {
    // Generate Field 1: To Work (Target: Industrial)
    this.generateField(TileType.INDUSTRIAL, this.world.flowToWork);

    // Generate Field 2: To Home (Target: Residential)
    this.generateField(TileType.RESIDENTIAL, this.world.flowToHome);
  }

  private generateField(targetType: TileType, outputField: Uint8Array) {
    const { tiles, getIndex } = this.world;
    const dist = this.distanceGrid;
    const q = this.queue;
    
    // Init Distances
    dist.fill(999999);
    
    let head = 0;
    let tail = 0;

    // Seed targets
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === targetType) {
        dist[i] = 0;
        q[tail++] = i;
      }
    }

    // BFS
    while (head < tail) {
      const currentIdx = q[head++];
      const cx = currentIdx % GRID_WIDTH;
      const cy = (currentIdx / GRID_WIDTH) | 0;

      // Check 8 neighbors (or 4 for Manhattan, let's use 4 for traffic simplicity first, implies orthogonal roads)
      // Actually, standard road networks are usually Manhattan. 
      // Let's stick to 4 neighbors (N, E, S, W) for cleaner road logic.
      // Indices in DX/DY: 1(N), 3(E), 5(S), 7(W)
      const neighbors = [1, 3, 5, 7];

      for (let dirIdx of neighbors) {
        const nx = cx + DX[dirIdx];
        const ny = cy + DY[dirIdx];

        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
          const nIdx = ny * GRID_WIDTH + nx;
          
          // Cost function: Roads are cheap (1), others expensive (but passable for flow calc if needed?)
          // Strict logic: Agents can ONLY move on Roads or Targets.
          const tile = tiles[nIdx];
          const isPassable = tile === TileType.ROAD || tile === TileType.RESIDENTIAL || tile === TileType.INDUSTRIAL;

          if (isPassable && dist[nIdx] > dist[currentIdx] + 1) {
            dist[nIdx] = dist[currentIdx] + 1;
            q[tail++] = nIdx;
          }
        }
      }
    }

    // Generate Vectors based on distance gradient
    for (let i = 0; i < tiles.length; i++) {
      if (dist[i] === 999999) {
        outputField[i] = 0; // Unreachable
        continue;
      }

      // If this tile is the target itself, direction is 0 (Stay)
      if (tiles[i] === targetType) {
        outputField[i] = 0;
        continue;
      }

      let bestDist = dist[i];
      let bestDir = 0;
      
      const cx = i % GRID_WIDTH;
      const cy = (i / GRID_WIDTH) | 0;

      // Find neighbor with lowest distance
      const neighbors = [1, 3, 5, 7];
      for (let dirIdx of neighbors) {
        const nx = cx + DX[dirIdx];
        const ny = cy + DY[dirIdx];

        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
          const nIdx = ny * GRID_WIDTH + nx;
          if (dist[nIdx] < bestDist) {
            bestDist = dist[nIdx];
            bestDir = dirIdx;
          }
        }
      }

      outputField[i] = bestDir;
    }
  }
}
