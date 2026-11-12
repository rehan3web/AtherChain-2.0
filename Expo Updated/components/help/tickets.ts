import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { supportApi, getMediaUrl, getToken, onSessionExpired } from '@/services/api';
import { appendImage } from '@/services/uploads';
import { onBackendRefresh } from '@/services/refresh';

export type TicketStatus = 'Open' | 'Resolved' | 'Rejected' | 'Closed';
export type Attachment = { id: string; name: string; size: number; kind: 'PNG' | 'MP4' | 'IMG'; uri?: string };
export type TicketMessage = { id: string; body: string; createdAt: string; author: 'user' | 'support'; attachments: Attachment[] };
export type Ticket = {
  id: string; subject: string; description: string; status: TicketStatus; date: string;
  attachments: Attachment[]; messages: TicketMessage[];
};
type State = { tickets: Ticket[]; loading: boolean; error: string | null };
export const canReply = (status: TicketStatus) => status === 'Open';

let remoteState: State = { tickets: [], loading: true, error: null };
const remoteListeners = new Set<() => void>();
let remoteGeneration = 0;
function publishRemote(patch: Partial<State>) {
  remoteState = { ...remoteState, ...patch };
  remoteListeners.forEach(listener => listener());
}
onSessionExpired(() => {
  remoteGeneration++;
  publishRemote({ tickets: [], loading: false, error: null });
});
function mapAttachment(image: string | null, id: string): Attachment[] {
  return image ? [{
    id, name: image.split('/').pop() ?? 'Attachment', size: 0, kind: 'IMG',
    uri: getMediaUrl(image.startsWith('/') ? image : `/uploads/support/${image}`),
  }] : [];
}
function mapTicket(result: any): Ticket {
  const ticket = result.ticket;
  const status = String(ticket.status).toUpperCase();
  const messages: TicketMessage[] = result.messages.map((message: any) => ({
    id: String(message.id), body: message.message ?? '', createdAt: message.created_at,
    author: message.is_admin ? 'support' : 'user',
    attachments: mapAttachment(message.image_url, `message-${message.id}`),
  }));
  return {
    id: String(ticket.id), subject: ticket.title, description: ticket.message ?? messages[0]?.body ?? '',
    status: status === 'RESOLVED' ? 'Resolved' : status === 'REJECTED' ? 'Rejected' : status === 'CLOSED' ? 'Closed' : 'Open',
    date: new Date(ticket.created_at).toLocaleDateString(), attachments: messages[0]?.attachments ?? [], messages,
  };
}
export const getTickets = () => remoteState.tickets;
export async function loadTickets() {
  const generation = ++remoteGeneration;
  if (!await getToken()) {
    publishRemote({ tickets: [], loading: false, error: 'Sign in to view or create support tickets.' });
    return;
  }
  publishRemote({ loading: true, error: null });
  try {
    const tickets: Ticket[] = [];
    let page = 1, pages = 1;
    do {
      const response = await supportApi.list(page);
      if (!Array.isArray(response.tickets)) throw new Error('The backend returned invalid support history.');
      const details = await Promise.all(response.tickets.map((ticket: any) => supportApi.getDetails(String(ticket.id))));
      tickets.push(...details.map(mapTicket));
      pages = Number(response.pagination.pages);
      page++;
    } while (page <= pages);
    if (generation === remoteGeneration) publishRemote({ tickets, loading: false, error: null });
  } catch (cause) {
    if (generation === remoteGeneration) publishRemote({
      tickets: [], loading: false, error: cause instanceof Error ? cause.message : 'Could not load support tickets.',
    });
    throw cause;
  }
}
async function ticketForm(message: string, attachments: Attachment[], subject?: string) {
  if (attachments.length > 1 || attachments.some(file => file.kind === 'MP4'))
    throw new Error('The backend supports one image per message, not videos or multiple attachments.');
  const form = new FormData();
  if (subject) form.append('title', subject);
  form.append('message', message);
  if (attachments[0]) {
    if (!attachments[0].uri) throw new Error('Select the attachment again.');
    await appendImage(form, 'image', { uri: attachments[0].uri, name: attachments[0].name });
  }
  return form;
}
export async function createTicket(subject: string, description: string, attachments: Attachment[]): Promise<Ticket> {
  if (!subject.trim() || !description.trim()) throw new Error('Enter a subject and description.');
  const result = await supportApi.create(await ticketForm(description.trim(), attachments, subject.trim()));
  if (!result.ticketId) throw new Error('The backend did not return a ticket reference.');
  let ticket: Ticket;
  try { ticket = mapTicket(await supportApi.getDetails(String(result.ticketId))); }
  catch { throw new Error(`Ticket ${result.ticketId} was created, but its details could not load. Refresh support before submitting another ticket.`); }
  publishRemote({ tickets: [ticket, ...remoteState.tickets.filter(item => item.id !== ticket.id)], error: null });
  return ticket;
}
export async function sendTicketMessage(id: string, body: string, attachments: Attachment[]) {
  const current = mapTicket(await supportApi.getDetails(id));
  if (!canReply(current.status)) throw new Error('This support ticket is closed.');
  await supportApi.reply(id, await ticketForm(body, attachments));
  let updated: Ticket;
  try { updated = mapTicket(await supportApi.getDetails(id)); }
  catch { throw new Error('Your reply was accepted, but history could not refresh. Refresh the ticket before resending.'); }
  publishRemote({ tickets: remoteState.tickets.map(ticket => ticket.id === id ? updated : ticket), error: null });
}
export function useTickets() {
  const state = useSyncExternalStore(
    listener => { remoteListeners.add(listener); return () => { remoteListeners.delete(listener); }; },
    () => remoteState, () => remoteState,
  );
  useFocusEffect(useCallback(() => {
    const refresh = () => { if (AppState.currentState === 'active') void loadTickets().catch(() => {}); };
    void loadTickets().catch(() => {});
    const interval = setInterval(refresh, 15000);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(interval); subscription.remove(); };
  }, []));
  useEffect(() => onBackendRefresh(() => { void loadTickets().catch(() => {}); }), []);
  return state;
}
