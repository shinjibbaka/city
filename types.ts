export enum TileType {
  EMPTY = 0,
  ROAD = 1,
  RESIDENTIAL = 2,
  INDUSTRIAL = 3,
}

export enum AgentState {
  IDLE_AT_HOME = 0,
  COMMUTING_TO_WORK = 1,
  WORKING = 2,
  COMMUTING_TO_HOME = 3,
}

export interface SimulationStats {
  funds: number;
  activeAgents: number;
  trafficEfficiency: number; // 0-100 score
  income: number;
  maintenance: number;
}
