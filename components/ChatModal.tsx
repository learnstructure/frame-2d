import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, User, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { analyzeStructureWithAI } from '../services/geminiService';
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type AIProvider = 'gemini' | 'groq';

const COOLDOWN_MS = 5000; // 5 seconds between messages
const HOURLY_LIMIT = 15; // Max messages per hour per user

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, model, initialResults }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('groq');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  // Spam Protection State
  const [cooldown, setCooldown] = useState(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  useEffect(() => {
    // If we receive new results from parent, update state
    if (initialResults) {
      setResults(initialResults);
    } else {
      // If parent clears results (e.g. model changed), we clear local results too
      setResults(null);
    }
  }, [initialResults]);

  // Cooldown Timer Logic
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
    // When modal opens, if no messages exist, show welcome message
    if (isOpen && messages.length === 0) {
      const hasStructure = model.nodes.length > 0;
      const welcomeMsg = hasStructure
        ? "Hi! I can see your model. Please ask your questions about stability, forces, or potential improvements."
        : "Hi! I am your structural analysis assistant. Please start by adding nodes and members in the sidebar to define your structure.";

      setMessages([{
        role: 'assistant',
        content: welcomeMsg
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkRateLimits = (): boolean => {
    const now = Date.now();

    // 1. Cooldown Check
    if (cooldown > 0) {
      return false;
    }

    // 2. LocalStorage Usage Check (Hourly Limit)
    try {
      const storageKey = 'sr_chat_usage';
      const usageData = localStorage.getItem(storageKey);
      let usage = usageData ? JSON.parse(usageData) : { count: 0, startTime: now };

      // Reset if hour has passed
      if (now - usage.startTime > 3600000) {
        usage = { count: 0, startTime: now };
      }

      if (usage.count >= HOURLY_LIMIT) {
        setRateLimitError(`You have reached the hourly limit of ${HOURLY_LIMIT} messages. Please try again later.`);
        return false;
      }

      // Increment
      usage.count++;
      localStorage.setItem(storageKey, JSON.stringify(usage));
    } catch (e) {
      console.error("Local storage error", e);
    }

    return true;
  };

  const callAI = async (currentModel: StructureModel, query?: string, currentResults?: AnalysisResults | null) => {
    if (provider === 'groq') {
      return await analyzeStructureWithGroq(currentModel, query, currentResults || undefined);
    } else {
      return await analyzeStructureWithAI(currentModel, query, currentResults || undefined);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // Spam Check: Duplicate message
    if (messages.length > 0 && messages[messages.length - 1].role === 'user' && messages[messages.length - 1].content === input) {
      setRateLimitError("Please do not send the same message twice.");
      setTimeout(() => setRateLimitError(null), 3000);
      return;
    }

    // Rate Limit Check
    if (!checkRateLimits()) return;
    setRateLimitError(null);

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setCooldown(COOLDOWN_MS); // Start cooldown

    try {
      // Lazy analysis: If we don't have results yet, try to run the solver locally on the current model
      let currentResults = results;
      if (!currentResults) {
        try {
          currentResults = analyzeStructure(model);
          setResults(currentResults);
        } catch (err) {
          console.log("Auto-solver in chat skipped due to incomplete model or error");
        }
      }

      const response = await callAI(model, userMsg, currentResults);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that request." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] w-full max-w-2xl h-[600px] rounded-xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'gemini' ? 'bg-gradient-to-br from-cyan-500 to-blue-600' : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
              {provider === 'gemini' ? <Sparkles size={16} className="text-white" /> : <Zap size={16} className="text-white" />}
            </div>
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                AI Assistant
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AIProvider)}
                  className="ml-2 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 outline-none focus:border-cyan-500"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq (Llama 3)</option>
                </select>
              </h3>
              <p className="text-xs text-slate-400">
                {provider === 'gemini' ? 'Powered by Gemini 2.5 Flash' : 'Powered by Llama 3.3 70B'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1e293b]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : (provider === 'gemini' ? 'bg-blue-600/20 text-blue-400' : 'bg-orange-600/20 text-orange-400')}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'gemini' ? 'bg-blue-600/20 text-blue-400' : 'bg-orange-600/20 text-orange-400'}`}>
                <Bot size={16} />
              </div>
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-2">
                <Loader2 size={16} className={`animate-spin ${provider === 'gemini' ? 'text-cyan-400' : 'text-orange-400'}`} />
                <span className="text-xs text-slate-400">
                  {provider === 'gemini' ? 'Thinking with Gemini...' : 'Thinking with Groq...'}
                </span>
              </div>
            </div>
          )}
          {rateLimitError && (
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-red-900/50 border border-red-500/50 text-red-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} />
                {rateLimitError}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700 bg-[#0f172a] flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={loading || cooldown > 0}
            placeholder={cooldown > 0 ? `Wait ${Math.ceil(cooldown / 1000)}s...` : "Ask about stability, reactions, or improvements..."}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || cooldown > 0}
            className={`px-4 py-2 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[50px] flex items-center justify-center ${provider === 'gemini' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500'}`}
          >
            {cooldown > 0 ? (
              <span className="text-xs font-mono font-bold">{Math.ceil(cooldown / 1000)}s</span>
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;