import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { StructureModel, Node, Member, Support, Load, SupportType, LoadType } from '../frame/types';

interface SidebarProps {
  model: StructureModel;
  setModel: React.Dispatch<React.SetStateAction<StructureModel>>;
}

type Tab = 'nodes' | 'members' | 'supports' | 'loads';

const Sidebar: React.FC<SidebarProps> = ({ model, setModel }) => {
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // Temporary state for inputs
  const [tempNode, setTempNode] = useState({ x: 0, y: 0 });
  const [tempMember, setTempMember] = useState({ startNodeId: '', endNodeId: '', e: 200, a: 0.01, i: 0.0001 });
  const [tempSupport, setTempSupport] = useState({ nodeId: '', type: SupportType.PIN });
  const [tempLoad, setTempLoad] = useState({ nodeId: '', magX: 0, magY: -10 });

  const addNode = () => {
    const id = `n${model.nodes.length + 1}`;
    setModel(prev => ({
      ...prev,
      nodes: [...prev.nodes, { id, x: Number(tempNode.x), y: Number(tempNode.y) }]
    }));
  };

  const addMember = () => {
    if (!tempMember.startNodeId || !tempMember.endNodeId || tempMember.startNodeId === tempMember.endNodeId) return;
    const id = `m${model.members.length + 1}`;
    setModel(prev => ({
      ...prev,
      members: [...prev.members, {
        id,
        startNodeId: tempMember.startNodeId,
        endNodeId: tempMember.endNodeId,
        eModulus: Number(tempMember.e),
        area: Number(tempMember.a),
        momentInertia: Number(tempMember.i),
        type: 'rigid'
      }]
    }));
  };

  const addSupport = () => {
    if (!tempSupport.nodeId) return;
    // Remove existing support at this node if any
    const id = `s${Date.now()}`;
    setModel(prev => ({
      ...prev,
      supports: [
        ...prev.supports.filter(s => s.nodeId !== tempSupport.nodeId),
        { id, nodeId: tempSupport.nodeId, type: tempSupport.type }
      ]
    }));
  };

  const addLoad = () => {
    if (!tempLoad.nodeId) return;
    const id = `l${Date.now()}`;
    setModel(prev => ({
      ...prev,
      loads: [...prev.loads, {
        id,
        type: LoadType.POINT,
        nodeId: tempLoad.nodeId,
        magnitudeX: Number(tempLoad.magX),
        magnitudeY: Number(tempLoad.magY)
      }]
    }));
  };

  const clearModel = () => {
    if(confirm("Are you sure you want to clear the entire model?")) {
      setModel({ nodes: [], members: [], supports: [], loads: [] });
    }
  };

  const renderTabButton = (tab: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === tab
          ? 'border-cyan-500 text-cyan-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-80 bg-[#111827] border-r border-slate-700 flex flex-col h-full shadow-xl z-10">
      {/* Tabs */}
      <div className="flex bg-[#1e293b]">
        {renderTabButton('nodes', 'Nodes')}
        {renderTabButton('members', 'Members')}
        {renderTabButton('supports', 'Supports')}
        {renderTabButton('loads', 'Loads')}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Nodes Tab */}
        {activeTab === 'nodes' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ New Node</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">X (m)</label>
                <input
                  type="number"
                  value={tempNode.x}
                  onChange={e => setTempNode({ ...tempNode, x: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Y (m)</label>
                <input
                  type="number"
                  value={tempNode.y}
                  onChange={e => setTempNode({ ...tempNode, y: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
                />
              </div>
            </div>
            <button
              onClick={addNode}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Add Node
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Defined Nodes ({model.nodes.length})</h4>
              <ul className="space-y-2">
                {model.nodes.map(node => (
                  <li key={node.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <span className="text-sm font-mono text-cyan-300">{node.id}</span>
                    <span className="text-xs text-slate-400">({node.x}, {node.y})</span>
                    <button onClick={() => setModel(p => ({ ...p, nodes: p.nodes.filter(n => n.id !== node.id) }))} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
             <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ New Member</h3>
             
             <div className="space-y-1">
                <label className="text-xs text-slate-400">Type</label>
                <select className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none">
                  <option>Beam (Rigid)</option>
                  <option>Truss (Pin-Jointed)</option>
                </select>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Start Node</label>
                  <select 
                    value={tempMember.startNodeId}
                    onChange={(e) => setTempMember({...tempMember, startNodeId: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                  >
                    <option value="">Select...</option>
                    {model.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">End Node</label>
                  <select 
                     value={tempMember.endNodeId}
                     onChange={(e) => setTempMember({...tempMember, endNodeId: e.target.value})}
                     className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                  >
                    <option value="">Select...</option>
                    {model.nodes.filter(n => n.id !== tempMember.startNodeId).map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                  </select>
                </div>
             </div>

             <div className="pt-2 border-t border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1">
                   Properties
                </p>
                <div className="grid grid-cols-2 gap-4 mb-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">E (GPa)</label>
                      <input 
                        type="number" 
                        value={tempMember.e}
                        onChange={(e) => setTempMember({...tempMember, e: parseFloat(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">A (m²)</label>
                      <input 
                        type="number" 
                        value={tempMember.a}
                        onChange={(e) => setTempMember({...tempMember, a: parseFloat(e.target.value)})}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500" 
                      />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-400">I (m⁴)</label>
                    <input 
                      type="number" 
                      value={tempMember.i}
                      onChange={(e) => setTempMember({...tempMember, i: parseFloat(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500" 
                    />
                </div>
             </div>

             <button
              onClick={addMember}
              disabled={!tempMember.startNodeId || !tempMember.endNodeId}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Connect
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Defined Members ({model.members.length})</h4>
              <ul className="space-y-2">
                {model.members.map(mem => (
                  <li key={mem.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <span className="text-sm font-mono text-cyan-300">{mem.id}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      {mem.startNodeId} <ArrowRight size={10} /> {mem.endNodeId}
                    </span>
                    <button onClick={() => setModel(p => ({ ...p, members: p.members.filter(m => m.id !== mem.id) }))} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Supports Tab */}
        {activeTab === 'supports' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
             <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ New Support</h3>
             
             <div className="space-y-1">
                <label className="text-xs text-slate-400">Node</label>
                <select 
                  value={tempSupport.nodeId}
                  onChange={(e) => setTempSupport({...tempSupport, nodeId: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="">Select...</option>
                  {model.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                </select>
             </div>

             <div className="space-y-1">
                <label className="text-xs text-slate-400">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[SupportType.PIN, SupportType.ROLLER, SupportType.FIXED].map((type) => (
                     <button
                        key={type}
                        onClick={() => setTempSupport({...tempSupport, type})}
                        className={`p-2 rounded text-xs uppercase font-bold border transition-all ${tempSupport.type === type ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                       {type}
                     </button>
                  ))}
                </div>
             </div>

             <button
              onClick={addSupport}
              disabled={!tempSupport.nodeId}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Add Support
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Defined Supports ({model.supports.length})</h4>
              <ul className="space-y-2">
                {model.supports.map(sup => (
                  <li key={sup.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <span className="text-sm font-mono text-cyan-300">{sup.nodeId}</span>
                    <span className="text-xs text-slate-400 uppercase">{sup.type}</span>
                    <button onClick={() => setModel(p => ({ ...p, supports: p.supports.filter(s => s.id !== sup.id) }))} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Loads Tab */}
        {activeTab === 'loads' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
             <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ Nodal Load</h3>
             
             <div className="space-y-1">
                <label className="text-xs text-slate-400">Node</label>
                <select 
                  value={tempLoad.nodeId}
                  onChange={(e) => setTempLoad({...tempLoad, nodeId: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="">Select...</option>
                  {model.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                </select>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-xs text-slate-400">Fx (kN)</label>
                  <input 
                    type="number"
                    value={tempLoad.magX}
                    onChange={(e) => setTempLoad({...tempLoad, magX: parseFloat(e.target.value)})}
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-xs text-slate-400">Fy (kN)</label>
                  <input 
                    type="number"
                    value={tempLoad.magY}
                    onChange={(e) => setTempLoad({...tempLoad, magY: parseFloat(e.target.value)})}
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                  />
               </div>
             </div>

             <button
              onClick={addLoad}
              disabled={!tempLoad.nodeId}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Add Load
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Defined Loads ({model.loads.length})</h4>
              <ul className="space-y-2">
                {model.loads.map(load => (
                  <li key={load.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <span className="text-sm font-mono text-cyan-300">{load.nodeId}</span>
                    <span className="text-xs text-slate-400">({load.magnitudeX}, {load.magnitudeY}) kN</span>
                    <button onClick={() => setModel(p => ({ ...p, loads: p.loads.filter(l => l.id !== load.id) }))} className="text-slate-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700">
        <button onClick={clearModel} className="w-full py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded border border-red-900/50 flex items-center justify-center gap-2 text-sm transition-all">
          <Trash2 size={14} /> Clear Model
        </button>
      </div>
    </div>
  );
};

export default Sidebar;