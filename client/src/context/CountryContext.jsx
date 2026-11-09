import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CountryContext = createContext(null);

export function CountryProvider({ children }) {
  const { user } = useAuth();
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCountries = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/countries');
      setCountries(data.data);

      // Restore selected from localStorage or pick first
      const savedId = localStorage.getItem('selectedCountryId');
      const saved = data.data.find((c) => c.id === parseInt(savedId));
      setSelectedCountry(saved || data.data[0] || null);
    } catch {
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const selectCountry = (country) => {
    setSelectedCountry(country);
    localStorage.setItem('selectedCountryId', country?.id);
  };

  return (
    <CountryContext.Provider
      value={{
        countries,
        selectedCountry,
        selectCountry,
        loading,
        refreshCountries: fetchCountries,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used within CountryProvider');
  return ctx;
}
