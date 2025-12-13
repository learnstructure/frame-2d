import React, { useState } from 'react';
import { Play, FileText, Sparkles, Loader2, MessageSquare, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StructureCanvas from './components/StructureCanvas';
import ChatModal from './components/ChatModal';
import { StructureModel, AnalysisResults } from './frame/types';
import { analyzeStructure } from './frame/solver';
import { generateReport } from './services/reportGenerator';
import { incrementAnalysisCount } from './services/firebase';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Validation for enabling analysis
  const canAnalyze = model.members.length > 0 && model.supports.length > 0;

  const handleAnalyze = () => {
    if (!canAnalyze) return;

    // Run the local solver
    const results = analyzeStructure(model);
    setAnalysisResults(results);

    // Optional: Alert if unstable, or let the canvas visualizer handle it
    if (!results.isStable) {
      alert(`Analysis Failed: ${results.message}`);
    } else {
      // Track successful analysis in Firestore
      incrementAnalysisCount();
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
        // @ts-ignore - backgroundColor is valid in runtime but types might conflict
        const canvas = await html2canvas(element, { backgroundColor: '#0f172a' } as any);
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
      <header className="h-16 border-b border-slate-700 bg-[#0f172a] px-4 md:px-6 flex items-center justify-between z-20 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-slate-300 hover:text-white"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          {/* Logo Image */}
          <div className="p-1 rounded-lg shadow-lg shadow-blue-900/20 bg-white/5 border border-white/10 hidden sm:block">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="StructureRealm Logo"
                className="w-8 h-8 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-600 to-emerald-600 rounded text-[10px] font-bold text-white shadow-inner">
                SR
              </div>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold truncate">
            <span className="text-blue-400">Structure</span><span className="text-emerald-400">Realm</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            title={!canAnalyze ? "Add at least one member and one support to analyze" : "Run Structural Analysis"}
            className={`px-3 py-2 md:px-4 rounded font-semibold flex items-center gap-2 transition-all ${canAnalyze
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-900/50 active:translate-y-0.5"
                : "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50 shadow-none"
              }`}
          >
            <Play size={18} fill={canAnalyze ? "currentColor" : "none"} />
            <span className="hidden sm:inline">Analyze</span>
          </button>
          <button
            onClick={handleReport}
            disabled={isGeneratingReport || !analysisResults}
            className="px-3 py-2 md:px-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded font-medium flex items-center gap-2 transition-all"
            title="Generate Report"
          >
            {isGeneratingReport ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            <span className="hidden sm:inline">Report</span>
          </button>
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-3 py-2 md:px-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-900/50 group"
            title="Ask AI"
          >
            <Sparkles size={18} className="group-hover:animate-spin" />
            <span className="hidden md:inline">Ask AI</span>
          </button>
          <a
            href="mailto:abinashmandal33486@gmail.com?subject=StructureRealm Feedback"
            className="flex px-3 py-2 md:px-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:text-white text-slate-300 rounded font-medium items-center gap-2 transition-all shadow-sm"
            title="Send Feedback via Email"
          >
            <MessageSquare size={18} /> <span className="hidden lg:inline">Feedback</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Container - Responsive Drawer */}
        <div className={`
           absolute inset-y-0 left-0 z-30 w-80 bg-[#111827] transform transition-transform duration-300 shadow-2xl
           md:relative md:translate-x-0 md:shadow-none md:border-r md:border-slate-700
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar
            model={model}
            setModel={handleModelChange}
            onCloseMobile={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Canvas takes remaining space */}
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