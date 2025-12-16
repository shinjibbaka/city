export enum TileType {
  EMPTY = 0,
  ROAD = 1,
  RESIDENTIAL = 2,
  INDUSTRIAL = 3,
  COMMERCIAL = 4,
}

export enum AgentState {
  IDLE_AT_HOME = 0,
  WALKING_TO_WORK = 1,
  WORKING = 2,
  WALKING_TO_SHOP = 3,
  SHOPPING = 4,
  WALKING_TO_HOME = 5,
}

export interface SimulationStats {
  funds: number;
  activeAgents: number;
  trafficEfficiency: number;
  goods: number;
  dayTime: number; // 0.0 to 1.0
}