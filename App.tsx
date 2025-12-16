import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WorldState } from './services/WorldState';
import { Renderer } from './services/Renderer';
import { FlowFieldSystem } from './services/FlowFieldSystem';
import { AgentSystem } from './services/AgentSystem';
import { EconomySystem } from './services/EconomySystem';
import { 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  TILE_SIZE, 
  BUILD_COST_ROAD,
  BUILD_COST_RES,
  BUILD_COST_IND,
  BUILD_COST_COM
} from './constants';
import { TileType } from './types';
import { 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  TruckIcon, 
  TrashIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon,
  CubeIcon,
  ClockIcon,
  CommandLineIcon
} from '@heroicons/react/24/solid';

const Engine = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI State
  const [selectedTool, setSelectedTool] = useState<TileType | 'ERASE'>(TileType.ROAD);
  const [stats, setStats] = useState({ funds: 0, agents: 0, eff: 0, goods: 0, time: 0 });
  const [showDebug, setShowDebug] = useState(false);
  
  // Camera State
  const cameraRef = useRef({ x: (GRID_WIDTH * TILE_SIZE)/2, y: (GRID_HEIGHT * TILE_SIZE)/2, scale: 1 });
  
  // Game Systems Refs
  const worldRef = useRef(new WorldState());
  const systemsRef = useRef<{
    renderer: Renderer | null;
    flow: FlowFieldSystem;
    agents: AgentSystem;
    economy: EconomySystem;
  }>({
    renderer: null,
    flow: new FlowFieldSystem(worldRef.current),
    agents: new AgentSystem(worldRef.current),
    economy: new EconomySystem(worldRef.current)
  });

  const isPointerDown = useRef(false);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Initialize Logic Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const resizeCanvas = () => {
      if(canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const world = worldRef.current;
    const systems = systemsRef.current;
    
    systems.renderer = new Renderer(canvasRef.current, world);

    let animationFrameId: number;
    let lastLogicTime = performance.now();
    const LOGIC_TICK_RATE = 1000 / 15;
    let logicAccumulator = 0;
    let economyTimer = 0;

    const loop = (time: number) => {
      const dt = time - lastLogicTime;
      lastLogicTime = time;
      logicAccumulator += dt;

      // Logic
      while (logicAccumulator >= LOGIC_TICK_RATE) {
        systems.agents.update();
        logicAccumulator -= LOGIC_TICK_RATE;
        
        // Economy
        economyTimer += LOGIC_TICK_RATE;
        if (economyTimer > 1000) {
           systems.economy.processMaintenance();
           // Auto-spawn chance
           for(let i=0; i<GRID_WIDTH*GRID_HEIGHT; i++) {
               if (world.tiles[i] === TileType.RESIDENTIAL) {
                   if (Math.random() < 0.1) systems.agents.spawnAgent(i);
               }
           }
           economyTimer = 0;
           
           setStats({
             funds: Math.floor(world.funds),
             agents: world.activeAgentCount,
             eff: 100, // Efficiency always 100 without traffic
             goods: world.goods,
             time: world.timeOfDay
           });
        }
      }

      // Render
      systems.renderer?.renderFrame(cameraRef.current, false);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const getWorldCoords = (screenX: number, screenY: number) => {
    const cam = cameraRef.current;
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;

    const rawX = (screenX - centerX) / cam.scale + cam.x;
    const rawY = (screenY - centerY) / cam.scale + cam.y;

    return {
      x: Math.floor(rawX / TILE_SIZE),
      y: Math.floor(rawY / TILE_SIZE)
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || e.button === 2) {
      isPanning.current = true;
    } else {
      isPanning.current = false;
      paint(e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current) return;

    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      cameraRef.current.x -= dx / cameraRef.current.scale;
      cameraRef.current.y -= dy / cameraRef.current.scale;
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else {
      paint(e.clientX, e.clientY);
    }
  };

  const paint = (cx: number, cy: number) => {
    const { x, y } = getWorldCoords(cx, cy);

    if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
      const world = worldRef.current;
      const systems = systemsRef.current;
      const idx = y * GRID_WIDTH + x;
      
      if (selectedTool === 'ERASE') {
         if (world.tiles[idx] !== TileType.EMPTY) {
            world.tiles[idx] = TileType.EMPTY;
            world.tileLevels[idx] = 0; 
            systems.flow.updateFields();
            systems.renderer?.renderStatic();
         }
      } else {
        if (world.tiles[idx] !== selectedTool) {
           // Cheats ignore cost? No, keep economy in normal mode. Cheat button adds money.
           if (systems.economy.canAfford(selectedTool)) {
              systems.economy.deduct(selectedTool);
              world.tiles[idx] = selectedTool;
              world.tileLevels[idx] = 0;
              systems.flow.updateFields();
              systems.renderer?.renderStatic();
           }
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const scaleFactor = 1 + (zoomIntensity * direction);
    const newScale = Math.max(0.5, Math.min(cameraRef.current.scale * scaleFactor, 5));
    cameraRef.current.scale = newScale;
  };

  const handleSave = () => {
    try {
      const json = worldRef.current.toJSON();
      localStorage.setItem('cybercity_save_v2', JSON.stringify(json));
      alert('City Saved Successfully!');
    } catch(e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  const handleLoad = () => {
    try {
      const str = localStorage.getItem('cybercity_save_v2');
      if (!str) return alert('No saved city found.');
      const json = JSON.parse(str);
      worldRef.current.loadFromJSON(json);
      systemsRef.current.flow.updateFields();
      systemsRef.current.renderer?.renderStatic();
      alert('City Loaded!');
    } catch (e) {
      console.error(e);
      alert('Corrupt save file.');
    }
  };

  // Cheats
  const cheatAddMoney = () => {
      worldRef.current.funds += 10000;
      setStats(prev => ({ ...prev, funds: Math.floor(worldRef.current.funds) }));
  };
  const cheatSpawnAgents = () => {
      systemsRef.current.agents.debugSpawn(100);
      setStats(prev => ({ ...prev, agents: worldRef.current.activeAgentCount }));
  };
  const cheatKillAgents = () => {
      systemsRef.current.agents.debugClearAgents();
      setStats(prev => ({ ...prev, agents: 0 }));
  };

  const hour = Math.floor(stats.time * 24);
  const minute = Math.floor((stats.time * 24 % 1) * 60);
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return (
    <div className="flex h-screen w-screen bg-black text-slate-100 overflow-hidden font-mono">
      {/* Sidebar */}
      <div className="absolute top-4 left-4 w-64 flex flex-col gap-4 z-10 pointer-events-none">
        
        {/* Header */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-lg shadow-xl pointer-events-auto">
          <h1 className="text-xl font-bold text-cyan-400 mb-1 tracking-tight">CYBERCITY <span className="text-white font-light">PEDESTRIAN</span></h1>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">NO CARS // FLUID SIM</span>
            <div className="flex items-center text-xs text-yellow-500 gap-1 bg-black/40 px-2 py-1 rounded">
               <ClockIcon className="h-3 w-3" />
               {timeString}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl space-y-3 pointer-events-auto">
           <StatRow icon={<CurrencyDollarIcon className="h-4 w-4 text-emerald-400"/>} label="FUNDS" value={stats.funds.toLocaleString()} />
           <StatRow icon={<UserGroupIcon className="h-4 w-4 text-blue-400"/>} label="CITIZENS" value={stats.agents.toLocaleString()} />
           <StatRow icon={<CubeIcon className="h-4 w-4 text-purple-400"/>} label="GOODS" value={stats.goods.toLocaleString()} />
        </div>

        {/* Tools */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl space-y-2 pointer-events-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Construction</p>
          
          <ToolButton 
             active={selectedTool === TileType.ROAD} 
             onClick={() => setSelectedTool(TileType.ROAD)}
             color="bg-slate-700 hover:bg-slate-600 border-slate-500"
             activeColor="bg-slate-600 border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
             label={`PAVEMENT ($${BUILD_COST_ROAD})`}
          />
          <ToolButton 
             active={selectedTool === TileType.RESIDENTIAL} 
             onClick={() => setSelectedTool(TileType.RESIDENTIAL)}
             color="bg-emerald-900/50 hover:bg-emerald-900/80 border-emerald-800"
             activeColor="bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]"
             label={`APARTMENTS ($${BUILD_COST_RES})`}
          />
          <ToolButton 
             active={selectedTool === TileType.INDUSTRIAL} 
             onClick={() => setSelectedTool(TileType.INDUSTRIAL)}
             color="bg-blue-900/50 hover:bg-blue-900/80 border-blue-800"
             activeColor="bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
             label={`INDUSTRY ($${BUILD_COST_IND})`}
          />
          <ToolButton 
             active={selectedTool === TileType.COMMERCIAL} 
             onClick={() => setSelectedTool(TileType.COMMERCIAL)}
             color="bg-purple-900/50 hover:bg-purple-900/80 border-purple-800"
             activeColor="bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]"
             label={`SHOPS ($${BUILD_COST_COM})`}
          />
        </div>

        {/* Utilities & Debug Toggle */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-lg shadow-xl grid grid-cols-4 gap-2 pointer-events-auto">
           <IconButton 
              active={selectedTool === 'ERASE'} 
              onClick={() => setSelectedTool('ERASE')}
              icon={<TrashIcon className="h-5 w-5"/>}
              title="Erase"
           />
           <IconButton 
              active={showDebug} 
              onClick={() => setShowDebug(!showDebug)}
              icon={<CommandLineIcon className="h-5 w-5 text-green-500"/>}
              title="Debug / Cheats"
           />
           <IconButton 
              onClick={handleSave}
              icon={<ArrowDownTrayIcon className="h-5 w-5"/>}
              title="Save City"
           />
           <IconButton 
              onClick={handleLoad}
              icon={<ArrowUpTrayIcon className="h-5 w-5"/>}
              title="Load City"
           />
        </div>

        {/* Debug Menu */}
        {showDebug && (
            <div className="bg-red-900/90 backdrop-blur border border-red-600 p-3 rounded-lg shadow-xl space-y-2 pointer-events-auto animate-pulse">
                <p className="text-[10px] font-bold text-red-200 uppercase tracking-widest mb-1">ADMIN ACCESS</p>
                <button onClick={cheatAddMoney} className="w-full text-xs bg-red-800 hover:bg-red-700 border border-red-500 py-1 px-2 rounded font-mono">+ $10,000</button>
                <button onClick={cheatSpawnAgents} className="w-full text-xs bg-red-800 hover:bg-red-700 border border-red-500 py-1 px-2 rounded font-mono">FORCE SPAWN (100)</button>
                <button onClick={cheatKillAgents} className="w-full text-xs bg-red-800 hover:bg-red-700 border border-red-500 py-1 px-2 rounded font-mono">KILL ALL AGENTS</button>
            </div>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="block touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerUp={() => { isPointerDown.current = false; isPanning.current = false; }}
        onPointerLeave={() => { isPointerDown.current = false; isPanning.current = false; }}
        onPointerMove={handlePointerMove}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

const StatRow = ({ icon, label, value }: any) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center text-slate-400 text-xs">
      {icon}
      <span className="ml-2 font-bold tracking-wider">{label}</span>
    </div>
    <span className="font-mono text-sm">{value}</span>
  </div>
);

const ToolButton = ({ active, onClick, color, activeColor, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded border transition-all text-xs font-bold font-mono uppercase ${
      active ? activeColor : `${color} text-slate-400`
    }`}
  >
    {label}
  </button>
);

const IconButton = ({ active, onClick, icon, title }: any) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex justify-center items-center py-2 rounded border transition-all ${
      active 
      ? 'bg-slate-700 border-white text-white' 
      : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
    }`}
  >
    {icon}
  </button>
);

export default Engine;
