import type { BrowserAction } from "@chromeclaw/shared";
import type { Planner, PlannerInput } from "./index";

export class AnthropicPlaceholderPlanner implements Planner {
  name = "anthropic-placeholder";

  constructor(public model: string) {}

  async plan(_input: PlannerInput): Promise<BrowserAction> {
    throw new Error("Anthropic-compatible planning is reserved behind the provider abstraction and is not implemented in v0.");
  }
}
