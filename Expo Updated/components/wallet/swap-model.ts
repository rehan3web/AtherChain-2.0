export const SWAP_FEE = 0;
export const SWAP_FEE_LABEL = '0%';
export const SWAP_COINS = [
  { sym: 'AT', name: 'AT', price: 1, dp: 2 },
  { sym: 'ATH', name: 'ATH', price: 1, dp: 2 },
] as const;
export type SwapCoin = typeof SWAP_COINS[number];
export type SwapReceiptData = {
  reference: string;
  createdAt: string;
  pay: SwapCoin;
  receive: SwapCoin;
  quote: ReturnType<typeof swapQuote>;
};
export const swapUnits = (value: number, coin: SwapCoin) =>
  value.toLocaleString('en-US', { maximumFractionDigits: coin.dp });
export function swapQuote(pay: SwapCoin, receive: SwapCoin, amount = 0, rate = 1) {
  if (pay.sym !== 'AT' || receive.sym !== 'ATH') throw new Error('Only AT to ATH swaps are supported.');
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid swap amount.');
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('The backend returned an invalid swap rate.');
  // The source backend applies its configured rate without an additional fee.
  return { amount, feeAmount: 0, receiveAmount: amount * rate, value: amount, fee: 0, receiveValue: amount * rate };
}
