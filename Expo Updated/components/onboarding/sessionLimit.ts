export type LoginSession = { id: string; device: string; loginTime?: string };
export type SessionLimit = { sessions: LoginSession[]; token: string };

/** Project only display fields; never render or persist session credentials. */
export function readSessionLimit(error: { data?: Record<string, any> }): SessionLimit | null {
  const data = error?.data;
  if (data?.code !== 'SESSION_LIMIT_EXCEEDED') return null;
  if (typeof data.sessionManagementToken !== 'string' || !data.sessionManagementToken ||
      !Array.isArray(data.sessions) || !data.sessions.length) {
    throw new Error('Could not load session recovery. Please sign in again.');
  }
  const sessions = data.sessions.map((session: any) => {
    if (typeof session.id !== 'string' || !session.id) throw new Error('The session list is invalid. Please sign in again.');
    return { id: session.id, device: typeof session.device === 'string' ? session.device : 'Unknown device',
      loginTime: typeof session.loginTime === 'string' ? session.loginTime : undefined };
  });
  return { sessions, token: data.sessionManagementToken };
}
