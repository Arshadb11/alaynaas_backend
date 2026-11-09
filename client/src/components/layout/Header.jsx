import { useCountry } from '../../context/CountryContext';
import { HiOutlineGlobeAlt, HiOutlineMenuAlt2 } from 'react-icons/hi';
import CountryFlag from '../ui/CountryFlag';

export default function Header({ onMenuClick = () => {} }) {
  const { countries, selectedCountry, selectCountry } = useCountry();

  return (
    <header className="h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-3.5 sm:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 rounded-xl text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 lg:hidden focus:outline-none"
          title="Open Menu"
          aria-label="Open sidebar menu"
        >
          <HiOutlineMenuAlt2 className="w-5 h-5" />
        </button>

        <h1 className="text-sm sm:text-base font-bold text-surface-900 dark:text-white font-display whitespace-nowrap">
          Admin Panel
        </h1>
      </div>

      {/* Global Country Selector */}
      {countries && countries.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {selectedCountry ? (
            <CountryFlag code={selectedCountry.code} name={selectedCountry.name} size="sm" className="hidden sm:inline-block" />
          ) : (
            <HiOutlineGlobeAlt className="w-4 h-4 text-primary-500 flex-shrink-0 hidden sm:block" />
          )}
          <select
            value={selectedCountry?.id || ''}
            onChange={(e) => {
              const found = countries.find((c) => c.id === parseInt(e.target.value));
              if (found) selectCountry(found);
            }}
            className="bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-200 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-colors max-w-[140px] sm:max-w-none truncate shadow-2xs"
            title="Active Country Store"
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name ? `${c.name} (${c.currency_code})` : c.currency_code}
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}

