import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../components/help/tickets.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, require: name => ({
  react: { useSyncExternalStore: (_, snapshot) => snapshot() },
  '@react-native-async-storage/async-storage': {},
  './attachmentStorage': { persistAttachments: async files => files },
})[name] });
const { createTicketStore, canReply } = exports;
const file = { id: 'photo', name: 'image.png', size: 25, kind: 'PNG', uri: 'data:image/png;base64,eA==' };
function storage() {
  let raw = null;
  let failRead = false;
  let failWrite = false;
  return {
    getItem: async () => { if (failRead) throw Error('read'); return raw; },
    setItem: async (_, value) => { if (failWrite) throw Error('quota'); raw = value; },
    set raw(value) { raw = value; },
    set failRead(value) { failRead = value; },
    set failWrite(value) { failWrite = value; },
  };
}

test('ticket plus original description and attachments survive a fresh app instance', async () => {
  const disk = storage();
  const first = createTicketStore(disk);
  const ticket = await first.createTicket(' Image question ', ' Please check this ', [file]);
  assert.equal(ticket.subject, 'Image question');
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.messages[0].body, 'Please check this');
  assert.equal(ticket.messages[0].attachments[0].uri, file.uri);
  const second = createTicketStore(disk);
  await second.load();
  const restored = second.getSnapshot().tickets.find(t => t.id === ticket.id);
  assert.equal(restored.messages[0].body, ticket.description);
  assert.equal(restored.attachments[0].name, 'image.png');
});

test('message history is chronological, isolated per ticket and persists attachments', async () => {
  const disk = storage();
  const store = createTicketStore(disk);
  const a = await store.createTicket('A', 'First', []);
  const b = await store.createTicket('B', 'Second', []);
  await store.sendMessage(a.id, ' reply ', []);
  await store.sendMessage(a.id, '', [file]);
  const restored = createTicketStore(disk);
  await restored.load();
  const tickets = restored.getSnapshot().tickets;
  assert.equal(tickets.find(t => t.id === a.id).messages.length, 3);
  assert.equal(tickets.find(t => t.id === a.id).messages[1].body, 'reply');
  assert.equal(tickets.find(t => t.id === a.id).messages[2].attachments[0].uri, file.uri);
  assert.equal(tickets.find(t => t.id === b.id).messages.length, 1);
});

test('Closed, Resolved and Rejected tickets enforce read-only at model level', async () => {
  const store = createTicketStore(storage());
  await store.load();
  for (const ticket of store.getSnapshot().tickets) {
    if (ticket.status === 'Open') { assert.equal(canReply(ticket.status), true); continue; }
    assert.equal(canReply(ticket.status), false);
    await assert.rejects(store.sendMessage(ticket.id, 'blocked', []), /cannot receive replies/);
  }
  await assert.rejects(store.sendMessage('missing', 'hi', []), /not found/);
});

test('failed writes do not publish phantom messages or lose existing history', async () => {
  const disk = storage();
  const store = createTicketStore(disk);
  const ticket = await store.createTicket('A', 'Original', []);
  disk.failWrite = true;
  await assert.rejects(store.sendMessage(ticket.id, 'unsaved', []), /Could not save/);
  assert.equal(store.getSnapshot().tickets[0].messages.length, 1);
  await assert.rejects(store.createTicket('B', 'unsaved', []), /Could not save/);
  assert.equal(store.getSnapshot().tickets[0].id, ticket.id);
  disk.failWrite = false;
  await store.sendMessage(ticket.id, 'retry', []);
  assert.equal(store.getSnapshot().tickets[0].messages.length, 2);
});

test('read failure and corrupt history block edits until successful retry', async () => {
  const disk = storage();
  disk.failRead = true;
  const store = createTicketStore(disk);
  await store.load();
  assert.ok(store.getSnapshot().error);
  await assert.rejects(store.createTicket('A', 'body', []), /Could not load/);
  disk.failRead = false;
  disk.raw = '{"broken":true}';
  await store.load();
  assert.ok(store.getSnapshot().error);
  disk.raw = null;
  await store.load();
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().loading, false);
});

test('concurrent writes and startup hydration do not overwrite each other', async () => {
  const disk = storage();
  const store = createTicketStore(disk);
  const [a, b] = await Promise.all([store.createTicket('A', 'a', []), store.createTicket('B', 'b', [])]);
  assert.notEqual(a.id, b.id);
  await Promise.all([store.sendMessage(a.id, 'one', []), store.sendMessage(a.id, 'two', [])]);
  const messages = store.getSnapshot().tickets.find(t => t.id === a.id).messages;
  assert.equal(messages.length, 3);
  assert.notEqual(messages[1].id, messages[2].id);
  const fresh = createTicketStore(disk);
  const c = await fresh.createTicket('C', 'c', []);
  assert.notEqual(c.id, a.id);
  assert.equal(fresh.getSnapshot().tickets.find(t => t.id === a.id).messages.length, 3);
});

test('blank messages, oversized text and invalid attachments fail explicitly', async () => {
  const store = createTicketStore(storage());
  const ticket = await store.createTicket('A', 'body', []);
  await assert.rejects(store.sendMessage(ticket.id, ' ', []), /Enter a message/);
  await assert.rejects(store.sendMessage(ticket.id, 'x'.repeat(2001), []), /2000/);
  await assert.rejects(store.sendMessage(ticket.id, 'hi', [{ ...file, size: 6e6 }]), /3 attachments/);
  await assert.rejects(store.createTicket('', 'body', []), /subject/);
});

test('attachment durability preparation finishes before publishing and failure leaves history unchanged', async () => {
  const disk = storage();
  const store = createTicketStore(disk, async files => files.map(f => ({ ...f, uri: 'file:///durable/image.png' })));
  const ticket = await store.createTicket('A', 'body', [file]);
  assert.equal(ticket.attachments[0].uri, 'file:///durable/image.png');
  const failing = createTicketStore(disk, async () => { throw Error('copy failed'); });
  await assert.rejects(failing.sendMessage(ticket.id, 'hi', [file]), /copy failed/);
  assert.equal(failing.getSnapshot().tickets[0].messages.length, 1);
});
