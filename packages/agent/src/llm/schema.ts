import { z } from "zod";
import { BrowserActionSchema } from "@chromeclaw/shared";

// The wire grammar constrains shape. Zod remains the authority for every refinement and bound.
function wireSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodOptional) return wireSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return wireSchema(schema.removeDefault());
  if (schema instanceof z.ZodLiteral) return { const: schema.value };
  if (schema instanceof z.ZodEnum)
    return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber)
    return { type: schema.isInt ? "integer" : "number" };
  if (schema instanceof z.ZodArray)
    return { type: "array", items: wireSchema(schema.element) };
  if (schema instanceof z.ZodUnion)
    return {
      anyOf: schema.options.map((option: z.ZodType) => wireSchema(option)),
    };
  if (schema instanceof z.ZodObject) {
    const shape: Record<string, z.ZodType> = schema.shape;
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(shape).map(([name, field]) => [name, wireSchema(field)]),
      ),
      required: Object.entries(shape)
        .filter(([, field]) => !field.isOptional())
        .map(([name]) => name),
      additionalProperties: false,
    };
  }
  throw new Error(
    "The planner wire grammar needs support for a new schema kind.",
  );
}

/** Derive the local-server grammar from the same action contract used after every reply. */
export const PLANNER_WIRE_SCHEMA = wireSchema(BrowserActionSchema);
