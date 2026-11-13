import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SendReceiptData } from './SendReceipt';

export type Contact = {
  id: string;
  name: string;
  /** A React node (e.g. an icon) or an image URI (https:, file:, data:). Plain strings render as text. */
  avatar: ReactNode;
  /** Avatar background color */
  tint: string;
};

export type Transaction = {
  id: string;
  title: string;
  date: Date | string | number;
  /** Signed, in major units. Negative = money out, positive = money in */
  amount: number;
  reference?: string;
  status?: string;
  currency?: 'AT' | 'ATH';
  /** Counterparty shown on the receipt (sender for incoming transfers). */
  recipient?: TransferRecipient;
  /** Original destination and method, separate from the incoming sender. */
  receivedRecipient?: TransferRecipient;
  /** Image URI / any node. Falls back to an arrow icon */
  icon?: ReactNode;
};

export type RecipientMethod = 'email' | 'username' | 'address';
export type TransferRecipient = { method: RecipientMethod; value: string };
export type TransferRequest = { amount: number; note: string } & (
  | { contact: Contact; recipient?: never }
  | { recipient: TransferRecipient; contact?: never }
);

export type MoneyCardProps = {
  user?: { name: string; avatar: ReactNode };
  balance?: number;
  contacts?: Contact[];
  /** Newest first */
  transactions?: Transaction[];
  /** Resolve = success screen, reject = inline error. If omitted, sending is shown as not configured. */
  onSend?: (req: TransferRequest) => Promise<void | SendReceiptData>;
  onRequest?: (req: TransferRequest) => Promise<void>;
  /** Override what "View all" does (default: opens the built-in activity list) */
  onViewAll?: () => void;
  currency?: string;
  locale?: string;
  /** Shown in settings and on the receive sheet with a copy button */
  paymentLink?: string;
  /** Marks the card and all success copy as demo-only */
  demo?: boolean;
  /** Fill the Home screen instead of rendering a floating card. */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type SheetConfig =
  | { type: 'send' | 'request'; contactId?: string }
  | { type: 'swap' }
  | { type: 'activity' }
  | { type: 'settings' };
