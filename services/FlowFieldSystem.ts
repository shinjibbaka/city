import { GRID_HEIGHT, GRID_WIDTH } from "../constants";
import { TileType } from "../types";
import { WorldState } from "./WorldState";

const DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];

export class FlowFieldSystem {
  private world: WorldState;
  private distanceGrid: Int32Array;
  private queue: Int32Array;

  constructor(world: WorldState) {
    this.world = world;
    this.distanceGrid = new Int32Array(GRID_WIDTH * GRID_HEIGHT);
    this.queue = new Int32Array(GRID_WIDTH * GRID_HEIGHT);
  }

  public updateFields() {
    this.generateField(TileType.INDUSTRIAL, this.world.flowToWork);
    this.generateField(TileType.RESIDENTIAL, this.world.flowToHome);
    this.generateField(TileType.COMMERCIAL, this.world.flowToShop);
  }

  private generateField(targetType: TileType, outputField: Uint8Array) {
    const { tiles } = this.world;
    const dist = this.distanceGrid;
    const q = this.queue;
    
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

    // Standard BFS
    while (head < tail) {
      const currentIdx = q[head++];
      const cx = currentIdx % GRID_WIDTH;
      const cy = (currentIdx / GRID_WIDTH) | 0;

      const neighbors = [1, 3, 5, 7]; // Manhattan neighbors

      for (let dirIdx of neighbors) {
        const nx = cx + DX[dirIdx];
        const ny = cy + DY[dirIdx];

        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
          const nIdx = ny * GRID_WIDTH + nx;
          
          const tile = tiles[nIdx];
          const isPassable = tile !== TileType.EMPTY; // Simplified passability

          if (isPassable && dist[nIdx] > dist[currentIdx] + 1) {
            dist[nIdx] = dist[currentIdx] + 1;
            q[tail++] = nIdx;
          }
        }
      }
    }

    // Generate Vectors
    for (let i = 0; i < tiles.length; i++) {
      if (dist[i] === 999999) {
        outputField[i] = 0;
        continue;
      }

      if (tiles[i] === targetType) {
        outputField[i] = 0;
        continue;
      }

      let bestDist = dist[i];
      let bestDir = 0;
      
      const cx = i % GRID_WIDTH;
      const cy = (i / GRID_WIDTH) | 0;

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