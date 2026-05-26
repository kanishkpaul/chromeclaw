import { z } from "zod";

const ThoughtSchema = z
  .object({
    thoughtSummary: z
      .string()
      .max(600)
      .describe("Short user-safe reasoning summary. Do not include hidden chain-of-thought.")
      .optional()
  })
  .strict();

export const NavigateActionSchema = ThoughtSchema.extend({
  type: z.literal("navigate"),
  url: z.string().min(1)
});

export const SearchWebActionSchema = ThoughtSchema.extend({
  type: z.literal("search_web"),
  query: z.string().min(1)
});

export const ClickActionSchema = ThoughtSchema.extend({
  type: z.literal("click"),
  selector: z.string().optional(),
  text: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional()
}).refine((value) => value.selector || value.text || value.name, {
  message: "click requires selector, text, or name"
});

export const TypeActionSchema = ThoughtSchema.extend({
  type: z.literal("type"),
  selector: z.string().optional(),
  target: z.string().optional(),
  text: z.string().min(1),
  submit: z.boolean().optional()
}).refine((value) => value.selector || value.target, {
  message: "type requires selector or target"
});

export const PressActionSchema = ThoughtSchema.extend({
  type: z.literal("press"),
  key: z.string().min(1)
});

export const WaitActionSchema = ThoughtSchema.extend({
  type: z.literal("wait"),
  ms: z.number().int().min(50).max(30000)
});

export const ExtractTextActionSchema = ThoughtSchema.extend({
  type: z.literal("extract_text")
});

export const SummarizePageActionSchema = ThoughtSchema.extend({
  type: z.literal("summarize_page")
});

export const ScrollActionSchema = ThoughtSchema.extend({
  type: z.literal("scroll"),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number().int().min(50).max(5000).default(700)
});

export const ScreenshotActionSchema = ThoughtSchema.extend({
  type: z.literal("screenshot")
});

export const AskUserActionSchema = ThoughtSchema.extend({
  type: z.literal("ask_user"),
  question: z.string().min(1)
});

export const FinishActionSchema = ThoughtSchema.extend({
  type: z.literal("finish"),
  answer: z.string().min(1)
});

export const FailActionSchema = ThoughtSchema.extend({
  type: z.literal("fail"),
  reason: z.string().min(1)
});

export const BrowserActionSchema = z.union([
  NavigateActionSchema,
  SearchWebActionSchema,
  ClickActionSchema,
  TypeActionSchema,
  PressActionSchema,
  WaitActionSchema,
  ExtractTextActionSchema,
  SummarizePageActionSchema,
  ScrollActionSchema,
  ScreenshotActionSchema,
  AskUserActionSchema,
  FinishActionSchema,
  FailActionSchema
]);

export type BrowserAction = z.infer<typeof BrowserActionSchema>;

export const ModelActionResponseSchema = BrowserActionSchema;

export type ModelActionResponse = z.infer<typeof ModelActionResponseSchema>;
