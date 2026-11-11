import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistAttachments } from './attachmentStorage';

export type TicketStatus = 'Open' | 'Resolved' | 'Rejected' | 'Closed';
export type Attachment = { id: string; name: string; size: number; kind: 'PNG' | 'MP4' | 'IMG'; uri?: string };
export type TicketMessage = { id: string; body: string; createdAt: string; author: 'user' | 'support'; attachments: Attachment[] };
export type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  date: string;
  attachments: Attachment[];
  messages: TicketMessage[];
};
type State = { tickets: Ticket[]; loading: boolean; error: string | null };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };
const KEY = 'atherchain.support-tickets.v1';
export const canReply = (status: TicketStatus) => status === 'Open';
const statuses = ['Open', 'Resolved', 'Rejected', 'Closed'];

function samples(): Ticket[] {
  return [
    { id: 'AT-1043', subject: 'A question about my mining session', description: 'Where can I check the time remaining before my next claim?', status: 'Open' as const },
    { id: 'AT-1042', subject: 'Finding a transaction receipt', description: 'I needed help opening the receipt from my wallet activity.', status: 'Resolved' as const },
    { id: 'AT-1041', subject: 'Duplicate support request', description: 'This is a sample duplicate request. Please continue in the original ticket.', status: 'Rejected' as const },
    { id: 'AT-1040', subject: 'A completed support conversation', description: 'This sample conversation has been closed.', status: 'Closed' as const },
  ].map(ticket => ({
    ...ticket, date: 'Sample ticket', attachments: [],
    messages: [
      { id: `${ticket.id}-initial`, body: ticket.description, createdAt: '2026-11-08T08:00:00.000Z', author: 'user', attachments: [] },
      { id: `${ticket.id}-sample`, body: ticket.status === 'Open'
        ? 'Sample support reply: you can find the countdown on your mining page.'
        : `Sample support reply: this ticket is ${ticket.status.toLowerCase()} and no longer accepts replies.`,
      createdAt: '2026-11-08T08:01:00.000Z', author: 'support', attachments: [] },
    ],
  }));
}

function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false;
  const a = value as Attachment;
  return typeof a.id === 'string' && typeof a.name === 'string' && Number.isFinite(a.size) && a.size >= 0
    && ['PNG', 'MP4', 'IMG'].includes(a.kind) && (a.uri === undefined || typeof a.uri === 'string');
}
function parseTickets(raw: string): Ticket[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid history');
  const ids = new Set<string>();
  for (const t of parsed) {
    if (!t || typeof t.id !== 'string' || ids.has(t.id) || typeof t.subject !== 'string'
      || typeof t.description !== 'string' || typeof t.date !== 'string' || !statuses.includes(t.status)
      || !Array.isArray(t.attachments) || !t.attachments.every(isAttachment) || !Array.isArray(t.messages)) throw new Error('Invalid history');
    ids.add(t.id);
    const messageIds = new Set<string>();
    for (const m of t.messages) {
      if (!m || typeof m.id !== 'string' || messageIds.has(m.id) || typeof m.body !== 'string'
        || !['user', 'support'].includes(m.author) || typeof m.createdAt !== 'string' || !Number.isFinite(Date.parse(m.createdAt))
        || !Array.isArray(m.attachments) || !m.attachments.every(isAttachment)) throw new Error('Invalid history');
      messageIds.add(m.id);
    }
  }
  return parsed as Ticket[];
}

export function createTicketStore(storage: Storage, prepare = async (files: Attachment[]) => files) {
  let state: State = { tickets: samples(), loading: true, error: null };
  const listeners = new Set<() => void>();
  let loading: Promise<void> | null = null;
  let queue = Promise.resolve();
  const emit = (next: Partial<State>) => {
    state = { ...state, ...next };
    listeners.forEach(listener => listener());
  };
  const load = (): Promise<void> => {
    if (loading) return loading;
    if (!state.loading && !state.error) return Promise.resolve();
    emit({ loading: true, error: null });
    loading = (async () => {
      try {
        const raw = await storage.getItem(KEY);
        emit({ tickets: raw === null ? samples() : parseTickets(raw), loading: false, error: null });
      } catch {
        emit({ loading: false, error: 'Could not load saved ticket history. Retry before making changes.' });
      } finally { loading = null; }
    })();
    return loading;
  };
  const mutate = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(async () => {
      await load();
      if (state.error) throw new Error(state.error);
      return work();
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const save = async (tickets: Ticket[]) => {
    try { await storage.setItem(KEY, JSON.stringify(tickets)); }
    catch { throw new Error('Could not save ticket history on this device. Your draft is unchanged.'); }
    emit({ tickets });
  };
  const checkFiles = (files: Attachment[]) => {
    if (files.length > 3 || !files.every(isAttachment) || files.some(file => file.size > 5e6))
      throw new Error('Choose up to 3 attachments under 5 MB each.');
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      void load();
      return () => { listeners.delete(listener); };
    },
    load,
    createTicket: (subject: string, description: string, attachments: Attachment[]): Promise<Ticket> => mutate(async () => {
      if (!subject.trim() || subject.trim().length > 100 || !description.trim() || description.trim().length > 2000)
        throw new Error('Enter a subject (up to 100 characters) and description (up to 2000 characters).');
      checkFiles(attachments);
      const files = await prepare(attachments);
      const now = new Date().toISOString();
      const number = Math.max(1043, ...state.tickets.map(t => Number(t.id.replace('AT-', '')) || 0)) + 1;
      const id = `AT-${number}`;
      const ticket: Ticket = { id, subject: subject.trim(), description: description.trim(), attachments: files,
        status: 'Open', date: new Date(now).toLocaleDateString(),
        messages: [{ id: `${id}-1`, body: description.trim(), createdAt: now, author: 'user', attachments: files }] };
      await save([ticket, ...state.tickets]);
      return ticket;
    }),
    sendMessage: (id: string, body: string, attachments: Attachment[]): Promise<void> => mutate(async () => {
      const ticket = state.tickets.find(t => t.id === id);
      if (!ticket) throw new Error('Ticket not found.');
      if (!canReply(ticket.status)) throw new Error(`This ticket is ${ticket.status.toLowerCase()} and cannot receive replies.`);
      if ((!body.trim() && !attachments.length) || body.length > 2000) throw new Error('Enter a message up to 2000 characters or add an attachment.');
      checkFiles(attachments);
      const files = await prepare(attachments);
      const message: TicketMessage = { id: `${id}-${ticket.messages.length + 1}`, body: body.trim(),
        createdAt: new Date().toISOString(), author: 'user', attachments: files };
      await save(state.tickets.map(t => t.id === id ? { ...t, messages: [...t.messages, message] } : t));
    }),
  };
}

const store = createTicketStore(AsyncStorage, persistAttachments);
export const getTickets = () => store.getSnapshot().tickets;
export const loadTickets = store.load;
export const createTicket = store.createTicket;
export const sendTicketMessage = store.sendMessage;
export function useTickets() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
