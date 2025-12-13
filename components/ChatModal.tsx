import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, User, Loader2 } from 'lucide-react';
import { analyzeStructureWithAI } from '../services/geminiService';
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

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, model, initialResults }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  useEffect(() => {
    // If we receive new results from parent, update state
    if (initialResults) {
      setResults(initialResults);
    }
  }, [initialResults]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      handleInitialAnalysis();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInitialAnalysis = async () => {
    setLoading(true);

    // 1. Get Numerical Results
    // Use initialResults passed from App if available, otherwise run solver
    let localResults: AnalysisResults | null = initialResults;

    if (!localResults) {
      try {
        localResults = analyzeStructure(model);
        setResults(localResults);
      } catch (err) {
        console.error("Solver error", err);
      }
    }

    // 2. Send to AI
    const response = await analyzeStructureWithAI(model, undefined, localResults || undefined);
    setMessages([{ role: 'assistant', content: response }]);
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await analyzeStructureWithAI(model, userMsg, results || undefined);
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Structure AI Assistant</h3>
              <p className="text-xs text-slate-400">Powered by Gemini + Local Solver</p>
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
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600/20 text-blue-400'}`}>
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
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Solving and Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700 bg-[#0f172a] flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about stability, reactions, or improvements..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;