import React, { useState } from 'react';
import { Play, FileText, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StructureCanvas from './components/StructureCanvas';
import ChatModal from './components/ChatModal';
import { StructureModel, AnalysisResults } from './frame/types';
import { analyzeStructure } from './frame/solver';
import { generateReport } from './services/reportGenerator';
import html2canvas from 'html2canvas';

const App = () => {
  const [model, setModel] = useState<StructureModel>({
    nodes: [],
    members: [],
    supports: [],
    loads: []
  });

  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleAnalyze = () => {
    // Run the local solver
    const results = analyzeStructure(model);
    setAnalysisResults(results);

    // Optional: Alert if unstable, or let the canvas visualizer handle it
    if (!results.isStable) {
      alert(`Analysis Failed: ${results.message}`);
    }
  };

  const handleReport = async () => {
    if (!analysisResults) {
      alert("Please analyze the structure before generating a report.");
      return;
    }

    setIsGeneratingReport(true);
    try {
      // Capture canvas image
      const element = document.getElementById('structure-canvas-container');
      let imageUri = undefined;

      if (element) {
        const canvas = await html2canvas(element, { backgroundColor: '#0f172a' }); // Use dark bg
        imageUri = canvas.toDataURL('image/png');
      }

      generateReport(model, analysisResults, imageUri);
    } catch (error) {
      console.error("Report generation failed:", error);
      alert("Failed to generate report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleModelChange: React.Dispatch<React.SetStateAction<StructureModel>> = (arg) => {
    // Clear results if model changes
    setAnalysisResults(null);
    setModel(arg);
  };

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
            onClick={handleAnalyze}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-900/50 active:translate-y-0.5"
          >
            <Play size={18} fill="currentColor" /> Analyze
          </button>
          <button
            onClick={handleReport}
            disabled={isGeneratingReport || !analysisResults}
            className="px-4 py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded font-medium flex items-center gap-2 transition-all"
          >
            {isGeneratingReport ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} Report
          </button>
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-900/50 group"
          >
            <Sparkles size={18} className="group-hover:animate-spin" /> Ask AI
          </button>
          <a
            href="mailto:abinashmandal33486@gmail.com?subject=StructureRealm Feedback"
            className="px-4 py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:text-white text-slate-300 rounded font-medium flex items-center gap-2 transition-all shadow-sm"
            title="Send Feedback via Email"
          >
            <MessageSquare size={18} /> <span className="hidden sm:inline">Feedback</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <Sidebar model={model} setModel={handleModelChange} />
        <StructureCanvas model={model} analysisResults={analysisResults} />
      </main>

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        model={model}
        initialResults={analysisResults}
      />
    </div>
  );
};

export default App;