import { 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  MAX_AGENTS, 
  HOME_DURATION, 
  WORK_DURATION,
  SHOP_DURATION, 
  INCOME_PER_CYCLE,
  COMMERCE_INCOME,
  MAX_PARTICLES
} from "../constants";
import { AgentState, TileType } from "../types";
import { WorldState } from "./WorldState";

const DX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
const DY = [0, -1, -1, 0, 1, 1, 1, 0, -1];

export class AgentSystem {
  private world: WorldState;
  private tickCounter: number = 0;

  constructor(world: WorldState) {
    this.world = world;
  }

  public spawnAgent(homeIdx: number) {
    let slot = -1;
    for (let i = 0; i < MAX_AGENTS; i++) {
      if (this.world.agents.active[i] === 0) {
        slot = i;
        break;
      }
    }

    if (slot === -1) return;

    const { agents, getXY } = this.world;
    const coords = getXY(homeIdx);

    agents.active[slot] = 1;
    agents.state[slot] = AgentState.IDLE_AT_HOME;
    agents.x[slot] = coords.x;
    agents.y[slot] = coords.y;
    agents.homeTileIdx[slot] = homeIdx;
    agents.workTileIdx[slot] = -1; 
    agents.timer[slot] = (Math.random() * 200) | 0;
    agents.colorVariant[slot] = (Math.random() * 5) | 0;
    
    this.world.activeAgentCount++;
  }

  // Helper to force spawn agents for Debug
  public debugSpawn(amount: number) {
    const { tiles } = this.world;
    let spawned = 0;
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] === TileType.RESIDENTIAL) {
            this.spawnAgent(i);
            spawned++;
            if (spawned >= amount) break;
        }
    }
  }

  public debugClearAgents() {
      this.world.agents.active.fill(0);
      this.world.activeAgentCount = 0;
  }

  private levelUpBuilding(tileIdx: number) {
    const { tileLevels, tileActivity } = this.world;
    tileActivity[tileIdx]++;
    
    const level = tileLevels[tileIdx];
    if (level < 3) {
      const threshold = level === 0 ? 10 : level === 1 ? 50 : 150;
      if (tileActivity[tileIdx] > threshold) {
        tileLevels[tileIdx]++;
        tileActivity[tileIdx] = 0; 
      }
    }
  }

  public update() {
    // Particles
    const { particles } = this.world;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (particles.active[i]) {
        particles.x[i] += particles.vx[i];
        particles.y[i] += particles.vy[i];
        particles.life[i] -= 0.05;
        if (particles.life[i] <= 0) particles.active[i] = 0;
      }
    }
    
    // Time
    this.world.timeOfDay += this.world.daySpeed;
    if (this.world.timeOfDay > 1.0) this.world.timeOfDay = 0.0;

    const { agents, flowToHome, flowToWork, flowToShop, tiles } = this.world;
    const count = MAX_AGENTS;
    this.tickCounter++;

    // Removed Spatial Lookup refresh -> No collision, purely flow

    let movesAttempted = 0;
    let movesSuccessful = 0;

    for (let i = 0; i < count; i++) {
      if (!agents.active[i]) continue;

      const state = agents.state[i];
      let x = agents.x[i];
      let y = agents.y[i];
      const idx = y * GRID_WIDTH + x;

      // --- TIMERS ---
      if (state === AgentState.IDLE_AT_HOME) {
        if (agents.timer[i] > 0) agents.timer[i]--;
        else agents.state[i] = AgentState.WALKING_TO_WORK;
        continue;
      } 
      
      if (state === AgentState.WORKING) {
        if (agents.timer[i] > 0) agents.timer[i]--;
        else {
          this.world.goods++;
          if (this.world.goods > 0 && Math.random() > 0.5) {
             agents.state[i] = AgentState.WALKING_TO_SHOP;
          } else {
             agents.state[i] = AgentState.WALKING_TO_HOME;
          }
        }
        continue;
      }

      if (state === AgentState.SHOPPING) {
        if (agents.timer[i] > 0) agents.timer[i]--;
        else agents.state[i] = AgentState.WALKING_TO_HOME;
        continue;
      }

      // --- MOVEMENT ---
      // Logic: Walk everywhere. 
      // Speed Boost: If on ROAD, move every tick. If on rough terrain (Buildings/Empty), move every 2nd tick.
      
      const currentTile = tiles[idx];
      const isOnRoad = currentTile === TileType.ROAD;
      
      // Speed Check
      if (!isOnRoad && (this.tickCounter + i) % 2 !== 0) continue; 
      
      // Determine Flow Field
      let flowField = flowToHome;
      let targetType = TileType.RESIDENTIAL;

      if (state === AgentState.WALKING_TO_WORK) {
        flowField = flowToWork;
        targetType = TileType.INDUSTRIAL;
      } else if (state === AgentState.WALKING_TO_SHOP) {
        flowField = flowToShop;
        targetType = TileType.COMMERCIAL;
      }

      movesAttempted++;
      const dir = flowField[idx];

      // Arrival Check
      if (currentTile === targetType) {
          if (targetType === TileType.INDUSTRIAL) {
             agents.state[i] = AgentState.WORKING;
             agents.timer[i] = WORK_DURATION + (Math.random() * 50 | 0);
             this.levelUpBuilding(idx);
          } 
          else if (targetType === TileType.COMMERCIAL) {
             if (this.world.goods > 0) {
                this.world.goods--;
                this.world.funds += COMMERCE_INCOME;
             }
             agents.state[i] = AgentState.SHOPPING;
             agents.timer[i] = SHOP_DURATION + (Math.random() * 50 | 0);
             this.levelUpBuilding(idx);
          }
          else {
             agents.state[i] = AgentState.IDLE_AT_HOME;
             agents.timer[i] = HOME_DURATION + (Math.random() * 50 | 0);
             this.world.funds += INCOME_PER_CYCLE;
             this.levelUpBuilding(idx);
          }
          continue;
      }

      // Movement Execution (No Collision Check)
      if (dir !== 0) {
         const nx = x + DX[dir];
         const ny = y + DY[dir];
         
         if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
             // Just move. No collision. Liquid crowd.
             agents.x[i] = nx;
             agents.y[i] = ny;
             agents.dx[i] = DX[dir];
             agents.dy[i] = DY[dir];
             movesSuccessful++;
         }
      }
    }
    
    this.world.potentialMovesLastSec = movesAttempted;
    this.world.totalMovesLastSec = movesSuccessful;
  }
}