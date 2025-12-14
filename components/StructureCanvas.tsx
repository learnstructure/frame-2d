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

    // Fallback if rect is zero (e.g. element hidden or not laid out yet)
    if (width <= 0 || height <= 0) {
      width = containerRef.current.clientWidth || 300;
      height = containerRef.current.clientHeight || 300;
    }

    // 2. Calculate content bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;

    if (model.nodes.length > 0) {
      const xs = model.nodes.map(n => n.x);
      const ys = model.nodes.map(n => n.y);
      // Validate numbers to prevent NaN
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

    const padding = 60;
    const availableWidth = Math.max(50, width - padding);
    const availableHeight = Math.max(50, height - padding);

    let newScale = 40;

    // If structure has dimensions
    if (contentWidth > 0.001 || contentHeight > 0.001) {
      const scaleX = contentWidth > 0 ? availableWidth / contentWidth : Infinity;
      const scaleY = contentHeight > 0 ? availableHeight / contentHeight : Infinity;

      // Use the tighter constraint
      newScale = Math.min(scaleX, scaleY);

      // Handle flat structures (line)
      if (!isFinite(newScale)) newScale = 50;
    } else {
      // Single point or empty
      newScale = 50;
    }

    // Clamp scale
    // CHANGED: Reduced minimum scale from 2 to 0.001 to support large coordinate systems (like inches/mm)
    newScale = Math.max(0.001, Math.min(newScale, 200));

    // 4. Calculate Offset to Center
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const newOffsetX = (width / 2) - (cx * newScale);
    // Screen Y is flipped (-y), so we add cy * scale
    const newOffsetY = (height / 2) + (cy * newScale);

    // 5. Update State with Checks
    if (isFinite(newScale)) setScale(newScale);
    if (isFinite(newOffsetX) && isFinite(newOffsetY)) {
      setOffset({ x: newOffsetX, y: newOffsetY });
    }
  }, [model.nodes]);

  // --- Lifecycle Hooks ---

  // Auto-center on mount and when model nodes change significantly
  useEffect(() => {
    // Small delay to allow layout to settle on mobile
    const t = setTimeout(centerStructure, 50);
    return () => clearTimeout(t);
  }, [model.nodes.length, centerStructure]);

  // Robust Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      // Debounce slightly or just call
      requestAnimationFrame(() => {
        centerStructure();
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [centerStructure]);

  // --- Interaction Handlers ---

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

  // Touch handlers
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

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const stopPropagation = (e: React.UIEvent) => {
    e.stopPropagation();
  };

  // --- Rendering Helpers ---

  // Calculate Adaptive Grid
  // Returns grid spacing in world units (e.g., 1, 10, 100, 500)
  const getGridStep = (currentScale: number) => {
    const targetPixelSpacing = 50; // We want lines roughly 50px apart
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
    const textAnchor = isVertical ? "start" : "middle";
    const dominantBaseline = isVertical ? "middle" : "auto";

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
          <text x={labelX} y={labelY} fill="#a3e635" fontSize="10" textAnchor={textAnchor} dominantBaseline={dominantBaseline}>k={member.springConstant}</text>
        </g>
      );
    }

    const color = member.type === 'truss' ? '#fbbf24' : '#38bdf8';
    return (
      <g key={member.id}>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={member.type === 'truss' ? '4' : '0'} />
        <text x={labelX} y={labelY} fill="#94a3b8" fontSize="10" textAnchor={textAnchor} dominantBaseline={dominantBaseline}>{member.id}</text>
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

    if (load.type === LoadType.MEMBER_DISTRIBUTED) {
      const count = Math.max(3, Math.floor(len / 30));
      const arrows = [];
      if (Math.abs(load.magnitudeX) > 0.001) {
        const angle = load.magnitudeX > 0 ? 0 : Math.PI;
        for (let i = 0; i <= count; i++) {
          const t = i / count;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          const tailX = x - Math.cos(angle) * arrowLen;
          const tailY = y - Math.sin(angle) * arrowLen;
          arrows.push(<line key={`udlx-${i}`} x1={tailX} y1={tailY} x2={x} y2={y} stroke={arrowColor} strokeWidth="1" markerEnd="url(#arrowhead-pink)" />);
        }
        const startTailX = p1.x - Math.cos(angle) * arrowLen;
        const startTailY = p1.y - Math.sin(angle) * arrowLen;
        const endTailX = p2.x - Math.cos(angle) * arrowLen;
        const endTailY = p2.y - Math.sin(angle) * arrowLen;
        arrows.push(<line key="udlx-line" x1={startTailX} y1={startTailY} x2={endTailX} y2={endTailY} stroke={arrowColor} strokeWidth="1" />);
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
        arrows.push(<line key="udly-line" x1={p1.x} y1={p1.y - dyArrow} x2={p2.x} y2={p2.y - dyArrow} stroke={arrowColor} strokeWidth="1" />);
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
      const displayId = nodeId.replace(/^n/, '');
      const lines = [];
      if (Math.abs(rxn.fx) > 0.001) lines.push({ prefix: 'R', sub: `${displayId}x`, val: rxn.fx.toFixed(2) });
      if (Math.abs(rxn.fy) > 0.001) lines.push({ prefix: 'R', sub: `${displayId}y`, val: rxn.fy.toFixed(2) });
      if (Math.abs(rxn.moment) > 0.001) lines.push({ prefix: 'M', sub: `${displayId}`, val: rxn.moment.toFixed(2) });
      if (lines.length === 0) continue;

      const lineHeight = 18;
      const paddingX = 10;
      const paddingY = 8;
      const fontSize = 11;
      const maxLen = Math.max(...lines.map(l => l.prefix.length + l.sub.length + l.val.length + 3));
      const boxWidth = maxLen * 7 + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 1.5;
      const boxX = p.x - boxWidth / 2;
      const boxY = p.y + 25;

      elements.push(
        <g key={`rxn-${nodeId}`}>
          <line x1={p.x} y1={p.y + 10} x2={p.x} y2={boxY} stroke="#4ade80" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
          <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#4ade80" strokeWidth="1" className="shadow-sm" />
          {lines.map((line, i) => (
            <text key={i} x={p.x} y={boxY + paddingY + (i * lineHeight) + fontSize - 2} fill="#4ade80" fontSize={fontSize} fontFamily="monospace" fontWeight="bold" textAnchor="middle">
              {line.prefix}<tspan baselineShift="sub" fontSize="9">{line.sub}</tspan>{` = ${line.val}`}
            </text>
          ))}
        </g>
      );
    }
    return <g>{elements}</g>;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full w-full bg-[#0f172a]">
      <div
        id="structure-canvas-container"
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden cursor-crosshair bg-[#0f172a] touch-none select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Adaptive Grid Rendering */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 z-0">
          <defs>
            <pattern
              id="grid"
              width={gridSizePx}
              height={gridSizePx}
              patternUnits="userSpaceOnUse"
              x={isFinite(offset.x) ? offset.x % gridSizePx : 0}
              y={isFinite(offset.y) ? offset.y % gridSizePx : 0}
            >
              <path d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`} fill="none" stroke="gray" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {model.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 text-center z-0">
            <h1 className="text-5xl md:text-8xl font-black text-slate-800 tracking-tighter select-none">STRUCTURE REALM</h1>
          </div>
        )}

        {/* Global Analysis Count */}
        {globalAnalysisCount !== null && (
          <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 bg-slate-900/80 border border-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-2 md:gap-3 shadow-lg pointer-events-none z-10 backdrop-blur-sm">
            <div className="p-1 md:p-1.5 bg-emerald-500/10 rounded-full">
              <Activity size={14} className="text-emerald-400 md:w-4 md:h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-slate-400 uppercase tracking-wider font-bold">Analyses Run</span>
              <span className="text-sm md:text-lg font-mono font-bold text-white leading-none">{globalAnalysisCount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Legend */}
        {analysisResults && analysisResults.isStable && (
          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-slate-900/80 border border-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-2 md:gap-3 z-10 pointer-events-none backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-0.5 md:w-3 bg-sky-400"></div>
              <span className="text-[10px] md:text-xs text-slate-400">Structure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-0.5 md:w-3 bg-green-400"></div>
              <span className="text-[10px] md:text-xs text-green-400 font-bold">Reactions</span>
            </div>
          </div>
        )}

        {/* Main SVG Layer - Absolute positioning ensures it fills the container on mobile */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#ef4444" /></marker>
            <marker id="arrowhead-pink" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#f472b6" /></marker>
            <marker id="arrowhead-moment" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#ef4444" /></marker>
            <marker id="arrowhead-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#4ade80" /></marker>
            <marker id="arrowhead-moment-green" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#4ade80" /></marker>
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
                  {support.type === SupportType.FIXED && <g><rect x="-10" y="4" width="20" height="4" fill="#94a3b8" /><line x1="-8" y1="8" x2="-12" y2="16" stroke="#64748b" strokeWidth="1" /><line x1="0" y1="8" x2="-4" y2="16" stroke="#64748b" strokeWidth="1" /><line x1="8" y1="8" x2="4" y2="16" stroke="#64748b" strokeWidth="1" /></g>}
                </g>
              );
            })}
            {renderReactions()}
            {model.loads.filter(l => l.type !== LoadType.NODAL_POINT).map(renderMemberLoad)}
            {model.nodes.map(node => {
              const p = toScreen(node.x, node.y);
              return (
                <g key={node.id}>
                  <circle cx={p.x} cy={p.y} r="6" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
                  <text x={p.x + 10} y={p.y - 10} fill="white" fontSize="12" className="font-mono">{node.id}</text>
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
                elements.push(<g key={`force-x-${load.id}`}><line x1={tailX} y1={p.y} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" /><text x={tailX + (isRight ? -10 : 10)} y={p.y + 4} fill="#ef4444" fontSize="10" textAnchor={isRight ? "end" : "start"} fontWeight="bold">{Math.abs(load.magnitudeX).toFixed(1)}</text></g>);
              }
              if (Math.abs(load.magnitudeY) > 0.001) {
                const isUp = load.magnitudeY > 0;
                const tailY = isUp ? p.y + 40 : p.y - 40;
                elements.push(<g key={`force-y-${load.id}`}><line x1={p.x} y1={tailY} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)" /><text x={p.x + 5} y={tailY + (isUp ? 10 : -5)} fill="#ef4444" fontSize="10" textAnchor="start" fontWeight="bold">{Math.abs(load.magnitudeY).toFixed(1)}</text></g>);
              }
              if (load.moment && Math.abs(load.moment) > 0.001) {
                const r = 20;
                const isCCW = load.moment > 0;
                let d = isCCW ? `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 0 ${p.x} ${p.y - r}` : `M ${p.x + r} ${p.y} A ${r} ${r} 0 1 1 ${p.x} ${p.y - r}`;
                elements.push(<g key={`moment-${load.id}`}><path d={d} fill="none" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead-moment)" /><text x={p.x + r + 5} y={p.y} fill="#ef4444" fontSize="11" fontWeight="bold">M={load.moment}</text></g>);
              }
              return <g key={load.id}>{elements}</g>;
            })}
          </g>
        </svg>

        {/* Controls */}
        <div
          className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col gap-3 bg-slate-800 p-2 md:p-3 rounded-lg border border-slate-700 shadow-lg items-center z-10"
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
          onMouseMove={stopPropagation}
          onTouchMove={stopPropagation}
        >
          <button onClick={() => setScale(s => Math.min(150, s * 1.2))} className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded transition">
            <ZoomIn size={18} className="md:w-5 md:h-5" />
          </button>
          <button onClick={() => setScale(s => Math.max(0.001, s / 1.2))} className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded transition">
            <ZoomOut size={18} className="md:w-5 md:h-5" />
          </button>
          <button onClick={centerStructure} className="p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white rounded transition" title="Reset View">
            <Maximize size={18} className="md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* Displacements Table */}
      {analysisResults && analysisResults.isStable && (
        <div className="h-40 md:h-48 bg-slate-900 border-t border-slate-700 flex flex-col z-10 flex-shrink-0">
          <div className="px-3 py-2 md:px-4 bg-slate-800 border-b border-slate-700 font-semibold text-[10px] md:text-xs text-slate-300 uppercase tracking-wider flex justify-between items-center">
            <span>Nodal Displacements</span>
            <span className="text-[9px] md:text-[10px] text-slate-500">Units: consistent with input</span>
          </div>
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead className="bg-slate-800/50 sticky top-0 text-slate-400 text-[10px] md:text-xs uppercase font-medium">
                <tr>
                  <th className="p-2 md:p-3 pl-3 md:pl-4">Node</th>
                  <th className="p-2 md:p-3">dx</th>
                  <th className="p-2 md:p-3">dy</th>
                  <th className="p-2 md:p-3">θ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[10px] md:text-xs">
                {Object.entries(analysisResults.displacements).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([nodeId, disp]) => (
                  <tr key={nodeId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-2 md:p-3 pl-3 md:pl-4 font-bold text-cyan-400">{nodeId}</td>
                    <td className="p-2 md:p-3">{disp.x.toExponential(4)}</td>
                    <td className="p-2 md:p-3">{disp.y.toExponential(4)}</td>
                    <td className="p-2 md:p-3">{disp.rotation.toExponential(4)}</td>
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