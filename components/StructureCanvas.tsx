import React, { useMemo, useRef, useEffect, useState } from 'react';
import { StructureModel, SupportType } from '../frame/types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface StructureCanvasProps {
  model: StructureModel;
}

const StructureCanvas: React.FC<StructureCanvasProps> = ({ model }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(40); // Pixels per meter
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Center structure on mount or model change
  useEffect(() => {
    if (model.nodes.length === 0 || !containerRef.current) return;

    const xs = model.nodes.map(n => n.x);
    const ys = model.nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const contentWidth = (maxX - minX) || 5;
    const contentHeight = (maxY - minY) || 5;

    const newScale = Math.min(width / (contentWidth * 2), height / (contentHeight * 2));
    setScale(Math.max(20, newScale));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setOffset({
      x: width / 2 - cx * newScale,
      y: height / 2 + cy * newScale // Flip Y
    });
  }, [model.nodes.length]); // Only re-center on node count change for stability

  const handleWheel = (e: React.WheelEvent) => {
    const s = Math.exp(-e.deltaY * 0.001);
    setScale(prev => Math.max(5, Math.min(200, prev * s)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Coordinate transformation: World (m) -> Screen (px)
  // Structural Y is UP, Screen Y is DOWN.
  const toScreen = (x: number, y: number) => ({
    x: x * scale + offset.x,
    y: -y * scale + offset.y
  });

  return (
    <div 
      ref={containerRef} 
      className="flex-1 bg-[#0f172a] relative overflow-hidden cursor-crosshair"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <pattern id="grid" width={scale} height={scale} patternUnits="userSpaceOnUse" x={offset.x % scale} y={offset.y % scale}>
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="gray" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      
      {/* Background Text "STRUCTURE" */}
      {model.nodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 className="text-8xl font-black text-slate-800 tracking-tighter select-none">STRUCTURE</h1>
         </div>
      )}

      <svg className="w-full h-full pointer-events-none">
        <g>
          {/* Members */}
          {model.members.map(member => {
            const start = model.nodes.find(n => n.id === member.startNodeId);
            const end = model.nodes.find(n => n.id === member.endNodeId);
            if (!start || !end) return null;
            const p1 = toScreen(start.x, start.y);
            const p2 = toScreen(end.x, end.y);

            return (
              <g key={member.id}>
                <line 
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                  stroke="#38bdf8" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                  className="drop-shadow-lg"
                />
                <circle cx={(p1.x + p2.x)/2} cy={(p1.y + p2.y)/2} r="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1"/>
                <text x={(p1.x + p2.x)/2} y={(p1.y + p2.y)/2 - 10} fill="#94a3b8" fontSize="10" textAnchor="middle">{member.id}</text>
              </g>
            );
          })}

          {/* Supports */}
          {model.supports.map(support => {
            const node = model.nodes.find(n => n.id === support.nodeId);
            if (!node) return null;
            const p = toScreen(node.x, node.y);
            
            return (
              <g key={support.id} transform={`translate(${p.x}, ${p.y})`}>
                 {support.type === SupportType.PIN && (
                   <path d="M 0 0 L -8 14 L 8 14 Z" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
                 )}
                 {support.type === SupportType.ROLLER && (
                   <g>
                      <path d="M 0 0 L -8 12 L 8 12 Z" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
                      <circle cx="-5" cy="16" r="3" fill="#94a3b8" />
                      <circle cx="5" cy="16" r="3" fill="#94a3b8" />
                   </g>
                 )}
                 {support.type === SupportType.FIXED && (
                   <g>
                     <rect x="-10" y="4" width="20" height="4" fill="#94a3b8" />
                     <line x1="-8" y1="8" x2="-12" y2="16" stroke="#64748b" strokeWidth="1" />
                     <line x1="0" y1="8" x2="-4" y2="16" stroke="#64748b" strokeWidth="1" />
                     <line x1="8" y1="8" x2="4" y2="16" stroke="#64748b" strokeWidth="1" />
                   </g>
                 )}
              </g>
            );
          })}

          {/* Nodes */}
          {model.nodes.map(node => {
            const p = toScreen(node.x, node.y);
            return (
              <g key={node.id}>
                <circle 
                  cx={p.x} cy={p.y} 
                  r="6" 
                  fill="#f1f5f9" 
                  stroke="#334155" 
                  strokeWidth="2" 
                />
                <text x={p.x + 10} y={p.y - 10} fill="white" fontSize="12" className="font-mono">{node.id}</text>
              </g>
            );
          })}

          {/* Loads */}
          {model.loads.map(load => {
             const node = model.nodes.find(n => n.id === load.nodeId);
             if (!node) return null;
             const p = toScreen(node.x, node.y);
             
             // Draw arrow based on vector
             const len = 40;
             const angle = Math.atan2(-load.magnitudeY, load.magnitudeX); // Structural Y is up, Screen Y is down
             const endX = p.x - Math.cos(angle) * len;
             const endY = p.y + Math.sin(angle) * len; // screen coord y increases down

             return (
               <g key={load.id}>
                 <line x1={endX} y1={endY} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowhead)" />
                 <text x={endX} y={endY - 5} fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold">
                   {Math.sqrt(load.magnitudeX**2 + load.magnitudeY**2).toFixed(1)} kN
                 </text>
               </g>
             );
          })}

          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
          </defs>

        </g>
      </svg>

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-lg">
        <button onClick={() => setScale(s => s * 1.2)} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => s / 1.2)} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><ZoomOut size={20} /></button>
        <button onClick={() => setOffset({x: containerRef.current!.clientWidth/2, y: containerRef.current!.clientHeight/2})} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><Maximize size={20} /></button>
      </div>
    </div>
  );
};

export default StructureCanvas;