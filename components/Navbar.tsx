"use client";

import Link from "next/link";
import { PackageSearch, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export function Navbar() {
  const { isAdmin, unlock, lock } = useAuth();

  const handleAdminToggle = () => {
    if (isAdmin) {
      lock();
    } else {
      const pass = prompt("Enter Admin Password to enable modifications:");
      if (pass) {
        if (!unlock(pass)) {
          alert("Incorrect password.");
        }
      }
    }
  };

  return (
    <nav className="border-b bg-black/50 backdrop-blur-md border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)] group-hover:scale-110 transition-transform">
                <PackageSearch className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-white tracking-tighter uppercase leading-tight">HANUMAN</span>
                <span className="text-[10px] font-black text-orange-500 tracking-[0.3em] uppercase leading-tight">Pipeline Terminal</span>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/inventory" className="text-[10px] font-black text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors">Library</Link>
            <Link href="/analytics" className="text-[10px] font-black text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors">Analytics</Link>
            <Link href="/tasks" className="text-[10px] font-black text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors">Ops Log</Link>
            <Link href="/team" className="text-[10px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-widest transition-colors">Team</Link>
            
            <button 
              onClick={handleAdminToggle}
              className={`p-2 rounded-lg transition-all ${isAdmin ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-600 hover:text-slate-400'}`}
              title={isAdmin ? "Admin Mode Active" : "Unlock Admin Mode"}
            >
              {isAdmin ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>

            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAdmin ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-emerald-500' : 'text-orange-500'}`}>
                  {isAdmin ? 'ADMIN ACCESS' : 'PROTECTED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
