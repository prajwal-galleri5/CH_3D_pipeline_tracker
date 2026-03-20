"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, BarChart3, Users, ShieldCheck, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { name: "SQUAD", href: "/", icon: LayoutDashboard },
  { name: "VAULT", href: "/inventory", icon: Package },
  { name: "ANALYSIS", href: "/analytics", icon: BarChart3 },
  { name: "HISTORY", href: "/tasks", icon: Activity },
  { name: "TEAM", href: "/team", icon: Users },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAdmin, lock } = useAuth();

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="epic-glass px-6 py-4 rounded-[32px] border border-white/10 flex items-center justify-between gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href} className="relative group px-3 py-2">
                <div className="flex flex-col items-center gap-1.5 transition-all duration-300">
                  <div className={`p-2 rounded-xl transition-all duration-500 ${
                    isActive 
                      ? "bg-orange-600/20 text-orange-400 shadow-[0_0_15px_rgba(255,153,51,0.2)]" 
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}>
                    <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                  </div>
                  <span className={`text-[9px] font-black tracking-widest uppercase transition-all duration-300 ${
                    isActive ? "text-orange-400 opacity-100" : "text-slate-600 opacity-0 group-hover:opacity-100"
                  }`}>
                    {item.name}
                  </span>
                </div>
                {isActive && (
                  <motion.div 
                    layoutId="nav-glow"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-orange-500 rounded-full blur-[2px]"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="pl-4 border-l border-white/10 ml-2">
            <button 
              onClick={lock}
              className="p-3 rounded-2xl bg-emerald-950/30 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all shadow-lg group"
              title="Admin Active - Click to Lock"
            >
              <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </motion.div>
    </nav>
  );
}
