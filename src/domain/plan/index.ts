export { needsOnboarding } from './gate';
export { bmiBand, energy, intakeAdvice, suggestedGoal, type BmiBand, type Energy } from './body';
export { generatePlan, type PlanResult } from './generate';
export { TEMPLATES, alternativesFor, templateFor, type TemplateId } from './template';
export { FOCUS_GROUPS, GROUP_LABEL, type Group } from './volume';
export { applyAnswers, commitPlan, goalFromProfile, skipOnboarding, type PlanAnswers, type PlanGoal } from './answers';
export { explain } from './explain';
export {
  generatePlanV2,
  explainV2,
  eligibleStyles,
  styleLayout,
  frequency,
  validateCustomPairs,
  STYLE_NAME,
  LOW_FREQ,
  type PlanRequest,
  type PlanResultV2,
  type StyleId,
  type DayLayout,
  type BodyFatEstimate,
} from './v2';
