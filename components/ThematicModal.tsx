"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, HelpCircle, CheckCircle } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  type?: "info" | "confirm" | "danger" | "prompt";
  onConfirm?: (inputValue?: string) => void;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  inputType?: string;
}

export default function ThematicModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  type = "info",
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  placeholder = "Enter value...",
  inputType = "text",
}: ModalProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case "confirm":
        return <HelpCircle className="w-6 h-6 text-orange-500" />;
      case "prompt":
        return <HelpCircle className="w-6 h-6 text-blue-500" />;
      default:
        return <CheckCircle className="w-6 h-6 text-emerald-500" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case "danger":
        return "bg-red-600";
      case "confirm":
        return "bg-orange-600";
      case "prompt":
        return "bg-blue-600";
      default:
        return "bg-emerald-600";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-slate-900 rounded-[32px] border border-white/10 shadow-2xl w-full max-w-md p-8 relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${getAccentColor()} rounded-xl flex items-center justify-center shadow-lg shadow-black/20`}>
                  {getIcon()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight leading-none">{title}</h2>
                  {description && <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mt-1.5">{description}</p>}
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-8">
              {children}
              {type === "prompt" && (
                <input
                  type={inputType}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-white font-bold focus:border-blue-500/50 outline-none transition placeholder:text-slate-700 mt-4"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onConfirm) onConfirm(inputValue);
                  }}
                />
              )}
            </div>

            <div className="flex gap-3">
              {(type === "confirm" || type === "danger" || type === "prompt") && (
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/5 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white/10 transition-all border border-white/5"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={() => {
                  if (onConfirm) onConfirm(type === "prompt" ? inputValue : undefined);
                  else onClose();
                }}
                className={`flex-[2] py-3 ${getAccentColor()} text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl transition-all hover:brightness-110 active:scale-[0.98]`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
