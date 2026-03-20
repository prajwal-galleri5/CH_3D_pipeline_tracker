"use client";

import { useEffect, useState } from "react";
import { X, User, Building2, Zap, Box, Flame, Trophy, Shield } from "lucide-react";
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, AssetType, AssetStatus, StudioName, TeamMember } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { sendSlackNotification, notifyArtistsByName } from "@/lib/slack";

export function AddAssetModal({
  isOpen,
  onClose,
  onAssetAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAssetAdded: () => void;
}) {
  const [formData, setFormData] = useState({
    assetId: "", // Selected from library
    artistId: "",
    studio: "Xentrix" as StudioName,
    priority: "Secondary" as 'Primary' | 'Secondary',
  });
  
  const [library, setLibrary] = useState<Asset[]>([]);
  const [fullAssets, setFullAssets] = useState<Asset[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [teamSnap, allAssetsSnap] = await Promise.all([
        getDocs(query(collection(db, "team_members"), where("active", "==", true))),
        getDocs(collection(db, "assets"))
      ]);

      const members: TeamMember[] = [];
      teamSnap.forEach(d => members.push({ id: d.id, ...d.data() } as TeamMember));
      setTeam(members);

      const all: Asset[] = [];
      allAssetsSnap.forEach(d => all.push({ ...d.data(), id: d.id } as Asset));
      setFullAssets(all);

      const lib = all.filter(a => a.isReady && (!a.assignedArtists || a.assignedArtists.length === 0));
      setLibrary(lib);
    };
    if (isOpen) fetchData();
  }, [isOpen]);

  const getParentName = (parentId: string) => {
    const parent = fullAssets.find(a => a.id === parentId);
    return parent ? parent.name : "Parent";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const selectedLibAsset = library.find(a => a.id === formData.assetId);
      if (!selectedLibAsset) throw new Error("Please select a legend from the archive");

      const selectedArtistMember = team.find(m => m.id === formData.artistId);
      const selectedArtist = selectedArtistMember?.name || "";
      
      // Auto-calculate Input Expected Date (T + 2 Days)
      const inputExpected = new Date();
      inputExpected.setDate(inputExpected.getDate() + 2);
      const inputExpectedStr = inputExpected.toISOString().split('T')[0];

      const productionData = {
        assignedArtists: [selectedArtist],
        studio: formData.studio,
        priority: formData.priority,
        inputExpectedDate: inputExpectedStr,
        status: "Not Started" as AssetStatus,
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, "assets", formData.assetId), productionData);

      // Slack Notification
      if (selectedArtist) {
        const variationContext = selectedLibAsset.parentId ? ` (Echo of ${getParentName(selectedLibAsset.parentId)})` : '';
        await notifyArtistsByName(
          [selectedArtist],
          `you have been assigned to a new legend: *${selectedLibAsset.name}*${variationContext} (${formData.studio}). Stage: Base input.`
        );
      }

      onAssetAdded();
      onClose();
      setFormData({
        assetId: "",
        artistId: "",
        studio: "Xentrix",
        priority: "Secondary",
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initiate production.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="epic-glass rounded-[40px] border border-white/10 shadow-2xl w-full max-w-xl p-10 relative overflow-hidden ornate-border"
          >
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-900/30">
                  <Flame className="w-7 h-7 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight font-serif">Sacred Initiation</h2>
                  <p className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">Release Legend into the Divine Pipeline</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition">
                <X className="w-7 h-7" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-vermillion/10 border border-vermillion/20 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-vermillion shrink-0" />
                  <p className="text-xs font-bold text-vermillion uppercase tracking-tight">{error}</p>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 text-divine">Legend from Archive</label>
                <div className="relative group">
                  <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
                  <select name="assetId" required value={formData.assetId} onChange={handleChange} className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-black text-xs focus:border-gold/50 outline-none transition appearance-none uppercase tracking-widest shadow-inner">
                    <option value="" className="bg-slate-900">Select Legend</option>
                    {library.map(a => (
                      <option key={a.id} value={a.id} className={`${a.parentId ? 'text-indigo-400 font-black' : 'text-white font-bold'} bg-slate-900`}>
                        {a.parentId ? `[ECHO] ` : `[${a.type}] `} {a.name} {a.parentId ? `(of ${getParentName(a.parentId)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {library.length === 0 && (
                  <p className="text-[9px] text-orange-500 font-bold uppercase tracking-[0.2em] ml-1 mt-2">No ready legends found in the Vault Archive.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Realm (Studio)</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
                    <select name="studio" value={formData.studio} onChange={handleChange} className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-black text-xs focus:border-gold/50 outline-none transition appearance-none uppercase tracking-widest shadow-inner">
                      <option value="Xentrix" className="bg-slate-900">Xentrix</option>
                      <option value="Innovative Colors" className="bg-slate-900">Innovative Colors</option>
                      <option value="Inhouse" className="bg-slate-900">Inhouse</option>
                      <option value="Other" className="bg-slate-900">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Guardian</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
                    <select name="artistId" required value={formData.artistId} onChange={handleChange} className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-black text-xs focus:border-gold/50 outline-none transition appearance-none uppercase tracking-widest shadow-inner">
                      <option value="" className="bg-slate-900">Select Guardian</option>
                      {team.filter(m => m.role === 'Artist').map(m => (
                        <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Magnitude Level</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Primary', 'Secondary'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: p as any }))}
                      className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        formData.priority === p 
                          ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(255,153,51,0.15)]' 
                          : 'bg-white/[0.03] border-white/5 text-slate-600 hover:border-white/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 flex flex-col gap-6">
                <div className="flex items-center gap-4 px-5 py-4 bg-emerald-500/5 border border-emerald-500/10 rounded-[24px]">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                    Prophecy: Divine Pipeline commences in 48h
                  </p>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading || !formData.artistId || !formData.assetId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-5 bg-orange-600 text-white font-black uppercase tracking-[0.3em] text-xs rounded-[24px] shadow-2xl shadow-orange-900/40 disabled:opacity-30 disabled:bg-slate-900 transition-all font-serif"
                >
                  {loading ? "COMMENCING..." : "Begin Production"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { AlertCircle } from "lucide-react";
