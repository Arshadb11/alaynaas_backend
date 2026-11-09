import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CountryProvider } from './context/CountryContext';
import { BrandingProvider } from './context/BrandingContext';
import { ToastContainer } from './components/ui/Toast';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Sessions from './pages/Sessions';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import Countries from './pages/Countries';
import Catalog from './pages/Catalog';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Fragrance from './pages/Fragrance';
import FileManager from './pages/FileManager';
import Settings from './pages/Settings';
import Storefront from './pages/Storefront';
import Reviews from './pages/Reviews';

function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <BrowserRouter>
          <AuthProvider>
            <CountryProvider>
              <ToastContainer />
              <Routes>
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/orders" element={<ProtectedRoute permission="orders.read"><Orders /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute permission="products.read"><Products /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute permission="products.read"><Reviews /></ProtectedRoute>} />
                <Route path="/catalog" element={<ProtectedRoute anyOf={['categories.read', 'brands.read', 'categories.manage', 'brands.manage']}><Catalog /></ProtectedRoute>} />
                <Route path="/fragrance" element={<ProtectedRoute permission="products.read"><Fragrance /></ProtectedRoute>} />
                <Route path="/countries" element={<ProtectedRoute permission="countries.read"><Countries /></ProtectedRoute>} />
                <Route path="/files" element={<ProtectedRoute permission="files.read"><FileManager /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute permission="users.read"><Users /></ProtectedRoute>} />
                <Route path="/roles" element={<ProtectedRoute permission="users.manage_permissions"><Roles /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute permission="audit.read"><AuditLogs /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute permission="settings.read"><Settings /></ProtectedRoute>} />
                <Route path="/storefront" element={<ProtectedRoute permission="settings.read"><Storefront /></ProtectedRoute>} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </CountryProvider>
        </AuthProvider>
      </BrowserRouter>
      </BrandingProvider>
    </ThemeProvider>
  );
}

export default App;
