export interface LodInput {
  distance: number;
  projectedRadiusPx: number;
  semanticPriority: number;
}

export interface LodDecision {
  level: 0 | 1 | 2;
  keep: boolean;
  score: number;
}

export class LodManager {
  constructor(private readonly weights = { w1: 0.5, w2: 0.35, w3: 0.15 }) {}

  decide(input: LodInput): LodDecision {
    const distanceFactor = 1 / Math.max(1, input.distance);
    const score = this.weights.w1 * distanceFactor + this.weights.w2 * (input.projectedRadiusPx / 32) + this.weights.w3 * input.semanticPriority;

    if (input.projectedRadiusPx < 0.5) return { level: 2, keep: false, score };
    if (score > 0.75) return { level: 0, keep: true, score };
    if (score > 0.35) return { level: 1, keep: true, score };
    return { level: 2, keep: true, score };
  }
}
