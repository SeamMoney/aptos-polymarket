/**
 * TPS Prediction & Evaluation System
 *
 * Predicts expected TPS based on configuration parameters and
 * evaluates prediction accuracy after runs.
 */

// Mode configuration interface
export interface ModeConfig {
  accounts: number;
  workers: number;
  batchSize: number;
  batchDelayMs: number;
  fireAndForgetRatio: number;
  targetTps: number;
}

// Prediction result
export interface TPSPrediction {
  mode: string;
  predicted: {
    peakTps: number;
    avgTps: number;
    successRate: number;
    totalTransfers: number;
  };
  confidence: {
    low: number;
    expected: number;
    high: number;
  };
  factors: {
    baseline: number;
    accountFactor: number;
    workerFactor: number;
    latencyFactor: number;
    reliabilityFactor: number;
    combined: number;
  };
}

// Evaluation result
export interface PredictionEvaluation {
  peakTpsAccuracy: number;
  avgTpsAccuracy: number;
  successRateAccuracy: number;
  totalTransfersAccuracy: number;
  overallAccuracy: number;
  withinConfidence: boolean;
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  deltas: {
    peakTps: number;
    avgTps: number;
    successRate: number;
    totalTransfers: number;
  };
}

// Baseline TPS values by mode (calibrated from historical data)
const MODE_BASELINES: Record<string, { tps: number; successRate: number }> = {
  dryrun:   { tps: 8,     successRate: 100 },
  reliable: { tps: 100,   successRate: 99 },
  light:    { tps: 500,   successRate: 95 },
  proven:   { tps: 2500,  successRate: 80 },
  turbo:    { tps: 2000,  successRate: 75 },
  quantum:  { tps: 3500,  successRate: 60 },
  hyper:    { tps: 5000,  successRate: 50 },
};

// Default configuration per mode (for normalization)
// Each mode's baseline TPS is calibrated for these specific configs
const MODE_DEFAULTS: Record<string, { accounts: number; workers: number }> = {
  dryrun:   { accounts: 10,   workers: 1 },
  reliable: { accounts: 100,  workers: 4 },
  light:    { accounts: 200,  workers: 4 },
  proven:   { accounts: 500,  workers: 4 },
  turbo:    { accounts: 500,  workers: 4 },
  quantum:  { accounts: 1000, workers: 8 },
  hyper:    { accounts: 2000, workers: 16 },
};

const NORM_LATENCY = 100; // ms baseline

/**
 * Predict TPS for a given mode and configuration
 */
export function predictTPS(
  mode: string,
  config: ModeConfig,
  rpcLatencyMs: number,
  durationSec: number
): TPSPrediction {
  // Get baseline for mode
  const baseline = MODE_BASELINES[mode] || MODE_BASELINES.turbo;
  const defaults = MODE_DEFAULTS[mode] || MODE_DEFAULTS.turbo;

  // Calculate adjustment factors relative to mode defaults
  // This way, running dryrun with 10 accounts gives factor 1.0, not 0.02
  const accountFactor = config.accounts / defaults.accounts;
  const workerFactor = config.workers / defaults.workers;

  // Latency factor: lower latency = higher TPS
  // Capped between 0.5 and 2.0 to avoid extreme predictions
  const rawLatencyFactor = NORM_LATENCY / Math.max(rpcLatencyMs, 20);
  const latencyFactor = Math.min(Math.max(rawLatencyFactor, 0.5), 2.0);

  // Reliability factor: higher FAF ratio = more errors = lower effective TPS
  // But also faster submission, so it's a balance
  const reliabilityFactor = 1 - (config.fireAndForgetRatio * 0.15);

  // Combined factor
  const combinedFactor = accountFactor * workerFactor * latencyFactor * reliabilityFactor;

  // Calculate predicted TPS
  const predictedPeakTps = Math.round(baseline.tps * combinedFactor);

  // Average TPS is typically 60-80% of peak
  const avgRatio = mode === 'dryrun' ? 0.7 : 0.75;
  const predictedAvgTps = Math.round(predictedPeakTps * avgRatio);

  // Predicted success rate
  const predictedSuccessRate = baseline.successRate;

  // Predicted total transfers
  const predictedTotalTransfers = Math.round(predictedAvgTps * durationSec);

  // Confidence intervals (±40%)
  const confidenceLow = Math.round(predictedPeakTps * 0.6);
  const confidenceHigh = Math.round(predictedPeakTps * 1.4);

  return {
    mode,
    predicted: {
      peakTps: predictedPeakTps,
      avgTps: predictedAvgTps,
      successRate: predictedSuccessRate,
      totalTransfers: predictedTotalTransfers,
    },
    confidence: {
      low: confidenceLow,
      expected: predictedPeakTps,
      high: confidenceHigh,
    },
    factors: {
      baseline: baseline.tps,
      accountFactor: Math.round(accountFactor * 100) / 100,
      workerFactor: Math.round(workerFactor * 100) / 100,
      latencyFactor: Math.round(latencyFactor * 100) / 100,
      reliabilityFactor: Math.round(reliabilityFactor * 100) / 100,
      combined: Math.round(combinedFactor * 100) / 100,
    },
  };
}

/**
 * Calculate accuracy between predicted and actual values
 */
function calculateAccuracy(predicted: number, actual: number): number {
  if (predicted === 0 && actual === 0) return 1;
  if (predicted === 0) return 0;

  const ratio = actual / predicted;
  // Accuracy is how close the ratio is to 1.0
  // 0.5 or 2.0 both give 50% accuracy
  if (ratio >= 1) {
    return Math.max(0, 1 - (ratio - 1));
  } else {
    return ratio;
  }
}

/**
 * Evaluate prediction accuracy against actual results
 */
export function evaluatePrediction(
  prediction: TPSPrediction,
  actual: {
    peakTps: number;
    avgTps: number;
    successRate: number;
    totalTransfers: number;
  }
): PredictionEvaluation {
  // Calculate individual accuracies
  const peakTpsAccuracy = calculateAccuracy(prediction.predicted.peakTps, actual.peakTps);
  const avgTpsAccuracy = calculateAccuracy(prediction.predicted.avgTps, actual.avgTps);
  const successRateAccuracy = calculateAccuracy(prediction.predicted.successRate, actual.successRate);
  const totalTransfersAccuracy = calculateAccuracy(prediction.predicted.totalTransfers, actual.totalTransfers);

  // Weight the metrics (peak and avg TPS are most important)
  const overallAccuracy = (
    peakTpsAccuracy * 0.35 +
    avgTpsAccuracy * 0.35 +
    successRateAccuracy * 0.15 +
    totalTransfersAccuracy * 0.15
  );

  // Check if actual is within confidence interval
  const withinConfidence =
    actual.peakTps >= prediction.confidence.low &&
    actual.peakTps <= prediction.confidence.high;

  // Determine rating
  let rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  if (overallAccuracy >= 0.95) {
    rating = 'EXCELLENT';
  } else if (overallAccuracy >= 0.85) {
    rating = 'GOOD';
  } else if (overallAccuracy >= 0.70) {
    rating = 'FAIR';
  } else {
    rating = 'POOR';
  }

  // Calculate deltas (percentage difference)
  const deltas = {
    peakTps: prediction.predicted.peakTps > 0
      ? ((actual.peakTps - prediction.predicted.peakTps) / prediction.predicted.peakTps) * 100
      : 0,
    avgTps: prediction.predicted.avgTps > 0
      ? ((actual.avgTps - prediction.predicted.avgTps) / prediction.predicted.avgTps) * 100
      : 0,
    successRate: prediction.predicted.successRate > 0
      ? ((actual.successRate - prediction.predicted.successRate) / prediction.predicted.successRate) * 100
      : 0,
    totalTransfers: prediction.predicted.totalTransfers > 0
      ? ((actual.totalTransfers - prediction.predicted.totalTransfers) / prediction.predicted.totalTransfers) * 100
      : 0,
  };

  return {
    peakTpsAccuracy: Math.round(peakTpsAccuracy * 100) / 100,
    avgTpsAccuracy: Math.round(avgTpsAccuracy * 100) / 100,
    successRateAccuracy: Math.round(successRateAccuracy * 100) / 100,
    totalTransfersAccuracy: Math.round(totalTransfersAccuracy * 100) / 100,
    overallAccuracy: Math.round(overallAccuracy * 100) / 100,
    withinConfidence,
    rating,
    deltas: {
      peakTps: Math.round(deltas.peakTps * 10) / 10,
      avgTps: Math.round(deltas.avgTps * 10) / 10,
      successRate: Math.round(deltas.successRate * 10) / 10,
      totalTransfers: Math.round(deltas.totalTransfers * 10) / 10,
    },
  };
}

/**
 * Format prediction for display
 */
export function formatPrediction(prediction: TPSPrediction, durationSec: number): string {
  const lines = [
    '',
    `  Mode:             ${prediction.mode.toUpperCase()} (${prediction.factors.baseline} baseline TPS)`,
    `  Duration:         ${durationSec}s`,
    '',
    '  PREDICTED PERFORMANCE',
    '  ─────────────────────────────────────────────',
    `                    Low       Expected    High`,
    `  Peak TPS:         ${prediction.confidence.low.toLocaleString().padStart(7)}   ${prediction.confidence.expected.toLocaleString().padStart(7)}     ${prediction.confidence.high.toLocaleString().padStart(7)}`,
    `  Average TPS:      ${Math.round(prediction.confidence.low * 0.75).toLocaleString().padStart(7)}   ${prediction.predicted.avgTps.toLocaleString().padStart(7)}     ${Math.round(prediction.confidence.high * 0.75).toLocaleString().padStart(7)}`,
    `  Success Rate:     ${Math.round(prediction.predicted.successRate * 0.9)}%        ${prediction.predicted.successRate}%         ${Math.min(100, Math.round(prediction.predicted.successRate * 1.1))}%`,
    '',
    '  Factors:',
    `    Account factor:       ×${prediction.factors.accountFactor.toFixed(2)}`,
    `    Worker factor:        ×${prediction.factors.workerFactor.toFixed(2)}`,
    `    Latency factor:       ×${prediction.factors.latencyFactor.toFixed(2)}`,
    `    Reliability factor:   ×${prediction.factors.reliabilityFactor.toFixed(2)}`,
    `    Combined:             ×${prediction.factors.combined.toFixed(2)}`,
  ];

  return lines.join('\n');
}

/**
 * Format evaluation for display
 */
export function formatEvaluation(
  prediction: TPSPrediction,
  actual: { peakTps: number; avgTps: number; successRate: number; totalTransfers: number },
  evaluation: PredictionEvaluation
): string {
  const ratingEmoji = {
    EXCELLENT: '🎯',
    GOOD: '✓',
    FAIR: '⚠️',
    POOR: '❌',
  };

  const formatDelta = (delta: number) => {
    if (delta >= 0) return `+${delta.toFixed(1)}%`;
    return `${delta.toFixed(1)}%`;
  };

  const formatAccuracyMark = (accuracy: number) => {
    if (accuracy >= 0.9) return '✓';
    if (accuracy >= 0.7) return '~';
    return '✗';
  };

  const lines = [
    '',
    '  ACTUAL vs PREDICTED',
    '  ─────────────────────────────────────────────',
    '                    Predicted    Actual      Delta',
    `  Peak TPS:         ${prediction.predicted.peakTps.toLocaleString().padStart(8)}    ${actual.peakTps.toLocaleString().padStart(8)}    ${formatDelta(evaluation.deltas.peakTps).padStart(7)} ${formatAccuracyMark(evaluation.peakTpsAccuracy)}`,
    `  Average TPS:      ${prediction.predicted.avgTps.toLocaleString().padStart(8)}    ${actual.avgTps.toLocaleString().padStart(8)}    ${formatDelta(evaluation.deltas.avgTps).padStart(7)} ${formatAccuracyMark(evaluation.avgTpsAccuracy)}`,
    `  Success Rate:     ${prediction.predicted.successRate.toFixed(1).padStart(7)}%    ${actual.successRate.toFixed(1).padStart(7)}%    ${formatDelta(evaluation.deltas.successRate).padStart(7)} ${formatAccuracyMark(evaluation.successRateAccuracy)}`,
    `  Total Transfers:  ${prediction.predicted.totalTransfers.toLocaleString().padStart(8)}    ${actual.totalTransfers.toLocaleString().padStart(8)}    ${formatDelta(evaluation.deltas.totalTransfers).padStart(7)} ${formatAccuracyMark(evaluation.totalTransfersAccuracy)}`,
    '',
    `  ${ratingEmoji[evaluation.rating]} Overall Accuracy: ${Math.round(evaluation.overallAccuracy * 100)}%`,
    `  Rating: ${evaluation.rating}${evaluation.withinConfidence ? ' (within confidence interval)' : ' (outside confidence interval)'}`,
  ];

  return lines.join('\n');
}
