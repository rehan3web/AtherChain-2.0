import { formatReceiptAmount, makeMoney, type Money } from '@/components/wallet/format';

const usd = makeMoney('en-US', 'USD');
const athBase = makeMoney('en-US', 'ATH');
const ath: Money = { ...athBase, full: value => formatReceiptAmount(athBase, value) };
const atNumber = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const at: Money = {
  symbol: 'AT',
  decimal: '.',
  num: value => atNumber.format(value),
  int: value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value),
  full: value => `${atNumber.format(value)} AT`,
};

export function receiptMoney(currency: 'USD' | 'AT' | 'ATH'): Money {
  return currency === 'ATH' ? ath : currency === 'AT' ? at : usd;
}
