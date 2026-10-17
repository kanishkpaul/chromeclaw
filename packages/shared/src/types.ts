import type { z } from "zod";
import type {
  RunRecordSchema,
  StepRecordSchema,
  StatusSchema,
} from "./records";
export type AgentStatus = z.infer<typeof StatusSchema>;

export interface InteractiveElement {
  id: string;
  number?: number;
  documentId?: string;
  frameId?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  destination?: string | undefined;
  formDestination?: string | undefined;
  isEditable?: boolean;
  isDisabled?: boolean;
  isOccluded?: boolean;
  role?: string | undefined;
  name?: string | undefined;
  text?: string | undefined;
  selector?: string | undefined;
  tagName?: string | undefined;
  href?: string | undefined;
  isVisible: boolean;
  isCredential: boolean;
  score: number;
}

export interface BrowserObservation {
  snapshotId: string;
  documentId: string;
  omittedTargets?: number;
  unreadableFrames?: number;
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: InteractiveElement[];
  accessibilityTreeSummary: string;
  screenshotPath?: string | undefined;
  timestamp: string;
}

export type AgentStep = z.infer<typeof StepRecordSchema>;
export type AgentRun = z.infer<typeof RunRecordSchema>;

export interface RunMetrics {
  steps: number;
  durationMs: number;
  actions: number;
  errors: number;
}
