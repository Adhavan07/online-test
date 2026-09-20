/**
 * Session Replay & Privacy Telemetry Governance Module
 * Enforces Wiretap & Privacy Law Compliance:
 * 1. Session Replay is OFF by default.
 * 2. Inputs, textareas, and code editors are tagged with masking attributes.
 */

export interface SessionReplayPolicy {
  enabled: boolean;
  maskAllInputs: boolean;
  maskCodeEditor: boolean;
  proctoringTelemetryOnly: boolean;
}

export const DEFAULT_SESSION_REPLAY_POLICY: SessionReplayPolicy = {
  enabled: false,              // Off by default
  maskAllInputs: true,        // Mask all form inputs
  maskCodeEditor: true,       // Mask code telemetry from third-party replay
  proctoringTelemetryOnly: true, // Only operational assessment timers/events allowed
};

/**
 * Checks if session replay recording is permitted under active policy
 */
export function isSessionReplayPermitted(tenantPolicy?: Partial<SessionReplayPolicy>): boolean {
  if (tenantPolicy?.enabled === true) {
    return true;
  }
  return DEFAULT_SESSION_REPLAY_POLICY.enabled;
}

/**
 * DOM Input Masking Utility
 * Applies privacy attributes (data-rr-mask, data-mask, data-private) to form elements
 */
export function applyInputMasking(containerElement?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  const root = containerElement || document;
  const sensitiveInputs = root.querySelectorAll('input, textarea, [contenteditable="true"]');

  sensitiveInputs.forEach((el) => {
    el.setAttribute('data-rr-mask', 'true');
    el.setAttribute('data-mask', 'true');
    el.setAttribute('data-private', 'true');
    el.setAttribute('autocomplete', 'off');
  });
}
