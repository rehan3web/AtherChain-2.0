export type DocumentType = 'passport' | 'driving' | 'id';
export type KycReviewStatus = 'pending' | 'rejected' | 'approved';
export const KYC_REVIEW_INTERVAL_MS = 30_000;

/** Local practice timeline only; never a real verification decision. */
export function kycReviewStatus(submittedAt: number, now: number): KycReviewStatus {
  const elapsed = Math.max(0, now - submittedAt);
  return elapsed < KYC_REVIEW_INTERVAL_MS ? 'pending'
    : elapsed < KYC_REVIEW_INTERVAL_MS * 2 ? 'rejected' : 'approved';
}

export function kycReviewDelay(submittedAt: number, now: number): number | null {
  const elapsed = Math.max(0, now - submittedAt);
  return elapsed < KYC_REVIEW_INTERVAL_MS ? KYC_REVIEW_INTERVAL_MS - elapsed
    : elapsed < KYC_REVIEW_INTERVAL_MS * 2 ? KYC_REVIEW_INTERVAL_MS * 2 - elapsed : null;
}

export const DOCUMENTS = [
  { id: 'passport' as const, label: 'Passport', icon: 'book' as const },
  { id: 'driving' as const, label: 'Driving Licence', icon: 'credit-card' as const },
  { id: 'id' as const, label: 'ID Card', icon: 'user' as const },
];
export type Personal = { name: string; fatherName: string; dob: string; language: string };
export type Residence = { address: string; city: string; state: string; country: string };
export type Photo = { uri: string; name: string; size?: number };
export type FieldErrors = Record<string, string>;
export const EMPTY_PERSONAL: Personal = { name: '', fatherName: '', dob: '', language: '' };
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
