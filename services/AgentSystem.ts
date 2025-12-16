import { 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  MAX_AGENTS, 
  HOME_DURATION, 
  WORK_DURATION, 
  INCOME_PER_CYCLE 
} from "../constants";
import { AgentState, TileType } from "../types";
import { WorldState } from "./WorldState";

// Lookup for direction deltas
const DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];

export class AgentSystem {
  private world: WorldState;

  constructor(world: WorldState) {
    this.world = world;
  }

  public spawnAgent(homeIdx: number) {
    // Find slot
    let slot = -1;
    // Simple linear search for empty slot. Optimized: maintain a 'nextFree' pointer if needed.
    // Given MAX_AGENTS and spawning frequency, linear is ok for now.
    for (let i = 0; i < MAX_AGENTS; i++) {
      if (this.world.agents.active[i] === 0) {
        slot = i;
        break;
      }
    }

    if (slot === -1) return; // Full

    const { agents, getXY } = this.world;
    const coords = getXY(homeIdx);

    agents.active[slot] = 1;
    agents.state[slot] = AgentState.IDLE_AT_HOME;
    agents.x[slot] = coords.x;
    agents.y[slot] = coords.y;
    agents.homeTileIdx[slot] = homeIdx;
    agents.workTileIdx[slot] = -1; // Any work
    agents.timer[slot] = Math.random() * 100 | 0; // Stagger starts
    agents.colorVariant[slot] = (Math.random() * 5) | 0;
    
    this.world.activeAgentCount++;
  }

  public update() {
    const { agents, spatialLookup, flowToHome, flowToWork, tiles } = this.world;
    const count = MAX_AGENTS;

    // 1. Reset Spatial Map for Collision Detection
    spatialLookup.fill(0);
    // Populate spatial map with CURRENT positions
    // This effectively reserves the current tile. 
    // In strict NS model, we move synchronously, but parallel update is hard in JS without double buffering positions.
    // We will use a "Move Request" approach or sequential updates.
    // Sequential is easier: iterate agents, check if target is free in spatial map.
    for (let i = 0; i < count; i++) {
      if (agents.active[i]) {
        const idx = agents.y[i] * GRID_WIDTH + agents.x[i];
        spatialLookup[idx] = i + 1; // 1-based ID
      }
    }

    let movesAttempted = 0;
    let movesSuccessful = 0;

    // 2. Update Agents
    for (let i = 0; i < count; i++) {
      if (!agents.active[i]) continue;

      const state = agents.state[i];
      const x = agents.x[i];
      const y = agents.y[i];
      const idx = y * GRID_WIDTH + x;

      // State Machine
      if (state === AgentState.IDLE_AT_HOME) {
        if (agents.timer[i] > 0) {
          agents.timer[i]--;
        } else {
          // Time to go to work
          agents.state[i] = AgentState.COMMUTING_TO_WORK;
        }
      } else if (state === AgentState.WORKING) {
        if (agents.timer[i] > 0) {
          agents.timer[i]--;
        } else {
          // Time to go home
          agents.state[i] = AgentState.COMMUTING_TO_HOME;
        }
      } else {
        // Commuting
        movesAttempted++;
        
        // Determine flow field
        const isToWork = state === AgentState.COMMUTING_TO_WORK;
        const flowField = isToWork ? flowToWork : flowToHome;
        const dir = flowField[idx];

        // Arrived Check
        const currentTile = tiles[idx];
        if (isToWork && currentTile === TileType.INDUSTRIAL) {
          agents.state[i] = AgentState.WORKING;
          agents.timer[i] = WORK_DURATION;
          continue;
        } else if (!isToWork && currentTile === TileType.RESIDENTIAL) {
          agents.state[i] = AgentState.IDLE_AT_HOME;
          agents.timer[i] = HOME_DURATION;
          // Economy: Completed a cycle!
          this.world.funds += INCOME_PER_CYCLE;
          continue;
        }

        // Movement Logic (Nagel-Schreckenberg simplified for 2D Grid)
        if (dir !== 0) {
           const nx = x + DX[dir];
           const ny = y + DY[dir];
           const nIdx = ny * GRID_WIDTH + nx;

           // Check bounds
           if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
              // Collision Check: Is the target cell occupied?
              if (spatialLookup[nIdx] === 0) {
                // Free! Move.
                // Random slowdown (reaction time)
                if (Math.random() > 0.1) {
                  // Update Spatial Lookup: Clear old, Set new
                  spatialLookup[idx] = 0;
                  spatialLookup[nIdx] = i + 1;

                  agents.x[i] = nx;
                  agents.y[i] = ny;
                  agents.dx[i] = DX[dir]; // Store for rendering orientation
                  agents.dy[i] = DY[dir];
                  movesSuccessful++;
                }
              }
           }
        }
      }
    }
    
    this.world.potentialMovesLastSec = movesAttempted;
    this.world.totalMovesLastSec = movesSuccessful;
  }
}
