import { z } from "zod";

const ThoughtSchema = z
  .object({
    thoughtSummary: z
      .string()
      .max(600)
      .describe(
        "Short user-safe reasoning summary. Do not include hidden chain-of-thought.",
      )
      .optional(),
  })
  .strict();

export const NavigateActionSchema = ThoughtSchema.extend({
  type: z.literal("navigate"),
  url: z.string().min(1),
});

export const SearchWebActionSchema = ThoughtSchema.extend({
  type: z.literal("search_web"),
  query: z.string().min(1),
});

const TargetFields = {
  snapshotId: z.string().min(1),
  target: z.number().int().positive(),
};

export const ClickActionSchema = ThoughtSchema.extend({
  type: z.literal("click"),
  ...TargetFields,
});

export const TypeActionSchema = ThoughtSchema.extend({
  type: z.literal("type"),
  ...TargetFields,
  text: z.string().min(1),
  submit: z.literal(false).optional(),
});

export const SelectActionSchema = ThoughtSchema.extend({
  type: z.literal("select"),
  ...TargetFields,
  option: z.string().min(1).max(500),
});
export const BackActionSchema = ThoughtSchema.extend({
  type: z.literal("back"),
  snapshotId: z.string().min(1),
  url: z.string().min(1),
});
export const OpenTabActionSchema = ThoughtSchema.extend({
  type: z.literal("open_tab"),
  snapshotId: z.string().min(1),
  url: z.string().min(1),
});
export const SwitchTabActionSchema = ThoughtSchema.extend({
  type: z.literal("switch_tab"),
  snapshotId: z.string().min(1),
  tabId: z.string().min(1),
});
export const CloseTabActionSchema = ThoughtSchema.extend({
  type: z.literal("close_tab"),
  snapshotId: z.string().min(1),
  tabId: z.string().min(1),
});

export const PressActionSchema = ThoughtSchema.extend({
  type: z.literal("press"),
  ...TargetFields,
  key: z.enum([
    "Enter",
    "Space",
    "Escape",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ]),
});

export const WaitActionSchema = ThoughtSchema.extend({
  type: z.literal("wait"),
  ms: z.number().int().min(50).max(30000),
});

export const ExtractTextActionSchema = ThoughtSchema.extend({
  type: z.literal("extract_text"),
});

export const SummarizePageActionSchema = ThoughtSchema.extend({
  type: z.literal("summarize_page"),
});

export const ScrollActionSchema = ThoughtSchema.extend({
  type: z.literal("scroll"),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number().int().min(50).max(5000).default(700),
});

export const ScreenshotActionSchema = ThoughtSchema.extend({
  type: z.literal("screenshot"),
});

export const AskUserActionSchema = ThoughtSchema.extend({
  type: z.literal("ask_user"),
  question: z.string().min(1),
});

// A result names captured data only; it carries no action or permission.
export const PageMatchSchema = z.union([
  z
    .object({
      snapshotId: z.string().min(1),
      target: z.number().int().positive(),
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      snapshotId: z.string().min(1),
      passageId: z.string().min(1),
      reason: z.string().min(1).max(500),
    })
    .strict(),
]);
export const PageFindSchema = z.union([
  z
    .object({
      outcome: z.literal("matches"),
      confidence: z.number().min(0).max(1).optional(),
      matches: z.array(PageMatchSchema).min(1).max(3),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("no-match"),
      reason: z.string().min(1).max(500),
    })
    .strict(),
]);

export const FinishActionSchema = ThoughtSchema.extend({
  type: z.literal("finish"),
  answer: z.string().min(1),
  pageFind: PageFindSchema.optional(),
  evidence: z
    .array(
      z
        .object({
          snapshotId: z.string().min(1),
          passageId: z.string().min(1).optional(),
          quote: z.string().min(1).max(2000),
        })
        .strict(),
    )
    .max(8)
    .optional(),
});

export const FailActionSchema = ThoughtSchema.extend({
  type: z.literal("fail"),
  reason: z.string().min(1),
});

export const BrowserActionSchema = z.union([
  NavigateActionSchema,
  SearchWebActionSchema,
  ClickActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  BackActionSchema,
  OpenTabActionSchema,
  SwitchTabActionSchema,
  CloseTabActionSchema,
  PressActionSchema,
  WaitActionSchema,
  ExtractTextActionSchema,
  SummarizePageActionSchema,
  ScrollActionSchema,
  ScreenshotActionSchema,
  AskUserActionSchema,
  FinishActionSchema,
  FailActionSchema,
]);

export type BrowserAction = z.infer<typeof BrowserActionSchema>;

export const ModelActionResponseSchema = BrowserActionSchema;

export type ModelActionResponse = z.infer<typeof ModelActionResponseSchema>;
