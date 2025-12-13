import React, { useRef, useEffect, useState } from 'react';
import { StructureModel, SupportType, LoadType, AnalysisResults } from '../frame/types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface StructureCanvasProps {
  model: StructureModel;
  analysisResults: AnalysisResults | null;
}

const StructureCanvas: React.FC<StructureCanvasProps> = ({ model, analysisResults }) => {
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
    const color = member.type === 'truss' ? '#fbbf24' : '#38bdf8'; // Amber/Sky for original

    return (
      <g key={member.id}>
        <line
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={member.type === 'truss' ? '4' : '0'}
          className="drop-shadow-lg"
        />
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
    const arrowLen = 25;
    const arrowColor = "#f472b6"; // Pink for member loads

    if (load.type === LoadType.MEMBER_DISTRIBUTED) {
      const count = Math.max(3, Math.floor(len / 30));
      const arrows = [];

      // Split into X and Y UDLs
      // Global X UDL
      if (Math.abs(load.magnitudeX) > 0.001) {
        const isRight = load.magnitudeX > 0;
        const angle = isRight ? 0 : Math.PI; // 0 or 180 deg

        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;

          const tailX = x - Math.cos(angle) * arrowLen;
          const tailY = y - Math.sin(angle) * arrowLen;

          arrows.push(
            <line key={`udlx-${i}`} x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />
          );
        }
        // Connect tails for X
        const startTailX = p1.x - Math.cos(angle) * arrowLen;
        const startTailY = p1.y - Math.sin(angle) * arrowLen;
        const endTailX = p2.x - Math.cos(angle) * arrowLen;
        const endTailY = p2.y - Math.sin(angle) * arrowLen;
        arrows.push(<line key="udlx-line" x1={startTailX} y1={startTailY} x2={endTailX} y2={endTailY} stroke={arrowColor} strokeWidth="1" />);
      }

      // Global Y UDL
      if (Math.abs(load.magnitudeY) > 0.001) {
        const isUp = load.magnitudeY > 0; // Screen coords: Up is -Y
        // Screen Vector: Up means screen Y decreases. 
        // We want arrow pointing towards member.
        const dyArrow = isUp ? -arrowLen : arrowLen;

        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;

          const tailX = x;
          const tailY = y - dyArrow;

          arrows.push(
            <line key={`udly-${i}`} x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />
          );
        }
        // Connect tails for Y
        const startTailX = p1.x;
        const startTailY = p1.y - dyArrow;
        const endTailX = p2.x;
        const endTailY = p2.y - dyArrow;
        arrows.push(<line key="udly-line" x1={startTailX} y1={startTailY} x2={endTailX} y2={endTailY} stroke={arrowColor} strokeWidth="1" />);
      }

      return (
        <g key={load.id}>
          {arrows}
          <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 10} fill={arrowColor} fontSize="10" textAnchor="middle">
            UDL
          </text>
        </g>
      );

    } else if (load.type === LoadType.MEMBER_POINT) {
      const realDx = end.x - start.x;
      const realDy = end.y - start.y;
      const realLen = Math.sqrt(realDx * realDx + realDy * realDy);

      const ratio = (load.location || 0) / realLen;
      if (ratio < 0 || ratio > 1) return null;

      const x = p1.x + dx * ratio;
      const y = p1.y + dy * ratio;

      const elements = [];

      // X Component
      if (Math.abs(load.magnitudeX) > 0.001) {
        const isRight = load.magnitudeX > 0;
        const tailX = isRight ? x - 30 : x + 30;
        elements.push(
          <g key="px">
            <line x1={tailX} y1={y} x2={x} y2={y} stroke={arrowColor} strokeWidth="2" markerEnd="url(#arrowhead-pink)" />
            <text x={tailX + (isRight ? -5 : 5)} y={y - 5} fill={arrowColor} fontSize="10" textAnchor={isRight ? "end" : "start"}>
              {Math.abs(load.magnitudeX).toFixed(1)}
            </text>
          </g>
        );
      }

      // Y Component
      if (Math.abs(load.magnitudeY) > 0.001) {
        const isUp = load.magnitudeY > 0;
        const tailY = isUp ? y + 30 : y - 30; // Screen Y: Up is neg, Down is pos.
        // If load is Up, we want arrow pointing Up. Head at y. Tail at y+30 (below).
        elements.push(
          <g key="py">
            <line x1={x} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="2" markerEnd="url(#arrowhead-pink)" />
            <text x={x + 5} y={tailY} fill={arrowColor} fontSize="10" textAnchor="start">
              {Math.abs(load.magnitudeY).toFixed(1)}
            </text>
          </g>
        );
      }

      return <g key={load.id}>{elements}</g>;
    }
    return null;
  };

  const renderReactions = () => {
    if (!analysisResults) return null;

    const elements = [];

    for (const [nodeId, rxn] of Object.entries(analysisResults.reactions)) {
      // Check if any reaction component is significant
      if (Math.abs(rxn.fx) < 0.001 && Math.abs(rxn.fy) < 0.001 && Math.abs(rxn.moment) < 0.001) continue;

      const node = model.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const p = toScreen(node.x, node.y);
      const color = "#4ade80"; // Green for reactions

      // FX Reaction
      if (Math.abs(rxn.fx) > 0.001) {
        const len = 35;
        const isRight = rxn.fx > 0;
        // If Rx > 0, arrow points Right. Tail is Left.
        const tailX = isRight ? p.x - len : p.x + len;

        elements.push(
          <g key={`rx-${nodeId}`}>
            <line x1={tailX} y1={p.y} x2={p.x} y2={p.y} stroke={color} strokeWidth="2" markerEnd="url(#arrowhead-green)" />
            <text x={tailX} y={p.y - 5} fill={color} fontSize="11" fontWeight="bold">
              {rxn.fx.toFixed(2)}
            </text>
          </g>
        );
      }

      // FY Reaction
      if (Math.abs(rxn.fy) > 0.001) {
        const len = 35;
        const isUp = rxn.fy > 0;
        // If Ry > 0 (Up), arrow points Up. Tail is Below (Screen Y+).
        const tailY = isUp ? p.y + len : p.y - len;

        elements.push(
          <g key={`ry-${nodeId}`}>
            <line x1={p.x} y1={tailY} x2={p.x} y2={p.y} stroke={color} strokeWidth="2" markerEnd="url(#arrowhead-green)" />
            <text x={p.x + 5} y={tailY + (isUp ? 0 : 10)} fill={color} fontSize="11" fontWeight="bold">
              {rxn.fy.toFixed(2)}
            </text>
          </g>
        );
      }

      // Moment Reaction
      if (Math.abs(rxn.moment) > 0.001) {
        const r = 30;
        const isCCW = rxn.moment > 0;
        let d = "";
        if (isCCW) d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 0 ${p.x} ${p.y - r}`;
        else d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 1 ${p.x} ${p.y - r}`;

        elements.push(
          <g key={`rm-${nodeId}`}>
            <path d={d} fill="none" stroke={color} strokeWidth="2" markerEnd="url(#arrowhead-moment-green)" />
            <text x={p.x + r + 5} y={p.y + 10} fill={color} fontSize="11" fontWeight="bold">
              {rxn.moment.toFixed(2)}
            </text>
          </g>
        );
      }
    }
    return <g>{elements}</g>;
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

      {analysisResults && analysisResults.isStable && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-full flex items-center gap-3 z-10 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-sky-400"></div>
            <span className="text-xs text-slate-400">Structure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-400"></div>
            <span className="text-xs text-green-400 font-bold">Reactions</span>
          </div>
        </div>
      )}

      <svg className="w-full h-full pointer-events-none">
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
          </marker>
          <marker id="arrowhead-pink" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#f472b6" />
          </marker>
          <marker id="arrowhead-moment" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#ef4444" />
          </marker>
          <marker id="arrowhead-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#4ade80" />
          </marker>
          <marker id="arrowhead-moment-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#4ade80" />
          </marker>
        </defs>
        <g>
          {/* Members */}
          {model.members.map(m => renderMember(m))}

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

          {/* Reactions */}
          {renderReactions()}

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

          {/* Nodal Loads */}
          {model.loads.filter(l => l.type === LoadType.NODAL_POINT).map(load => {
            const node = model.nodes.find(n => n.id === load.nodeId);
            if (!node) return null;
            const p = toScreen(node.x, node.y);

            const elements = [];

            // 1. Draw Force X Arrow
            if (Math.abs(load.magnitudeX) > 0.001) {
              const isRight = load.magnitudeX > 0;
              const len = 40;
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

            // 3. Draw Moment
            if (load.moment && Math.abs(load.moment) > 0.001) {
              const r = 20;
              const isCCW = load.moment > 0;
              let d = "";
              if (isCCW) d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 0 ${p.x} ${p.y - r}`;
              else d = `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 1 ${p.x} ${p.y - r}`;

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