import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DOCUMENTS, type DocumentType, type FieldErrors, type Personal, type Residence } from './model';
import { LANGUAGES } from './languages';
import { COUNTRIES } from './countries';
import { CountryFlag } from './CountryFlag';
import { DocumentIcon } from './DocumentIcon';
import { ConfirmedIcon } from '@/components/wallet/ConfirmedIcon';
import { IdentityIllustration } from './Illustration';
import { Field, Heading, Row, s } from './parts';

export function IntroStep() {
  const c = useColors();
  return (
    <View>
      <IdentityIllustration />
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text accessibilityRole="header" style={[s.title, { color: c.walletInk, textAlign: 'center' }]}>Let’s walk through KYC</Text>
        <Text style={[s.body, { color: c.walletSubtle, textAlign: 'center', marginTop: 8 }]}>Submit your real identity details, ID photos and face capture securely for review.</Text>
      </View>
      <Row icon="credit-card" title="Photograph an ID document" sub="Front and back, from your photos or camera" />
      <Row icon="user" title="Follow the face instructions" sub="Turn left, turn right, open your mouth" />
      <Row icon="map-pin" title="Add personal & home details" sub="Name, birth date, language, address" />
    </View>
  );
}

export function DocumentStep({ value, onChange }: { value: DocumentType | null; onChange: (d: DocumentType) => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup">
      <Heading title="Choose a document" body="Choose the valid identity document you will submit." />
      {DOCUMENTS.map(d => (
        <Row key={d.id} testID={`kyc-document-${d.id}`} icon={d.icon}
          leading={<DocumentIcon type={d.id} color={c.walletInk} />}
          title={d.label} selected={value === d.id} onPress={() => onChange(d.id)} />
      ))}
    </View>
  );
}

export function PersonalStep({ value, errors, onChange, onLanguage }: {
  value: Personal; errors: FieldErrors; onChange: (v: Personal) => void; onLanguage: () => void;
}) {
  const c = useColors();
  const lang = LANGUAGES.find(l => l.code === value.language);
  return (
    <View>
      <Heading title="Personal details" body="As they’d appear on your document." />
      <Field testID="kyc-name" label="Full name" value={value.name} error={errors.name} autoComplete="off"
        onChangeText={name => onChange({ ...value, name })} placeholder="e.g. Sample Person" />
      <Field testID="kyc-fatherName" label="Father’s name" value={value.fatherName} error={errors.fatherName} autoComplete="off"
        onChangeText={fatherName => onChange({ ...value, fatherName })} placeholder="e.g. Sample Parent" />
      <Field testID="kyc-dob" label="Date of birth (YYYY-MM-DD)" value={value.dob} error={errors.dob} keyboardType="numbers-and-punctuation"
        maxLength={10} onChangeText={dob => onChange({ ...value, dob })} placeholder="1998-06-15" />
      <Field testID="kyc-document-number" label="Document number" value={value.documentNumber ?? ''} error={errors.documentNumber}
        onChangeText={documentNumber => onChange({ ...value, documentNumber })} autoCapitalize="characters" maxLength={80} />
      <Field testID="kyc-document-expiry" label="Document expiry (YYYY-MM-DD)" value={value.idExpiry ?? ''} error={errors.idExpiry}
        keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={idExpiry => onChange({ ...value, idExpiry })} placeholder="2030-12-31" />
      <View style={s.field}>
        <Text style={[s.label, { color: c.walletInk }]}>Preferred language</Text>
        <Pressable testID="kyc-language" onPress={onLanguage} accessibilityRole="button"
          accessibilityLabel={`Preferred language, ${lang ? lang.name : 'not chosen'}`}
          style={[s.input, { backgroundColor: c.walletField, borderColor: errors.language ? c.walletError : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <CountryFlag code={lang?.region} size={24} />
          <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: lang ? c.walletInk : c.walletMuted }}>
            {lang ? `${lang.nativeName} · ${lang.name}` : 'Choose a language'}
          </Text>
          <Feather name="chevron-down" size={18} color={c.walletMuted} />
        </Pressable>
        {!!errors.language && <Text accessibilityRole="alert" style={[s.error, { color: c.walletError }]}>{errors.language}</Text>}
      </View>
    </View>
  );
}

const RES: { key: keyof Residence; label: string; ph: string }[] = [
  { key: 'address', label: 'Street address', ph: '12 Sample Lane, Apt 4' },
  { key: 'city', label: 'City', ph: 'Sample City' },
  { key: 'state', label: 'State / province', ph: 'Sample State' },
];

export function ResidenceStep({ value, errors, onChange, onCountry }: { value: Residence; errors: FieldErrors; onChange: (v: Residence) => void; onCountry: () => void }) {
  const c = useColors();
  const country = COUNTRIES.find(item => item.name === value.country);
  return (
    <View>
      <Heading title="Where you live" body="Your current residential address." />
      {RES.map(r => (
        <Field key={r.key} testID={`kyc-${r.key}`} label={r.label} value={value[r.key]} error={errors[r.key]} placeholder={r.ph}
          multiline={r.key === 'address'} autoComplete="off" onChangeText={t => onChange({ ...value, [r.key]: t })} />
      ))}
      <View style={s.field}>
        <Text style={[s.label, { color: c.walletInk }]}>Country</Text>
        <Pressable testID="kyc-country" onPress={onCountry} accessibilityRole="button"
          accessibilityLabel={`Country, ${value.country || 'not chosen'}`}
          style={[s.input, { backgroundColor: c.walletField, borderColor: errors.country ? c.walletError : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <CountryFlag code={country?.code} size={24} />
          <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: value.country ? c.walletInk : c.walletMuted }}>
            {value.country || 'Choose a country'}
          </Text>
          <Feather name="chevron-down" size={18} color={c.walletMuted} />
        </Pressable>
        {!!errors.country && <Text accessibilityRole="alert" style={[s.error, { color: c.walletError }]}>{errors.country}</Text>}
      </View>
    </View>
  );
}

export type KycResultStatus = 'pending' | 'rejected' | 'approved';

const AMBER = '#B7791F';
const RESULT_COPY: Record<KycResultStatus, { icon: 'clock' | 'x' | 'check'; title: string; body: string; label: string }> = {
  pending: { icon: 'clock', title: 'Verification Pending', body: 'Your details have been submitted and are being reviewed.', label: 'Pending' },
  rejected: { icon: 'x', title: 'Verification Rejected', body: 'This submission was not approved.', label: 'Rejected' },
  approved: { icon: 'check', title: 'Verification Approved', body: 'Your KYC journey is complete. You’re ready to explore everything AtherChain has to offer.', label: 'Approved' },
};

export function ResultStep({ document, status = 'approved' }: { document: DocumentType | null; status?: KycResultStatus }) {
  const c = useColors();
  const documentName = DOCUMENTS.find(item => item.id === document)?.label ?? 'Not selected';
  const copy = RESULT_COPY[status];
  const statusColor = status === 'approved' ? c.walletPositive : status === 'rejected' ? c.walletError : AMBER;
  return (
    <View testID="kyc-result" accessibilityLiveRegion="polite" style={{ alignItems: 'center', paddingTop: 24 }}>
      <View testID={`kyc-result-${status}`}>
        <IdentityIllustration icon={copy.icon} />
      </View>
      <Text accessibilityRole="header" style={[s.title, { color: c.walletInk, textAlign: 'center' }]}>{copy.title}</Text>
      <Text style={[s.body, { color: c.walletSubtle, textAlign: 'center', marginTop: 10, marginBottom: 24 }]}>
        {copy.body}
      </Text>
      <View style={{ width: '100%', marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: c.walletDisabled }}>
          <Text style={[s.body, { color: c.walletSubtle }]}>Document Type</Text>
          <Text testID="kyc-result-document" style={[s.body, { color: c.walletInk, fontFamily: 'DMSans_500Medium' }]}>{documentName}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 }}>
          <Text style={[s.body, { color: c.walletSubtle }]}>Status</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {status === 'approved'
              ? <ConfirmedIcon />
              : <Feather name={status === 'rejected' ? 'x-circle' : 'clock'} size={18} color={statusColor} />}
            <Text testID="kyc-result-status" style={[s.body, { color: statusColor, fontFamily: 'DMSans_500Medium' }]}>{copy.label}</Text>
          </View>
        </View>
      </View>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: c.walletMuted, textAlign: 'center' }}>
        Simulated outcome · No real identity check was performed
      </Text>
    </View>
  );
}
