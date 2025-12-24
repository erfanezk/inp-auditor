import type { Rule } from "@/types";
import { inpAnimationCompositingRule } from "./inp-animation-compositing";
import { inpAnimationTypeRule } from "./inp-animation-type";
import { inpAsyncBatchProcessingRule } from "./inp-async-batch-processing";
import { inpCallbackYieldRule } from "./inp-callback-yield";
import { inpDomSizeRule } from "./inp-dom-size";
import { inpEventHandlerApiCallsRule } from "./inp-event-handler-api-calls";
import { inpEventHandlerDomManipulationRule } from "./inp-event-handler-dom-manipulation";
import { inpEventHandlerStateUpdatesRule } from "./inp-event-handler-state-updates";
import { inpHeavyComputationRule } from "./inp-heavy-computation";
import { inpLayoutThrashingRule } from "./inp-layout-thrashing";
import { inpLongLoopRule } from "./inp-long-loop";

const eventHandlerRules: Rule[] = [
  inpCallbackYieldRule,
  inpEventHandlerApiCallsRule,
  inpEventHandlerDomManipulationRule,
  inpEventHandlerStateUpdatesRule,
];

const longTaskRules: Rule[] = [
  inpLongLoopRule,
  inpAsyncBatchProcessingRule,
  inpHeavyComputationRule,
];

const animationRules: Rule[] = [inpAnimationTypeRule, inpAnimationCompositingRule];

const layoutRules: Rule[] = [inpLayoutThrashingRule];

const domRules: Rule[] = [inpDomSizeRule];

export const rules: Rule[] = [
  ...eventHandlerRules,
  ...longTaskRules,
  ...animationRules,
  ...layoutRules,
  ...domRules,
];
