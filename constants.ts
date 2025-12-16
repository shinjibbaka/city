export const TILE_SIZE = 8;
export const GRID_WIDTH = 128; // Power of 2 mostly for habit, but 128x128 fits 1024px screen well
export const GRID_HEIGHT = 128;
export const MAX_AGENTS = 15000;
export const TICKS_PER_DAY = 2000; // Simulation ticks per cycle
export const WORK_DURATION = 500;
export const HOME_DURATION = 200;

// Costs
export const BUILD_COST_ROAD = 10;
export const BUILD_COST_RES = 50;
export const BUILD_COST_IND = 100;
export const MAINTENANCE_COST_PER_TILE = 0.05;
export const INCOME_PER_CYCLE = 20;

// Cyberpunk Colors
export const COLOR_BG = '#050505'; // Almost black
export const COLOR_ROAD = '#1e293b'; // Dark slate
export const COLOR_RES = '#059669'; // Emerald dim
export const COLOR_IND = '#2563eb'; // Blue dim
// Agents are bright neon
export const COLOR_AGENT_COMMUTE = '#facc15'; // Yellow
export const COLOR_AGENT_RETURN = '#f43f5e'; // Pink/Red
