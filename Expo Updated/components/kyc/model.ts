export type DocumentType = 'passport' | 'driving' | 'id';
export type KycReviewStatus = 'pending' | 'rejected' | 'approved';

export const DOCUMENTS = [
  { id: 'passport' as const, label: 'Passport', icon: 'book' as const },
  { id: 'driving' as const, label: 'Driving Licence', icon: 'credit-card' as const },
  { id: 'id' as const, label: 'ID Card', icon: 'user' as const },
];
export type Personal = { name: string; fatherName: string; dob: string; language: string; documentNumber?: string; idExpiry?: string };
export type Residence = { address: string; city: string; state: string; country: string };
export type Photo = { uri: string; name: string; size?: number };
export type FieldErrors = Record<string, string>;
export const EMPTY_PERSONAL: Personal = { name: '', fatherName: '', dob: '', language: '', documentNumber: '', idExpiry: '' };
export const EMPTY_RESIDENCE: Residence = { address: '', city: '', state: '', country: '' };
export const FACE_STEPS = [
  { id: 'left', title: 'Turn your head left', body: 'Gently turn to your left, then capture a photo.' },
  { id: 'right', title: 'Turn your head right', body: 'Gently turn to your right, then capture a photo.' },
  { id: 'mouth', title: 'Open your mouth', body: 'Face forward and open your mouth, then capture a photo.' },
] as const;

export function validatePersonal(value: Personal, today = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  if (!value.name.trim()) errors.name = 'Enter your full name.';
  else if (value.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.';
  if (!value.fatherName.trim()) errors.fatherName = "Enter your father's name.";
  else if (value.fatherName.trim().length > 100) errors.fatherName = 'Use 100 characters or fewer.';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.dob.trim());
  if (!match) errors.dob = 'Use YYYY-MM-DD, for example 1998-06-15.';
  else {
    const [, y, m, d] = match.map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d ||
        date > today || y < today.getFullYear() - 120) {
      errors.dob = 'Enter a valid date of birth, not a future date.';
    }
  }
  if (!value.language) errors.language = 'Choose a language.';
  if (!value.documentNumber?.trim() || value.documentNumber.trim().length > 80)
    errors.documentNumber = 'Enter the document number printed on your ID.';
  if (!value.idExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(value.idExpiry) ||
      !Number.isFinite(new Date(value.idExpiry).getTime()) ||
      new Date(value.idExpiry).toISOString().slice(0, 10) !== value.idExpiry ||
      new Date(`${value.idExpiry}T23:59:59Z`).getTime() < today.getTime())
    errors.idExpiry = 'Enter a valid, unexpired document expiry date (YYYY-MM-DD).';
  return errors;
}

export function validateResidence(value: Residence): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ['address', 'city', 'state', 'country'] as const) {
    if (!value[key].trim()) errors[key] = `Enter your ${key === 'state' ? 'state or province' : key}.`;
    else if (value[key].trim().length > (key === 'address' ? 240 : 100)) errors[key] = 'This entry is too long.';
  }
  return errors;
}

export function photoError(photo: Photo): string | null {
  if (!photo.uri) return 'Could not read this image. Please try another.';
  if (photo.size != null && photo.size > 5_000_000) return 'Choose an image under 5 MB.';
  return null;
}
