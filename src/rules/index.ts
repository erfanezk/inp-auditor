import type { Rule } from "@/types";
import { inpHeavyLoopsRule } from "./inp-heavy-loop";
import { memoryCleanupRule } from "./memory-cleanup";

export const rules: Rule[] = [inpHeavyLoopsRule, memoryCleanupRule];
