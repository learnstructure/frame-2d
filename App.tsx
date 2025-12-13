import React, { useState } from 'react';
import { Box, Play, FileText, Sparkles } from 'lucide-react';
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
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
            <Box className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            StructureRealm
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar model={model} setModel={setModel} />
        <StructureCanvas model={model} />

        {/* Floating AI Button (Visual cue if modal is closed) */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center gap-2 group z-10"
          >
            <Sparkles size={20} className="group-hover:animate-spin" />
            <span className="font-bold">Ask AI</span>
          </button>
        )}
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