import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { StructureModel, SupportType, LoadType, MemberType } from '../frame/types';

interface SidebarProps {
  model: StructureModel;
  setModel: React.Dispatch<React.SetStateAction<StructureModel>>;
}

type Tab = 'nodes' | 'members' | 'supports' | 'loads';

const Sidebar: React.FC<SidebarProps> = ({ model, setModel }) => {
  const [activeTab, setActiveTab] = useState<Tab>('nodes');
  const [error, setError] = useState<string | null>(null);

  // Temporary state
  const [tempNode, setTempNode] = useState({ x: 0, y: 0 });
  const [tempMember, setTempMember] = useState({
    startNodeId: '',
    endNodeId: '',
    e: 200,
    a: 10,
    i: 50,
    k: 100,
    type: 'rigid' as MemberType
  });
  const [tempSupport, setTempSupport] = useState({ nodeId: '', type: SupportType.PIN });

  // Load state
  const [loadCategory, setLoadCategory] = useState<'node' | 'member'>('node');
  const [tempLoad, setTempLoad] = useState({
    targetId: '', // nodeId or memberId
    type: 'point', // 'point' | 'distributed' (for member)
    magX: 0,
    magY: -10,
    moment: 0,
    location: 0 // for member point load
  });

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  };

  const addNode = () => {
    // Validation: Check for duplicates
    const exists = model.nodes.some(n =>
      Math.abs(n.x - tempNode.x) < 0.001 && Math.abs(n.y - tempNode.y) < 0.001
    );

    if (exists) {
      showError("A node already exists at these coordinates.");
      return;
    }

    const id = `n${model.nodes.length + 1}`;
    setModel(prev => ({
      ...prev,
      nodes: [...prev.nodes, { id, x: Number(tempNode.x), y: Number(tempNode.y) }]
    }));
  };

  const addMember = () => {
    if (!tempMember.startNodeId || !tempMember.endNodeId) return;
    if (tempMember.startNodeId === tempMember.endNodeId) {
      showError("Start and end nodes must be different.");
      return;
    }

    // Validation: Check if member exists between these nodes
    const exists = model.members.some(m =>
      (m.startNodeId === tempMember.startNodeId && m.endNodeId === tempMember.endNodeId) ||
      (m.startNodeId === tempMember.endNodeId && m.endNodeId === tempMember.startNodeId)
    );

    if (exists) {
      showError("A member already connects these two nodes.");
      return;
    }

    const id = `m${model.members.length + 1}`;

    // Construct member based on type
    const newMember: any = {
      id,
      startNodeId: tempMember.startNodeId,
      endNodeId: tempMember.endNodeId,
      type: tempMember.type
    };

    if (tempMember.type === 'spring') {
      newMember.springConstant = Number(tempMember.k);
    } else if (tempMember.type === 'truss') {
      newMember.eModulus = Number(tempMember.e);
      newMember.area = Number(tempMember.a);
    } else {
      // Rigid
      newMember.eModulus = Number(tempMember.e);
      newMember.area = Number(tempMember.a);
      newMember.momentInertia = Number(tempMember.i);
    }

    setModel(prev => ({
      ...prev,
      members: [...prev.members, newMember]
    }));
  };

  const addSupport = () => {
    if (!tempSupport.nodeId) return;
    // Validation handled by logic (replaces existing support at node)
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
    if (!tempLoad.targetId) return;
    const id = `l${Date.now()}`;

    let type: LoadType = LoadType.NODAL_POINT;

    if (loadCategory === 'member') {
      type = tempLoad.type === 'distributed' ? LoadType.MEMBER_DISTRIBUTED : LoadType.MEMBER_POINT;
    }

    setModel(prev => ({
      ...prev,
      loads: [...prev.loads, {
        id,
        type,
        nodeId: loadCategory === 'node' ? tempLoad.targetId : undefined,
        memberId: loadCategory === 'member' ? tempLoad.targetId : undefined,
        magnitudeX: Number(tempLoad.magX),
        magnitudeY: Number(tempLoad.magY),
        moment: Number(tempLoad.moment),
        location: loadCategory === 'member' && tempLoad.type === 'point' ? Number(tempLoad.location) : undefined
      }]
    }));
  };

  const clearModel = () => {
    if (confirm("Are you sure you want to clear the entire model?")) {
      setModel({ nodes: [], members: [], supports: [], loads: [] });
    }
  };

  const renderTabButton = (tab: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === tab
          ? 'border-cyan-500 text-cyan-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
    >
      {label}
    </button>
  );

  const getMemberTypeLabel = (type: string) => {
    switch (type) {
      case 'rigid': return 'Beam';
      case 'truss': return 'Truss';
      case 'spring': return 'Spring';
      default: return type;
    }
  };

  return (
    <div className="w-80 bg-[#111827] border-r border-slate-700 flex flex-col h-full shadow-xl z-10">
      {/* Tabs */}
      <div className="flex bg-[#1e293b]">
        {renderTabButton('nodes', 'Nodes')}
        {renderTabButton('members', 'Members')}
        {renderTabButton('supports', 'Support')}
        {renderTabButton('loads', 'Loads')}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
        {error && (
          <div className="absolute top-2 left-2 right-2 bg-red-900/90 border border-red-500 text-white p-2 rounded text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 z-50">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Nodes Tab */}
        {activeTab === 'nodes' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ New Node</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">X</label>
                <input
                  type="number"
                  value={tempNode.x}
                  onChange={e => setTempNode({ ...tempNode, x: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Y</label>
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
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Nodes ({model.nodes.length})</h4>
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
              <select
                value={tempMember.type}
                onChange={(e) => setTempMember({ ...tempMember, type: e.target.value as MemberType })}
                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
              >
                <option value="rigid">Beam</option>
                <option value="truss">Truss</option>
                <option value="spring">Spring</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Start</label>
                <select
                  value={tempMember.startNodeId}
                  onChange={(e) => setTempMember({ ...tempMember, startNodeId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="">...</option>
                  {model.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">End</label>
                <select
                  value={tempMember.endNodeId}
                  onChange={(e) => setTempMember({ ...tempMember, endNodeId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <option value="">...</option>
                  {model.nodes.filter(n => n.id !== tempMember.startNodeId).map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Properties</p>

              {tempMember.type === 'spring' ? (
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">k (Spring Constant)</label>
                  <input
                    type="number"
                    value={tempMember.k}
                    onChange={(e) => setTempMember({ ...tempMember, k: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">E (Modulus)</label>
                    <input
                      type="number"
                      value={tempMember.e}
                      onChange={(e) => setTempMember({ ...tempMember, e: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">A (Area)</label>
                    <input
                      type="number"
                      value={tempMember.a}
                      onChange={(e) => setTempMember({ ...tempMember, a: parseFloat(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500"
                    />
                  </div>
                  {tempMember.type === 'rigid' && (
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-slate-400">I (Inertia)</label>
                      <input
                        type="number"
                        value={tempMember.i}
                        onChange={(e) => setTempMember({ ...tempMember, i: parseFloat(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={addMember}
              disabled={!tempMember.startNodeId || !tempMember.endNodeId}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Connect
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Members ({model.members.length})</h4>
              <ul className="space-y-2">
                {model.members.map(mem => (
                  <li key={mem.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <div className="flex flex-col">
                      <span className="text-sm font-mono text-cyan-300">{mem.id} <span className="text-xs text-slate-500">({getMemberTypeLabel(mem.type)})</span></span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        {mem.startNodeId} <ArrowRight size={10} /> {mem.endNodeId}
                      </span>
                    </div>
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
                onChange={(e) => setTempSupport({ ...tempSupport, nodeId: e.target.value })}
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
                    onClick={() => setTempSupport({ ...tempSupport, type })}
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
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Supports ({model.supports.length})</h4>
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
            <h3 className="text-cyan-400 font-semibold text-sm uppercase tracking-wider">+ New Load</h3>

            {/* Load Category Toggle */}
            <div className="flex bg-slate-800 rounded p-1 mb-4">
              <button
                className={`flex-1 text-xs py-1 rounded ${loadCategory === 'node' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setLoadCategory('node')}
              >
                Node Load
              </button>
              <button
                className={`flex-1 text-xs py-1 rounded ${loadCategory === 'member' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                onClick={() => setLoadCategory('member')}
              >
                Member Load
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Target {loadCategory === 'node' ? 'Node' : 'Member'}</label>
              <select
                value={tempLoad.targetId}
                onChange={(e) => setTempLoad({ ...tempLoad, targetId: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
              >
                <option value="">Select...</option>
                {loadCategory === 'node'
                  ? model.nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)
                  : model.members.map(m => <option key={m.id} value={m.id}>{m.id}</option>)
                }
              </select>
            </div>

            {loadCategory === 'member' && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Load Distribution</label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-1 text-xs border rounded ${tempLoad.type === 'point' ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'border-slate-600 text-slate-400'}`}
                    onClick={() => setTempLoad({ ...tempLoad, type: 'point' })}
                  >
                    Point
                  </button>
                  <button
                    className={`flex-1 py-1 text-xs border rounded ${tempLoad.type === 'distributed' ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'border-slate-600 text-slate-400'}`}
                    onClick={() => setTempLoad({ ...tempLoad, type: 'distributed' })}
                  >
                    Distributed
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fx</label>
                <input
                  type="number"
                  value={tempLoad.magX}
                  onChange={(e) => setTempLoad({ ...tempLoad, magX: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fy</label>
                <input
                  type="number"
                  value={tempLoad.magY}
                  onChange={(e) => setTempLoad({ ...tempLoad, magY: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">M</label>
                <input
                  type="number"
                  value={tempLoad.moment}
                  onChange={(e) => setTempLoad({ ...tempLoad, moment: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {loadCategory === 'member' && tempLoad.type === 'point' && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Distance from Start</label>
                <input
                  type="number"
                  value={tempLoad.location}
                  onChange={(e) => setTempLoad({ ...tempLoad, location: parseFloat(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            )}

            <button
              onClick={addLoad}
              disabled={!tempLoad.targetId}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} /> Add Load
            </button>

            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">Loads ({model.loads.length})</h4>
              <ul className="space-y-2">
                {model.loads.map(load => (
                  <li key={load.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                    <span className="text-sm font-mono text-cyan-300">
                      {load.nodeId || load.memberId}
                      {load.type === LoadType.MEMBER_DISTRIBUTED && ' (UDL)'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {Math.abs(load.magnitudeX) > 0 && `Fx:${load.magnitudeX} `}
                      {Math.abs(load.magnitudeY) > 0 && `Fy:${load.magnitudeY} `}
                      {load.moment && load.moment !== 0 && `M:${load.moment}`}
                    </span>
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