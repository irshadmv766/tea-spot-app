export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatSignedMoney(net: number): string {
  if (net < 0) return `-${formatMoney(Math.abs(net))}`;
  if (net > 0) return `+${formatMoney(net)}`;
  return formatMoney(0);
}