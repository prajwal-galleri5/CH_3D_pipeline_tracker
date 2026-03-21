"use client";

import { useEffect, useState, Fragment } from "react";
import { collection, getDocs, orderBy, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, AssetType, StudioName } from "@/types";
import { Plus, Boxes, CheckCircle, Trash2, ChevronRight, User, Box, Shield, Car, Building2, Filter } from "lucide-react";
import { AddAssetModal } from "@/components/AddAssetModal";
import ThematicModal from "@/components/ThematicModal";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { isAdmin } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<AssetType | 'All'>('All');
  const [activeStudio, setActiveStudio] = useState<StudioName | 'All'>('All');

  // Thematic Modal State
  const [isThematicModalOpen, setIsThematicModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    type: "confirm" | "danger" | "info";
    title: string;
    description: string;
    onConfirm?: () => void;
  }>({ type: "info", title: "", description: "" });

  const fetchAssets = async () => {
    setLoading(true);
    setError("");
    try {
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "your_project_id_here") {
        throw new Error("Please connect your Firebase project in .env.local");
      }

      const q = query(collection(db, "assets"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const allFetched: Asset[] = [];
      querySnapshot.forEach((doc) => {
        allFetched.push({ ...doc.data(), id: doc.id } as Asset);
      });
      
      const active = allFetched.filter(a => a.assignedArtists && a.assignedArtists.length > 0);
      setAssets(active);
    } catch (err: any) {
      console.error("Error fetching assets:", err);
      setError(err.message || "Could not connect to database.");
    } finally {
      setLoading(false);
    }
  };

  const mainAssets = assets.filter(a => !a.parentId);
  const variations = assets.filter(a => a.parentId);

  const filteredMainAssets = mainAssets.filter(a => {
    const categoryMatch = activeCategory === 'All' || a.type === activeCategory;
    const studioMatch = activeStudio === 'All' || a.studio === activeStudio;
    return categoryMatch && studioMatch;
  });

  const getParentName = (parentId: string) => {
    const parent = assets.find(a => a.id === parentId);
    return parent ? parent.name : "Parent";
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteAsset = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    
    setModalConfig({
      type: "danger",
      title: "Stop Production",
      description: `Are you sure you want to stop production for "${name}" and all its variations? This will clear all version history and reset them back to the Library.`,
      onConfirm: async () => {
        try {
          // 1. Find all variations of this asset
          const variationsQuery = query(collection(db, "assets"), where("parentId", "==", id));
          const variationsSnap = await getDocs(variationsQuery);
          const allAssetIdsToReset = [id, ...variationsSnap.docs.map(d => d.id)];

          // 2. Delete version history for the main asset AND all its variations
          const deleteVersionsPromises = allAssetIdsToReset.map(async (assetId) => {
            const q = query(collection(db, "versions"), where("assetId", "==", assetId));
            const snap = await getDocs(q);
            return Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
          });
          await Promise.all(deleteVersionsPromises);

          // 3. Reset all these assets in Firestore
          const resetPromises = allAssetIdsToReset.map((assetId) => {
            const assetRef = doc(db, "assets", assetId);
            return updateDoc(assetRef, {
              assignedArtists: [],
              status: "Not Started",
              updatedAt: Date.now(),
              inputCompletedDate: null,
              inputExpectedDate: null,
              firstPassReceived: "No",
              firstPassReceivedDate: null,
              firstPassExpectedDate: null,
              reviewed: "No",
              reviewedDate: null,
              greyScaleExpectedDate: null,
              finalVersionReceivedDate: null,
              finalVersionExpectedDate: null,
              finalReviewOutcome: "",
              bmApproved: false,
              fpApproved: false,
              gsApproved: false,
              finalApproved: false,
              reviewDueAt: null,
              vendorActionDueAt: null,
              vendorNotified: "No",
              vendorNotifiedDate: null,
              bmUploadedAt: null,
              bmReviewedAt: null,
              bmNotifiedAt: null,
              fpUploadedAt: null,
              fpReviewedAt: null,
              fpNotifiedAt: null,
              gsUploadedAt: null,
              gsReviewedAt: null,
              gsNotifiedAt: null,
              finalUploadedAt: null,
              finalReviewedAt: null,
              finalReviewedAtModel: null,
              finalReviewedAtRig: null,
              finalNotifiedAt: null
            });
          });
          await Promise.all(resetPromises);

          setIsThematicModalOpen(false);
          fetchAssets();
        } catch (err) {
          console.error("Multi-reset failed:", err);
          setModalConfig({
            type: "info",
            title: "Error",
            description: "Failed to reset production task and its variations."
          });
          setIsThematicModalOpen(true);
        }
      }
    });
    setIsThematicModalOpen(true);
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
    
    if (asset.finalVersionReceivedDate) return { 
      text: isRework ? "Final pkg rework" : "Final pkg review", 
      color: isRework ? "text-red-400" : "text-orange-400", 
      bg: isRework ? "bg-red-500/10" : "bg-orange-500/10" 
    };
    
    if (asset.gsApproved) return { text: "Awaiting Final", color: "text-purple-400", bg: "bg-purple-500/10" };
    if (asset.reviewed === "Yes") return { 
      text: isRework ? "Texture rework" : "Texture review", 
      color: isRework ? "text-red-400" : "text-purple-400", 
      bg: isRework ? "bg-red-500/10" : "bg-purple-500/10" 
    };
    
    if (asset.fpApproved) return { text: "Awaiting Texture", color: "text-cyan-400", bg: "bg-cyan-500/10" };
    if (asset.firstPassReceived === "Yes") return { 
      text: isRework ? "Grey scale Model(1st pass) rework" : "Grey scale Model(1st pass) review", 
      color: isRework ? "text-red-400" : "text-cyan-400", 
      bg: isRework ? "bg-red-500/10" : "bg-cyan-500/10" 
    };
    
    if (asset.bmApproved) return { text: "Awaiting Grey scale Model(1st pass)", color: "text-blue-400", bg: "bg-blue-500/10" };
    if (asset.inputCompletedDate) return { 
      text: isRework ? "Base input rework" : "Base input review", 
      color: isRework ? "text-red-400" : "text-blue-400", 
      bg: isRework ? "bg-red-500/10" : "bg-blue-500/10" 
    };
    
    return { text: "Base input Phase", color: "text-slate-500", bg: "bg-white/5" };
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Not Started": return "text-slate-400 border-slate-800 bg-slate-800/20";
      case "Base input": return "text-blue-400 border-blue-500/30 bg-blue-500/10";
      case "Grey scale Model(1st pass)": return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
      case "Texture": return "text-purple-400 border-purple-500/30 bg-purple-500/10";
      case "Final Review": return "text-orange-400 border-orange-500/30 bg-orange-500/10";
      case "RM Approved": return "text-emerald-400 border-emerald-500/50 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
      case "Approved": case "Completed": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
      default: return "text-slate-400 border-slate-800";
    }
  };

  const renderAssetRow = (asset: Asset) => {
    const progress = calculateProgress(asset);
    const outcome = getLifecycleOutcome(asset);
    const children = variations.filter(v => v.parentId === asset.id);
    const hasVariations = children.length > 0;
    const isExpanded = expandedRows.has(asset.id);

    const displayProgress = progress;
    const displayOutcome = asset.status === 'RM Approved' ? { text: "DIRECTOR LOCKED", color: "text-emerald-400 font-black", bg: "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" } : outcome;

    return (
      <Fragment key={asset.id}>
        <tr 
          className={`group cursor-pointer hover:bg-white/[0.02] transition-all relative ${asset.parentId ? 'bg-indigo-500/[0.03]' : ''}`}
          style={{ 
            backgroundImage: `linear-gradient(to right, ${asset.parentId ? 'rgba(99, 102, 241, 0.05)' : 'rgba(16, 185, 129, 0.04)'} ${displayProgress}%, transparent ${displayProgress}%)`
          }}
          onClick={() => window.location.href = `/assets/${asset.id}`}
        >
          <td className="px-6 py-5 sticky left-0 bg-slate-900/95 backdrop-blur-md group-hover:bg-slate-800 transition-colors z-10 border-r border-white/5">
            <div className="flex items-center gap-4">
              {!asset.parentId && hasVariations && (
                <button 
                  onClick={(e) => toggleExpand(asset.id, e)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500"
                >
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              {asset.parentId && (
                <div className="w-3 h-3 border-l-2 border-b-2 border-indigo-500/30 rounded-bl-sm ml-2 flex-shrink-0" />
              )}
              {isAdmin && (
                <button 
                  onClick={(e) => handleDeleteAsset(asset.id, asset.name, e)}
                  className="p-1.5 text-slate-700 hover:text-red-500 rounded-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="min-w-0" title={asset.name}>
                <div className={`font-black text-[11px] uppercase tracking-tight truncate group-hover:text-orange-400 transition-colors ${asset.parentId ? 'text-indigo-400' : 'text-white'}`}>
                  {asset.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${getStatusStyle(asset.status)}`}>
                    {asset.status}
                  </span>
                  {asset.parentId && (
                    <span className="text-[6px] font-black text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                      Variation of {getParentName(asset.parentId)}
                    </span>
                  )}
                  <span className="text-[7px] font-bold text-slate-600 uppercase tabular-nums">{Math.round(displayProgress)}%</span>
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
            { key: 'inputCompletedDate', label: 'Done', exp: asset.inputExpectedDate, check: asset.bmApproved },
            { key: 'firstPassReceived', label: 'Recv', exp: asset.firstPassExpectedDate, check: asset.fpApproved },
            { key: 'reviewed', label: 'Rev', exp: asset.greyScaleExpectedDate, check: asset.gsApproved },
            { key: 'finalVersionReceivedDate', label: 'Recv', exp: asset.finalVersionExpectedDate, check: asset.finalApproved }
          ].map((m, i) => {
            const isUploaded = (asset as any)[m.key] === 'Yes' || !!(asset as any)[m.key];
            const isApproved = m.check;
            
            return (
              <td key={i} className="px-6 py-5 text-center">
                <div className="flex flex-col items-center gap-1">
                  {isUploaded ? (
                    <CheckCircle className={`w-4 h-4 ${isApproved ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-orange-500'} transition-all`} />
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600 italic">
                      {m.exp ? m.exp.split('-').slice(1).join('/') : "—"}
                    </span>
                  )}
                  <span className={`text-[7px] font-black uppercase tracking-tighter ${isApproved ? 'text-emerald-600' : isUploaded ? 'text-orange-600' : 'text-slate-500'}`}>
                    {isApproved ? "Approved" : isUploaded ? m.label : "Awaiting"}
                  </span>
                </div>
              </td>
            );
          })}

          {/* Outcome */}
          <td className="px-6 py-5 text-center">
            <div className={`inline-flex px-3 py-1 rounded-full border border-white/5 ${displayOutcome.bg}`}>
              <span className={`text-[9px] font-black uppercase tracking-widest ${displayOutcome.color}`}>
                {displayOutcome.text}
              </span>
            </div>
          </td>
        </tr>
        {isExpanded && children.map(v => renderAssetRow(v))}
      </Fragment>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-full mx-auto px-4 py-8">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
            <span className="text-orange-500 font-bold uppercase tracking-[0.3em] text-[10px]">Operations</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white leading-tight uppercase">
            {activeCategory === 'All' ? 'Character' : activeCategory} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Pipeline</span>
          </h1>
        </div>

        {isAdmin && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg whitespace-nowrap shadow-orange-900/20 w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Initialize Production</span>
          </motion.button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row items-center gap-4 mb-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 px-2 text-slate-600">
          <Filter className="w-3 h-3" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">Filter Engine</span>
        </div>
        
        {/* Studio Filter UI */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 w-full lg:w-auto overflow-x-auto custom-scrollbar">
          {[
            { id: 'All', label: 'All Studios', icon: Building2 },
            { id: 'Xentrix', label: 'Xentrix' },
            { id: 'Innovative Colors', label: 'Innovative' },
            { id: 'Inhouse', label: 'Inhouse' }
          ].map((studio) => (
            <button
              key={studio.id}
              onClick={() => setActiveStudio(studio.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeStudio === studio.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {studio.icon && <studio.icon className="w-3.5 h-3.5" />}
              <span>{studio.label}</span>
            </button>
          ))}
        </div>

        <div className="hidden lg:block w-px h-4 bg-white/10 mx-2"></div>

        {/* Category Filter UI */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 gap-1 w-full lg:w-auto overflow-x-auto custom-scrollbar">
          {[
            { id: 'All', label: 'All Categories', icon: Boxes },
            { id: 'Character', label: 'Characters', icon: User },
            { id: 'Prop', label: 'Props', icon: Box },
            { id: 'Weapon', label: 'Weapons', icon: Shield },
            { id: 'Vehicle', label: 'Vehicles', icon: Car }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeCategory === cat.id 
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <cat.icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="w-12 h-12 border-2 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
          <span className="text-orange-500 font-bold tracking-widest text-[10px] animate-pulse uppercase">Syncing...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-32 cinematic-glass rounded-3xl border border-dashed border-white/10 max-w-7xl mx-auto">
           <Boxes className="w-16 h-16 text-slate-800 mx-auto mb-4" />
           <p className="text-slate-500 font-bold uppercase tracking-widest">No active production tasks. Release assets from Library to start.</p>
        </div>
      ) : (
        <div className="w-full">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="cinematic-glass rounded-3xl border border-white/5 shadow-2xl overflow-hidden"
          >
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    <th className="px-6 py-5 w-[250px] sticky left-0 bg-slate-900/95 backdrop-blur-md z-20 border-r border-white/5">Asset Name</th>
                    <th className="px-6 py-5 w-[150px]">Studio</th>
                    <th className="px-6 py-5 w-[150px]">Artist</th>
                    <th className="px-6 py-5 text-center bg-blue-500/[0.02]">Base input</th>
                    <th className="px-6 py-5 text-center bg-cyan-500/[0.02]">Grey scale Model(1st pass)</th>
                    <th className="px-6 py-5 text-center bg-purple-500/[0.02]">Texture</th>
                    <th className="px-6 py-5 text-center bg-orange-500/[0.02]">Final Pkg</th>
                    <th className="px-6 py-5 text-center bg-emerald-500/[0.02]">Lifecycle Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMainAssets.map((asset) => renderAssetRow(asset))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

      <AddAssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAssetAdded={fetchAssets}
      />

      <ThematicModal
        isOpen={isThematicModalOpen}
        onClose={() => setIsThematicModalOpen(false)}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
        onConfirm={modalConfig.onConfirm}
      />
    </motion.div>
  );
}
