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
    // Allow scaling down for large structures (min 0.1 instead of 20)
    const finalScale = Math.max(0.1, Math.min(newScale, 150));
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

    // Calculate label positioning
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Determine orientation for label placement: "more vertical" if dy > dx
    const isVertical = Math.abs(dy) > Math.abs(dx);

    // If vertical, place to the right (x + 10). If horizontal, place above (y - 10).
    const labelX = isVertical ? midX + 10 : midX;
    const labelY = isVertical ? midY : midY - 10;
    const textAnchor = isVertical ? "start" : "middle";
    const dominantBaseline = isVertical ? "middle" : "auto";

    if (member.type === 'spring') {
      // Draw zigzag
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
          <text
            x={labelX}
            y={labelY}
            fill="#a3e635"
            fontSize="10"
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
          >k={member.springConstant}</text>
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
        <text
          x={labelX}
          y={labelY}
          fill="#94a3b8"
          fontSize="10"
          textAnchor={textAnchor}
          dominantBaseline={dominantBaseline}
        >{member.id}</text>
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

      // Remove 'n' prefix for cleaner display (e.g. n1 -> 1)
      const displayId = nodeId.replace(/^n/, '');

      // Generate text lines objects
      const lines = [];
      if (Math.abs(rxn.fx) > 0.001) lines.push({ prefix: 'R', sub: `${displayId}x`, val: rxn.fx.toFixed(2) });
      if (Math.abs(rxn.fy) > 0.001) lines.push({ prefix: 'R', sub: `${displayId}y`, val: rxn.fy.toFixed(2) });
      if (Math.abs(rxn.moment) > 0.001) lines.push({ prefix: 'M', sub: `${displayId}`, val: rxn.moment.toFixed(2) });

      if (lines.length === 0) continue;

      // Box styling parameters - Increased line height and padding
      const lineHeight = 18;
      const paddingX = 10;
      const paddingY = 8;
      const fontSize = 11;

      // Estimate width (approx 7px per char for monospace 11px)
      const maxLen = Math.max(...lines.map(l => l.prefix.length + l.sub.length + 3 + l.val.length));
      const boxWidth = maxLen * 7 + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 1.5;

      // Position below the support (assuming support is drawn around node y)
      // Fixed supports extend down, so we push it down a bit more (e.g., 25px offset)
      const boxX = p.x - boxWidth / 2;
      const boxY = p.y + 25;

      elements.push(
        <g key={`rxn-${nodeId}`}>
          {/* Connecting line (optional, but helps visual association) */}
          <line x1={p.x} y1={p.y + 10} x2={p.x} y2={boxY} stroke="#4ade80" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />

          {/* Box Background */}
          <rect
            x={boxX}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            rx="4"
            fill="rgba(15, 23, 42, 0.95)"
            stroke="#4ade80"
            strokeWidth="1"
            className="shadow-sm"
          />

          {/* Text Lines */}
          {lines.map((line, i) => (
            <text
              key={i}
              x={p.x}
              y={boxY + paddingY + (i * lineHeight) + fontSize - 2}
              fill="#4ade80"
              fontSize={fontSize}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {line.prefix}
              <tspan baselineShift="sub" fontSize="9">{line.sub}</tspan>
              {` = ${line.val}`}
            </text>
          ))}
        </g>
      );
    }
    return <g>{elements}</g>;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
      <div
        id="structure-canvas-container"
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-crosshair bg-[#0f172a]"
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

        {/* Legend - Moved to top right */}
        {analysisResults && analysisResults.isStable && (
          <div className="absolute top-4 right-4 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-full flex items-center gap-3 z-10 pointer-events-none">
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

      {/* Displacements Table */}
      {analysisResults && analysisResults.isStable && (
        <div className="h-48 bg-slate-900 border-t border-slate-700 flex flex-col z-10">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 font-semibold text-xs text-slate-300 uppercase tracking-wider flex justify-between items-center">
            <span>Nodal Displacements</span>
            <span className="text-[10px] text-slate-500">Units: consistent with input (e.g. m, rad)</span>
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-800/50 sticky top-0 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-3 pl-4">Node</th>
                  <th className="p-3">dx</th>
                  <th className="p-3">dy</th>
                  <th className="p-3">θ (theta)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-xs">
                {Object.entries(analysisResults.displacements).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([nodeId, disp]) => (
                  <tr key={nodeId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 pl-4 font-bold text-cyan-400">{nodeId}</td>
                    <td className="p-3">{disp.x.toExponential(4)}</td>
                    <td className="p-3">{disp.y.toExponential(4)}</td>
                    <td className="p-3">{disp.rotation.toExponential(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructureCanvas;