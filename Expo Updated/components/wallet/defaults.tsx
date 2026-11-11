import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { BallIcon } from './primitives';
import type { Contact, Transaction } from './types';

const t = colors.light;

export const DEFAULT_USER = {
  name: 'Ana',
  avatar: <Feather name="user" size={18} color={t.walletInkSoft} />,
};

const ico = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name'], color: string) => (
  <MaterialCommunityIcons name={name} size={28} color={color} />
);

export const DEFAULT_CONTACTS: Contact[] = [
  { id: 'zane', name: 'Zane', avatar: ico('google-downasaur', '#2f6b3a'), tint: t.walletContactZane },
  { id: 'maya', name: 'Maya', avatar: ico('cat', '#4f3f8f'), tint: t.walletContactMaya },
  { id: 'remy', name: 'Remy', avatar: ico('rabbit', '#8f2f3a'), tint: t.walletContactRemy },
  { id: 'arjun', name: 'Arjun', avatar: ico('panda', '#6b4520'), tint: t.walletContactArjun },
  { id: 'nova', name: 'Nova', avatar: <Feather name="user" size={24} color={t.walletContactNovaInk} />, tint: t.walletContactNova },
];

export const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 't0', title: 'Dribbble Pro', date: new Date().toISOString(), amount: -60, icon: <BallIcon /> },
  { id: 't1', title: 'Elena Rostova', date: new Date(Date.now() - 3600000 * 4).toISOString(), amount: 350 },
  { id: 't2', title: 'Coffee Roasters', date: new Date(Date.now() - 86400000).toISOString(), amount: -14.5 },
];
