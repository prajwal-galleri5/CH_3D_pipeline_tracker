"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TeamMember, TeamRole, VersionStage, ReviewerExpertise } from "@/types";
import { Plus, Users, Trash2, ShieldCheck, User, X, CheckCircle, AlertCircle, ArrowLeft, Edit2, Activity, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const VERSION_STAGES: VersionStage[] = ['Base input', 'Grey scale Model(1st pass)', 'Texture', 'Final Package'];
const EXPERTISE_OPTIONS: ReviewerExpertise[] = ['Model/Texture', 'Rig/Animation'];

export default function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlackId, setNewSlackId] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("Artist");
  const [selectedStages, setSelectedStages] = useState<VersionStage[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<ReviewerExpertise[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);


  const fetchMembers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "team_members"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetched: TeamMember[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      setMembers(fetched);
    } catch (err) {
      console.error("Error fetching team members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    try {
      if (editingMemberId) {
        await updateDoc(doc(db, "team_members", editingMemberId), {
          name: newName,
          role: newRole,
          slackId: newSlackId,
          reviewerStages: newRole === 'Reviewer' ? selectedStages : [],
          reviewerExpertise: newRole === 'Reviewer' ? selectedExpertise : [],
        });
      } else {
        await addDoc(collection(db, "team_members"), {
          name: newName,
          role: newRole,
          slackId: newSlackId,
          active: true,
          reviewerStages: newRole === 'Reviewer' ? selectedStages : [],
          reviewerExpertise: newRole === 'Reviewer' ? selectedExpertise : [],
        });
      }
      setNewName("");
      setNewSlackId("");
      setSelectedStages([]);
      setSelectedExpertise([]);
      setEditingMemberId(null);
      setShowAddModal(false);
      fetchMembers();
    } catch (err) {
      console.error("Error saving member:", err);
    }
  };

  const handleEditClick = (member: TeamMember) => {
    setNewName(member.name);
    setNewSlackId(member.slackId || "");
    setNewRole(member.role);
    setSelectedStages(member.reviewerStages || []);
    setSelectedExpertise(member.reviewerExpertise || []);
    setEditingMemberId(member.id);
    setShowAddModal(true);
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await deleteDoc(doc(db, "team_members", id));
      fetchMembers();
    } catch (err) {
      console.error("Error deleting member:", err);
    }
  };

  const toggleMemberActive = async (member: TeamMember) => {
    try {
      await updateDoc(doc(db, "team_members", member.id), {
        active: !member.active
      });
      fetchMembers();
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
      <div className="flex justify-between items-end mb-12">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
            <span className="text-orange-500 font-bold uppercase tracking-widest text-[10px]">Operations</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
            Team <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Management</span>
          </h1>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setNewName("");
            setNewSlackId("");
            setNewRole("Artist");
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
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 border-2 border-orange-600/20 border-t-orange-600 rounded-full animate-spin"></div>
          <span className="text-orange-500 font-bold tracking-widest text-[10px] animate-pulse">Synchronizing Team Data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {members.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`cinematic-glass p-6 rounded-2xl border ${member.active ? 'border-white/10' : 'border-white/5 opacity-60'} group relative overflow-hidden`}
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      member.role === 'Reviewer' ? 'bg-blue-500/20 text-blue-400' : 
                      member.role === 'Ops' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {member.role === 'Reviewer' ? <ShieldCheck className="w-6 h-6" /> : 
                       member.role === 'Ops' ? <Activity className="w-6 h-6" /> :
                       <User className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{member.name}</h3>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                          member.role === 'Reviewer' ? 'text-blue-500' : 
                          member.role === 'Ops' ? 'text-purple-500' :
                          'text-emerald-500'
                        }`}>
                          {member.role}
                        </span>
                        {member.role === 'Reviewer' && member.reviewerStages && member.reviewerStages.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {member.reviewerStages.map(s => (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[7px] font-bold uppercase tracking-widest">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {member.role === 'Reviewer' && member.reviewerExpertise && member.reviewerExpertise.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {member.reviewerExpertise.map(e => (
                              <span key={e} className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[7px] font-bold uppercase tracking-widest">
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                        {member.slackId && (
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            Slack: {member.slackId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
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
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                    placeholder="Enter artist or reviewer name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Slack User ID (Optional)</label>
                  <input
                    type="text"
                    value={newSlackId}
                    onChange={(e) => setNewSlackId(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                    placeholder="Example: U12345678"
                  />
                  <p className="mt-1.5 text-[7px] text-slate-600 font-bold uppercase tracking-widest">Find this in Slack: Profile &gt; More &gt; Copy member ID</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewRole("Artist");
                        setSelectedStages([]);
                      }}
                      className={`py-3 rounded-xl border text-[10px] font-bold transition-all ${newRole === 'Artist' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
                    >
                      Artist
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewRole("Reviewer");
                        setSelectedStages([...VERSION_STAGES]);
                      }}
                      className={`py-3 rounded-xl border text-[10px] font-bold transition-all ${newRole === 'Reviewer' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
                    >
                      Reviewer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewRole("Ops");
                        setSelectedStages([]);
                      }}
                      className={`py-3 rounded-xl border text-[10px] font-bold transition-all ${newRole === 'Ops' ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
                    >
                      Ops
                    </button>
                  </div>
                </div>

                {newRole === 'Reviewer' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-2"
                  >
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Stages</label>
                    <div className="grid grid-cols-2 gap-2">
                      {VERSION_STAGES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSelectedStages(prev => 
                              prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                            );
                          }}
                          className={`px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all ${
                            selectedStages.includes(s) 
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                              : 'bg-white/[0.03] border-white/10 text-slate-500'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {newRole === 'Reviewer' && selectedStages.includes('Final Package') && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-2"
                  >
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Expertise (Final Package)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXPERTISE_OPTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setSelectedExpertise(prev => 
                              prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
                            );
                          }}
                          className={`px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all ${
                            selectedExpertise.includes(e) 
                              ? 'bg-orange-600/20 border-orange-500 text-orange-400' 
                              : 'bg-white/[0.03] border-white/10 text-slate-500'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={!newName || (newRole === 'Reviewer' && selectedStages.length === 0)}
                  className="w-full py-4 bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-900/20 transition-all active:scale-95"
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
