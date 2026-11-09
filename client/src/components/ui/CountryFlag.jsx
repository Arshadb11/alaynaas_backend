import { useState } from 'react';

/**
 * Helper to get flagcdn.com URL for a given country code
 * @param {string} countryCode 2-letter ISO country code (e.g. 'AE', 'SA', 'KW')
 * @returns {string} flagcdn.com SVG URL
 */
export function getCountryFlagUrl(countryCode) {
  if (!countryCode) return '';
  const cleanCode = countryCode.trim().toLowerCase();
  return `https://flagcdn.com/${cleanCode}.svg`;
}

/**
 * CountryFlag Component
 * Renders high-definition vector national flags from flagcdn.com
 * with rounded borders and graceful font-based fallback on error/missing.
 */
export default function CountryFlag({
  code,
  name,
  size = 'sm',
  className = '',
  title,
}) {
  const [error, setError] = useState(false);

  if (!code) return null;

  const cleanCode = String(code).trim().toUpperCase();
  const flagUrl = getCountryFlagUrl(cleanCode);

  // Dimension presets with 4:3 standard flag aspect ratio
  const sizeClasses = {
    xs: 'w-4 h-3 min-w-[16px] text-[8px]',
    sm: 'w-5 h-3.5 min-w-[20px] text-[9px]',
    md: 'w-6 h-4.5 min-w-[24px] text-[10px]',
    lg: 'w-8 h-6 min-w-[32px] text-xs',
    xl: 'w-10 h-7.5 min-w-[40px] text-sm',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.sm;

  if (error) {
    return (
      <span
        className={`inline-flex items-center justify-center font-mono font-bold uppercase rounded-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 shrink-0 select-none ${currentSizeClass} ${className}`}
        title={title || name || cleanCode}
      >
        {cleanCode.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={name || `${cleanCode} flag`}
      title={title || name || cleanCode}
      onError={() => setError(true)}
      loading="lazy"
      className={`inline-block object-cover rounded-xs border border-surface-300/70 dark:border-surface-700/80 shadow-2xs shrink-0 select-none align-middle ${currentSizeClass} ${className}`}
    />
  );
}

/**
 * CountryBadge Component
 * Convenient pill badge displaying CountryFlag + Country Code/Label
 */
export function CountryBadge({
  code,
  label,
  name,
  size = 'xs',
  className = '',
}) {
  if (!code) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-semibold bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 shrink-0 ${className}`}
    >
      <CountryFlag code={code} name={name} size={size} />
      <span>{label || code}</span>
    </span>
  );
}
