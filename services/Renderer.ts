import { 
  TILE_SIZE, 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  COLOR_BG, 
  COLOR_ROAD, 
  COLOR_RES, 
  COLOR_IND,
  COLOR_COM,
  COLOR_AGENT_COMMUTE,
  COLOR_AGENT_RETURN,
  COLOR_AGENT_SHOPPING,
  MAX_AGENTS,
  MAX_PARTICLES
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

    this.offscreenCanvas = new OffscreenCanvas(GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;
    
    this.renderStatic();
  }

  public renderStatic() {
    const { tiles, tileLevels } = this.world;
    const ctx = this.offscreenCtx;

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const i = y * GRID_WIDTH + x;
        const type = tiles[i];

        if (type !== TileType.EMPTY) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          
          if (type === TileType.ROAD) ctx.fillStyle = COLOR_ROAD;
          else if (type === TileType.RESIDENTIAL) ctx.fillStyle = COLOR_RES;
          else if (type === TileType.INDUSTRIAL) ctx.fillStyle = COLOR_IND;
          else if (type === TileType.COMMERCIAL) ctx.fillStyle = COLOR_COM;

          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // Height Visuals
          const level = tileLevels[i]; 
          if (type !== TileType.ROAD) {
             if (level > 0) {
               ctx.fillStyle = "rgba(255,255,255,0.15)";
               ctx.fillRect(px+1, py+1, TILE_SIZE-2, TILE_SIZE-2);
             }
             if (level > 1) {
               ctx.fillStyle = "rgba(255,255,255,0.25)";
               ctx.fillRect(px+2, py+2, TILE_SIZE-4, TILE_SIZE-4);
             }
             if (level > 2) {
               ctx.fillStyle = "rgba(255,255,255,0.4)";
               ctx.fillRect(px+3, py+3, TILE_SIZE-6, TILE_SIZE-6);
             }
          }
          
          // Subtle Grid
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(px, py, TILE_SIZE, 1);
          ctx.fillRect(px, py, 1, TILE_SIZE);
        }
      }
    }
  }

  public renderFrame(view: CameraView, showHeatmap: boolean) {
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    
    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX, centerY);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.x, -view.y);

    // Static Map
    ctx.drawImage(this.offscreenCanvas, 0, 0);

    // Day/Night
    const time = this.world.timeOfDay;
    const darkness = (Math.sin(time * Math.PI * 2 - Math.PI/2) + 1) / 2 * 0.7; 
    ctx.fillStyle = `rgba(0, 0, 5, ${darkness})`;
    ctx.fillRect(0, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);

    // Heatmap (Legacy support in case needed, though agents don't block now)
    if (showHeatmap) {
      // Logic removed as spatialLookup is no longer populated for collision
    }

    // Agents
    this.renderAgents();
  }

  private renderAgents() {
    const { agents } = this.world;
    const ctx = this.ctx;
    const count = MAX_AGENTS;

    ctx.globalCompositeOperation = 'lighter'; 
    
    // Batch path drawing for performance? 
    // Actually with 10k agents rects are faster than beginPath/closePath for every dot if colors mix.
    // Let's grouping by color.

    const drawGroup = (color: string, stateMatch: (s: number) => boolean) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            if (!agents.active[i]) continue;
            if (stateMatch(agents.state[i])) {
                const px = (agents.x[i] * TILE_SIZE) | 0;
                const py = (agents.y[i] * TILE_SIZE) | 0;
                // Draw small 2x2 dot centered
                ctx.rect(px + 3, py + 3, 2, 2);
            }
        }
        ctx.fill();
    }

    drawGroup(COLOR_AGENT_COMMUTE, (s) => s === AgentState.WALKING_TO_WORK);
    drawGroup(COLOR_AGENT_RETURN, (s) => s === AgentState.WALKING_TO_HOME);
    drawGroup(COLOR_AGENT_SHOPPING, (s) => s === AgentState.WALKING_TO_SHOP);

    ctx.globalCompositeOperation = 'source-over';
  }
}