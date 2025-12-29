
import React from 'react';
import { X, Linkedin, GraduationCap, MapPin, Github, Mail, Award } from 'lucide-react';

interface DeveloperModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DeveloperModal: React.FC<DeveloperModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header/Cover */}
                <div className="h-24 bg-gradient-to-r from-blue-600 to-emerald-600 relative flex items-center px-6">
                    <h2 className="text-xl font-bold text-white/90 uppercase tracking-wider">Developer Info</h2>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Profile Content */}
                <div className="px-6 pb-8 pt-6 relative">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Abinash Mandal</h2>
                        <p className="text-emerald-400 font-medium flex items-center gap-2 mt-1">
                            <GraduationCap size={16} /> PhD Student & Structural Researcher
                        </p>

                        <div className="mt-4 space-y-2 text-slate-300 text-sm leading-relaxed">
                            <p className="flex items-center gap-2">
                                <MapPin size={14} className="text-slate-500" /> University of Nevada, Reno (UNR)
                            </p>
                            <p>
                                Specializing in structural engineering with an aim to create safe, smart & economical structures.
                            </p>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <a
                                href="https://www.linkedin.com/in/abinash-mandal-90132b238/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-[#0077B5] hover:bg-[#00669c] text-white rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            >
                                <Linkedin size={14} /> LinkedIn
                            </a>
                            <a
                                href="https://github.com/learnstructure"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-700 hover:scale-105"
                            >
                                <Github size={14} /> GitHub
                            </a>
                            <a
                                href="mailto:abinashmandal33486@gmail.com"
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all hover:scale-105 shadow-lg shadow-emerald-900/20"
                            >
                                <Mail size={14} /> Feedback
                            </a>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Project Specs</h3>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div className="bg-slate-800/50 p-2 rounded flex items-center gap-2">
                                    <Award size={12} className="text-blue-400" />
                                    <span className="text-slate-400">Solver: Matrix Stiffness</span>
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded flex items-center gap-2">
                                    <Award size={12} className="text-emerald-400" />
                                    <span className="text-slate-400">AI: Gemini & Llama 3</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-950/50 p-4 text-center border-t border-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                        StructureRealm | Frame Calculator v1.0 | Built with React & TypeScript
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DeveloperModal;
