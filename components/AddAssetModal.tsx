"use client";

import { useEffect, useState } from "react";
import { X, User, Building2, Zap, Box } from "lucide-react";
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
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [teamSnap, libSnap] = await Promise.all([
        getDocs(query(collection(db, "team_members"), where("active", "==", true))),
        getDocs(query(collection(db, "assets"), where("isReady", "==", true)))
      ]);

      const members: TeamMember[] = [];
      teamSnap.forEach(d => members.push({ id: d.id, ...d.data() } as TeamMember));
      setTeam(members);

      const lib: Asset[] = [];
      libSnap.forEach(d => {
        const data = d.data() as Asset;
        // Only show assets not yet in production (no artists assigned)
        if (!data.assignedArtists || data.assignedArtists.length === 0) {
          lib.push({ id: d.id, ...data });
        }
      });
      setLibrary(lib);
    };
    if (isOpen) fetchData();
  }, [isOpen]);

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
      if (!selectedLibAsset) throw new Error("Please select an asset from library");

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
        await notifyArtistsByName(
          [selectedArtist],
          `you have been assigned to a new asset: *${selectedLibAsset.name}* (${formData.studio}). Stage: Base input.`
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
      setError(err.message || "Failed to initialize production.");
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="cinematic-glass rounded-[32px] border border-white/10 shadow-2xl w-full max-w-xl p-8 relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Initialize Production</h2>
                  <p className="text-slate-500 text-[9px] font-bold tracking-[0.2em] uppercase">Release Ready Asset to Pipeline</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                    <X className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-red-400 uppercase tracking-tight">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ready Assets (from library)</label>
                <div className="relative">
                  <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select name="assetId" required value={formData.assetId} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold focus:border-orange-500/50 outline-none transition appearance-none">
                    <option value="" className="bg-slate-900">Select Ready Asset</option>
                    {library.map(a => (
                      <option key={a.id} value={a.id} className="bg-slate-900">[{a.type}] {a.name}</option>
                    ))}
                  </select>
                </div>
                {library.length === 0 && (
                  <p className="text-[8px] text-orange-500 font-bold uppercase tracking-widest ml-1 mt-1">No ready assets available in Library. Mark them as ready in the Library page first.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Studio</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select name="studio" value={formData.studio} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold focus:border-orange-500/50 outline-none transition appearance-none">
                      <option value="Xentrix" className="bg-slate-900">Xentrix</option>
                      <option value="Innovative Colors" className="bg-slate-900">Innovative Colors</option>
                      <option value="Inhouse" className="bg-slate-900">Inhouse</option>
                      <option value="Other" className="bg-slate-900">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assign Lead Artist</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select name="artistId" required value={formData.artistId} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white font-bold focus:border-orange-500/50 outline-none transition appearance-none">
                      <option value="" className="bg-slate-900">Select Artist</option>
                      {team.filter(m => m.role === 'Artist').map(m => (
                        <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Priority Level</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Primary', 'Secondary'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: p as any }))}
                      className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                        formData.priority === p 
                          ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20' 
                          : 'bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/20'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                    Automated Release: Pipeline starts in 48h
                  </p>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading || !formData.artistId || !formData.assetId}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-4 bg-orange-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-900/20 disabled:opacity-50 disabled:bg-slate-800 transition-all"
                >
                  {loading ? "Releasing..." : "Start Production"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
