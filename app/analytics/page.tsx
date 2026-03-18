"use client";

import { useEffect, useState, Fragment } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Asset, Version, TeamMember } from "@/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Zap, Package, Activity, Users, ChevronRight, TrendingUp, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface DerivedOp {
  date: string;
  assetId: string;
  onTime: boolean | 'N/A';
  type: 'Milestone' | 'Upload';
  timestamp: number;
}

export default function Analytics() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [ops, setOps] = useState<DerivedOp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assetsSnap, versionsSnap, teamSnap] = await Promise.all([
          getDocs(collection(db, "assets")),
          getDocs(collection(db, "versions")),
          getDocs(collection(db, "team_members"))
        ]);

        const fetchedAssets: Asset[] = [];
        assetsSnap.forEach(d => fetchedAssets.push({ id: d.id, ...d.data() } as Asset));
        setAssets(fetchedAssets);

        const fetchedVersions: Version[] = [];
        versionsSnap.forEach(d => fetchedVersions.push({ id: d.id, ...d.data() } as Version));
        setVersions(fetchedVersions);

        const fetchedTeam: TeamMember[] = [];
        teamSnap.forEach(d => fetchedTeam.push({ id: d.id, ...d.data() } as TeamMember));
        setTeam(fetchedTeam);

        const derivedOps: DerivedOp[] = [];
        const checkOnTime = (actual: string | undefined, expected: string | undefined) => {
          if (!actual || !expected) return 'N/A';
          return new Date(actual) <= new Date(expected);
        };

        fetchedAssets.forEach(asset => {
          if (asset.inputCompletedDate) derivedOps.push({ date: asset.inputCompletedDate, assetId: asset.id, onTime: checkOnTime(asset.inputCompletedDate, asset.inputExpectedDate), type: 'Milestone', timestamp: new Date(asset.inputCompletedDate).getTime() });
          if (asset.firstPassReceivedDate) derivedOps.push({ date: asset.firstPassReceivedDate, assetId: asset.id, onTime: checkOnTime(asset.firstPassReceivedDate, asset.firstPassExpectedDate), type: 'Milestone', timestamp: new Date(asset.firstPassReceivedDate).getTime() });
          if (asset.finalVersionReceivedDate) derivedOps.push({ date: asset.finalVersionReceivedDate, assetId: asset.id, onTime: checkOnTime(asset.finalVersionReceivedDate, asset.finalVersionExpectedDate), type: 'Milestone', timestamp: new Date(asset.finalVersionReceivedDate).getTime() });
        });

        fetchedVersions.forEach(v => {
          const asset = fetchedAssets.find(a => a.id === v.assetId);
          if (!asset) return;
          let expectedDate = asset.finalVersionExpectedDate;
          if (v.stage === "Base input" || v.stage === "Grey scale Model(1st pass)") expectedDate = asset.firstPassExpectedDate;
          if (v.stage === "Texture") expectedDate = asset.greyScaleExpectedDate;
          const actualDateStr = new Date(v.createdAt).toISOString().split('T')[0];
          derivedOps.push({ date: actualDateStr, assetId: v.assetId, onTime: checkOnTime(actualDateStr, expectedDate), type: 'Upload', timestamp: v.createdAt });
        });

        setOps(derivedOps);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateProgress = (asset: Asset) => {
    let milestones = 0;
    if (asset.bmApproved) milestones++;
    if (asset.fpApproved) milestones++;
    if (asset.gsApproved) milestones++;
    if (asset.finalApproved) milestones++;
    if (asset.status === "Approved") milestones++;
    return Math.round((milestones / 5) * 100);
  };

  const groupAssets = () => {
    const groups: Record<string, Asset[]> = {
      Primary: [],
      Secondary: [],
      Inhouse: []
    };
    assets.forEach(a => {
      if (a.studio === 'Inhouse') {
        groups.Inhouse.push(a);
      } else if (a.priority === 'Primary') {
        groups.Primary.push(a);
      } else {
        groups.Secondary.push(a);
      }
    });
    return groups;
  };

  const getEfficiencyData = () => {
    const validOps = ops.filter(o => o.onTime !== 'N/A');
    const onTime = validOps.filter(o => o.onTime === true).length;
    const delayed = validOps.filter(o => o.onTime === false).length;
    return [
      { name: 'On Time', value: onTime, color: '#10b981' },
      { name: 'Delayed', value: delayed, color: '#ef4444' }
    ];
  };

  const getActivityData = () => {
    const days: Record<string, number> = {};
    const last14Days = [...Array(14)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    last14Days.forEach(day => days[day] = 0);
    ops.forEach(o => { if (days[o.date] !== undefined) days[o.date]++; });
    return last14Days.map(day => ({ date: day.split('-').slice(1).join('/'), events: days[day] }));
  };

  const efficiencyRate = ops.filter(o => o.onTime !== 'N/A').length > 0
    ? Math.round((ops.filter(o => o.onTime === true).length / ops.filter(o => o.onTime !== 'N/A').length) * 100)
    : 0;

  const stats = [
    { label: "Pipeline Efficiency", value: `${efficiencyRate}%`, icon: Zap, color: "text-yellow-500" },
    { label: "Active Characters", value: assets.length, icon: Package, color: "text-blue-500" },
    { label: "Total Milestones", value: ops.length, icon: Activity, color: "text-purple-500" },
    { label: "Artists", value: new Set(assets.flatMap(a => a.assignedArtists || [])).size, icon: Users, color: "text-emerald-500" }
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-10 h-10 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="text-blue-500 font-bold tracking-widest text-[10px]">Processing Pipeline Data...</span>
    </div>
  );

  const artistList = Array.from(new Set(assets.flatMap(a => a.assignedArtists || []))).sort();
  const assetGroups = groupAssets();

  return (
    <div className="max-w-full mx-auto px-4 py-12 custom-scrollbar">
      <div className="max-w-7xl mx-auto mb-6">
        <Link href="/" className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-blue-500 uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
        </Link>
      </div>
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-1 bg-blue-600 rounded-full"></div>
          <span className="text-blue-500 font-bold uppercase tracking-widest text-[10px]">Strategic Analytics</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white leading-tight uppercase">
          Pipeline <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Intelligence</span>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="cinematic-glass p-6 rounded-2xl border border-white/5"
          >
            <div className={`p-3 rounded-xl bg-white/5 inline-flex mb-4 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-black text-white mb-1">{stat.value}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Artist Intelligence Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-emerald-600 rounded-full"></div>
            <span className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">Team Analytics</span>
          </div>
          <h2 className="text-3xl font-bold text-white uppercase tracking-tight">Artist Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {artistList.map((artist, idx) => {
            const artistAssets = assets.filter(a => a.assignedArtists?.includes(artist));
            const artistOps = ops.filter(o => {
              const a = assets.find(as => as.id === o.assetId);
              return a?.assignedArtists?.includes(artist);
            });

            const efficiency = artistOps.filter(o => o.onTime !== 'N/A').length > 0
              ? Math.round((artistOps.filter(o => o.onTime === true).length / artistOps.filter(o => o.onTime !== 'N/A').length) * 100)
              : 0;

            const active = artistAssets.filter(a => a.status !== 'Approved' && a.status !== 'Completed');
            const completed = artistAssets.filter(a => a.status === 'Approved' || a.status === 'Completed');

            return (
              <motion.div
                key={artist}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="cinematic-glass p-6 rounded-3xl border border-white/5 flex flex-col group hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white uppercase truncate group-hover:text-emerald-400 transition-colors">{artist}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${efficiency >= 80 ? 'bg-emerald-500' : efficiency >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{efficiency}% Efficiency</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-lg font-black text-white tabular-nums">{active.length}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Active</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-lg font-black text-blue-400 tabular-nums">{completed.length}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Done</div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Current Focus</div>
                  {active.length === 0 ? (
                    <div className="text-[8px] text-slate-700 italic font-bold uppercase">All tasks cleared</div>
                  ) : (
                    active.slice(0, 3).map(asset => {
                      const progress = calculateProgress(asset);
                      return (
                        <div 
                          key={asset.id} 
                          onClick={() => window.location.href = `/assets/${asset.id}`}
                          className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/5 hover:bg-emerald-500/10 transition-colors cursor-pointer group/item"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-white font-bold truncate mr-2">{asset.name}</span>
                            <span className="text-blue-500 font-black shrink-0">{progress}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className="h-full bg-blue-500 group-hover/item:bg-emerald-500 transition-colors"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                  {active.length > 3 && (
                    <div className="text-[8px] text-slate-600 font-bold uppercase text-center pt-1">+{active.length - 3} more assets</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reviewer Intelligence Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-blue-600 rounded-full"></div>
            <span className="text-blue-500 font-bold uppercase tracking-widest text-[10px]">Quality Control</span>
          </div>
          <h2 className="text-3xl font-bold text-white uppercase tracking-tight">Reviewer Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {team.filter(m => m.role === 'Reviewer').map((reviewer, idx) => {
            const reviewsDone = versions.filter(v => 
              v.reviewerId === reviewer.id || 
              v.reviewerModelId === reviewer.id || 
              v.reviewerRigId === reviewer.id
            ).sort((a, b) => (b.reviewedAt || b.createdAt) - (a.reviewedAt || a.createdAt));

            const approvals = reviewsDone.filter(v => {
              if (v.stage === 'Final Package') {
                return (v.reviewerModelId === reviewer.id && v.statusModel === 'Approved') || 
                       (v.reviewerRigId === reviewer.id && v.statusRig === 'Approved');
              }
              return v.status === 'Approved';
            }).length;

            const rate = reviewsDone.length > 0 ? Math.round((approvals / reviewsDone.length) * 100) : 0;

            return (
              <motion.div
                key={reviewer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="cinematic-glass p-6 rounded-3xl border border-white/5 flex flex-col group hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white uppercase truncate group-hover:text-blue-400 transition-colors">{reviewer.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Lead Reviewer</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-lg font-black text-white tabular-nums">{reviewsDone.length}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Reviews</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-lg font-black text-emerald-400 tabular-nums">{approvals}</div>
                    <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Approvals</div>
                  </div>
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Recent Activity</div>
                  {reviewsDone.length === 0 ? (
                    <div className="text-[8px] text-slate-700 italic font-bold uppercase text-center py-4">No reviews logged</div>
                  ) : (
                    reviewsDone.slice(0, 3).map(v => {
                      const asset = assets.find(a => a.id === v.assetId);
                      const isModelReview = v.reviewerModelId === reviewer.id;
                      const specificStatus = v.stage === 'Final Package' ? (isModelReview ? v.statusModel : v.statusRig) : v.status;
                      
                      return (
                        <div 
                          key={v.id} 
                          onClick={() => window.location.href = `/assets/${v.assetId}`}
                          className="flex flex-col gap-1 p-2 rounded-xl bg-white/5 hover:bg-blue-500/10 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-white font-bold truncate mr-2">{asset?.name || "Unknown"}</span>
                            <span className={`text-[8px] font-black uppercase ${
                              specificStatus === 'Approved' ? 'text-emerald-500' : 
                              specificStatus === 'Corrections Needed' ? 'text-orange-500' : 'text-blue-500'
                            }`}>
                              {specificStatus === 'Approved' ? 'Pass' : specificStatus === 'Corrections Needed' ? 'Rework' : 'Pending'}
                            </span>
                          </div>
                          <div className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter">
                            {v.stage} {v.stage === 'Final Package' ? (isModelReview ? '(Model)' : '(Rig)') : ''} • V{v.versionNumber}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Global Team Metrics Table */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-purple-600 rounded-full"></div>
            <span className="text-purple-500 font-bold uppercase tracking-widest text-[10px]">Workforce Performance</span>
          </div>
          <h2 className="text-3xl font-bold text-white uppercase tracking-tight">Global Team Metrics</h2>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cinematic-glass rounded-[32px] border border-white/5 overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Team Member</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Involvement</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Workload</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Deliverables</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">On Time</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Delayed</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Reworks</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {team.sort((a, b) => a.name.localeCompare(b.name)).map((member) => {
                  const memberAssets = assets.filter(a => a.assignedArtists?.includes(member.name));
                  const memberReviews = versions.filter(v => v.reviewerId === member.id || v.reviewerModelId === member.id || v.reviewerRigId === member.id);
                  
                  // Complete list of involved assets throughout production lifetime
                  const uniqueAssetIds = new Set([
                    ...memberAssets.map(a => a.id),
                    ...memberReviews.map(v => v.assetId)
                  ]);
                  const uniqueInvolvedAssets = assets.filter(a => uniqueAssetIds.has(a.id));

                  const memberOps = ops.filter(o => {
                    const a = assets.find(as => as.id === o.assetId);
                    if (member.role === 'Artist') return a?.assignedArtists?.includes(member.name);
                    if (member.role === 'Reviewer') {
                      const v = versions.find(ver => ver.assetId === o.assetId && new Date(ver.createdAt).toISOString().split('T')[0] === o.date);
                      return v?.reviewerId === member.id || v?.reviewerModelId === member.id || v?.reviewerRigId === member.id;
                    }
                    return false;
                  });

                  const active = memberAssets.filter(a => a.status !== 'Approved' && a.status !== 'Completed').length;
                  const done = memberAssets.filter(a => a.status === 'Approved' || a.status === 'Completed').length;
                  
                  const validOps = memberOps.filter(o => o.onTime !== 'N/A');
                  const onTime = validOps.filter(o => o.onTime === true).length;
                  const delayed = validOps.filter(o => o.onTime === false).length;

                  // Quality Metrics
                  const reworks = member.role === 'Artist' 
                    ? versions.filter(v => {
                        const a = assets.find(as => as.id === v.assetId);
                        return a?.assignedArtists?.includes(member.name) && v.status === 'Corrections Needed';
                      }).length
                    : memberReviews.filter(v => {
                        if (v.stage === 'Final Package') {
                          return (v.reviewerModelId === member.id && v.statusModel === 'Corrections Needed') || 
                                 (v.reviewerRigId === member.id && v.statusRig === 'Corrections Needed');
                        }
                        return v.status === 'Corrections Needed';
                      }).length;
                  
                  const efficiency = validOps.length > 0 ? Math.round((onTime / validOps.length) * 100) : 0;

                  return (
                    <Fragment key={member.id}>
                      <tr className="group hover:bg-white/[0.02] transition-all">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              member.role === 'Reviewer' ? 'bg-blue-500/10 text-blue-500' : 
                              member.role === 'Ops' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {member.role === 'Reviewer' ? <ShieldCheck className="w-5 h-5" /> : member.role === 'Ops' ? <Activity className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="text-sm font-black text-white uppercase tracking-tight group-hover:text-purple-400 transition-colors">{member.name}</div>
                              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">{member.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-bold text-white tabular-nums">{memberAssets.length + memberReviews.length}</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase ml-2">Total</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <div className="text-center">
                              <div className="text-sm font-bold text-blue-400 tabular-nums">{active}</div>
                              <div className="text-[7px] font-black text-slate-600 uppercase">Active</div>
                            </div>
                            <div className="w-px h-4 bg-white/5"></div>
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-400 tabular-nums">{done}</div>
                              <div className="text-[7px] font-black text-slate-600 uppercase">Done</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-sm font-bold text-slate-300 tabular-nums">{memberOps.length}</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase ml-2">Ops</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] font-black text-emerald-500 tabular-nums">{onTime}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-black text-red-500 tabular-nums">{delayed}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                            <span className="text-[10px] font-black text-orange-500 tabular-nums">{reworks}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <div className={`text-lg font-black tabular-nums ${
                              efficiency >= 85 ? 'text-emerald-500' : efficiency >= 60 ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                              {efficiency}%
                            </div>
                            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${efficiency}%` }}
                                className={`h-full ${
                                  efficiency >= 85 ? 'bg-emerald-500' : efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Assets Involvement Sub-row */}
                      <tr className="bg-white/[0.01]">
                        <td colSpan={8} className="px-8 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mr-2">Lifetime Involvement:</span>
                            {uniqueInvolvedAssets.length === 0 ? (
                              <span className="text-[8px] text-slate-700 font-bold uppercase italic">No records detected</span>
                            ) : (
                              uniqueInvolvedAssets.map(asset => (
                                <Link 
                                  key={asset.id} 
                                  href={`/assets/${asset.id}`}
                                  className={`text-[7px] font-black px-2 py-0.5 rounded-md border transition-all hover:border-blue-500/50 ${
                                    asset.status === 'Approved' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
                                    asset.status === 'Final Review' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
                                    'text-slate-400 border-white/5 bg-white/5'
                                  }`}
                                >
                                  {asset.name}
                                </Link>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Grouped Asset Progression Tables */}
      <div className="max-w-7xl mx-auto space-y-16 mb-16">
        {Object.entries(assetGroups).map(([groupName, groupAssets], idx) => (
          <div key={groupName} className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-1 rounded-full ${
                    groupName === 'Primary' ? 'bg-orange-500' : 
                    groupName === 'Inhouse' ? 'bg-emerald-500' : 
                    'bg-blue-500'
                  }`}></div>
                  <span className={`font-bold uppercase tracking-widest text-[10px] ${
                    groupName === 'Primary' ? 'text-orange-500' : 
                    groupName === 'Inhouse' ? 'text-emerald-500' : 
                    'text-blue-500'
                  }`}>{groupName === 'Inhouse' ? 'Studio Internal' : `${groupName} Priority`}</span>
                </div>
                <h2 className="text-3xl font-bold text-white uppercase tracking-tight">
                  {groupName === 'Inhouse' ? 'Inhouse Progression' : `${groupName} Asset Flow`}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white tabular-nums">{groupAssets.length}</div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-right">Total Entries</div>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="cinematic-glass rounded-[32px] border border-white/5 overflow-hidden shadow-2xl"
            >
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <th className="px-8 py-6 w-[250px]">Asset Name</th>
                      <th className="px-6 py-6 text-center">Current Status</th>
                      <th className="px-6 py-6 text-center w-[350px]">Production Progress</th>
                      <th className="px-6 py-6 text-center">Lead Artist</th>
                      <th className="px-8 py-6 text-right">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {groupAssets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-slate-700 font-bold uppercase tracking-widest text-[10px]">
                          No assets detected in this category
                        </td>
                      </tr>
                    ) : (
                      groupAssets.sort((a, b) => calculateProgress(b) - calculateProgress(a)).map((asset) => {
                        const progress = calculateProgress(asset);
                        return (
                          <tr 
                            key={asset.id} 
                            className="group hover:bg-white/[0.02] transition-all cursor-pointer"
                            onClick={() => window.location.href = `/assets/${asset.id}`}
                          >
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-tight group-hover:text-orange-400 transition-colors">{asset.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{asset.type}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{asset.studio}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
                                asset.status === 'Approved' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
                                asset.status === 'Final Review' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
                                'text-slate-400 border-white/5 bg-white/5'
                              }`}>
                                {asset.status}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-2">
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className={`h-full absolute top-0 left-0 ${
                                      progress === 100 ? 'bg-emerald-500' : 
                                      groupName === 'Primary' ? 'bg-orange-500' : 'bg-blue-500'
                                    }`}
                                  />
                                </div>
                                <div className="flex justify-between gap-1">
                                  {['INPUT', '1P', 'TEX', 'FP', 'DONE'].map((m, i) => {
                                    const approved = [asset.bmApproved, asset.fpApproved, asset.gsApproved, asset.finalApproved, asset.status === 'Approved'][i];
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
                            <td className="px-6 py-5 text-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.assignedArtists?.[0] || "—"}</span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span className={`text-sm font-black tabular-nums ${progress === 100 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                {Math.round(progress)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 cinematic-glass p-8 rounded-3xl border border-white/5 h-[400px] flex flex-col"
        >
          <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-8">Operational Velocity (Last 14 Days)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getActivityData()}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="events" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEvents)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cinematic-glass p-8 rounded-3xl border border-white/5 h-[400px] flex flex-col"
        >
          <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-8">Delivery Timeliness</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getEfficiencyData().filter(d => d.value > 0)}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getEfficiencyData().filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
