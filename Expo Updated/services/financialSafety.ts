import { onSessionExpired } from './api';

type Operation = 'send' | 'swap';
// An uncertain HTTP result is not proof of rollback. Do not retry on a reopened sheet.
const uncertain = new Set<Operation>();
onSessionExpired(() => uncertain.clear());

export function assertPaymentCanProceed(operation: Operation) {
  if (uncertain.has(operation))
    throw new Error(`The previous ${operation} has an uncertain result. Check transaction history and restart the app before submitting again.`);
}
export function markPaymentUncertain(operation: Operation) {
  uncertain.add(operation);
}
