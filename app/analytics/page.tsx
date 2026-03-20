"use client";

import { useEffect, useState, Fragment } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, TeamMember } from "@/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Package, Activity, Users, ChevronRight, TrendingUp, ArrowLeft, ShieldCheck, Calendar, X, Flame, Trophy, Target } from "lucide-react";
import Link from "next/link";

interface DerivedOp {
  date: string;
  assetId: string;
  onTime: boolean | 'N/A';
  type: 'Milestone' | 'Upload';
  label: string;
}

export default function Analytics() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aSnap, vSnap, tSnap] = await Promise.all([
          getDocs(collection(db, "assets")),
          getDocs(collection(db, "versions")),
          getDocs(collection(db, "team_members"))
        ]);

        const aData: Asset[] = [];
        aSnap.forEach(d => aData.push({ ...d.data(), id: d.id } as Asset));
        setAssets(aData);

        const vData: Version[] = [];
        vSnap.forEach(d => vData.push({ ...d.data(), id: d.id } as Version));
        setVersions(vData);

        const tData: TeamMember[] = [];
        tSnap.forEach(d => tData.push({ ...d.data(), id: d.id } as TeamMember));
        setTeam(tData);
      } catch (err) {
        console.error("Analytics load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Derived Data for Intelligence ---
  const ops: DerivedOp[] = [];
  assets.forEach(a => {
    if (a.bmReviewedAt) ops.push({ date: new Date(a.bmReviewedAt).toISOString().split('T')[0], assetId: a.id, onTime: a.inputCompletedDate ? (new Date(a.bmReviewedAt) <= new Date(a.inputCompletedDate)) : 'N/A', type: 'Milestone', label: 'Base input' });
    if (a.fpReviewedAt) ops.push({ date: new Date(a.fpReviewedAt).toISOString().split('T')[0], assetId: a.id, onTime: a.firstPassExpectedDate ? (new Date(a.fpReviewedAt) <= new Date(a.firstPassExpectedDate)) : 'N/A', type: 'Milestone', label: '1st Pass' });
    if (a.gsReviewedAt) ops.push({ date: new Date(a.gsReviewedAt).toISOString().split('T')[0], assetId: a.id, onTime: a.greyScaleExpectedDate ? (new Date(a.gsReviewedAt) <= new Date(a.greyScaleExpectedDate)) : 'N/A', type: 'Milestone', label: 'Texture' });
    if (a.finalReviewedAt) ops.push({ date: new Date(a.finalReviewedAt).toISOString().split('T')[0], assetId: a.id, onTime: a.finalVersionExpectedDate ? (new Date(a.finalReviewedAt) <= new Date(a.finalVersionExpectedDate)) : 'N/A', type: 'Milestone', label: 'Final Package' });
  });

  // --- Filtering Logic ---
  const filteredOps = selectedDate 
    ? ops.filter(o => o.date === selectedDate)
    : ops;

  const involvedAssetIds = new Set(filteredOps.map(o => o.assetId));
  
  const displayedAssets = selectedDate 
    ? assets.filter(a => involvedAssetIds.has(a.id))
    : assets;

  const calculateProgress = (asset: Asset) => {
    const status = asset.status as string;
    if (status === "Approved" || status === "RM Approved") return 100;
    let milestones = 0;
    if (asset.bmApproved) milestones++;
    if (asset.fpApproved) milestones++;
    if (asset.gsApproved) milestones++;
    if (asset.finalApproved) milestones++;
    if (status === "Approved" || status === "RM Approved") milestones++;
    return Math.round((milestones / 5) * 100);
  };

  const groupAssets = () => {
    const groups: Record<string, Asset[]> = { Primary: [], Secondary: [], Inhouse: [] };
    displayedAssets.forEach(a => {
      if (a.studio === 'Inhouse') groups.Inhouse.push(a);
      else if (a.priority === 'Primary') groups.Primary.push(a);
      else groups.Secondary.push(a);
    });
    Object.keys(groups).forEach(key => {
      groups[key] = groups[key].filter(a => !a.parentId).sort((a, b) => calculateProgress(b) - calculateProgress(a));
    });
    return groups;
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-6">
      <div className="w-16 h-16 border-4 border-saffron/20 border-t-saffron rounded-full animate-spin"></div>
      <span className="text-saffron font-black tracking-[0.4em] text-xs uppercase animate-pulse">Reading the Celestial Alignment...</span>
    </div>
  );

  const artistList = Array.from(new Set(displayedAssets.flatMap(a => a.assignedArtists || []))).sort();
  const reviewerList = team.filter(m => m.role === 'Reviewer' && m.active).sort((a, b) => a.name.localeCompare(b.name));
  const assetGroups = groupAssets();

  const stats = [
    { label: "Squad Power", value: assets.length, icon: Users, color: "text-saffron" },
    { label: "Divine Milestones", value: ops.length, icon: Trophy, color: "text-gold" },
    { label: "Production Agility", value: `${Math.round((ops.filter(o => o.onTime === true).length / ops.filter(o => o.onTime !== 'N/A').length) * 100) || 0}%`, icon: Zap, color: "text-vermillion" },
    { label: "Vaulted Assets", value: assets.filter(a => a.status === 'Approved' || a.status === 'RM Approved').length, icon: Package, color: "text-emerald-400" },
  ];

  const renderProgressionRow = (asset: Asset, groupName: string) => {
    const progress = calculateProgress(asset);
    const children = assets.filter(v => v.parentId === asset.id);
    const hasVariations = children.length > 0;
    const isExpanded = expandedRows.has(asset.id);

    return (
      <Fragment key={asset.id}>
        <tr className={`group hover:bg-white/[0.03] transition-all cursor-pointer ${asset.parentId ? 'bg-white/[0.01]' : ''}`} onClick={() => window.location.href = `/assets/${asset.id}`}>
          <td className="px-8 py-5">
            <div className="flex items-center gap-3">
              {!asset.parentId && hasVariations && (
                <button onClick={(e) => toggleExpand(asset.id, e)} className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500">
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              {asset.parentId && <div className="w-3 h-3 border-l border-b border-indigo-500/30 rounded-bl-sm ml-2 flex-shrink-0" />}
              <div className="flex flex-col min-w-0">
                <span className={`text-sm font-black uppercase tracking-tight group-hover:text-gold transition-colors ${asset.parentId ? 'text-indigo-400' : 'text-white'}`}>
                  {asset.name}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{asset.type}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{asset.studio}</span>
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-5 text-center">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
              asset.status === 'Approved' || asset.status === 'RM Approved' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
              asset.status === 'Final Review' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
              'text-slate-400 border-white/5 bg-white/5'
            }`}>
              {asset.status}
            </span>
          </td>
          <td className="px-6 py-5">
            <div className="flex flex-col gap-2">
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={`h-full absolute top-0 left-0 ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gold'}`} />
              </div>
              <div className="flex justify-between gap-1">
                {['INPUT', '1P', 'TEX', 'FP', 'DONE'].map((m, i) => {
                  const approved = [asset.bmApproved, asset.fpApproved, asset.gsApproved, asset.finalApproved, asset.status === 'Approved' || asset.status === 'RM Approved'][i];
                  return (
                    <div key={m} className="flex flex-col items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${approved ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-slate-800'}`}></div>
                      <span className={`text-[6px] font-black uppercase ${approved ? 'text-emerald-600' : 'text-slate-700'}`}>{m}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
          <td className="px-8 py-5 text-right">
            <span className={`text-sm font-black tabular-nums ${progress === 100 ? 'text-emerald-500' : 'text-gold'}`}>{Math.round(progress)}%</span>
          </td>
        </tr>
        {isExpanded && children.map(v => renderProgressionRow(v, groupName))}
      </Fragment>
    );
  };

  return (
    <div className="max-w-full mx-auto px-4 py-12 custom-scrollbar pb-40">
      <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 bg-gradient-to-r from-saffron to-vermillion rounded-full"></div>
            <span className="text-saffron font-black uppercase tracking-[0.3em] text-[10px]">Strategic Analysis</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white uppercase leading-none">
            Pipeline <span className="text-divine">Intelligence</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-3xl px-6 py-3 shadow-xl">
          <Calendar className="w-4 h-4 text-saffron" />
          <input type="date" value={selectedDate || ""} onChange={(e) => setSelectedDate(e.target.value || null)} className="bg-transparent text-white text-xs font-bold uppercase tracking-widest focus:outline-none [color-scheme:dark]" />
          {selectedDate && <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-white/10 rounded-full text-slate-500"><X className="w-3 h-3" /></button>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="epic-glass p-8 rounded-[32px] border border-white/5 relative group hover:border-gold/30 transition-all">
            <div className={`p-4 rounded-2xl bg-white/5 inline-flex mb-6 ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="text-4xl font-black text-white mb-1 tabular-nums">{stat.value}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="epic-glass p-8 rounded-[40px] border border-white/5 ornate-border">
          <h3 className="text-xl font-black text-white uppercase mb-8 flex items-center gap-3">
            <Activity className="w-5 h-5 text-saffron" /> Milestone Velocity
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ops.slice(-20)}>
                <defs>
                  <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9933" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff9933" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#0a1414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                <Area type="monotone" dataKey="onTime" stroke="#ff9933" strokeWidth={3} fillOpacity={1} fill="url(#colorOnTime)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="epic-glass p-8 rounded-[40px] border border-white/5 ornate-border">
          <h3 className="text-xl font-black text-white uppercase mb-8 flex items-center gap-3">
            <Target className="w-5 h-5 text-emerald-400" /> Category Focus
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  { name: 'Character', value: assets.filter(a => a.type === 'Character').length },
                  { name: 'Prop', value: assets.filter(a => a.type === 'Prop').length },
                  { name: 'Vehicle', value: assets.filter(a => a.type === 'Vehicle').length },
                  { name: 'Weapon', value: assets.filter(a => a.type === 'Weapon').length },
                ]} innerRadius={80} outerRadius={100} paddingAngle={8} dataKey="value">
                  {['#ff9933', '#d4af37', '#e34234', '#004d40'].map((color, i) => <Cell key={i} fill={color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0a1414', border: 'none', borderRadius: '16px' }} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Artist Intelligence Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <span className="text-emerald-500 font-black uppercase tracking-[0.2em] text-[10px]">Guardians of Creation</span>
            <h2 className="text-4xl font-black text-white uppercase">Artist Intelligence</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {artistList.length === 0 ? (
            <div className="col-span-full py-20 text-center epic-glass rounded-[32px] border border-dashed border-white/10 opacity-50">
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No legends active in this era</p>
            </div>
          ) : artistList.map((artist, idx) => {
            const artistAssets = displayedAssets.filter(a => a.assignedArtists?.includes(artist));
            const artistOps = filteredOps.filter(o => displayedAssets.find(as => as.id === o.assetId)?.assignedArtists?.includes(artist));
            const efficiency = artistOps.filter(o => o.onTime !== 'N/A').length > 0 ? Math.round((artistOps.filter(o => o.onTime === true).length / artistOps.filter(o => o.onTime !== 'N/A').length) * 100) : 0;

            return (
              <motion.div key={artist} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className="epic-glass p-8 rounded-[32px] border border-white/5 flex flex-col group hover:border-emerald-500/30 transition-all relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/20 group-hover:rotate-12 transition-transform">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white uppercase truncate group-hover:text-emerald-400 transition-colors tracking-tight">{artist}</h3>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${efficiency >= 80 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : efficiency >= 50 ? 'bg-gold shadow-[0_0_8px_#d4af37]' : 'bg-vermillion shadow-[0_0_8px_#e34234]'}`}></div>
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{efficiency}% Efficiency</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-2xl font-black text-white tabular-nums">{artistAssets.length}</div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Legends</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-2xl font-black text-blue-400 tabular-nums">{artistOps.length}</div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Milestones</div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  {artistAssets.slice(0, 2).map(asset => (
                    <div key={asset.id} onClick={() => window.location.href = `/assets/${asset.id}`} className="p-3 rounded-xl bg-white/5 hover:bg-emerald-500/10 transition-colors cursor-pointer group/item flex justify-between items-center border border-white/5">
                      <span className="text-[10px] font-bold text-white uppercase truncate mr-2">{asset.name}</span>
                      <span className="text-gold font-black text-[9px]">{calculateProgress(asset)}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reviewer Intelligence Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <span className="text-blue-500 font-black uppercase tracking-[0.2em] text-[10px]">Shields of Quality</span>
            <h2 className="text-4xl font-black text-white uppercase">Reviewer Intelligence</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {reviewerList.length === 0 ? (
            <div className="col-span-full py-20 text-center epic-glass rounded-[32px] border border-dashed border-white/10 opacity-50">
              <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">The council is not yet seated</p>
            </div>
          ) : reviewerList.map((reviewer, idx) => {
            const memberReviews = versions.filter(v => (selectedDate ? new Date(v.createdAt).toISOString().split('T')[0] === selectedDate : true) && (v.reviewerId === reviewer.id || v.reviewerModelId === reviewer.id || v.reviewerRigId === reviewer.id));
            const approvedCount = memberReviews.filter(v => v.stage === 'Final Package' ? ((v.reviewerModelId === reviewer.id && v.statusModel === 'Approved') || (v.reviewerRigId === reviewer.id && v.statusRig === 'Approved')) : (v.status === 'Approved' || v.status === 'RM Approved')).length;

            return (
              <motion.div key={reviewer.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className="epic-glass p-8 rounded-[32px] border border-white/5 flex flex-col group hover:border-blue-500/30 transition-all relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 border border-blue-500/20 group-hover:-rotate-12 transition-transform">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-white uppercase truncate group-hover:text-blue-400 transition-colors tracking-tight">{reviewer.name}</h3>
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Master Reviewer</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-2xl font-black text-white tabular-nums">{memberReviews.length}</div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Inspections</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-2xl font-black text-emerald-400 tabular-nums">{approvedCount}</div>
                    <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Decrees</div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  {memberReviews.slice(0, 2).map(v => (
                    <div key={v.id} onClick={() => window.location.href = `/assets/${v.assetId}`} className="p-3 rounded-xl bg-white/5 hover:bg-blue-500/10 transition-colors cursor-pointer group/item flex justify-between items-center border border-white/5">
                      <span className="text-[10px] font-bold text-white uppercase truncate mr-2">{assets.find(a => a.id === v.assetId)?.name || "Legend"}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${v.status.includes('Approved') ? 'text-emerald-500' : 'text-saffron'}`}>{v.stage.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Progression Strategy Section */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <span className="text-gold font-black uppercase tracking-[0.2em] text-[10px]">The Great Campaign</span>
          <h2 className="text-4xl font-black text-white uppercase">Campaign Progression</h2>
        </div>

        {Object.entries(assetGroups).map(([groupName, list]) => (
          <div key={groupName} className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h3 className={`text-xl font-black uppercase tracking-[0.2em] ${groupName === 'Primary' ? 'text-saffron' : groupName === 'Inhouse' ? 'text-emerald-400' : 'text-blue-400'}`}>{groupName} Campaign</h3>
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{list.length} Missions</span>
            </div>

            <div className="epic-glass rounded-[40px] border border-white/5 overflow-hidden ornate-border">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <th className="px-8 py-6">Mission Identity</th>
                      <th className="px-6 py-6 text-center">Campaign Status</th>
                      <th className="px-6 py-6">Completion Path</th>
                      <th className="px-8 py-6 text-right">Magnitude</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {list.map(asset => renderProgressionRow(asset, groupName))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
