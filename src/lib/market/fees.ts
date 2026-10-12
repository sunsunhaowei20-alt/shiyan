export const COMMISSION_RATE = 0.00025;
export const MIN_COMMISSION = 5;
export const STAMP_RATE = 0.0005;
export const TRANSFER_RATE = 0.00001;
export const INITIAL_CASH = 1_000_000;

export function commission(notional: number) {
  if (notional <= 0) return 0;
  return Math.max(MIN_COMMISSION, notional * COMMISSION_RATE);
}

export function buyFee(notional: number) {
  return commission(notional) + notional * TRANSFER_RATE;
}

export function sellFee(notional: number) {
  return commission(notional) + notional * TRANSFER_RATE + notional * STAMP_RATE;
}

export function buyCost(qty: number, price: number) {
  const notional = qty * price;
  return notional + buyFee(notional);
}

export function sellNet(qty: number, price: number) {
  const notional = qty * price;
  const fee = sellFee(notional);
  return { notional, fee, proceeds: notional - fee };
}

export function maxAffordableShares(cash: number, price: number, lotSize: number) {
  if (!(price > 0) || !(cash > 0) || lotSize <= 0) return 0;
  const variableRate = COMMISSION_RATE + TRANSFER_RATE;
  let shares = Math.floor(cash / (price * (1 + variableRate)) / lotSize) * lotSize;
  while (shares > 0 && buyCost(shares, price) > cash + 0.001) {
    shares -= lotSize;
  }
  return Math.max(0, shares);
}
