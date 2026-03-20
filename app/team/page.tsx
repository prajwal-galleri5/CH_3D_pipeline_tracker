"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TeamMember, TeamRole, VersionStage, ReviewerExpertise, GlobalSettings } from "@/types";
import { Plus, Users, Trash2, ShieldCheck, User, X, CheckCircle, AlertCircle, ArrowLeft, Edit2, Activity, Zap, Bell, BellOff, Settings } from "lucide-react";
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
    if (!confirm("Are you sure? This will permanently remove the member.")) return;
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
      className="max-w-7xl mx-auto px-4 py-12"
    >
      <Link href="/" className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-orange-500 uppercase tracking-widest mb-6 transition-colors">
        <ArrowLeft className="w-3 h-3 mr-2" /> Back to Dashboard
      </Link>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
            <span className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Operations</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
            Team <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Management</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Global Slack Toggle UI */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
            <div className={`p-2 rounded-lg ${globalSettings.slackNotificationsEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {globalSettings.slackNotificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Global Slack Alerts</span>
              <button 
                onClick={handleGlobalSlackToggle}
                disabled={!isAdmin}
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${!isAdmin ? 'opacity-50' : ''} ${globalSettings.slackNotificationsEnabled ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'}`}
              >
                {globalSettings.slackNotificationsEnabled ? 'SYSTEM ACTIVE' : 'SYSTEM MUTED'}
              </button>
            </div>
          </div>

          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Add Member</span>
            </motion.button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 border-2 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
          <span className="text-orange-500 font-bold tracking-widest text-[10px] uppercase animate-pulse">Syncing Team Data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {members.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`cinematic-glass p-6 rounded-[32px] border group relative overflow-hidden transition-all ${
                  member.active ? 'border-white/5 hover:border-orange-500/30' : 'border-red-500/10 grayscale opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      member.role === 'Reviewer' ? 'bg-blue-500/10 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 
                      member.role === 'Ops' ? 'bg-purple-500/10 text-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.1)]' :
                      'bg-emerald-500/10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                    }`}>
                      {member.role === 'Reviewer' ? <ShieldCheck className="w-7 h-7" /> : 
                       member.role === 'Ops' ? <Activity className="w-7 h-7" /> :
                       <User className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-1">{member.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          member.role === 'Reviewer' ? 'text-blue-400 border-blue-500/30' : 
                          member.role === 'Ops' ? 'text-purple-400 border-purple-500/30' :
                          'text-emerald-400 border-emerald-500/30'
                        }`}>
                          {member.role}
                        </span>
                        
                        {/* Individual Slack Status */}
                        <button 
                          onClick={() => handleIndividualSlackToggle(member)}
                          disabled={!isAdmin}
                          title={member.slackEnabled === false ? "Slack Muted" : "Slack Active"}
                          className={`p-1 rounded-md transition-colors ${!isAdmin ? 'cursor-default' : 'hover:bg-white/10'} ${member.slackEnabled === false ? 'text-red-500' : 'text-emerald-500'}`}
                        >
                          {member.slackEnabled === false ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditClick(member)}
                        className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors"
                        title="Edit Member"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleMemberActive(member)}
                        className={`p-2 rounded-lg transition-colors ${member.active ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-500/10'}`}
                      >
                        <CheckCircle className={`w-5 h-5 ${member.active ? 'fill-emerald-500/20' : ''}`} />
                      </button>
                      <button 
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Capabilities</span>
                    <div className="flex flex-wrap gap-1.5">
                      {member.role === 'Artist' ? (
                        <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 uppercase">Production Assets</span>
                      ) : (
                        member.reviewerStages?.map(s => (
                          <span key={s} className="text-[9px] font-bold text-blue-400 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10 uppercase">{s}</span>
                        ))
                      )}
                      {member.reviewerExpertise?.map(e => (
                        <span key={e} className="text-[9px] font-bold text-purple-400 bg-purple-500/5 px-2 py-1 rounded-lg border border-purple-500/10 uppercase">{e}</span>
                      ))}
                      {member.slackId && (
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                          ID: {member.slackId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!member.active && (
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <AlertCircle className="w-3 h-3" />
                    Inactive
                  </div>
                )}

                {/* Decorative background element */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity ${
                  member.role === 'Reviewer' ? 'text-blue-500' : 
                  member.role === 'Ops' ? 'text-purple-500' :
                  'text-emerald-500'
                }`}>
                   {member.role === 'Reviewer' ? <ShieldCheck className="w-full h-full" /> : 
                    member.role === 'Ops' ? <Activity className="w-full h-full" /> :
                    <Users className="w-full h-full" />}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="cinematic-glass w-full max-w-md p-8 rounded-3xl border border-white/10 relative z-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">{editingMemberId ? 'Edit Team Member' : 'Add Team Member'}</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                    <input
                      autoFocus
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      placeholder="Enter name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Slack Member ID</label>
                    <input
                      type="text"
                      value={newSlackId}
                      onChange={(e) => setNewSlackId(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      placeholder="U12345678"
                    />
                  </div>

                  <div className="flex items-center gap-3 self-end pb-3">
                    <button
                      type="button"
                      onClick={() => setNewSlackEnabled(!newSlackEnabled)}
                      className={`p-3 rounded-xl border transition-all ${newSlackEnabled ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-red-500/10 border-red-500 text-red-500'}`}
                    >
                      {newSlackEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </button>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Slack Alert</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Core Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Artist', 'Reviewer', 'Ops'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewRole(r as TeamRole)}
                        className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                          newRole === r ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-white/5 border-white/5 text-slate-500'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {newRole === 'Reviewer' && (
                  <>
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assigned Review Stages</label>
                      <div className="grid grid-cols-2 gap-2">
                        {VERSION_STAGES.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setSelectedStages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                            }}
                            className={`py-2 px-3 rounded-lg border text-[8px] font-black uppercase text-left transition-all ${
                              selectedStages.includes(s) ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-600'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Final Pkg Expertise</label>
                      <div className="grid grid-cols-2 gap-2">
                        {EXPERTISE_OPTIONS.map(e => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => {
                              setSelectedExpertise(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
                            }}
                            className={`py-2 px-3 rounded-lg border text-[8px] font-black uppercase text-left transition-all ${
                              selectedExpertise.includes(e) ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-white/5 border-white/5 text-slate-600'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-orange-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-orange-900/20 hover:bg-orange-500 transition-all mt-4"
                >
                  {editingMemberId ? 'Save Changes' : 'Confirm Addition'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
