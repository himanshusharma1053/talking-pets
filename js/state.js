// What the pet is doing, and which events move it between activities.
// Pure logic, no browser APIs.

export const STATES = ['idle', 'listening', 'talking', 'reacting', 'acting', 'sleeping'];

// Returns the state to enter, or null when the event should be ignored.
// Returning the current state means "restart it" (e.g. a second tap).
export function nextState(state, event) {
  switch (event) {
    case 'heard':
      return state === 'idle' ? 'listening' : null;
    case 'speechEnd':
      return state === 'listening' ? 'talking' : null;
    case 'speechDiscard':
      return state === 'listening' ? 'idle' : null;
    case 'done':
      return ['talking', 'reacting', 'acting'].includes(state) ? 'idle' : null;
    case 'tap':
      return state === 'sleeping' ? 'idle' : 'reacting';
    case 'act':
      return state === 'sleeping' ? null : 'acting';
    case 'sleep':
      return state === 'sleeping' ? 'idle' : 'sleeping';
    default:
      return null;
  }
}

// The microphone only listens while the pet is free to hear you, so it
// never records its own voice or sound effects.
export function micOpen(state) {
  return state === 'idle' || state === 'listening';
}
