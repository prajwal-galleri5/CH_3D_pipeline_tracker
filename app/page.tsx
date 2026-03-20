"use client";

import { useEffect, useState, Fragment } from "react";
import { collection, getDocs, orderBy, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, AssetStatus } from "@/types";
import { Plus, Trash2, CheckCircle, Search, Filter, ArrowUpDown, ChevronRight, Activity, Zap, ShieldCheck, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AddAssetModal } from "@/components/AddAssetModal";
import { useAuth } from "@/lib/AuthContext";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchType] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "assets"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetched: Asset[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ ...doc.data(), id: doc.id } as Asset);
      });
      setAssets(fetched);

      const vq = query(collection(db, "versions"));
      const vSnapshot = await getDocs(vq);
      const vFetched: Version[] = [];
      vSnapshot.forEach((doc) => vFetched.push({ ...doc.data(), id: doc.id } as Version));
      setVersions(vFetched);
    } catch (err) {
      console.error("Error fetching assets:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetProduction = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to stop production for "${name}" and all its variations? This will clear all version history and reset them back to the Library.`)) return;

    try {
      setLoading(true);
      const variationsQuery = query(collection(db, "assets"), where("parentId", "==", id));
      const variationsSnap = await getDocs(variationsQuery);
      const allAssetIdsToReset = [id, ...variationsSnap.docs.map(d => d.id)];

      for (const assetId of allAssetIdsToReset) {
        const vq = query(collection(db, "versions"), where("assetId", "==", assetId));
        const vSnap = await getDocs(vq);
        for (const vDoc of vSnap.docs) {
          await deleteDoc(doc(db, "versions", vDoc.id));
        }

        await updateDoc(doc(db, "assets", assetId), {
          status: "Not Started" as AssetStatus,
          assignedArtists: [],
          bmApproved: false,
          fpApproved: false,
          gsApproved: false,
          finalApproved: false,
          inputCompletedDate: null,
          inputExpectedDate: null,
          firstPassExpectedDate: null,
          greyScaleExpectedDate: null,
          finalVersionExpectedDate: null,
          updatedAt: Date.now()
        });
      }

      await fetchAssets();
    } catch (err) {
      console.error("Reset failed", err);
      alert("Failed to reset production task.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const calculateProgress = (asset: Asset) => {
    const status = asset.status as string;
    if (status === "Approved" || status === "RM Approved") return 100;
    
    let milestones = 0;
    if (asset.bmApproved) milestones++;
    if (asset.fpApproved) milestones++;
    if (asset.gsApproved) milestones++;
    if (asset.finalApproved) milestones++;
    if (status === "Approved" || status === "RM Approved") milestones++;
    return (milestones / 5) * 100;
  };

  const getLifecycleOutcome = (asset: Asset) => {
    const isRework = asset.finalReviewOutcome === "Rework";
    if (asset.status === "Approved" || asset.finalApproved) return { text: "Fully Approved", color: "text-emerald-400", bg: "bg-emerald-500/10" };
    if (asset.status === "RM Approved") return { text: "Director Approved", color: "text-orange-400", bg: "bg-orange-500/10" };
    if (isRework) return { text: "Refining", color: "text-orange-400", bg: "bg-orange-500/10" };
    return { text: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10" };
  };

  const filteredAssets = assets.filter(a => !a.parentId).filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "All" || a.type === filterType;
    return matchesSearch && matchesFilter && a.assignedArtists?.length > 0;
  });

  const variations = assets.filter(a => a.parentId);

  const getParentName = (parentId: string) => {
    const parent = assets.find(a => a.id === parentId);
    return parent ? parent.name : "Parent";
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Approved': return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
      case 'RM Approved': return "text-orange-400 border-orange-500/20 bg-orange-500/5 font-black";
      case 'Final Review': return "text-orange-500 border-orange-500/20 bg-orange-500/5";
      case 'Not Started': return "text-slate-500 border-white/5";
      default: return "text-blue-400 border-blue-500/20 bg-blue-500/5";
    }
  };

  const renderAssetRow = (asset: Asset) => {
    const progress = calculateProgress(asset);
    const outcome = getLifecycleOutcome(asset);
    const children = variations.filter(v => v.parentId === asset.id);
    const hasVariations = children.length > 0;
    const isExpanded = expandedRows.has(asset.id);

    return (
      <Fragment key={asset.id}>
        <tr 
          className={`group cursor-pointer hover:bg-white/[0.03] transition-all relative ${asset.parentId ? 'bg-indigo-500/[0.03]' : ''}`}
          style={{ 
            backgroundImage: `linear-gradient(to right, ${asset.parentId ? 'rgba(99, 102, 241, 0.05)' : 'rgba(212, 175, 55, 0.03)'} ${progress}%, transparent ${progress}%)`
          }}
          onClick={() => window.location.href = `/assets/${asset.id}`}
        >
          <td className="px-6 py-5">
            <div className="flex items-center gap-3">
              {!asset.parentId && hasVariations && (
                <button 
                  onClick={(e) => toggleExpand(asset.id, e)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              {asset.parentId && (
                <div className="w-3 h-3 border-l-2 border-b-2 border-indigo-500/30 rounded-bl-sm ml-2 flex-shrink-0" />
              )}
              {isAdmin && (
                <button 
                  onClick={(e) => handleResetProduction(asset.id, asset.name, e)}
                  className="p-1.5 text-slate-700 hover:text-vermillion rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title="Stop Production & Reset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="min-w-0" title={asset.name}>
                <div className={`font-black text-[11px] uppercase tracking-wider truncate group-hover:text-gold transition-colors ${asset.parentId ? 'text-indigo-400 font-bold' : 'text-white'}`}>
                  {asset.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${getStatusStyle(asset.status)}`}>
                    {asset.status}
                  </span>
                  <span className="text-[7px] font-bold text-slate-600 uppercase tabular-nums">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          </td>

          <td className="px-6 py-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase truncate block">{asset.studio || "—"}</span>
          </td>

          <td className="px-6 py-5">
            <span className="text-[10px] font-bold text-slate-300 uppercase truncate block">{asset.assignedArtists?.[0] || "—"}</span>
          </td>

          {/* Milestones */}
          {[
            { key: 'inputCompletedDate', label: 'Input', exp: asset.inputExpectedDate, check: asset.bmApproved },
            { key: 'firstPassReceived', label: '1st Pass', exp: asset.firstPassExpectedDate, check: asset.fpApproved },
            { key: 'reviewed', label: 'Texture', exp: asset.greyScaleExpectedDate, check: asset.gsApproved },
            { key: 'finalVersionReceivedDate', label: 'Final', exp: asset.finalVersionExpectedDate, check: asset.finalApproved }
          ].map((m, i) => {
            const isUploaded = (asset as any)[m.key] === 'Yes' || !!(asset as any)[m.key];
            const isApproved = m.check;
            
            return (
              <td key={i} className="px-6 py-5 text-center">
                <div className="flex flex-col items-center gap-1">
                  {isUploaded ? (
                    <CheckCircle className={`w-4 h-4 ${isApproved ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-orange-500'} transition-all`} />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                  )}
                  <span className={`text-[7px] font-black uppercase tracking-tighter ${isApproved ? 'text-emerald-600' : isUploaded ? 'text-orange-600' : 'text-slate-700'}`}>
                    {m.label}
                  </span>
                </div>
              </td>
            );
          })}

          <td className="px-8 py-5 text-right">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${outcome.bg} border border-white/5`}>
              <div className={`w-1.5 h-1.5 rounded-full ${outcome.color.replace('text-', 'bg-')} animate-pulse`} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${outcome.color}`}>
                {outcome.text}
              </span>
            </div>
          </td>
        </tr>
        {isExpanded && children.map(v => renderAssetRow(v))}
      </Fragment>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="max-w-full mx-auto px-4 py-8 pb-32"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-1 bg-gradient-to-r from-saffron to-vermillion rounded-full shadow-[0_0_10px_rgba(255,153,51,0.5)]"></div>
            <span className="text-saffron font-black uppercase tracking-[0.3em] text-[10px]">Divine Pipeline</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase leading-none">
            Production <span className="text-divine">Squad</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-gold transition-colors" />
            <input 
              type="text" 
              placeholder="Search Assets..." 
              value={searchTerm}
              onChange={(e) => setSearchType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-gold/50 transition-all w-64 placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
            {["All", "Character", "Prop", "Vehicle", "Weapon"].map(t => (
              <button 
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-slate-500 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {isAdmin && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3.5 bg-orange-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_25px_rgba(227,66,52,0.3)] hover:bg-orange-500 transition-all"
            >
              <Flame className="w-4 h-4" />
              <span>Initialize</span>
            </motion.button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="epic-glass rounded-[40px] border border-white/5 overflow-hidden shadow-2xl relative ornate-border">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">
                  <th className="px-8 py-6">Identity & Progress</th>
                  <th className="px-6 py-6">Studio</th>
                  <th className="px-6 py-6">Guardian</th>
                  <th className="px-6 py-6 text-center">Base</th>
                  <th className="px-6 py-6 text-center">1st Pass</th>
                  <th className="px-6 py-6 text-center">Texture</th>
                  <th className="px-6 py-6 text-center">Final</th>
                  <th className="px-8 py-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-2 border-saffron/20 border-t-saffron rounded-full animate-spin"></div>
                        <span className="text-saffron font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">Consulting the Vedas...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-20">
                        <ShieldCheck className="w-12 h-12 text-slate-500" />
                        <span className="text-slate-500 font-black tracking-widest text-[10px] uppercase">No active legends found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => renderAssetRow(asset))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddAssetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAssetAdded={fetchAssets} 
      />
    </motion.div>
  );
}
