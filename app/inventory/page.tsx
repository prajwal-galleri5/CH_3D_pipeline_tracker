"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, AssetType } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, Search, Plus, ExternalLink, CheckCircle, 
  XCircle, Filter, Trash2, ArrowLeft, Loader2,
  Box, User, Shield, Car
} from "lucide-react";
import Link from "next/link";

export default function Inventory() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AssetType | 'All'>('All');
  
  // New Asset Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AssetType>("Character");
  const [newLink, setNewLink] = useState("");

  const fetchAssets = async () => {
    try {
      const q = query(collection(db, "assets"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const fetched: Asset[] = [];
      snap.forEach(d => fetched.push({ id: d.id, ...d.data() } as Asset));
      setAssets(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    
    try {
      const newAsset = {
        name: newName.trim(),
        type: newType,
        masterDriveLink: newLink.trim(),
        isReady: false,
        status: "Not Started",
        assignedArtists: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await addDoc(collection(db, "assets"), newAsset);
      setNewName("");
      setNewLink("");
      setIsAddModalOpen(false);
      fetchAssets();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleReady = async (asset: Asset) => {
    try {
      const newStatus = !asset.isReady;
      await updateDoc(doc(db, "assets", asset.id), { 
        isReady: newStatus,
        updatedAt: Date.now() 
      });
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, isReady: newStatus } : a));
    } catch (err) {
      console.error(err);
    }
  };

  const updateDriveLink = async (asset: Asset, link: string) => {
    try {
      await updateDoc(doc(db, "assets", asset.id), { 
        masterDriveLink: link.trim(),
        updatedAt: Date.now() 
      });
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, masterDriveLink: link } : a));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" from master library?`)) return;
    try {
      await deleteDoc(doc(db, "assets", id));
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || a.type === filter;
    return matchesSearch && matchesFilter;
  });

  const getTypeIcon = (type: AssetType) => {
    switch(type) {
      case 'Character': return <User className="w-4 h-4" />;
      case 'Prop': return <Box className="w-4 h-4" />;
      case 'Weapon': return <Shield className="w-4 h-4" />;
      case 'Vehicle': return <Car className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12">
        <Link href="/" className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-orange-500 uppercase tracking-widest transition-colors mb-6">
          <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
              <span className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Asset Library</span>
            </div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tight">Master <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Inventory</span></h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Manage all assets and mark them ready for production</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-orange-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="SEARCH ASSET LIBRARY..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold text-xs uppercase tracking-widest focus:border-orange-500 outline-none transition"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold text-xs uppercase tracking-widest focus:border-orange-500 outline-none transition appearance-none cursor-pointer"
          >
            <option value="All" className="bg-slate-900">All Categories</option>
            <option value="Character" className="bg-slate-900">Characters</option>
            <option value="Prop" className="bg-slate-900">Props</option>
            <option value="Weapon" className="bg-slate-900">Weapons</option>
            <option value="Vehicle" className="bg-slate-900">Vehicles</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
          <span className="text-orange-500 font-bold tracking-widest text-[10px] uppercase">Accessing Vault...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-32 cinematic-glass rounded-[40px] border border-dashed border-white/10">
          <Package className="w-16 h-16 text-slate-800 mx-auto mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No assets found in library</p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cinematic-glass rounded-[32px] border border-white/5 overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  <th className="px-8 py-6 w-[80px]">Type</th>
                  <th className="px-6 py-6">Asset Name</th>
                  <th className="px-6 py-6">Category</th>
                  <th className="px-6 py-6 min-w-[300px]">Master Drive Link</th>
                  <th className="px-6 py-6 text-center w-[120px]">Status</th>
                  <th className="px-8 py-6 text-right w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAssets.map((asset) => (
                  <tr 
                    key={asset.id}
                    className={`group transition-all hover:bg-white/[0.02] ${asset.isReady ? 'bg-emerald-500/[0.01]' : ''}`}
                  >
                    <td className="px-8 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${asset.isReady ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-white/5 text-slate-500'}`}>
                        {getTypeIcon(asset.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white uppercase tracking-tight group-hover:text-orange-400 transition-colors">{asset.name}</span>
                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">ID: {asset.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[9px] font-black text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 uppercase tracking-widest inline-block">{asset.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="url"
                          placeholder="ADD DRIVE LINK..."
                          defaultValue={asset.masterDriveLink}
                          onBlur={(e) => updateDriveLink(asset, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-400 focus:text-blue-400 focus:border-blue-500/30 outline-none transition uppercase tracking-widest placeholder:text-slate-800"
                        />
                        {asset.masterDriveLink && (
                          <a href={asset.masterDriveLink} target="_blank" className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-all shrink-0">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          onClick={() => toggleReady(asset)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${asset.isReady ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-white/5 text-slate-600 hover:bg-white/10'}`}
                        >
                          {asset.isReady ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        </button>
                        <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${asset.isReady ? 'text-emerald-500' : 'text-slate-600'}`}>{asset.isReady ? 'READY' : 'WAITING'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(asset.id, asset.name)}
                        className="p-2.5 rounded-xl text-slate-800 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}


      {/* Add Master Asset Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="cinematic-glass rounded-[32px] border border-white/10 shadow-2xl w-full max-w-lg p-8 relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Register Master Asset</h2>
                    <p className="text-slate-500 text-[9px] font-bold tracking-[0.2em] uppercase">Add to vault library</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddAsset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold focus:border-orange-500 outline-none transition uppercase tracking-widest" 
                    placeholder="E.G. HANUMAN_PROPS_01" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Character', 'Prop', 'Weapon', 'Vehicle'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t as any)}
                        className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          newType === t 
                            ? 'bg-orange-600/20 border-orange-500 text-orange-400' 
                            : 'bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/20'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Drive link (Optional)</label>
                  <input 
                    type="url" 
                    value={newLink} 
                    onChange={(e) => setNewLink(e.target.value)} 
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold focus:border-orange-500 outline-none transition" 
                    placeholder="https://drive.google.com/..." 
                  />
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-white/5 text-slate-500 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-orange-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-orange-900/20 transition-all"
                  >
                    Add to Vault
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
