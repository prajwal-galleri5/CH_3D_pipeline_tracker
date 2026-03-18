"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, TeamMember } from "@/types";
import { CheckCircle, Clock, AlertCircle, Calendar, User, Package, ShieldCheck, ChevronRight, Activity, Search, Building2, UserCheck, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface DailyOp {
  id: string;
  date: string;
  assetName: string;
  assetId: string;
  workDone: string;
  responsibleParty: string;
  partyRole: 'Artist' | 'Vendor' | 'Reviewer';
  onTime: boolean | 'N/A';
  type: 'Milestone' | 'Upload' | 'Review';
  timestamp: number;
}

export default function AutomatedDailyOps() {
  const [ops, setOps] = useState<DailyOp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsSnap, versionsSnap, teamSnap] = await Promise.all([
        getDocs(collection(db, "assets")),
        getDocs(query(collection(db, "versions"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "team_members"))
      ]);

      const assets: Asset[] = [];
      assetsSnap.forEach(d => assets.push({ id: d.id, ...d.data() } as Asset));

      const versions: Version[] = [];
      versionsSnap.forEach(d => versions.push({ id: d.id, ...d.data() } as Version));

      const team: Record<string, string> = {};
      teamSnap.forEach(d => {
        const data = d.data();
        team[d.id] = data.name;
      });

      const derivedOps: DailyOp[] = [];

      const checkOnTime = (actual: string | undefined, expected: string | undefined): boolean | 'N/A' => {
        if (!actual || !expected) return 'N/A';
        return new Date(actual) <= new Date(expected);
      };

      assets.forEach(asset => {
        // Milestone: Input Completed (Artist)
        if (asset.inputCompletedDate) {
          derivedOps.push({
            id: `milestone-input-${asset.id}`,
            date: asset.inputCompletedDate,
            assetName: asset.name,
            assetId: asset.id,
            workDone: "Input Preparation",
            responsibleParty: asset.assignedArtists?.join(", ") || "Unknown Artist",
            partyRole: 'Artist',
            onTime: checkOnTime(asset.inputCompletedDate, asset.inputExpectedDate),
            type: 'Milestone',
            timestamp: new Date(asset.inputCompletedDate).getTime()
          });
        }

        // Milestone: Grey scale Model(1st pass) Received (Vendor)
        if (asset.firstPassReceivedDate) {
          const isInhouse = asset.studio === 'Inhouse';
          derivedOps.push({
            id: `milestone-fp-${asset.id}`,
            date: asset.firstPassReceivedDate,
            assetName: asset.name,
            assetId: asset.id,
            workDone: "Grey scale Model(1st pass) Delivery",
            responsibleParty: isInhouse ? (asset.assignedArtists?.join(", ") || "Artist") : (asset.studio || "Unknown Vendor"),
            partyRole: isInhouse ? 'Artist' : 'Vendor',
            onTime: checkOnTime(asset.firstPassReceivedDate, asset.firstPassExpectedDate),
            type: 'Milestone',
            timestamp: new Date(asset.firstPassReceivedDate).getTime()
          });
        }

        // Milestone: Final Version Received (Vendor)
        if (asset.finalVersionReceivedDate) {
          const isInhouse = asset.studio === 'Inhouse';
          derivedOps.push({
            id: `milestone-final-${asset.id}`,
            date: asset.finalVersionReceivedDate,
            assetName: asset.name,
            assetId: asset.id,
            workDone: "Final Delivery",
            responsibleParty: isInhouse ? (asset.assignedArtists?.join(", ") || "Artist") : (asset.studio || "Unknown Vendor"),
            partyRole: isInhouse ? 'Artist' : 'Vendor',
            onTime: checkOnTime(asset.finalVersionReceivedDate, asset.finalVersionExpectedDate),
            type: 'Milestone',
            timestamp: new Date(asset.finalVersionReceivedDate).getTime()
          });
        }
      });

      versions.forEach(v => {
        const asset = assets.find(a => a.id === v.assetId);
        if (!asset) return;

        const actualDateStr = new Date(v.createdAt).toISOString().split('T')[0];

        // 1. Log the Upload
        let responsibleParty = "";
        let partyRole: 'Artist' | 'Vendor' | 'Reviewer' = 'Vendor';
        
        if (v.stage === 'Base input') {
          responsibleParty = asset.assignedArtists?.join(", ") || "Unassigned Artist";
          partyRole = 'Artist';
        } else {
          responsibleParty = asset.studio || "Vendor";
          partyRole = 'Vendor';
        }

        let expectedDate = asset.finalVersionExpectedDate;
        if (v.stage === "Base input" || v.stage === "Grey scale Model(1st pass)") expectedDate = asset.firstPassExpectedDate;
        if (v.stage === "Texture") expectedDate = asset.greyScaleExpectedDate;

        derivedOps.push({
          id: `version-up-${v.id}`,
          date: actualDateStr,
          assetName: asset.name,
          assetId: asset.id,
          workDone: `Package Uploaded: ${v.stage} V${v.versionNumber}`,
          responsibleParty,
          partyRole,
          onTime: checkOnTime(actualDateStr, expectedDate),
          type: 'Upload',
          timestamp: v.createdAt
        });

        // 2. Log the Review
        if (v.reviewerId) {
          derivedOps.push({
            id: `version-rev-${v.id}`,
            date: actualDateStr,
            assetName: asset.name,
            assetId: asset.id,
            workDone: `Reviewed ${v.stage} V${v.versionNumber} (${v.status})`,
            responsibleParty: team[v.reviewerId] || "Unknown Reviewer",
            partyRole: 'Reviewer',
            onTime: 'N/A',
            type: 'Review',
            timestamp: v.createdAt + 1000
          });
        }
      });

      derivedOps.sort((a, b) => b.timestamp - a.timestamp);
      setOps(derivedOps);
    } catch (err) {
      console.error("Error populating ops log:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOps = ops.filter(op => 
    op.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.workDone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    op.responsibleParty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'Artist': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'Vendor': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'Reviewer': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'Artist': return <User className="w-3.5 h-3.5" />;
      case 'Vendor': return <Building2 className="w-3.5 h-3.5" />;
      case 'Reviewer': return <UserCheck className="w-3.5 h-3.5" />;
      default: return <User className="w-3.5 h-3.5" />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-4 py-12 pb-32">
      <Link href="/" className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-orange-500 uppercase tracking-widest mb-6 transition-colors">
        <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
      </Link>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
            <span className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Operations Log</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight uppercase">
            System <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Timeline</span>
          </h1>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by character, party, or task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-all text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 border-2 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
          <span className="text-orange-500 font-bold tracking-widest text-[10px] animate-pulse">Scanning Activity History...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOps.map((op, i) => (
            <motion.div
              key={op.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="cinematic-glass p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  op.type === 'Upload' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  op.type === 'Review' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                   {op.type === 'Upload' ? <Package className="w-6 h-6" /> : 
                    op.type === 'Review' ? <ShieldCheck className="w-6 h-6" /> : 
                    <Activity className="w-6 h-6" />}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="text-white font-black text-lg truncate uppercase tracking-tighter">{op.assetName}</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{op.date}</span>
                    </div>
                    {op.onTime !== 'N/A' && (
                      <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${
                        op.onTime ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5'
                      }`}>
                        {op.onTime ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {op.onTime ? "On Time" : "Delayed"}
                      </div>
                    )}
                  </div>
                  <p className="text-slate-100 font-bold text-sm uppercase tracking-tight mb-2 flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-orange-500" />
                    {op.workDone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Responsible Party</span>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${getRoleBadge(op.partyRole)}`}>
                    {getRoleIcon(op.partyRole)}
                    <span className="text-[10px] font-black uppercase tracking-widest">{op.responsibleParty}</span>
                    <span className="text-[8px] opacity-60 font-black italic">({op.partyRole})</span>
                  </div>
                </div>
                <button 
                  onClick={() => window.location.href = `/assets/${op.assetId}`}
                  className="p-2 bg-white/5 text-slate-500 hover:text-white rounded-lg border border-white/5 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
