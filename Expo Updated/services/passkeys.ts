function decode(value: string): Uint8Array {
  const text = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(text, character => character.charCodeAt(0));
}
function encode(value: ArrayBuffer | null): string | null {
  if (!value) return null;
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function optionsFromJson(input: any) {
  return {
    ...input, challenge: decode(input.challenge),
    ...(input.user ? { user: { ...input.user, id: decode(input.user.id) } } : {}),
    ...(input.excludeCredentials ? { excludeCredentials: input.excludeCredentials.map((item: any) => ({ ...item, id: decode(item.id) })) } : {}),
    ...(input.allowCredentials ? { allowCredentials: input.allowCredentials.map((item: any) => ({ ...item, id: decode(item.id) })) } : {}),
  };
}
function serialize(credential: any) {
  if (!credential) throw new Error('The passkey prompt was cancelled.');
  if (typeof credential.toJSON === 'function') return credential.toJSON();
  const response = credential.response;
  return {
    id: credential.id, rawId: encode(credential.rawId), type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      ...(response.attestationObject ? { attestationObject: encode(response.attestationObject), transports: response.getTransports?.() ?? [] } : {}),
      ...(response.authenticatorData ? { authenticatorData: encode(response.authenticatorData), signature: encode(response.signature), userHandle: encode(response.userHandle) } : {}),
    },
  };
}
export async function createCredential(options: any) {
  if (!globalThis.navigator?.credentials) throw new Error('Passkeys require a supported browser and secure connection.');
  return serialize(await navigator.credentials.create({ publicKey: optionsFromJson(options) as any }));
}
export async function getCredential(options: any) {
  if (!globalThis.navigator?.credentials) throw new Error('Passkeys require a supported browser and secure connection.');
  return serialize(await navigator.credentials.get({ publicKey: optionsFromJson(options) as any }));
}
