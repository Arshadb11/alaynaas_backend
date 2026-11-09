/**
 * Format currency with appropriate decimals and currency code
 * Respects 2-decimal (AED, SAR) vs 3-decimal (KWD, BHR, OMR) precision
 * 
 * @param {number|string} amount
 * @param {string} currencyCode
 * @param {number} decimals
 * @returns {string} Formatted currency string (e.g. "1,250.00 AED")
 */
export function formatCurrency(amount, currencyCode = 'AED', decimals = 2) {
  const num = parseFloat(amount);
  if (isNaN(num)) return `0.${'0'.repeat(decimals || 2)} ${currencyCode}`;
  const dec = parseInt(decimals, 10);
  const safeDec = isNaN(dec) ? 2 : dec;

  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: safeDec,
    maximumFractionDigits: safeDec,
  })} ${currencyCode}`;
}

export default formatCurrency;
