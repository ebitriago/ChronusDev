"use client";

import { useState, useEffect } from "react";

interface TooltipProps {
    children: React.ReactNode;
    content: string;
    isOpen: boolean;
    onDismiss: () => void;
    placement?: "top" | "bottom" | "left" | "right";
}

export default function OnboardingTooltip({ children, content, isOpen, onDismiss, placement = "bottom" }: TooltipProps) {
    if (!isOpen) return <>{children}</>;

    return (
        <div className="relative inline-block z-50">
            {children}
            <div className={`absolute ${placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 w-64 p-4 bg-slate-900 text-white text-sm rounded-xl shadow-xl animate-bounce-in z-50`}>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45"></div>
                <p className="relative z-10 mb-3">{content}</p>
                <button
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider"
                >
                    Entendido
                </button>
            </div>
        </div>
    );
}
