import React from 'react';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';
import type { Contact, Transaction } from './types';

/** Empty loading defaults. Account data must always come from the backend. */
export const DEFAULT_USER = {
  name: '',
  avatar: <Feather name="user" size={18} color={colors.light.walletInkSoft} />,
};
export const DEFAULT_CONTACTS: Contact[] = [];
export const DEFAULT_TRANSACTIONS: Transaction[] = [];
