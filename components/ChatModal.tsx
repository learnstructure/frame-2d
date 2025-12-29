
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, User, Loader2, Zap } from 'lucide-react';
import { analyzeStructureWithAI, Message } from '../services/geminiService';
import { analyzeStructureWithGroq } from '../services/groqService';
import { analyzeStructure } from '../frame/solver';
import { StructureModel, AnalysisResults } from '../frame/types';
import ReactMarkdown from 'react-markdown';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: StructureModel;
  initialResults: AnalysisResults | null;
}

type AIProvider = 'gemini' | 'groq';

const COOLDOWN_MS = 3000;
const HOURLY_LIMIT = 20;

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, model, initialResults }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('groq');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);

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
      const hasStructure = model.nodes.length > 0;
      const welcomeMsg = hasStructure
        ? "Hi! I see your structural model. How can I help you analyze the forces or improve the design?"
        : "Hi! I'm your structural analysis co-pilot. Start by defining your structure in the sidebar!";

      setMessages([{ role: 'assistant', content: welcomeMsg }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      if (!currentResults && model.nodes.length > 0 && model.members.length > 0) {
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
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : (provider === 'gemini' ? 'bg-blue-600/20 text-blue-400' : 'bg-orange-600/20 text-orange-400')}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm'
                }`}>
                {/* Fix: Wrapped ReactMarkdown in a div to resolve the className type error */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
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
              placeholder={cooldown > 0 ? `Please wait ${Math.ceil(cooldown / 1000)}s...` : "Ask about forces, stability, or how to use the app..."}
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
