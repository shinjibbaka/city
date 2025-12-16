import { GRID_HEIGHT, GRID_WIDTH, MAX_AGENTS, MAX_PARTICLES } from "../constants";
import { TileType } from "../types";

export class WorldState {
  // Map Data
  public tiles: Uint8Array;
  public tileLevels: Uint8Array; // 0-3 level for buildings
  public tileActivity: Uint16Array; // Counter for leveling up
  
  // Flow Fields
  public flowToHome: Uint8Array;
  public flowToWork: Uint8Array;
  public flowToShop: Uint8Array; // New field

  // Spatial Hash
  public spatialLookup: Int32Array;

  // Agents (SOA)
  public agents: {
    active: Uint8Array;
    state: Uint8Array;
    x: Int32Array;
    y: Int32Array;
    dx: Int32Array;
    dy: Int32Array;
    timer: Int32Array;
    patience: Int32Array; // NEW: Counter for frustration
    homeTileIdx: Int32Array;
    workTileIdx: Int32Array;
    colorVariant: Uint8Array;
  };

  // Particles (SOA)
  public particles: {
    active: Uint8Array;
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    life: Float32Array;
    colorType: Uint8Array; // 0: Smoke, 1: Spark/Light
  };
  public nextParticleIdx: number = 0;

  // Global State
  public funds: number = 1000;
  public goods: number = 0; // Produced by Ind, Consumed by Com
  public activeAgentCount: number = 0;
  public timeOfDay: number = 0; // 0.0 - 1.0
  public daySpeed: number = 0.0005; 

  // Stats
  public totalMovesLastSec: number = 0;
  public potentialMovesLastSec: number = 0;

  constructor() {
    const gridSize = GRID_WIDTH * GRID_HEIGHT;
    
    this.tiles = new Uint8Array(gridSize);
    this.tileLevels = new Uint8Array(gridSize);
    this.tileActivity = new Uint16Array(gridSize);

    this.flowToHome = new Uint8Array(gridSize);
    this.flowToWork = new Uint8Array(gridSize);
    this.flowToShop = new Uint8Array(gridSize);
    this.spatialLookup = new Int32Array(gridSize);

    this.agents = {
      active: new Uint8Array(MAX_AGENTS),
      state: new Uint8Array(MAX_AGENTS),
      x: new Int32Array(MAX_AGENTS),
      y: new Int32Array(MAX_AGENTS),
      dx: new Int32Array(MAX_AGENTS),
      dy: new Int32Array(MAX_AGENTS),
      timer: new Int32Array(MAX_AGENTS),
      patience: new Int32Array(MAX_AGENTS),
      homeTileIdx: new Int32Array(MAX_AGENTS),
      workTileIdx: new Int32Array(MAX_AGENTS),
      colorVariant: new Uint8Array(MAX_AGENTS),
    };

    this.particles = {
      active: new Uint8Array(MAX_PARTICLES),
      x: new Float32Array(MAX_PARTICLES),
      y: new Float32Array(MAX_PARTICLES),
      vx: new Float32Array(MAX_PARTICLES),
      vy: new Float32Array(MAX_PARTICLES),
      life: new Float32Array(MAX_PARTICLES),
      colorType: new Uint8Array(MAX_PARTICLES),
    };

    this.initMap();
  }

  private initMap() {
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

  public toJSON() {
    return {
      tiles: Array.from(this.tiles),
      tileLevels: Array.from(this.tileLevels),
      funds: this.funds,
      goods: this.goods,
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
    this.goods = data.goods || 0;
    this.tiles.set(data.tiles);
    if (data.tileLevels) this.tileLevels.set(data.tileLevels);
    
    this.agents.active.set(data.agents.active);
    this.agents.state.set(data.agents.state);
    this.agents.x.set(data.agents.x);
    this.agents.y.set(data.agents.y);
    this.agents.homeTileIdx.set(data.agents.homeTileIdx);
    this.agents.workTileIdx.set(data.agents.workTileIdx);
    this.agents.colorVariant.set(data.agents.colorVariant || new Uint8Array(MAX_AGENTS));
    
    this.agents.dx.fill(0);
    this.agents.dy.fill(0);
    this.agents.timer.fill(0);
    this.agents.patience.fill(0); // Reset patience
    
    this.activeAgentCount = 0;
    for(let i=0; i<this.agents.active.length; i++) {
        if(this.agents.active[i]) this.activeAgentCount++;
    }
  }
}