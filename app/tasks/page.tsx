"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, TeamMember } from "@/types";
import { CheckCircle, Clock, AlertCircle, Calendar, User, Package, ShieldCheck, ChevronRight, Activity, Search, Building2, UserCheck, ArrowLeft, Trophy } from "lucide-react";
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
            workDone: "Divine Input Preparation",
            responsibleParty: asset.assignedArtists?.join(", ") || "Unknown Guardian",
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
            workDone: "1st Pass Chronicle Delivery",
            responsibleParty: isInhouse ? (asset.assignedArtists?.join(", ") || "Guardian") : (asset.studio || "Unknown Realm"),
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
            workDone: "Final Legend Delivery",
            responsibleParty: isInhouse ? (asset.assignedArtists?.join(", ") || "Guardian") : (asset.studio || "Unknown Realm"),
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
          responsibleParty = asset.assignedArtists?.join(", ") || "Unassigned Guardian";
          partyRole = 'Artist';
        } else {
          responsibleParty = asset.studio || "Realm";
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
          workDone: `Sacred Upload: ${v.stage} V${v.versionNumber}`,
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
            workDone: `Divine Decree: ${v.stage} V${v.versionNumber} (${v.status})`,
            responsibleParty: team[v.reviewerId] || "Unknown Guardian",
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
      case 'Reviewer': return 'text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(255,153,51,0.1)]';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'Artist': return <User className="w-3.5 h-3.5" />;
      case 'Vendor': return <Building2 className="w-3.5 h-3.5" />;
      case 'Reviewer': return <ShieldCheck className="w-3.5 h-3.5" />;
      default: return <User className="w-3.5 h-3.5" />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-4 py-12 pb-40">
      <Link href="/" className="inline-flex items-center text-[10px] font-black text-slate-500 hover:text-saffron uppercase tracking-[0.2em] transition-colors mb-8">
        <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 bg-gradient-to-r from-saffron to-vermillion rounded-full"></div>
            <span className="text-saffron font-black uppercase tracking-[0.3em] text-[10px]">Ancient Records</span>
          </div>
          <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none font-serif">
            Veda <span className="text-divine">Chronicle</span>
          </h1>
        </div>

        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-gold transition-colors" />
          <input
            type="text"
            placeholder="Search the chronicles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white font-bold focus:border-gold/50 outline-none transition-all text-xs uppercase tracking-widest shadow-xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="w-16 h-16 border-4 border-saffron/20 border-t-saffron rounded-full animate-spin"></div>
          <span className="text-saffron font-black tracking-[0.4em] text-xs uppercase animate-pulse">Consulting the Records...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOps.map((op, i) => (
            <motion.div
              key={op.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="epic-glass p-6 rounded-[32px] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-gold/30 transition-all ornate-border"
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:rotate-6 ${
                  op.type === 'Upload' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 
                  op.type === 'Review' ? 'bg-saffron/10 text-saffron border-saffron/20 shadow-[0_0_20px_rgba(255,153,51,0.1)]' : 
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                }`}>
                   {op.type === 'Upload' ? <Package className="w-7 h-7" /> : 
                    op.type === 'Review' ? <Trophy className="w-7 h-7" /> : 
                    <Activity className="w-7 h-7" />}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="text-white font-black text-xl truncate uppercase tracking-tighter font-serif group-hover:text-gold transition-colors">{op.assetName}</span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{op.date}</span>
                    </div>
                    {op.onTime !== 'N/A' && (
                      <div className={`px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 ${
                        op.onTime ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-vermillion border-vermillion/20 bg-vermillion/5'
                      }`}>
                        {op.onTime ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {op.onTime ? "DIVINE TIMING" : "DELAYED"}
                      </div>
                    )}
                  </div>
                  <p className="text-slate-200 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2.5">
                    <ChevronRight className="w-4 h-4 text-saffron animate-pulse" />
                    {op.workDone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 border-t md:border-t-0 border-white/5 pt-6 md:pt-0">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Soul Responsible</span>
                  <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${getRoleBadge(op.partyRole)}`}>
                    {getRoleIcon(op.partyRole)}
                    <span className="text-[11px] font-black uppercase tracking-widest">{op.responsibleParty}</span>
                  </div>
                </div>
                <button 
                  onClick={() => window.location.href = `/assets/${op.assetId}`}
                  className="p-3 bg-white/5 text-slate-500 hover:text-white rounded-xl border border-white/5 hover:border-gold/30 transition-all group/btn shadow-lg"
                >
                  <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
