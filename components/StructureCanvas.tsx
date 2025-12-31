
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StructureModel, SupportType, LoadType, AnalysisResults } from '../frame/types';
import { ZoomIn, ZoomOut, Maximize, Activity } from 'lucide-react';
import { subscribeToAnalysisCount } from '../services/firebase';

interface StructureCanvasProps {
  model: StructureModel;
  analysisResults: AnalysisResults | null;
}

const StructureCanvas: React.FC<StructureCanvasProps> = ({ model, analysisResults }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [scale, setScale] = useState(40); // Pixels per unit
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [globalAnalysisCount, setGlobalAnalysisCount] = useState<number | null>(null);

  // Subscribe to analysis count
  useEffect(() => {
    const unsubscribe = subscribeToAnalysisCount((count) => {
      setGlobalAnalysisCount(count);
    });
    return () => unsubscribe();
  }, []);

  // --- Robust Centering Logic ---
  const centerStructure = useCallback(() => {
    if (!containerRef.current) return;

    // 1. Get container dimensions safely
    const rect = containerRef.current.getBoundingClientRect();
    let width = rect.width;
    let height = rect.height;

    // Fallback if rect is zero
    if (width <= 0 || height <= 0) {
      width = containerRef.current.clientWidth || 300;
      height = containerRef.current.clientHeight || 300;
    }

    // 2. Calculate content bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;

    if (model.nodes.length > 0) {
      const xs = model.nodes.map(n => n.x);
      const ys = model.nodes.map(n => n.y);
      const validXs = xs.filter(n => !isNaN(n));
      const validYs = ys.filter(n => !isNaN(n));

      if (validXs.length > 0) {
        minX = Math.min(...validXs);
        maxX = Math.max(...validXs);
        minY = Math.min(...validYs);
        maxY = Math.max(...validYs);
      }
    }

    // 3. Determine Scale
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 100;
    const availableWidth = Math.max(50, width - padding);
    const availableHeight = Math.max(50, height - padding);

    let newScale = 40;

    if (contentWidth > 0.001 || contentHeight > 0.001) {
      const scaleX = contentWidth > 0 ? availableWidth / contentWidth : Infinity;
      const scaleY = contentHeight > 0 ? availableHeight / contentHeight : Infinity;
      newScale = Math.min(scaleX, scaleY);
      if (!isFinite(newScale)) newScale = 50;
    } else {
      newScale = 50;
    }

    newScale = Math.max(0.001, Math.min(newScale, 200));

    // 4. Calculate Offset to Center
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const newOffsetX = (width / 2) - (cx * newScale);
    const newOffsetY = (height / 2) + (cy * newScale);

    if (isFinite(newScale)) setScale(newScale);
    if (isFinite(newOffsetX) && isFinite(newOffsetY)) {
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [model.nodes]);

  useEffect(() => {
    const t = setTimeout(centerStructure, 100);
    return () => clearTimeout(t);
  }, [model.nodes.length, centerStructure]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => centerStructure());
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [centerStructure]);

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

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setLastMouse({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastMouse.x;
    const dy = touch.clientY - lastMouse.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMouse({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const getGridStep = (currentScale: number) => {
    const targetPixelSpacing = 50;
    if (currentScale <= 0) return 1;
    const rawStep = targetPixelSpacing / currentScale;
    const power = Math.floor(Math.log10(rawStep));
    const base = Math.pow(10, power);
    if (rawStep / base < 2) return base;
    if (rawStep / base < 5) return base * 2;
    return base * 5;
  };

  const gridStep = getGridStep(scale);
  const gridSizePx = gridStep * scale;

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
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const isVertical = Math.abs(dy) > Math.abs(dx);
    const labelX = isVertical ? midX + 10 : midX;
    const labelY = isVertical ? midY : midY - 10;

    if (member.type === 'spring') {
      const length = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / (length || 1);
      const perpY = dx / (length || 1);
      const zigCount = 10;
      const zigHeight = 5;
      let d = `M ${p1.x} ${p1.y}`;
      for (let i = 1; i <= zigCount; i++) {
        const t = i / zigCount;
        const px = p1.x + dx * t;
        const py = p1.y + dy * t;
        const offset = (i % 2 === 0 ? 1 : -1) * zigHeight;
        if (i < zigCount) d += ` L ${px + perpX * offset} ${py + perpY * offset}`;
        else d += ` L ${p2.x} ${p2.y}`;
      }
      return (
        <g key={member.id}>
          <path d={d} stroke="#a3e635" strokeWidth="2" fill="none" />
          <text x={labelX} y={labelY} fill="#a3e635" fontSize="10" textAnchor={isVertical ? "start" : "middle"}>k={member.springConstant}</text>
        </g>
      );
    }
    const color = member.type === 'truss' ? '#fbbf24' : '#38bdf8';
    return (
      <g key={member.id}>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={member.type === 'truss' ? '4' : '0'} />
        <text x={labelX} y={labelY} fill="#94a3b8" fontSize="10" textAnchor={isVertical ? "start" : "middle"}>{member.id}</text>
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
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const arrowLen = 25;
    const arrowColor = "#f472b6";
    const momentColor = "#f59e0b";

    if (load.type === LoadType.MEMBER_DISTRIBUTED) {
      const count = Math.max(3, Math.floor(len / 30));
      const arrows = [];
      if (Math.abs(load.magnitudeX) > 0.001) {
        const angle = load.magnitudeX > 0 ? 0 : Math.PI;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          const tailX = x - cosA * arrowLen;
          const tailY = y - sinA * arrowLen;
          arrows.push(<line key={`udlx-${i}`} x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />);
        }
        // Add connecting bar for X UDL
        arrows.push(
          <line
            key={`udlx-bar`}
            x1={p1.x - cosA * arrowLen} y1={p1.y - sinA * arrowLen}
            x2={p2.x - cosA * arrowLen} y2={p2.y - sinA * arrowLen}
            stroke={arrowColor} strokeWidth="1"
          />
        );
      }
      if (Math.abs(load.magnitudeY) > 0.001) {
        const isUp = load.magnitudeY > 0;
        const dyArrow = isUp ? -arrowLen : arrowLen;
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          arrows.push(<line key={`udly-${i}`} x1={x} y1={y - dyArrow} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />);
        }
        // Add connecting bar for Y UDL
        arrows.push(
          <line
            key={`udly-bar`}
            x1={p1.x} y1={p1.y - dyArrow}
            x2={p2.x} y2={p2.y - dyArrow}
            stroke={arrowColor} strokeWidth="1"
          />
        );
      }
      return <g key={load.id}>{arrows}</g>;
    } else if (load.type === LoadType.MEMBER_POINT) {
      const realLen = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const ratio = (load.location || 0) / (realLen || 1);
      if (ratio < 0 || ratio > 1) return null;
      const x = p1.x + dx * ratio;
      const y = p1.y + dy * ratio;
      const elements = [];
      if (Math.abs(load.magnitudeX) > 0.001) {
        const isRight = load.magnitudeX > 0;
        const tailX = isRight ? x - 30 : x + 30;
        elements.push(<g key="px"><line x1={tailX} y1={y} x2={x} y2={y} stroke={arrowColor} strokeWidth="2" markerEnd="url(#arrowhead-pink)" /><text x={tailX + (isRight ? -5 : 5)} y={y - 5} fill={arrowColor} fontSize="10" textAnchor={isRight ? "end" : "start"}>{Math.abs(load.magnitudeX).toFixed(1)}</text></g>);
      }
      if (Math.abs(load.magnitudeY) > 0.001) {
        const isUp = load.magnitudeY > 0;
        const tailY = isUp ? y + 30 : y - 30;
        elements.push(<g key="py"><line x1={x} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="2" markerEnd="url(#arrowhead-pink)" /><text x={x + 5} y={tailY} fill={arrowColor} fontSize="10" textAnchor="start">{Math.abs(load.magnitudeY).toFixed(1)}</text></g>);
      }
      if (Math.abs(load.moment || 0) > 0.001) {
        const isCCW = (load.moment || 0) > 0;
        const d = isCCW ? "M 15 0 A 15 15 0 1 0 0 -15" : "M 15 0 A 15 15 0 1 1 0 -15";
        elements.push(
          <g key="pm" transform={`translate(${x}, ${y})`}>
            <path d={d} fill="none" stroke={momentColor} strokeWidth="1.5" markerEnd="url(#arrowhead-moment)" />
            <text x="18" y="-18" fill={momentColor} fontSize="9" fontWeight="bold">{load.moment}</text>
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
      if (Math.abs(rxn.fx) < 0.001 && Math.abs(rxn.fy) < 0.001 && Math.abs(rxn.moment) < 0.001) continue;
      const node = model.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const p = toScreen(node.x, node.y);
      const lines = [];
      if (Math.abs(rxn.fx) > 0.001) lines.push({ prefix: 'R', sub: nodeId.replace('n', ''), suffix: 'x', val: rxn.fx.toFixed(2) });
      if (Math.abs(rxn.fy) > 0.001) lines.push({ prefix: 'R', sub: nodeId.replace('n', ''), suffix: 'y', val: rxn.fy.toFixed(2) });
      if (Math.abs(rxn.moment) > 0.001) lines.push({ prefix: 'M', sub: nodeId.replace('n', ''), suffix: '', val: rxn.moment.toFixed(2) });

      const boxHeight = lines.length * 18 + 12;
      const boxY = p.y + 25;

      elements.push(
        <g key={`rxn-${nodeId}`}>
          <rect x={p.x - 35} y={boxY} width="70" height={boxHeight} rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#4ade80" strokeWidth="1" />
          {lines.map((line, i) => (
            <text key={i} x={p.x} y={boxY + 18 + (i * 18)} fill="#4ade80" fontSize="10" textAnchor="middle" fontWeight="bold">
              {line.prefix}{line.sub}{line.suffix}={line.val}
            </text>
          ))}
        </g>
      );
    }
    return elements;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full w-full bg-[#0f172a] overflow-hidden">
      <div
        id="structure-canvas-container"
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden cursor-crosshair bg-[#0f172a] touch-none select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <pattern id="grid" width={gridSizePx} height={gridSizePx} patternUnits="userSpaceOnUse" x={offset.x % gridSizePx} y={offset.y % gridSizePx}>
              <path d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`} fill="none" stroke="gray" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {model.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 text-center">
            <h1 className="text-4xl md:text-8xl font-black text-slate-800 tracking-tighter opacity-50 select-none">STRUCTURE REALM</h1>
          </div>
        )}

        {globalAnalysisCount !== null && (
          <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg z-10 backdrop-blur-sm">
            <Activity size={14} className="text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Analyses</span>
              <span className="text-xs md:text-sm font-mono font-bold text-white">{globalAnalysisCount.toLocaleString()}</span>
            </div>
          </div>
        )}

        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#ef4444" /></marker>
            <marker id="arrowhead-pink" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#f472b6" /></marker>
            <marker id="arrowhead-moment" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#f59e0b" /></marker>
          </defs>
          <g>
            {model.members.map(m => renderMember(m))}
            {model.supports.map(support => {
              const node = model.nodes.find(n => n.id === support.nodeId);
              if (!node) return null;
              const p = toScreen(node.x, node.y);
              return (
                <g key={support.id} transform={`translate(${p.x}, ${p.y})`}>
                  {support.type === SupportType.PIN && <path d="M 0 0 L -8 14 L 8 14 Z" fill="#475569" stroke="#94a3b8" strokeWidth="2" />}
                  {support.type === SupportType.ROLLER && <g><path d="M 0 0 L -8 12 L 8 12 Z" fill="#475569" stroke="#94a3b8" strokeWidth="2" /><circle cx="-5" cy="16" r="3" fill="#94a3b8" /><circle cx="5" cy="16" r="3" fill="#94a3b8" /></g>}
                  {support.type === SupportType.FIXED && <g><rect x="-10" y="4" width="20" height="4" fill="#94a3b8" /><line x1="-8" y1="8" x2="-12" y2="16" stroke="#64748b" strokeWidth="1" /><line x1="8" y1="8" x2="4" y2="16" stroke="#64748b" strokeWidth="1" /></g>}
                </g>
              );
            })}
            {renderReactions()}
            {model.loads.filter(l => l.type !== LoadType.NODAL_POINT).map(renderMemberLoad)}
            {model.nodes.map(node => {
              const p = toScreen(node.x, node.y);
              return (
                <g key={node.id}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#f1f5f9" stroke="#334155" strokeWidth="1" />
                  <text x={p.x + 8} y={p.y - 8} fill="white" fontSize="10" className="font-mono">{node.id}</text>
                </g>
              );
            })}
            {model.loads.filter(l => l.type === LoadType.NODAL_POINT).map(load => {
              const node = model.nodes.find(n => n.id === load.nodeId);
              if (!node) return null;
              const p = toScreen(node.x, node.y);
              const elements = [];
              if (Math.abs(load.magnitudeX) > 0.001) {
                const isRight = load.magnitudeX > 0;
                const tailX = isRight ? p.x - 40 : p.x + 40;
                elements.push(<g key={`fx-${load.id}`}><line x1={tailX} y1={p.y} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" /><text x={tailX + (isRight ? -5 : 5)} y={p.y - 4} fill="#ef4444" fontSize="9" textAnchor={isRight ? "end" : "start"}>{Math.abs(load.magnitudeX)}</text></g>);
              }
              if (Math.abs(load.magnitudeY) > 0.001) {
                const isUp = load.magnitudeY > 0;
                const tailY = isUp ? p.y + 40 : p.y - 40;
                elements.push(<g key={`fy-${load.id}`}><line x1={p.x} y1={tailY} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" /><text x={p.x + 4} y={tailY + (isUp ? 10 : -4)} fill="#ef4444" fontSize="9">{Math.abs(load.magnitudeY)}</text></g>);
              }
              if (Math.abs(load.moment || 0) > 0.001) {
                const isCCW = (load.moment || 0) > 0;
                const d = isCCW ? "M 18 0 A 18 18 0 1 0 0 -18" : "M 18 0 A 18 18 0 1 1 0 -18";
                elements.push(
                  <g key={`m-${load.id}`} transform={`translate(${p.x}, ${p.y})`}>
                    <path d={d} fill="none" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrowhead-moment)" />
                    <text x="22" y="-22" fill="#f59e0b" fontSize="9" fontWeight="bold">{load.moment}</text>
                  </g>
                );
              }
              return elements;
            })}
          </g>
        </svg>

        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <button onClick={() => setScale(s => Math.min(150, s * 1.2))} className="p-2 bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:text-white rounded-lg shadow-lg border border-slate-700 transition-all active:scale-95">
            <ZoomIn size={20} />
          </button>
          <button onClick={() => setScale(s => Math.max(0.001, s / 1.2))} className="p-2 bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:text-white rounded-lg shadow-lg border border-slate-700 transition-all active:scale-95">
            <ZoomOut size={20} />
          </button>
          <button onClick={centerStructure} className="p-2 bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:text-white rounded-lg shadow-lg border border-slate-700 transition-all active:scale-95">
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Analysis Results Table - Improved for iPad/Tablet height */}
      {analysisResults && analysisResults.isStable && (
        <div className="h-32 md:h-40 bg-slate-900 border-t border-slate-700 flex flex-col flex-shrink-0 z-10 overflow-hidden">
          <div className="px-4 py-1.5 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
            <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Nodal Displacements</span>
          </div>
          <div className="flex-1 overflow-auto bg-slate-950/20">
            <table className="w-full text-left border-collapse text-[10px] md:text-xs">
              <thead className="bg-slate-900/50 sticky top-0">
                <tr className="text-slate-500 font-bold border-b border-slate-800">
                  <th className="p-2 pl-4">Node</th>
                  <th className="p-2">dx</th>
                  <th className="p-2">dy</th>
                  <th className="p-2">Rotation (rad)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
                {Object.entries(analysisResults.displacements).map(([nodeId, disp]) => (
                  <tr key={nodeId} className="hover:bg-slate-800/30">
                    <td className="p-2 pl-4 text-cyan-400 font-bold">{nodeId}</td>
                    <td className="p-2">{disp.x.toExponential(3)}</td>
                    <td className="p-2">{disp.y.toExponential(3)}</td>
                    <td className="p-2">{disp.rotation.toExponential(3)}</td>
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
