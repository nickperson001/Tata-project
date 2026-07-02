import { state, addLog } from '../config/state';
import { CIRCUIT_COOLDOWN_MS, CIRCUIT_FAILURE_THRESHOLD } from '../config/constants';

function circuitIsOpen(): boolean {
  const c = state._circuit;
  if (c.state === 'OPEN') {
    if (Date.now() - c.openedAt > CIRCUIT_COOLDOWN_MS) {
      c.state = 'HALF_OPEN';
      addLog('info', '[CIRCUIT] Half-open — testing 1 request...');
      return false;
    }
    return true;
  }
  return false;
}

function circuitRecordSuccess(): void {
  const c = state._circuit;
  if (c.failures > 0 || c.state !== 'CLOSED') {
    addLog('info', '[CIRCUIT] Closed — DB healthy again');
  }
  c.failures = 0;
  c.state = 'CLOSED';
}

function circuitRecordFailure(): void {
  const c = state._circuit;
  c.failures++;
  if (c.failures >= CIRCUIT_FAILURE_THRESHOLD && c.state !== 'OPEN') {
    c.state = 'OPEN';
    c.openedAt = Date.now();
    addLog('warn', `[CIRCUIT] OPEN — ${c.failures} consecutive DB failures. Cooling down ${CIRCUIT_COOLDOWN_MS / 1000}s.`);
  }
}

export { circuitIsOpen, circuitRecordSuccess, circuitRecordFailure };
