export const MINIMUM_LEVERAGE_MIN = 1;
export const MINIMUM_LEVERAGE_MAX = 50;

const STORAGE_KEY = 'tefeci_engine_settings_v1';

export interface EngineSettings {
  minimumLeverage: number;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  minimumLeverage: 2,
};

export function normalizeMinimumLeverage(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_ENGINE_SETTINGS.minimumLeverage;
  return Math.min(
    MINIMUM_LEVERAGE_MAX,
    Math.max(MINIMUM_LEVERAGE_MIN, Math.round(parsed)),
  );
}

export function loadEngineSettings(): EngineSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_ENGINE_SETTINGS };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ENGINE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      minimumLeverage: normalizeMinimumLeverage(parsed.minimumLeverage),
    };
  } catch {
    return { ...DEFAULT_ENGINE_SETTINGS };
  }
}

export function saveEngineSettings(settings: EngineSettings) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        minimumLeverage: normalizeMinimumLeverage(settings.minimumLeverage),
      }),
    );
  } catch {
    // A blocked/full storage area must not stop the trading simulation.
  }
}
