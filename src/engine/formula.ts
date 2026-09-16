import type { LetterGrade, StatusTier } from '../types/score.ts';
import type { KPIScoreResult } from '../types/rubric.ts';

/**
 * Universal linear interpolation with boundary clamping:
 * Score = maxPoints * clamp((actual - floor) / (target - floor), 0, 1)
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function calculateLinearScore(
  actual: number,
  floor: number,
  target: number,
  maxPoints: number
): { score: number; percentage: number } {
  if (target === floor) {
    const score = actual >= target ? maxPoints : 0;
    return { score, percentage: actual >= target ? 1 : 0 };
  }
  const ratio = (actual - floor) / (target - floor);
  const clampedRatio = clamp(ratio, 0, 1);
  const score = Number((clampedRatio * maxPoints).toFixed(2));
  return {
    score,
    percentage: Number(clampedRatio.toFixed(4)),
  };
}

/**
 * Letter Grade & Performance Tier mapping as defined in the build spec:
 * 90–100: A (Green — Thriving)
 * 80–89:  B (Green — Healthy)
 * 65–79:  C (Yellow — Watch)
 * 50–64:  D (Red — Intervene)
 * < 50:   F (Red — At Risk)
 */
export function getGradeAndTier(score: number): { letterGrade: LetterGrade; tier: StatusTier } {
  if (score >= 90) return { letterGrade: 'A', tier: 'Green — Thriving' };
  if (score >= 80) return { letterGrade: 'B', tier: 'Green — Healthy' };
  if (score >= 65) return { letterGrade: 'C', tier: 'Yellow — Watch' };
  if (score >= 50) return { letterGrade: 'D', tier: 'Red — Intervene' };
  return { letterGrade: 'F', tier: 'Red — At Risk' };
}

/**
 * Dynamic group rescaling:
 * When conditional KPIs drop (e.g. no survey, no AMVs, or mature school where T5-T7 drop),
 * the remaining applicable KPIs in that group rescale to preserve the group's full point weight.
 */
export function rescaleGroupKpis(kpis: KPIScoreResult[], groupTargetPoints: number): {
  rescaledKpis: KPIScoreResult[];
  groupEarnedPoints: number;
} {
  const applicableKpis = kpis.filter(k => k.isApplicable);
  if (applicableKpis.length === 0) {
    return { rescaledKpis: kpis, groupEarnedPoints: 0 };
  }

  const standardApplicableMax = applicableKpis.reduce((acc, k) => acc + k.maxPoints, 0);

  // If all KPIs in group apply, no rescaling factor needed
  if (Math.abs(standardApplicableMax - groupTargetPoints) < 0.001) {
    const groupEarnedPoints = Number(
      applicableKpis.reduce((acc, k) => acc + k.score, 0).toFixed(2)
    );
    return { rescaledKpis: kpis, groupEarnedPoints };
  }

  // Rescale applicable KPIs proportionally to meet groupTargetPoints
  const scaleFactor = groupTargetPoints / standardApplicableMax;
  const rescaledKpis = kpis.map(k => {
    if (!k.isApplicable) return k;
    const rescaledMax = Number((k.maxPoints * scaleFactor).toFixed(2));
    const rescaledScore = Number((k.score * scaleFactor).toFixed(2));
    return {
      ...k,
      maxPoints: rescaledMax,
      score: rescaledScore,
    };
  });

  const groupEarnedPoints = Number(
    rescaledKpis.filter(k => k.isApplicable).reduce((acc, k) => acc + k.score, 0).toFixed(2)
  );

  return { rescaledKpis, groupEarnedPoints };
}
