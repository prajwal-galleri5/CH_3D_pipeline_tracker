"use client";

import { useEffect, useState, Fragment } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, AssetType } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, Search, Plus, ExternalLink, CheckCircle, 
  XCircle, Filter, Trash2, ArrowLeft, Loader2,
  Box, User, Shield, Car, ChevronRight, Flame, Trophy
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function Inventory() {
  const { isAdmin } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AssetType | 'All'>('All');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // New Asset Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AssetType>("Character");
  const [newLink, setNewLink] = useState("");
  const [variationParent, setVariationParent] = useState<Asset | null>(null);

  const fetchAssets = async () => {
    try {
      const q = query(collection(db, "assets"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const fetched: Asset[] = [];
      snap.forEach(d => fetched.push({ ...d.data(), id: d.id } as Asset));
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
      const newAsset: any = {
        name: newName.trim(),
        type: variationParent ? variationParent.type : newType,
        masterDriveLink: newLink.trim(),
        isReady: false,
        status: "Not Started",
        assignedArtists: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (variationParent) {
        newAsset.parentId = variationParent.id;
      }
      
      await addDoc(collection(db, "assets"), newAsset);
      setNewName("");
      setNewLink("");
      setVariationParent(null);
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

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mainAssets = assets.filter(a => !a.parentId);

  const filteredMainAssets = mainAssets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || a.type === filter;

    // Also include if any of its variations match
    const hasMatchingVariation = assets.some(v => 
      v.parentId === a.id && 
      v.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'All' || v.type === filter)
    );

    return matchesSearch && matchesFilter || hasMatchingVariation;
  });

  const getTypeIcon = (type: AssetType) => {
    switch(type) {
      case 'Character': return <User className="w-4 h-4 text-saffron" />;
      case 'Prop': return <Box className="w-4 h-4 text-gold" />;
      case 'Weapon': return <Shield className="w-4 h-4 text-vermillion" />;
      case 'Vehicle': return <Car className="w-4 h-4 text-emerald-400" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const renderAssetRow = (asset: Asset, isVariation = false) => {
    const variations = assets.filter(v => v.parentId === asset.id);
    const hasVariations = variations.length > 0;
    const isExpanded = expandedRows.has(asset.id);

    return (
      <Fragment key={asset.id}>
        <tr 
          className={`group transition-all hover:bg-white/[0.03] ${asset.isReady ? 'bg-emerald-500/[0.02]' : ''} ${isVariation ? 'bg-indigo-500/[0.03]' : ''}`}
        >
          <td className="px-8 py-5">
            <div className="flex items-center gap-3">
              {!isVariation && hasVariations && (
                <button 
                  onClick={() => toggleExpand(asset.id)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              {isVariation && <div className="w-4 h-4 border-l-2 border-b-2 border-indigo-500/30 rounded-bl-lg ml-2 mb-2" />}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${asset.isReady ? (isVariation ? 'bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]') : 'bg-white/5 text-slate-500'}`}>
                {getTypeIcon(asset.type)}
              </div>
            </div>
          </td>
          <td className="px-6 py-5">
            <div className="flex flex-col">
              <span className={`text-sm font-black uppercase tracking-tight group-hover:text-gold transition-colors font-serif ${isVariation ? 'text-indigo-400' : 'text-white'}`}>
                {asset.name}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[8px] font-bold uppercase tracking-widest ${isVariation ? 'text-indigo-500/60' : 'text-slate-600'}`}>
                  {isVariation ? 'Echo' : 'Main Legend'} • {asset.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </td>
          <td className="px-6 py-5">
            <span className="text-[9px] font-black text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 uppercase tracking-widest inline-block">{asset.type}</span>
          </td>
          <td className="px-6 py-5">
            <div className="flex items-center gap-3">
              <input 
                type="url"
                disabled={!isAdmin}
                placeholder={isAdmin ? "ENTHRINE LINK..." : "NO LINK"}
                defaultValue={asset.masterDriveLink}
                onBlur={(e) => updateDriveLink(asset, e.target.value)}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-bold text-slate-400 focus:text-gold focus:border-gold/30 outline-none transition uppercase tracking-widest placeholder:text-slate-800 disabled:opacity-50"
              />
              {asset.masterDriveLink && (
                <a href={asset.masterDriveLink} target="_blank" className="p-2.5 rounded-xl hover:bg-gold/10 text-slate-500 hover:text-gold transition-all shrink-0 border border-transparent hover:border-gold/20">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </td>
          <td className="px-6 py-5 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <button 
                disabled={!isAdmin}
                onClick={() => toggleReady(asset)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${asset.isReady ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500' : 'bg-white/5 text-slate-600 hover:bg-white/10'} disabled:opacity-50 disabled:hover:bg-white/5`}
              >
                {asset.isReady ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </button>
              <span className={`text-[7px] font-black uppercase tracking-[0.25em] ${asset.isReady ? 'text-emerald-500' : 'text-slate-600'}`}>{asset.isReady ? 'CONSECRATED' : 'WAITING'}</span>
            </div>
          </td>
          <td className="px-8 py-5 text-right">
            <div className="flex items-center justify-end gap-3">
              {isAdmin && !isVariation && (
                <button 
                  onClick={() => {
                    setVariationParent(asset);
                    setIsAddModalOpen(true);
                  }}
                  title="Splice Variation"
                  className="p-2.5 rounded-xl text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-orange-500/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => handleDelete(asset.id, asset.name)}
                  className="p-2.5 rounded-xl text-slate-800 hover:text-vermillion hover:bg-vermillion/10 transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-vermillion/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </td>
        </tr>
        {isExpanded && variations.map(v => renderAssetRow(v, true))}
      </Fragment>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-40">
      <div className="mb-12">
        <Link href="/" className="inline-flex items-center text-[10px] font-black text-slate-500 hover:text-saffron uppercase tracking-[0.2em] transition-colors mb-8">
          <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-gradient-to-r from-saffron to-vermillion rounded-full"></div>
              <span className="text-saffron font-black uppercase tracking-[0.3em] text-[10px]">Ancient Archive</span>
            </div>
            <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none font-serif">
              Master <span className="text-divine">Vault</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Consecrate legends and prepare them for the divine pipeline</p>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setVariationParent(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-3 px-8 py-4 bg-orange-600 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-[0_10px_25px_rgba(227,66,52,0.3)] hover:bg-orange-500 transition-all font-serif"
            >
              <Trophy className="w-4 h-4" />
              <span>Enshrine Asset</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
          <input 
            type="text" 
            placeholder="SEARCH THE VAULT..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-[20px] py-5 pl-14 pr-6 text-white font-black text-xs uppercase tracking-widest focus:border-gold/50 outline-none transition shadow-xl"
          />
        </div>
        <div className="relative group">
          <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full bg-white/5 border border-white/10 rounded-[20px] py-5 pl-14 pr-6 text-white font-black text-xs uppercase tracking-widest focus:border-gold/50 outline-none transition appearance-none cursor-pointer shadow-xl"
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
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="w-16 h-16 border-4 border-saffron/20 border-t-saffron rounded-full animate-spin"></div>
          <span className="text-saffron font-black tracking-[0.4em] text-xs uppercase animate-pulse">Unlocking the Seals...</span>
        </div>
      ) : filteredMainAssets.length === 0 ? (
        <div className="text-center py-40 epic-glass rounded-[40px] border border-dashed border-white/10">
          <Package className="w-20 h-20 text-slate-900 mx-auto mb-6" />
          <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-xs">The vault is currently empty</p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="epic-glass rounded-[48px] border border-white/5 overflow-hidden shadow-2xl ornate-border"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">
                  <th className="px-8 py-8 w-[120px]">Avatar</th>
                  <th className="px-6 py-8">Legend Identity</th>
                  <th className="px-6 py-8">Category</th>
                  <th className="px-6 py-8 min-w-[300px]">Aether Link</th>
                  <th className="px-6 py-8 text-center w-[120px]">State</th>
                  <th className="px-8 py-8 text-right w-[150px]">Decrees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMainAssets.map((asset) => renderAssetRow(asset))}
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
              className="epic-glass rounded-[40px] border border-white/10 shadow-2xl w-full max-w-lg p-10 relative overflow-hidden ornate-border"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-900/30">
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight font-serif">
                      {variationParent ? 'Splice Echo' : 'New Legend'}
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">
                      {variationParent ? `Echo of ${variationParent.name}` : 'Enshrine in vault library'}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setIsAddModalOpen(false); setVariationParent(null); }} className="p-2 text-slate-500 hover:text-white transition">
                  <XCircle className="w-7 h-7" />
                </button>
              </div>

              <form onSubmit={handleAddAsset} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Legend Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-black focus:border-gold/50 outline-none transition uppercase tracking-widest placeholder:text-slate-800 shadow-inner" 
                    placeholder={variationParent ? `E.G. ${variationParent.name}_V1` : "E.G. HANUMAN_PROPS_01"} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Avatar Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Character', 'Prop', 'Weapon', 'Vehicle'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        disabled={!!variationParent}
                        onClick={() => setNewType(t as any)}
                        className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          (variationParent ? variationParent.type === t : newType === t)
                            ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(255,153,51,0.15)]' 
                            : 'bg-white/[0.03] border-white/5 text-slate-600 hover:border-white/20'
                        } ${variationParent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Aether Link (Optional)</label>
                  <input 
                    type="url" 
                    value={newLink} 
                    onChange={(e) => setNewLink(e.target.value)} 
                    className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-black focus:border-gold/50 outline-none transition placeholder:text-slate-800 shadow-inner" 
                    placeholder="https://drive.link/..." 
                  />
                </div>

                <div className="flex gap-4 pt-8 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setVariationParent(null); }}
                    className="flex-1 py-5 bg-white/5 text-slate-500 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all border border-white/5 font-serif"
                  >
                    Retreat
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-5 bg-orange-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl shadow-orange-900/30 hover:bg-orange-500 transition-all active:scale-[0.98] font-serif"
                  >
                    {variationParent ? 'Enshrine Echo' : 'Seal into Vault'}
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
