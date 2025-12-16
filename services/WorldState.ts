import { GRID_HEIGHT, GRID_WIDTH, MAX_AGENTS } from "../constants";
import { TileType } from "../types";

/**
 * WorldState container.
 * Uses strict Data-Oriented Design with TypedArrays.
 * No objects per agent.
 */
export class WorldState {
  // Map Data
  public tiles: Uint8Array;
  
  // Flow Fields (Direction vectors: 0-8)
  // 0: None, 1: N, 2: NE, 3: E, 4: SE, 5: S, 6: SW, 7: W, 8: NW
  public flowToHome: Uint8Array;
  public flowToWork: Uint8Array;

  // Spatial Hash / Lookup for Collision
  // Stores (AgentIndex + 1) at grid index. 0 means empty.
  public spatialLookup: Int32Array;

  // Agents (Structure of Arrays)
  public agents: {
    active: Uint8Array; // 0 or 1
    state: Uint8Array; // AgentState enum
    x: Int32Array; // Grid X
    y: Int32Array; // Grid Y
    dx: Int32Array; // Last move X (for smooth render if needed, or visual orientation)
    dy: Int32Array; // Last move Y
    timer: Int32Array; // For working/sleeping delays
    homeTileIdx: Int32Array; // Persisted Home ID (Tile Index)
    workTileIdx: Int32Array; // Persisted Work ID (Tile Index)
    colorVariant: Uint8Array; // Visual variety
  };

  // Economy
  public funds: number = 1000;
  public activeAgentCount: number = 0;
  public totalMovesLastSec: number = 0;
  public potentialMovesLastSec: number = 0;

  constructor() {
    const gridSize = GRID_WIDTH * GRID_HEIGHT;
    
    this.tiles = new Uint8Array(gridSize);
    this.flowToHome = new Uint8Array(gridSize);
    this.flowToWork = new Uint8Array(gridSize);
    this.spatialLookup = new Int32Array(gridSize);

    this.agents = {
      active: new Uint8Array(MAX_AGENTS),
      state: new Uint8Array(MAX_AGENTS),
      x: new Int32Array(MAX_AGENTS),
      y: new Int32Array(MAX_AGENTS),
      dx: new Int32Array(MAX_AGENTS),
      dy: new Int32Array(MAX_AGENTS),
      timer: new Int32Array(MAX_AGENTS),
      homeTileIdx: new Int32Array(MAX_AGENTS),
      workTileIdx: new Int32Array(MAX_AGENTS),
      colorVariant: new Uint8Array(MAX_AGENTS),
    };

    this.initMap();
  }

  private initMap() {
    // Fill with empty
    this.tiles.fill(TileType.EMPTY);
  }

  public getIndex(x: number, y: number): number {
    return y * GRID_WIDTH + x;
  }

  public getXY(index: number): { x: number, y: number } {
    return {
      x: index % GRID_WIDTH,
      y: Math.floor(index / GRID_WIDTH)
    };
  }

  // --- Persistence ---

  public toJSON() {
    return {
      tiles: Array.from(this.tiles),
      funds: this.funds,
      agents: {
        active: Array.from(this.agents.active),
        state: Array.from(this.agents.state),
        x: Array.from(this.agents.x),
        y: Array.from(this.agents.y),
        homeTileIdx: Array.from(this.agents.homeTileIdx),
        workTileIdx: Array.from(this.agents.workTileIdx),
        colorVariant: Array.from(this.agents.colorVariant)
      }
    };
  }

  public loadFromJSON(data: any) {
    if (!data || !data.agents) return;

    this.funds = data.funds;
    this.tiles.set(data.tiles);
    
    // Restore agents
    this.agents.active.set(data.agents.active);
    this.agents.state.set(data.agents.state);
    this.agents.x.set(data.agents.x);
    this.agents.y.set(data.agents.y);
    this.agents.homeTileIdx.set(data.agents.homeTileIdx);
    this.agents.workTileIdx.set(data.agents.workTileIdx);
    this.agents.colorVariant.set(data.agents.colorVariant || new Uint8Array(MAX_AGENTS));
    
    // Reset transient agent data (movement deltas and timers can be reset safely)
    this.agents.dx.fill(0);
    this.agents.dy.fill(0);
    this.agents.timer.fill(0);
    
    // Recalculate counts
    this.activeAgentCount = 0;
    for(let i=0; i<this.agents.active.length; i++) {
        if(this.agents.active[i]) this.activeAgentCount++;
    }
  }
}