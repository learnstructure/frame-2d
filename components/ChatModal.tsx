
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, User, Loader2, Zap, CheckCircle2, RotateCcw } from 'lucide-react';
import { analyzeStructureWithAI, Message } from '../services/geminiService';
import { analyzeStructureWithGroq } from '../services/groqService';
import { analyzeStructure } from '../frame/solver';
import { StructureModel, AnalysisResults, SupportType, LoadType } from '../frame/types';
import ReactMarkdown from 'react-markdown';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: StructureModel;
  setModel: (model: StructureModel) => void;
  initialResults: AnalysisResults | null;
}

type AIProvider = 'gemini' | 'groq';

const COOLDOWN_MS = 3000;
const HOURLY_LIMIT = 20;

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, model, setModel, initialResults }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const lastManualModel = useRef<StructureModel | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  useEffect(() => {
    setResults(initialResults);
  }, [initialResults]);

  useEffect(() => {
    let interval: any;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const hasStructure = (model.nodes?.length ?? 0) > 0;
      const welcomeMsg = hasStructure
        ? "Hi! I see your structural model. How can I help you?"
        : "Hi! I'm your structural analysis co-pilot. I can build structures for you—try saying 'Create a 10m simple beam with udl load of 20 kN/m'.";

      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractJsonCommand = (text: string) => {
    try {
      const mdMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonCandidate = mdMatch ? mdMatch[1] : text;
      const jsonMatch = jsonCandidate.match(/\{[\s\S]*"action"\s*:\s*"SET_MODEL"[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action === 'SET_MODEL' && parsed.payload) {
          const p = parsed.payload;

          // Deep normalization to map AI shorthand to application logic schema
          const sanitizedPayload: StructureModel = {
            nodes: Array.isArray(p.nodes) ? p.nodes.map((n: any) => ({
              id: String(n.id || ''),
              x: Number(n.x || 0),
              y: Number(n.y || 0),
              label: n.label
            })) : [],

            members: Array.isArray(p.members) ? p.members.map((m: any, idx: number) => ({
              id: String(m.id || `m${idx + 1}`),
              type: (String(m.type || 'beam').toLowerCase().includes('truss') ? 'truss' :
                String(m.type || 'beam').toLowerCase().includes('spring') ? 'spring' : 'beam'),
              startNodeId: String(m.startNodeId || m.start || m.node_i || ''),
              endNodeId: String(m.endNodeId || m.end || m.node_j || ''),
              eModulus: Number(m.eModulus ?? m.E ?? 200e9),
              area: Number(m.area ?? m.A ?? 0.01),
              momentInertia: Number(m.momentInertia ?? m.I ?? 0.0001),
              springConstant: Number(m.springConstant ?? m.k ?? 100)
            })) : [],

            supports: Array.isArray(p.supports) ? p.supports.map((s: any, idx: number) => {
              let stype = String(s.type || 'pin').toLowerCase();
              if (stype.includes('pin')) stype = SupportType.PIN;
              else if (stype.includes('roller')) stype = SupportType.ROLLER;
              else if (stype.includes('fixed')) stype = SupportType.FIXED;
              else stype = SupportType.PIN;

              return {
                id: String(s.id || `s${idx + 1}`),
                nodeId: String(s.nodeId || s.node || ''),
                type: stype as SupportType
              };
            }) : [],

            loads: Array.isArray(p.loads) ? p.loads.map((l: any, idx: number) => {
              let ltype = String(l.type || '').toLowerCase();

              // Better type identification
              if (ltype.includes('nodal')) ltype = LoadType.NODAL_POINT;
              else if (ltype.includes('dist') || ltype.includes('udl')) ltype = LoadType.MEMBER_DISTRIBUTED;
              else if (ltype.includes('member_point')) ltype = LoadType.MEMBER_POINT;
              else if (ltype.includes('point')) {
                ltype = (l.memberId || l.member) ? LoadType.MEMBER_POINT : LoadType.NODAL_POINT;
              } else {
                // Fallback based on targets
                ltype = (l.memberId || l.member) ? LoadType.MEMBER_POINT : LoadType.NODAL_POINT;
              }

              // Robust extraction of magnitudes and IDs
              const magX = Number(l.magnitudeX ?? l.fx ?? l.magX ?? l.forceX ?? 0);
              const magY = Number(l.magnitudeY ?? l.fy ?? l.magY ?? l.forceY ?? l.value ?? 0);
              const moment = Number(l.moment ?? l.m ?? l.momentZ ?? 0);
              const location = l.location !== undefined ? Number(l.location) : undefined;

              const nodeId = l.nodeId || l.node ? String(l.nodeId || l.node) : undefined;
              const memberId = l.memberId || l.member ? String(l.memberId || l.member) : undefined;

              return {
                id: String(l.id || `l${idx + 1}`),
                type: ltype as LoadType,
                nodeId,
                memberId,
                magnitudeX: magX,
                magnitudeY: magY,
                moment,
                location
              };
            }) : []
          };

          return {
            action: 'SET_MODEL',
            payload: sanitizedPayload
          };
        }
      }
    } catch (e) {
      console.warn("Normalization failed for AI suggested model:", e);
    }
    return null;
  };

  const cleanDisplayContent = (text: string) => {
    let cleaned = text.replace(/```json\n([\s\S]*?"action"\s*:\s*"SET_MODEL"[\s\S]*?)\n```/g, '');
    cleaned = cleaned.replace(/```\n([\s\S]*?"action"\s*:\s*"SET_MODEL"[\s\S]*?)\n```/g, '');
    cleaned = cleaned.replace(/\{[\s\S]*"action"\s*:\s*"SET_MODEL"[\s\S]*\}/g, '');
    return cleaned.trim();
  };

  const handleApplyModel = (jsonCmd: any) => {
    if (jsonCmd && jsonCmd.payload) {
      lastManualModel.current = JSON.parse(JSON.stringify(model));
      setModel(jsonCmd.payload);
      setMessages(prev => [...prev, { role: 'assistant', content: "✅ Structural model with applied loads is now active on the canvas." }]);
    }
  };

  const handleUndoModel = () => {
    if (lastManualModel.current) {
      setModel(lastManualModel.current);
      lastManualModel.current = null;
      setMessages(prev => [...prev, { role: 'assistant', content: "🔄 Model reverted." }]);
    }
  };

  const checkRateLimits = (): boolean => {
    const now = Date.now();
    if (cooldown > 0) return false;
    try {
      const storageKey = 'sr_chat_usage';
      const usageData = localStorage.getItem(storageKey);
      let usage = usageData ? JSON.parse(usageData) : { count: 0, startTime: now };
      if (now - usage.startTime > 3600000) usage = { count: 0, startTime: now };
      if (usage.count >= HOURLY_LIMIT) {
        setRateLimitError(`Limit of ${HOURLY_LIMIT} messages per hour reached.`);
        return false;
      }
      usage.count++;
      localStorage.setItem(storageKey, JSON.stringify(usage));
      return true;
    } catch (e) { return true; }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!checkRateLimits()) return;
    setRateLimitError(null);

    const userMsg = input;
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];

    setInput('');
    setMessages(newMessages);
    setLoading(true);
    setCooldown(COOLDOWN_MS);

    try {
      let currentResults = results;
      const nodesCount = model.nodes?.length ?? 0;
      const membersCount = model.members?.length ?? 0;

      if (!currentResults && nodesCount > 0 && membersCount > 0) {
        try {
          currentResults = analyzeStructure(model);
          setResults(currentResults);
        } catch (err) { }
      }

      let responseContent = "";
      if (provider === 'groq') {
        responseContent = await analyzeStructureWithGroq(model, newMessages, currentResults || undefined);
      } else {
        responseContent = await analyzeStructureWithAI(model, newMessages, currentResults || undefined);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble processing that request." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] w-full max-w-2xl h-[85vh] md:h-[600px] rounded-xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#0f172a] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'gemini' ? 'bg-gradient-to-br from-cyan-500 to-blue-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
              {provider === 'gemini' ? <Sparkles size={16} className="text-white" /> : <Zap size={16} className="text-white" />}
            </div>
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                Engineering Co-pilot
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AIProvider)}
                  className="ml-2 text-[10px] bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 outline-none"
                >
                  <option value="gemini">Gemini Flash</option>
                  <option value="groq">Llama 3 (Groq)</option>
                </select>
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-2">
            <X size={20} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1e293b] min-h-0 scroll-smooth">
          {messages.map((msg, i) => {
            const jsonCmd = msg.role === 'assistant' ? extractJsonCommand(msg.content) : null;
            const displayText = msg.role === 'assistant' ? cleanDisplayContent(msg.content) : msg.content;

            return (
              <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : (provider === 'gemini' ? 'bg-blue-600/20 text-blue-400' : 'bg-orange-600/20 text-orange-400')}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
                    }`}>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{displayText}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {jsonCmd && (
                  <div className="ml-11 mr-11 bg-slate-900/80 border border-emerald-500/30 rounded-lg p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">
                      <Zap size={14} className="animate-pulse" /> Modeling Suggestion
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      The agent has prepared a new structural layout based on your request. Applying this will update your current canvas.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApplyModel(jsonCmd)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <CheckCircle2 size={14} /> Apply Changes
                      </button>
                      {lastManualModel.current && (
                        <button
                          onClick={handleUndoModel}
                          className="bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 px-3 rounded-md text-[11px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                          title="Undo last AI update"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-3 animate-pulse">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'gemini' ? 'bg-blue-600/20 text-blue-400' : 'bg-orange-600/20 text-orange-400'}`}>
                <Bot size={16} />
              </div>
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-[#0f172a] flex-shrink-0">
          <div className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={loading || cooldown > 0}
              placeholder={cooldown > 0 ? `Rate limited. Wait ${Math.ceil(cooldown / 1000)}s...` : "Build structure or ask questions..."}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none disabled:opacity-50 transition-all shadow-inner"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || cooldown > 0}
              className={`px-5 py-2 rounded-lg transition-all text-white disabled:opacity-50 font-bold shadow-lg active:scale-95 ${provider === 'gemini' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500'}`}
            >
              {cooldown > 0 ? `${Math.ceil(cooldown / 1000)}s` : <Send size={18} />}
            </button>
          </div>
          {rateLimitError && <p className="mt-2 text-center text-red-400 text-[10px] font-bold">{rateLimitError}</p>}
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
