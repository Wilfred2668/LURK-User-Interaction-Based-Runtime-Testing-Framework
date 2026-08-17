/**
 * Configurable thresholds for engineering insight extraction.
 */

export interface RepeatedNetworkThreshold {
  minCount: number;
  maxTimeSpanMs: number;
}

export interface RepeatedConsoleThreshold {
  minCount: number;
}

export interface RepeatedResourceThreshold {
  minCount: number;
}

export interface SlowNetworkThreshold {
  warningMs: number;
  highMs: number;
}

export interface SlowResourceThreshold {
  warningMs: number;
  highMs: number;
}

export interface LargeResourceThreshold {
  warningBytes: number;
  highBytes: number;
}

export interface LongTaskThreshold {
  warningMs: number;
  highMs: number;
}

export interface SlowNavigationThreshold {
  warningMs: number;
  highMs: number;
}

export interface InsightConfig {
  repeatedNetwork: RepeatedNetworkThreshold;
  repeatedConsole: RepeatedConsoleThreshold;
  repeatedResource: RepeatedResourceThreshold;
  slowNetwork: SlowNetworkThreshold;
  slowResource: SlowResourceThreshold;
  largeResource: LargeResourceThreshold;
  longTask: LongTaskThreshold;
  slowNavigation: SlowNavigationThreshold;
}

export const DEFAULT_INSIGHT_CONFIG: InsightConfig = {
  repeatedNetwork: {
    minCount: 5,
    maxTimeSpanMs: 5000
  },
  repeatedConsole: {
    minCount: 3
  },
  repeatedResource: {
    minCount: 5
  },
  slowNetwork: {
    warningMs: 1000,
    highMs: 3000
  },
  slowResource: {
    warningMs: 500,
    highMs: 2000
  },
  largeResource: {
    warningBytes: 1_000_000,
    highBytes: 5_000_000
  },
  longTask: {
    warningMs: 50,
    highMs: 200
  },
  slowNavigation: {
    warningMs: 3000,
    highMs: 6000
  }
};
