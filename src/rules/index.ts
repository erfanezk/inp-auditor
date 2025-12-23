import type { Rule } from "@/types";
import { inpCallbackYieldRule } from "./inp-callback-yield";
import { inpLayoutThrashingRule } from "./inp-layout-thrashing";

export const rules: Rule[] = [inpCallbackYieldRule, inpLayoutThrashingRule];
