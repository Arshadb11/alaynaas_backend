import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const BrandingContext = createContext(null);

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      adminLogo: '/LOGO/Desktop.svg',
      adminLogoHeight: 32,
      favicon: '/LOGO/Mobile.svg',
      storeName: 'ALAYNAAS',
      branding: {},
      refreshBranding: () => {},
    };
  }
  return context;
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/store/settings');
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setBranding(data);

        // Dynamically update browser tab favicon in Admin Panel
        if (data.favicon) {
          const favUrl = data.favicon.startsWith('http') ? data.favicon : `http://localhost:3000${data.favicon}`;
          let link = document.querySelector("link[rel*='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = favUrl;
        }

        // Dynamically update Admin Panel page title
        if (data.store_name) {
          document.title = `${data.store_name} | Admin Panel`;
        }
      }
    } catch (err) {
      console.warn('[Branding] Falling back to default admin brand:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const resolveUrl = (u, fallback) => {
    if (!u) return fallback;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `http://localhost:3000${u.startsWith('/') ? u : `/${u}`}`;
  };

  const adminLogo = resolveUrl(branding.admin_logo, '/LOGO/Desktop.svg');
  const favicon = resolveUrl(branding.favicon, '/LOGO/Mobile.svg');
  const storeName = branding.store_name || 'ALAYNAAS';
  const adminLogoHeight = Number(branding.admin_logo_height) || 32;

  return (
    <BrandingContext.Provider value={{ branding, adminLogo, adminLogoHeight, favicon, storeName, loading, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
