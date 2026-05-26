"use client";

import { create } from "zustand";
import type { AgentRun } from "@chromeclaw/shared";

interface ChromeClawState {
  task: string;
  activeRun?: AgentRun | undefined;
  runs: AgentRun[];
  isRunning: boolean;
  error?: string | undefined;
  setTask: (task: string) => void;
  setRun: (run?: AgentRun) => void;
  setRuns: (runs: AgentRun[]) => void;
  setRunning: (isRunning: boolean) => void;
  setError: (error?: string) => void;
}

export const useChromeClawStore = create<ChromeClawState>((set) => ({
  task: "Go to example.com and tell me the page title.",
  runs: [],
  isRunning: false,
  setTask: (task) => set({ task }),
  setRun: (activeRun) => set({ activeRun }),
  setRuns: (runs) => set({ runs }),
  setRunning: (isRunning) => set({ isRunning }),
  setError: (error) => set({ error })
}));
