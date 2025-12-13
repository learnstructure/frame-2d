import React, { useState } from 'react';
import { Play, FileText, Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StructureCanvas from './components/StructureCanvas';
import ChatModal from './components/ChatModal';
import { StructureModel } from './frame/types';

const App = () => {
  const [model, setModel] = useState<StructureModel>({
    nodes: [],
    members: [],
    supports: [],
    loads: []
  });

  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a] text-slate-100 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 bg-[#0f172a] px-6 flex items-center justify-between z-20 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Logo Image - Place your image file named 'logo.png' in the public folder */}
          <div className="p-1 rounded-lg shadow-lg shadow-blue-900/20 bg-white/5 border border-white/10">
            <img
              src="/logo.png"
              alt="StructureRealm Logo"
              className="w-8 h-8 object-contain"
              onError={(e) => {
                // Fallback if image is missing
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-8 h-8 flex items-center justify-center text-xs text-slate-500">IMG</div>';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-blue-400">Structure</span><span className="text-emerald-400">Realm</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/50"
          >
            <Play size={18} fill="currentColor" /> Analyze
          </button>
          <button className="px-4 py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded font-medium flex items-center gap-2 transition-all">
            <FileText size={18} /> Report
          </button>
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-900/50 group"
          >
            <Sparkles size={18} className="group-hover:animate-spin" /> Ask AI
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar model={model} setModel={setModel} />
        <StructureCanvas model={model} />
      </main>

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        model={model}
      />
    </div>
  );
};

export default App;