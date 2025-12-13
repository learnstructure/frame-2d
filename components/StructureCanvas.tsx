import React, { useRef, useEffect, useState } from 'react';
import { StructureModel, SupportType, LoadType } from '../frame/types';
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

  const centerStructure = () => {
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

    // Fit with padding
    const newScale = Math.min(
      (width * 0.8) / contentWidth,
      (height * 0.8) / contentHeight
    );
    const finalScale = Math.max(20, Math.min(newScale, 150));
    setScale(finalScale);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setOffset({
      x: width / 2 - cx * finalScale,
      y: height / 2 + cy * finalScale // Flip Y
    });
  };

  // Center structure on mount or model change
  useEffect(() => {
    centerStructure();
  }, [model.nodes.length]);

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

  const renderMember = (member: any) => {
    const start = model.nodes.find(n => n.id === member.startNodeId);
    const end = model.nodes.find(n => n.id === member.endNodeId);
    if (!start || !end) return null;
    const p1 = toScreen(start.x, start.y);
    const p2 = toScreen(end.x, end.y);

    if (member.type === 'spring') {
      // Draw zigzag
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const unitX = dx / length;
      const unitY = dy / length;
      const perpX = -unitY;
      const perpY = unitX;

      const zigCount = 10;
      const zigHeight = 5;
      let d = `M ${p1.x} ${p1.y}`;

      for (let i = 1; i <= zigCount; i++) {
        const t = i / zigCount;
        const px = p1.x + dx * t;
        const py = p1.y + dy * t;
        const offset = (i % 2 === 0 ? 1 : -1) * zigHeight;
        // Don't zigzag at very ends
        if (i < zigCount) {
          d += ` L ${px + perpX * offset} ${py + perpY * offset}`;
        } else {
          d += ` L ${p2.x} ${p2.y}`;
        }
      }

      return (
        <g key={member.id}>
          <path d={d} stroke="#a3e635" strokeWidth="2" fill="none" />
          <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 10} fill="#a3e635" fontSize="10" textAnchor="middle">k={member.springConstant}</text>
        </g>
      );
    }

    // Rigid or Truss
    return (
      <g key={member.id}>
        <line
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={member.type === 'truss' ? '#fbbf24' : '#38bdf8'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={member.type === 'truss' ? '4' : '0'}
          className="drop-shadow-lg"
        />
        <circle cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2} r="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
        <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 10} fill="#94a3b8" fontSize="10" textAnchor="middle">{member.id}</text>
      </g>
    );
  };

  const renderMemberLoad = (load: any) => {
    const member = model.members.find(m => m.id === load.memberId);
    if (!member) return null;
    const start = model.nodes.find(n => n.id === member.startNodeId);
    const end = model.nodes.find(n => n.id === member.endNodeId);
    if (!start || !end) return null;

    const p1 = toScreen(start.x, start.y);
    const p2 = toScreen(end.x, end.y);

    // Vector calculation
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    // Load visualization parameters
    const arrowLen = 20;
    const arrowColor = "#f472b6"; // Pink for member loads

    if (load.type === LoadType.MEMBER_DISTRIBUTED) {
      // Draw a series of arrows along the member
      const count = Math.max(3, Math.floor(len / 30));
      const arrows = [];

      // Angle of load vector (global)
      // Structural Y up -> Screen Y down. So Fy positive is Screen Y negative.
      const angle = Math.atan2(-load.magnitudeY, load.magnitudeX);

      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const x = p1.x + dx * t;
        const y = p1.y + dy * t;

        // Arrow start point (tail)
        const tailX = x - Math.cos(angle) * arrowLen;
        // Fixed: Use minus sine so tail is opposite to head in screen coordinates for Y
        const tailY = y - Math.sin(angle) * arrowLen;

        arrows.push(
          <line key={i} x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />
        );
      }
      // Connect tails
      const startTailX = p1.x - Math.cos(angle) * arrowLen;
      const startTailY = p1.y - Math.sin(angle) * arrowLen;
      const endTailX = p2.x - Math.cos(angle) * arrowLen;
      const endTailY = p2.y - Math.sin(angle) * arrowLen;

      return (
        <g key={load.id}>
          {arrows}
          <line x1={startTailX} y1={startTailY} x2={endTailX} y2={endTailY} stroke={arrowColor} strokeWidth="1" />
          <text x={(startTailX + endTailX) / 2} y={(startTailY + endTailY) / 2 - 5} fill={arrowColor} fontSize="10" textAnchor="middle">
            UDL
          </text>
        </g>
      );
    } else if (load.type === LoadType.MEMBER_POINT) {
      // Calculate position based on location (distance from start)
      // We need real length of member in meters
      const realDx = end.x - start.x;
      const realDy = end.y - start.y;
      const realLen = Math.sqrt(realDx * realDx + realDy * realDy);

      const ratio = (load.location || 0) / realLen;

      if (ratio < 0 || ratio > 1) return null; // Out of bounds

      const x = p1.x + dx * ratio;
      const y = p1.y + dy * ratio;

      const angle = Math.atan2(-load.magnitudeY, load.magnitudeX);
      const tailX = x - Math.cos(angle) * 30;
      // Fixed: Use minus sine so tail is opposite to head in screen coordinates for Y
      const tailY = y - Math.sin(angle) * 30;

      return (
        <g key={load.id}>
          <line x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="2" markerEnd="url(#arrowhead-pink)" />
          <text x={tailX} y={tailY - 5} fill={arrowColor} fontSize="10" textAnchor="middle">
            {Math.sqrt(load.magnitudeX ** 2 + load.magnitudeY ** 2).toFixed(1)}
          </text>
        </g>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#0f172a] relative overflow-hidden cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <defs>
          <pattern id="grid" width={scale} height={scale} patternUnits="userSpaceOnUse" x={offset.x % scale} y={offset.y % scale}>
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="gray" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {model.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="text-8xl font-black text-slate-800 tracking-tighter select-none">STRUCTURE REALM</h1>
        </div>
      )}

      <svg className="w-full h-full pointer-events-none">
        <defs>
          {/* Reduced Arrowhead Size */}
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
          </marker>
          <marker id="arrowhead-pink" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#f472b6" />
          </marker>
          {/* Moment Arrowhead */}
          <marker id="arrowhead-moment" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
          </marker>
        </defs>
        <g>
          {/* Members */}
          {model.members.map(renderMember)}

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

          {/* Member Loads */}
          {model.loads.filter(l => l.type !== LoadType.NODAL_POINT).map(renderMemberLoad)}

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

          {/* Nodal Loads (Force & Moment) */}
          {model.loads.filter(l => l.type === LoadType.NODAL_POINT).map(load => {
            const node = model.nodes.find(n => n.id === load.nodeId);
            if (!node) return null;
            const p = toScreen(node.x, node.y);

            const elements = [];

            // 1. Draw Force X Arrow
            if (Math.abs(load.magnitudeX) > 0.001) {
              const isRight = load.magnitudeX > 0;
              const len = 40;
              // If force is right, arrow points right (->). Head at p.x, Tail at p.x - len
              // If force is left, arrow points left (<-). Head at p.x, Tail at p.x + len
              const tailX = isRight ? p.x - len : p.x + len;
              const tailY = p.y;

              elements.push(
                <g key={`force-x-${load.id}`}>
                  <line x1={tailX} y1={tailY} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x={tailX + (isRight ? -10 : 10)} y={p.y + 4} fill="#ef4444" fontSize="10" textAnchor={isRight ? "end" : "start"} fontWeight="bold">
                    {Math.abs(load.magnitudeX).toFixed(1)}
                  </text>
                </g>
              );
            }

            // 2. Draw Force Y Arrow
            if (Math.abs(load.magnitudeY) > 0.001) {
              const isUp = load.magnitudeY > 0;
              const len = 40;
              // Screen Y is down. 
              // If force is Up (World +Y), arrow points Up (Screen -Y). Head at p.y. Tail at p.y + len.
              // If force is Down (World -Y), arrow points Down (Screen +Y). Head at p.y. Tail at p.y - len.
              const tailX = p.x;
              const tailY = isUp ? p.y + len : p.y - len;

              elements.push(
                <g key={`force-y-${load.id}`}>
                  <line x1={tailX} y1={tailY} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <text x={p.x + 5} y={tailY + (isUp ? 10 : -5)} fill="#ef4444" fontSize="10" textAnchor="start" fontWeight="bold">
                    {Math.abs(load.magnitudeY).toFixed(1)}
                  </text>
                </g>
              );
            }

            // 3. Draw Moment if moment exists
            if (load.moment && Math.abs(load.moment) > 0.001) {
              const r = 20; // Radius of moment arc
              // If moment is positive (CCW), arrow points CCW
              const isCCW = load.moment > 0;

              let d = "";

              if (isCCW) {
                // Start at 3 o'clock, arc to 12 o'clock
                d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 0 ${p.x} ${p.y - r}`;
              } else {
                // CW: Start at 3 o'clock, arc down to 6 o'clock...
                d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 1 ${p.x} ${p.y - r}`;
              }

              elements.push(
                <g key={`moment-${load.id}`}>
                  <path d={d} fill="none" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead-moment)" />
                  <text x={p.x + r + 5} y={p.y} fill="#ef4444" fontSize="11" fontWeight="bold">M={load.moment}</text>
                </g>
              );
            }

            return <g key={load.id}>{elements}</g>;
          })}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-lg">
        <button onClick={() => setScale(s => s * 1.2)} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => s / 1.2)} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><ZoomOut size={20} /></button>
        <button onClick={centerStructure} className="p-2 text-slate-300 hover:bg-slate-700 rounded transition"><Maximize size={20} /></button>
      </div>
    </div>
  );
};

export default StructureCanvas;