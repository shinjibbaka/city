import { 
  TILE_SIZE, 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  COLOR_BG, 
  COLOR_ROAD, 
  COLOR_RES, 
  COLOR_IND,
  COLOR_AGENT_COMMUTE,
  COLOR_AGENT_RETURN,
  MAX_AGENTS
} from "../constants";
import { AgentState, TileType } from "../types";
import { WorldState } from "./WorldState";

export interface CameraView {
  x: number;
  y: number;
  scale: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: OffscreenCanvas;
  private offscreenCtx: OffscreenCanvasRenderingContext2D;
  private world: WorldState;

  constructor(canvas: HTMLCanvasElement, world: WorldState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.world = world;

    // Setup Offscreen Canvas for Static Map
    this.offscreenCanvas = new OffscreenCanvas(GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;
    
    // Initial Render
    this.renderStatic();
  }

  public renderStatic() {
    const { tiles } = this.world;
    const ctx = this.offscreenCtx;

    // Clear
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const i = y * GRID_WIDTH + x;
        const type = tiles[i];

        if (type !== TileType.EMPTY) {
          if (type === TileType.ROAD) ctx.fillStyle = COLOR_ROAD;
          else if (type === TileType.RESIDENTIAL) ctx.fillStyle = COLOR_RES;
          else if (type === TileType.INDUSTRIAL) ctx.fillStyle = COLOR_IND;

          // Draw tile base
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // Cyber Grid Effect: faint border
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, TILE_SIZE, 1);
          ctx.fillRect(px, py, 1, TILE_SIZE);

          // Procedural Details (Deterministic based on coords)
          if (type === TileType.RESIDENTIAL) {
             // Pseudo-random seed
             const seed = (x * 12.9898 + y * 78.233) * 43758.5453;
             const val = seed - Math.floor(seed);
             
             ctx.fillStyle = val > 0.5 ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
             
             // Windows pattern
             if (val > 0.3) ctx.fillRect(px + 2, py + 2, 2, 2);
             if (val > 0.6) ctx.fillRect(px + 5, py + 5, 1, 2);
             if (val < 0.2) ctx.fillRect(px + 1, py + 5, 2, 1);
          } 
          else if (type === TileType.INDUSTRIAL) {
              const seed = (x * 32.1 + y * 13.7);
              const val = seed - Math.floor(seed);
              ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
              
              if (val > 0.5) {
                 // Smokestack base or vent
                 ctx.fillRect(px + 2, py + 1, 2, 4);
              } else {
                 // Warehouse roof lines
                 ctx.fillRect(px + 1, py + 2, 6, 1);
                 ctx.fillRect(px + 1, py + 5, 6, 1);
              }
          }
          else if (type === TileType.ROAD) {
             // Subtle lane marker
             ctx.fillStyle = "rgba(255,255,255,0.03)";
             ctx.fillRect(px + 3, py + 3, 2, 2);
          }
        }
      }
    }
  }

  public renderFrame(view: CameraView, showArrows: boolean) {
    const { ctx, canvas } = this;
    
    // Ensure pixel art look during zoom
    ctx.imageSmoothingEnabled = false;
    
    // Clear Screen
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; // Fill black for margins
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Camera Transform
    // We center the view based on the canvas size
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.translate(centerX, centerY);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.x, -view.y);

    // 1. Draw Static Layer
    ctx.drawImage(this.offscreenCanvas, 0, 0);

    // 2. Draw Flow Field Arrows (Debug)
    if (showArrows) {
       this.renderArrows();
    }

    // 3. Draw Agents (Neon Mode)
    this.renderAgents();
  }

  private renderArrows() {
    const { flowToWork } = this.world;
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    
    const size = TILE_SIZE;
    const half = size / 2;

    // Check every 2nd tile
    for (let y = 0; y < GRID_HEIGHT; y+=2) {
      for (let x = 0; x < GRID_WIDTH; x+=2) {
        const i = y * GRID_WIDTH + x;
        const dir = flowToWork[i]; // Visualize Work Flow
        if (dir > 0) {
           const cx = x * size + half;
           const cy = y * size + half;
           ctx.fillRect(cx - 1, cy - 1, 2, 2);
        }
      }
    }
  }

  private renderAgents() {
    const { agents } = this.world;
    const ctx = this.ctx;
    const count = MAX_AGENTS;

    // Setup Glow Effect
    ctx.globalCompositeOperation = 'lighter'; // Additive blending for neon look
    
    ctx.fillStyle = COLOR_AGENT_COMMUTE;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      if (agents.active[i] && agents.state[i] === AgentState.COMMUTING_TO_WORK) {
        const px = (agents.x[i] * TILE_SIZE) | 0;
        const py = (agents.y[i] * TILE_SIZE) | 0;
        ctx.rect(px + 2, py + 2, 4, 4);
      }
    }
    ctx.fill();

    ctx.fillStyle = COLOR_AGENT_RETURN;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      if (agents.active[i] && agents.state[i] === AgentState.COMMUTING_TO_HOME) {
        const px = (agents.x[i] * TILE_SIZE) | 0;
        const py = (agents.y[i] * TILE_SIZE) | 0;
        ctx.rect(px + 2, py + 2, 4, 4);
      }
    }
    ctx.fill();

    // Reset composite
    ctx.globalCompositeOperation = 'source-over';
  }
}