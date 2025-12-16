import { MAINTENANCE_COST_PER_TILE, BUILD_COST_ROAD, BUILD_COST_RES, BUILD_COST_IND, BUILD_COST_COM } from "../constants";
import { TileType } from "../types";
import { WorldState } from "./WorldState";

export class EconomySystem {
  private world: WorldState;

  constructor(world: WorldState) {
    this.world = world;
  }

  public processMaintenance() {
    let maintenance = 0;
    const tiles = this.world.tiles;
    for(let i=0; i<tiles.length; i++) {
        if (tiles[i] !== TileType.EMPTY) {
            maintenance += MAINTENANCE_COST_PER_TILE;
        }
    }
    this.world.funds -= maintenance;
    return maintenance;
  }

  public canAfford(type: TileType): boolean {
    let cost = 0;
    if (type === TileType.ROAD) cost = BUILD_COST_ROAD;
    if (type === TileType.RESIDENTIAL) cost = BUILD_COST_RES;
    if (type === TileType.INDUSTRIAL) cost = BUILD_COST_IND;
    if (type === TileType.COMMERCIAL) cost = BUILD_COST_COM;
    return this.world.funds >= cost;
  }

  public deduct(type: TileType) {
    let cost = 0;
    if (type === TileType.ROAD) cost = BUILD_COST_ROAD;
    if (type === TileType.RESIDENTIAL) cost = BUILD_COST_RES;
    if (type === TileType.INDUSTRIAL) cost = BUILD_COST_IND;
    if (type === TileType.COMMERCIAL) cost = BUILD_COST_COM;
    this.world.funds -= cost;
  }
}