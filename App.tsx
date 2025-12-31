
import React, { useState } from 'react';
import { Play, FileText, Sparkles, Loader2, Info, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import StructureCanvas from './components/StructureCanvas';
import ChatModal from './components/ChatModal';
import DeveloperModal from './components/DeveloperModal';
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
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const canAnalyze = model.members.length > 0 && model.supports.length > 0;

  const handleAnalyze = () => {
    if (!canAnalyze) return;

    const results = analyzeStructure(model);
    setAnalysisResults(results);

    if (!results.isStable) {
      alert(`Analysis Failed: ${results.message}`);
    } else {
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
      const element = document.getElementById('structure-canvas-container');
      let imageUri = undefined;

      if (element) {
        // @ts-ignore
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
    setAnalysisResults(null);
    if (typeof arg === 'function') {
      setModel(prev => arg(prev));
    } else {
      setModel(arg);
    }
  };

  const handleUpdateModelFromAI = (newModel: StructureModel) => {
    setAnalysisResults(null);
    setModel(newModel);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f172a] text-slate-100 font-sans overflow-hidden">
      <header className="h-16 border-b border-slate-700 bg-[#0f172a] px-4 md:px-6 flex items-center justify-between z-20 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden text-slate-300 hover:text-white p-2"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Editor"
          >
            <Menu size={24} />
          </button>

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
          <h1 className="text-lg md:text-2xl font-bold truncate cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsDevModalOpen(true)}>
            <span className="text-blue-400">Structure</span><span className="text-emerald-400">Realm</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            title={!canAnalyze ? "Add at least one member and one support" : "Run Structural Analysis"}
            className={`px-3 py-1.5 md:py-2 md:px-4 rounded font-semibold flex items-center gap-2 transition-all text-xs md:text-base ${canAnalyze
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:translate-y-0.5"
                : "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
              }`}
          >
            <Play size={16} className="md:w-[18px] md:h-[18px]" fill={canAnalyze ? "currentColor" : "none"} />
            <span className="hidden sm:inline">Analyze</span>
          </button>
          <button
            onClick={handleReport}
            disabled={isGeneratingReport || !analysisResults}
            className="px-3 py-1.5 md:py-2 md:px-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded font-medium flex items-center gap-2 transition-all text-xs md:text-base"
          >
            {isGeneratingReport ? <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" /> : <FileText size={16} className="md:w-[18px] md:h-[18px]" />}
            <span className="hidden sm:inline">Report</span>
          </button>
          <button
            onClick={() => setIsChatOpen(true)}
            className="px-3 py-1.5 md:py-2 md:px-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-semibold flex items-center gap-2 transition-all shadow-lg group text-xs md:text-base"
          >
            <Sparkles size={16} className="md:w-[18px] md:h-[18px] group-hover:animate-spin" />
            <span className="hidden md:inline">Ask AI</span>
          </button>
          <button
            onClick={() => setIsDevModalOpen(true)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white rounded font-medium transition-all flex items-center justify-center gap-2 text-xs md:text-base"
            title="Developer Details"
          >
            <Info size={18} />
            <span className="hidden md:inline">Info</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row relative min-h-0 overflow-hidden">
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div className={`
           fixed inset-y-0 left-0 z-40 w-80 bg-[#111827] transform transition-transform duration-300 ease-in-out shadow-2xl
           lg:relative lg:translate-x-0 lg:shadow-none lg:border-r lg:border-slate-700 lg:z-10
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar
            model={model}
            setModel={handleModelChange}
            onCloseMobile={() => setIsSidebarOpen(false)}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          <StructureCanvas model={model} analysisResults={analysisResults} />
        </div>
      </main>

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        model={model}
        setModel={handleUpdateModelFromAI}
        initialResults={analysisResults}
      />
      <DeveloperModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
      />
    </div>
  );
};

export default App;
