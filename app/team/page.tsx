"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TeamMember, TeamRole, VersionStage, ReviewerExpertise, GlobalSettings } from "@/types";
import { Plus, Users, Trash2, ShieldCheck, User, X, CheckCircle, AlertCircle, ArrowLeft, Edit2, Activity, Zap, Bell, BellOff, Settings, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

const VERSION_STAGES: VersionStage[] = ['Base input', 'Grey scale Model(1st pass)', 'Texture', 'Final Package'];
const EXPERTISE_OPTIONS: ReviewerExpertise[] = ['Model/Texture', 'Rig/Animation'];

export default function TeamManagement() {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ id: 'app_settings', slackNotificationsEnabled: true });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlackId, setNewSlackId] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("Artist");
  const [newSlackEnabled, setNewSlackEnabled] = useState(true);
  const [selectedStages, setSelectedStages] = useState<VersionStage[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<ReviewerExpertise[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);


  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Members
      const q = query(collection(db, "team_members"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetched: TeamMember[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ ...doc.data(), id: doc.id } as TeamMember);
      });
      setMembers(fetched);

      // Fetch Global Settings
      const settingsRef = doc(db, "settings", "app_settings");
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        setGlobalSettings(settingsSnap.data() as GlobalSettings);
      } else {
        // Initialize if missing
        await setDoc(settingsRef, { id: 'app_settings', slackNotificationsEnabled: true });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGlobalSlackToggle = async () => {
    if (!isAdmin) return;
    try {
      const newVal = !globalSettings.slackNotificationsEnabled;
      await setDoc(doc(db, "settings", "app_settings"), { 
        ...globalSettings, 
        slackNotificationsEnabled: newVal 
      });
      setGlobalSettings(prev => ({ ...prev, slackNotificationsEnabled: newVal }));
    } catch (err) {
      console.error("Error updating global settings:", err);
    }
  };

  const handleIndividualSlackToggle = async (member: TeamMember) => {
    if (!isAdmin) return;
    try {
      const newVal = member.slackEnabled === false ? true : false;
      await updateDoc(doc(db, "team_members", member.id), {
        slackEnabled: newVal
      });
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, slackEnabled: newVal } : m));
    } catch (err) {
      console.error("Error updating member slack setting:", err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !isAdmin) return;

    try {
      const memberData: any = {
        name: newName.trim(),
        role: newRole,
        slackId: newSlackId.trim(),
        slackEnabled: newSlackEnabled,
        active: true,
        updatedAt: Date.now(),
      };

      if (newRole === 'Reviewer') {
        memberData.reviewerStages = selectedStages;
        memberData.reviewerExpertise = selectedExpertise;
      }

      if (editingMemberId) {
        await updateDoc(doc(db, "team_members", editingMemberId), memberData);
      } else {
        await addDoc(collection(db, "team_members"), memberData);
      }

      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error("Error saving member:", err);
    }
  };

  const handleEditClick = (member: TeamMember) => {
    setNewName(member.name);
    setNewSlackId(member.slackId || "");
    setNewRole(member.role);
    setNewSlackEnabled(member.slackEnabled !== false);
    setSelectedStages(member.reviewerStages || []);
    setSelectedExpertise(member.reviewerExpertise || []);
    setEditingMemberId(member.id);
    setShowAddModal(true);
  };

  const handleDeleteMember = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Are you sure? This will permanently remove the member from the squad.")) return;
    try {
      await deleteDoc(doc(db, "team_members", id));
      fetchData();
    } catch (err) {
      console.error("Error deleting member:", err);
    }
  };

  const toggleMemberActive = async (member: TeamMember) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, "team_members", member.id), {
        active: !member.active
      });
      fetchData();
    } catch (err) {
      console.error("Error updating member:", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-12 pb-40"
    >
      <Link href="/" className="inline-flex items-center text-[10px] font-black text-slate-500 hover:text-saffron uppercase tracking-[0.2em] transition-colors mb-8">
        <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 bg-gradient-to-r from-saffron to-vermillion rounded-full"></div>
            <span className="text-saffron font-black uppercase tracking-[0.3em] text-[10px]">Guardians Council</span>
          </div>
          <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none font-serif">
            Squad <span className="text-divine">Intelligence</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Global Slack Toggle UI */}
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-[20px] px-6 py-3.5 shadow-xl">
            <div className={`p-2.5 rounded-xl ${globalSettings.slackNotificationsEnabled ? 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 text-red-500'}`}>
              {globalSettings.slackNotificationsEnabled ? <Bell className="w-5 h-5 animate-pulse" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Aether Alerts</span>
              <button 
                onClick={handleGlobalSlackToggle}
                disabled={!isAdmin}
                className={`text-[11px] font-black uppercase tracking-widest transition-colors ${!isAdmin ? 'opacity-50' : ''} ${globalSettings.slackNotificationsEnabled ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'}`}
              >
                {globalSettings.slackNotificationsEnabled ? 'SYSTEM ACTIVE' : 'SYSTEM MUTED'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setNewName("");
                setNewSlackId("");
                setNewRole("Artist");
                setNewSlackEnabled(true);
                setSelectedStages([]);
                setSelectedExpertise([]);
                setEditingMemberId(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-3 px-8 py-4 bg-orange-600 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-[0_10px_25px_rgba(227,66,52,0.3)] hover:bg-orange-500 transition-all font-serif"
            >
              <Plus className="w-5 h-5" />
              <span>Summon Guardian</span>
            </motion.button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="w-16 h-16 border-4 border-saffron/20 border-t-saffron rounded-full animate-spin"></div>
          <span className="text-saffron font-black tracking-[0.4em] text-xs uppercase animate-pulse">Convening the Council...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {members.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`epic-glass p-8 rounded-[40px] border group relative overflow-hidden transition-all ornate-border ${
                  member.active ? 'border-white/5 hover:border-gold/30' : 'border-red-500/10 grayscale opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-10">
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:rotate-6 ${
                      member.role === 'Reviewer' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_25px_rgba(59,130,246,0.15)]' : 
                      member.role === 'Ops' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-[0_0_25px_rgba(168,85,247,0.15)]' :
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                    }`}>
                      {member.role === 'Reviewer' ? <ShieldCheck className="w-8 h-8" /> : 
                       member.role === 'Ops' ? <Activity className="w-8 h-8" /> :
                       <User className="w-8 h-8" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-2 truncate group-hover:text-gold transition-colors">{member.name}</h3>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border ${
                          member.role === 'Reviewer' ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 
                          member.role === 'Ops' ? 'text-purple-400 border-purple-500/30 bg-purple-500/5' :
                          'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                        }`}>
                          {member.role}
                        </span>
                        
                        {/* Individual Slack Status */}
                        <button 
                          onClick={() => handleIndividualSlackToggle(member)}
                          disabled={!isAdmin}
                          title={member.slackEnabled === false ? "Slack Muted" : "Slack Active"}
                          className={`p-1.5 rounded-lg transition-all ${!isAdmin ? 'cursor-default' : 'hover:bg-white/10'} ${member.slackEnabled === false ? 'text-red-500' : 'text-emerald-500'}`}
                        >
                          {member.slackEnabled === false ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditClick(member)}
                        className="p-2.5 text-slate-500 hover:text-gold hover:bg-gold/10 rounded-xl transition-all"
                        title="Edit Guardian"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleMemberActive(member)}
                        className={`p-2.5 rounded-xl transition-all ${member.active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-500/10'}`}
                      >
                        <CheckCircle className={`w-5 h-5 ${member.active ? 'fill-emerald-500/20' : ''}`} />
                      </button>
                      <button 
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2.5 text-slate-500 hover:text-vermillion hover:bg-vermillion/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">Endowments</span>
                    <div className="flex flex-wrap gap-2">
                      {member.role === 'Artist' ? (
                        <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 uppercase tracking-widest">CREATION OF LEGENDS</span>
                      ) : (
                        member.reviewerStages?.map(s => (
                          <span key={s} className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20 uppercase tracking-widest">{s}</span>
                        ))
                      )}
                      {member.reviewerExpertise?.map(e => (
                        <span key={e} className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 uppercase tracking-widest">{e}</span>
                      ))}
                      {member.slackId && (
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                          ID: {member.slackId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!member.active && (
                  <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                    <AlertCircle className="w-4 h-4" />
                    In Eternal Slumber
                  </div>
                )}

                {/* Decorative background element */}
                <div className={`absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-700 group-hover:scale-110 ${
                  member.role === 'Reviewer' ? 'text-blue-500' : 
                  member.role === 'Ops' ? 'text-purple-500' :
                  'text-emerald-500'
                }`}>
                   {member.role === 'Reviewer' ? <ShieldCheck className="w-full h-full" /> : 
                    member.role === 'Ops' ? <Activity className="w-full h-full" /> :
                    <User className="w-full h-full" />}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="epic-glass w-full max-w-lg p-10 rounded-[40px] border border-white/10 relative z-10 shadow-2xl ornate-border"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-900/30">
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight font-serif">{editingMemberId ? 'Edit Guardian' : 'Summon Guardian'}</h2>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-500 hover:text-white transition">
                  <X className="w-7 h-7" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Guardian Name</label>
                    <input
                      autoFocus
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-gold/50 transition-colors uppercase tracking-widest placeholder:text-slate-800 shadow-inner"
                      placeholder="Enter name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Aether ID (Slack)</label>
                    <input
                      type="text"
                      value={newSlackId}
                      onChange={(e) => setNewSlackId(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-gold/50 transition-colors uppercase tracking-widest placeholder:text-slate-800 shadow-inner"
                      placeholder="U12345678"
                    />
                  </div>

                  <div className="flex items-center gap-4 self-end pb-3">
                    <button
                      type="button"
                      onClick={() => setNewSlackEnabled(!newSlackEnabled)}
                      className={`p-4 rounded-2xl border transition-all ${newSlackEnabled ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 border-red-500 text-red-500'}`}
                    >
                      {newSlackEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </button>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Oracle Alert</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Divine Core Role</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Artist', 'Reviewer', 'Ops'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewRole(r as TeamRole)}
                        className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          newRole === r ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(255,153,51,0.15)]' : 'bg-white/[0.03] border-white/5 text-slate-600 hover:border-white/20'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {newRole === 'Reviewer' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Vigilance Stages</label>
                      <div className="grid grid-cols-2 gap-3">
                        {VERSION_STAGES.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setSelectedStages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                            }}
                            className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase text-left transition-all ${
                              selectedStages.includes(s) ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-white/[0.03] border-white/5 text-slate-700'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-1">Aura Expertise</label>
                      <div className="grid grid-cols-2 gap-3">
                        {EXPERTISE_OPTIONS.map(e => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => {
                              setSelectedExpertise(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
                            }}
                            className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase text-left transition-all ${
                              selectedExpertise.includes(e) ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white/[0.03] border-white/5 text-slate-700'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full py-5 bg-orange-600 text-white font-black uppercase tracking-[0.3em] text-xs rounded-[20px] shadow-xl shadow-orange-900/30 hover:bg-orange-500 transition-all mt-6 active:scale-[0.98] font-serif"
                >
                  {editingMemberId ? 'Seal Covenant' : 'Confirm Summoning'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
