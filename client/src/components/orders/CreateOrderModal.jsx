import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { useCountry } from '../../context/CountryContext';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  getOrderStatusConfig,
  getPaymentMethodLabel,
} from '../../config/orderConfig';
import CountryFlag from '../ui/CountryFlag';
import {
  HiOutlineX,
  HiOutlineShoppingBag,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineUser,
  HiOutlineLocationMarker,
  HiOutlineCreditCard,
  HiOutlineGift,
  HiOutlineCheck,
  HiOutlineChevronRight,
  HiOutlineChevronLeft,
  HiOutlineTruck,
  HiOutlineDocumentText,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
} from 'react-icons/hi';

const STEPS = [
  { id: 1, label: 'Market & Customer' },
  { id: 2, label: 'Perfumes & Bundles' },
  { id: 3, label: 'Gifting & Notes' },
  { id: 4, label: 'Review & Confirm' },
];

export default function CreateOrderModal({ isOpen, onClose, onOrderCreated = () => {} }) {
  const { countries, selectedCountry } = useCountry();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    country_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: {
      recipient_name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state_province_emirate: '',
      country_code: '',
      postal_code: '',
      delivery_instructions: '',
    },
    items: [],
    shipping_fee: 0,
    discount_amount: 0,
    payment_method: 'credit_card',
    payment_reference: '',
    is_paid: false,
    status: 'confirmed',
    customer_notes: '',
    internal_notes: '',
    is_gift: false,
    gift_engraving_text: '',
  });

  // Product Search & Catalog State
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Initialize Country from Global Context when opening
  useEffect(() => {
    if (isOpen) {
      const defaultCountry = selectedCountry || (countries && countries[0]);
      if (defaultCountry) {
        setFormData((prev) => ({
          ...prev,
          country_id: defaultCountry.id,
          shipping_address: {
            ...prev.shipping_address,
            country_code: defaultCountry.code,
          },
        }));
      }
    }
  }, [isOpen, selectedCountry, countries]);

  // Selected Country Metadata
  const activeCountry = useMemo(() => {
    if (!formData.country_id || !countries) return null;
    return countries.find((c) => c.id === parseInt(formData.country_id)) || null;
  }, [formData.country_id, countries]);

  // Live Product Search
  const searchProducts = useCallback(async () => {
    if (!formData.country_id) return;
    setSearchLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          country_id: formData.country_id,
          search: productSearch.trim() || undefined,
          limit: 12,
        },
      });
      setSearchResults(res.data.products || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [formData.country_id, productSearch]);

  useEffect(() => {
    if (isOpen && currentStep === 2) {
      const debounce = setTimeout(searchProducts, 250);
      return () => clearTimeout(debounce);
    }
  }, [isOpen, currentStep, searchProducts]);

  // Switch Country Handler
  const handleCountryChange = (newCountryId) => {
    const match = countries?.find((c) => c.id === parseInt(newCountryId));
    setFormData((prev) => ({
      ...prev,
      country_id: newCountryId,
      items: [], // Reset items as stock/currency varies by country
      shipping_address: {
        ...prev.shipping_address,
        country_code: match?.code || '',
      },
    }));
  };

  // Add Item to Order
  const handleAddItem = (prod) => {
    setFormData((prev) => {
      const existsIndex = prev.items.findIndex((i) => i.product_id === prod.id);
      const stock = parseInt(prod.country_stock_quantity || 0);

      if (existsIndex >= 0) {
        const currentQty = prev.items[existsIndex].quantity;
        if (currentQty + 1 > stock) {
          toast.warning(`Cannot exceed available warehouse stock (${stock} units)`);
          return prev;
        }
        const updated = [...prev.items];
        updated[existsIndex] = {
          ...updated[existsIndex],
          quantity: currentQty + 1,
        };
        return { ...prev, items: updated };
      }

      if (stock < 1) {
        toast.warning('Product is currently out of stock in this market');
        return prev;
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: prod.id,
            product_name: prod.name,
            product_name_ar: prod.name_ar,
            sku: prod.sku,
            size_name: prod.size_name,
            unit_price: parseFloat(prod.price || 0),
            quantity: 1,
            max_stock: stock,
            is_bundle: Boolean(prod.is_bundle),
            image_url: prod.primary_image_url,
          },
        ],
      };
    });
  };

  // Update Item Quantity
  const handleUpdateItemQuantity = (productId, delta) => {
    setFormData((prev) => {
      const updated = prev.items
        .map((i) => {
          if (i.product_id === productId) {
            const nextQty = i.quantity + delta;
            if (nextQty > i.max_stock) {
              toast.warning(`Maximum available stock: ${i.max_stock}`);
              return i;
            }
            return { ...i, quantity: nextQty };
          }
          return i;
        })
        .filter((i) => i.quantity > 0);

      return { ...prev, items: updated };
    });
  };

  // Remove Item
  const handleRemoveItem = (productId) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.product_id !== productId),
    }));
  };

  // Financial Calculations
  const financials = useMemo(() => {
    const subtotal = formData.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const shipping = Math.max(0, parseFloat(formData.shipping_fee) || 0);
    const discount = Math.max(0, parseFloat(formData.discount_amount) || 0);
    const taxPct = parseFloat(activeCountry?.tax_percentage || 5.0);
    const taxableBase = Math.max(0, subtotal - discount);
    const taxAmount = (taxableBase * taxPct) / 100;
    const grandTotal = taxableBase + taxAmount + shipping;

    return {
      subtotal,
      shipping,
      discount,
      taxPct,
      taxAmount,
      grandTotal,
      currency: activeCountry?.currency_code || 'AED',
      decimals: activeCountry?.decimal_places || 2,
    };
  }, [formData.items, formData.shipping_fee, formData.discount_amount, activeCountry]);

  // Form Submission
  const handleSubmit = async () => {
    if (formData.items.length === 0) {
      toast.error('Please add at least one perfume item to the order');
      setCurrentStep(2);
      return;
    }
    if (!formData.customer_name || !formData.customer_phone || !formData.customer_email) {
      toast.error('Please enter required customer contact information');
      setCurrentStep(1);
      return;
    }
    if (!formData.shipping_address.address_line1 || !formData.shipping_address.city) {
      toast.error('Please enter delivery street address and city');
      setCurrentStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        country_id: parseInt(formData.country_id),
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim(),
        customer_phone: formData.customer_phone.trim(),
        shipping_address: {
          recipient_name: formData.shipping_address.recipient_name || formData.customer_name,
          phone: formData.shipping_address.phone || formData.customer_phone,
          address_line1: formData.shipping_address.address_line1.trim(),
          address_line2: formData.shipping_address.address_line2?.trim() || null,
          city: formData.shipping_address.city.trim(),
          state_province_emirate: formData.shipping_address.state_province_emirate?.trim() || null,
          country_code: activeCountry?.code || formData.shipping_address.country_code || 'AE',
          postal_code: formData.shipping_address.postal_code?.trim() || null,
          delivery_instructions: formData.shipping_address.delivery_instructions?.trim() || null,
        },
        items: formData.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        shipping_fee: financials.shipping,
        discount_amount: financials.discount,
        payment_method: formData.payment_method,
        payment_reference: formData.payment_reference.trim() || undefined,
        is_paid: formData.is_paid,
        status: formData.status,
        customer_notes: formData.customer_notes.trim() || undefined,
        internal_notes: formData.internal_notes.trim() || undefined,
        is_gift: formData.is_gift,
        gift_engraving_text: formData.is_gift && formData.gift_engraving_text.trim()
          ? formData.gift_engraving_text.trim()
          : undefined,
      };

      const res = await api.post('/orders', payload);
      toast.success(`Order ${res.data.data.order_number} created successfully`);
      onOrderCreated(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-surface-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">
        {/* ── Top Header ── */}
        <div className="px-6 py-4 border-b border-surface-200/80 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-surface-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800/60 shrink-0">
              <HiOutlineShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">
                Create Concierge Order
              </h2>
              <p className="text-xs text-surface-400">
                Manual boutique & VIP client order entry with real-time warehouse inventory checks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* ── Progress Stepper Bar ── */}
        <div className="px-6 py-3 bg-surface-50 dark:bg-surface-800/40 border-b border-surface-200/80 dark:border-surface-800 flex items-center justify-between shrink-0">
          <div className="grid grid-cols-4 gap-2 w-full">
            {STEPS.map((s) => {
              const isCurrent = currentStep === s.id;
              const isCompleted = currentStep > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-purple-600 text-white shadow-xs'
                      : isCompleted
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                        : 'text-surface-400 hover:text-surface-600'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                      isCurrent
                        ? 'bg-white text-purple-700 font-bold'
                        : isCompleted
                          ? 'bg-purple-600 text-white'
                          : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                    }`}
                  >
                    {isCompleted ? <HiOutlineCheck className="w-3 h-3 stroke-2" /> : s.id}
                  </span>
                  <span className="truncate hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Step Body Content (Scrollable) ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: MARKET COUNTRY & CUSTOMER PROFILE */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                    Target Destination Market
                  </h4>
                  <p className="text-xs text-purple-700/80 dark:text-purple-400 mt-0.5">
                    Orders are partitioned by country warehouse. Inventory and VAT ({activeCountry?.tax_percentage || 5}%) are calculated based on this market.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeCountry && (
                    <CountryFlag code={activeCountry.code} name={activeCountry.name} size="md" />
                  )}
                  <select
                    value={formData.country_id}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-surface-800 border border-purple-200 dark:border-purple-700 text-surface-900 dark:text-white shrink-0 focus:ring-2 focus:ring-purple-500"
                  >
                    {countries?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name} ({c.currency_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HiOutlineUser className="w-4 h-4 text-purple-500" />
                  <span>Customer Contact Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData((p) => ({ ...p, customer_name: e.target.value }))}
                      placeholder="e.g. HH Sheikh Mansoor Al Otaiba"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-purple-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData((p) => ({ ...p, customer_email: e.target.value }))}
                      placeholder="client@luxury-domain.ae"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-purple-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Phone Number (with Country Code) *
                    </label>
                    <input
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData((p) => ({ ...p, customer_phone: e.target.value }))}
                      placeholder="+971 50 123 4567"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-purple-500/20"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-surface-100 dark:border-surface-800">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HiOutlineLocationMarker className="w-4 h-4 text-purple-500" />
                  <span>Delivery Destination</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Street Address / Villa Number *
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_address.address_line1}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          shipping_address: { ...p.shipping_address, address_line1: e.target.value },
                        }))
                      }
                      placeholder="e.g. Villa 12, Al Wasl Road"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Area / Neighborhood (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_address.address_line2}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          shipping_address: { ...p.shipping_address, address_line2: e.target.value },
                        }))
                      }
                      placeholder="e.g. Jumeirah 1"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_address.city}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          shipping_address: { ...p.shipping_address, city: e.target.value },
                        }))
                      }
                      placeholder="Dubai, Riyadh, Kuwait City"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      State / Emirate / Province
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_address.state_province_emirate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          shipping_address: { ...p.shipping_address, state_province_emirate: e.target.value },
                        }))
                      }
                      placeholder="e.g. Dubai, Riyadh Province"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Delivery Courier Instructions
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_address.delivery_instructions}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          shipping_address: { ...p.shipping_address, delivery_instructions: e.target.value },
                        }))
                      }
                      placeholder="e.g. Leave with private security gate / Call upon arrival"
                      className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PERFUMES & BUNDLES PICKER */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-fade-in">
              {/* Product Live Search Bar */}
              <div className="relative">
                <HiOutlineSearch className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Search luxury perfumes in ${activeCountry?.name || 'market'} by name, SKU, or olfactory profile...`}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Product Search Results Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-surface-500">
                  <span>Available Fragrances ({searchResults.length})</span>
                  <span className="flex items-center gap-1.5">
                    Warehouse: {activeCountry && <CountryFlag code={activeCountry.code} size="xs" />}
                    <span>{activeCountry?.name}</span>
                  </span>
                </div>

                {searchLoading ? (
                  <div className="py-12 text-center text-xs text-surface-400">
                    Checking live inventory in {activeCountry?.name}...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {searchResults.map((prod) => {
                      const stock = parseInt(prod.country_stock_quantity || 0);
                      const isOutOfStock = stock < 1;
                      const selectedCount =
                        formData.items.find((i) => i.product_id === prod.id)?.quantity || 0;

                      return (
                        <div
                          key={prod.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                            isOutOfStock
                              ? 'opacity-50 border-surface-200 dark:border-surface-800 bg-surface-50/50'
                              : 'bg-white dark:bg-surface-850 border-surface-200 dark:border-surface-700 hover:border-purple-300 dark:hover:border-purple-600'
                          }`}
                        >
                          {prod.primary_image_url ? (
                            <img
                              src={prod.primary_image_url}
                              alt={prod.name}
                              className="w-10 h-10 rounded-lg object-cover border border-surface-200 dark:border-surface-700 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                              <HiOutlineShoppingBag className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-surface-900 dark:text-white truncate">
                              {prod.name}
                            </h5>
                            <p className="text-[10px] text-surface-400 font-mono">
                              SKU: {prod.sku} {prod.size_name && `· ${prod.size_name}`}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">
                                {parseFloat(prod.price).toFixed(financials.decimals)} {financials.currency}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                  isOutOfStock
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                                }`}
                              >
                                {isOutOfStock ? '0 stock' : `${stock} avail`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isOutOfStock || selectedCount >= stock}
                            onClick={() => handleAddItem(prod)}
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-600 hover:text-white dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            title="Add to order"
                          >
                            <HiOutlinePlus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Order Basket */}
              <div className="space-y-2 pt-3 border-t border-surface-100 dark:border-surface-800">
                <h4 className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Selected Perfumes in Basket ({formData.items.length})</span>
                  <span className="font-mono text-purple-600">
                    Subtotal: {financials.subtotal.toFixed(financials.decimals)} {financials.currency}
                  </span>
                </h4>

                {formData.items.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl text-xs text-surface-400">
                    No items selected yet. Search and click (+) above to add fragrances to this concierge order.
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100 dark:divide-surface-800 border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {formData.items.map((item) => (
                      <div
                        key={item.product_id}
                        className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-surface-850"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-surface-900 dark:text-white truncate">
                            {item.product_name}
                          </p>
                          <span className="text-[10px] text-surface-400 font-mono">
                            {item.sku} {item.size_name && `· ${item.size_name}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-xs text-surface-800 dark:text-surface-200">
                            {(item.unit_price * item.quantity).toFixed(financials.decimals)} {financials.currency}
                          </span>

                          <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product_id, -1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-surface-600 hover:bg-white dark:hover:bg-surface-700 text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.product_id, 1)}
                              className="w-5 h-5 flex items-center justify-center rounded text-surface-600 hover:bg-white dark:hover:bg-surface-700 text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product_id)}
                            className="p-1 text-surface-400 hover:text-rose-600 transition-colors"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: BESPOKE GIFTING & CONCIERGE NOTES */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              {/* Gift Set & Custom Bottle Engraving */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiOutlineGift className="w-5 h-5 text-amber-600" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Bespoke Gifting & Custom Bottle Engraving
                      </h4>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Signature gift ribbon packaging & personalized laser engraving on perfume bottles
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_gift}
                      onChange={(e) => setFormData((p) => ({ ...p, is_gift: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                  </label>
                </div>

                {formData.is_gift && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 space-y-2">
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 block">
                      Custom Laser Engraving Text (Max 50 Characters)
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={formData.gift_engraving_text}
                      onChange={(e) => setFormData((p) => ({ ...p, gift_engraving_text: e.target.value }))}
                      placeholder="e.g. With Royal Regards - Alaynaa's Parfums"
                      className="w-full p-2.5 text-xs font-serif italic rounded-xl bg-white dark:bg-surface-850 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100"
                    />
                    {formData.gift_engraving_text && (
                      <div className="p-3 rounded-xl bg-amber-100/50 dark:bg-amber-900/30 border border-amber-300/60 text-center">
                        <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-widest mb-0.5">
                          Bottle Laser Engraving Preview
                        </span>
                        <p className="font-serif italic text-sm font-semibold text-amber-950 dark:text-amber-100">
                          "{formData.gift_engraving_text}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Adjustments: Shipping Fee & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Courier Shipping Fee ({financials.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.shipping_fee}
                    onChange={(e) => setFormData((p) => ({ ...p, shipping_fee: e.target.value }))}
                    className="w-full p-2.5 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    VIP Promotional Discount ({financials.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData((p) => ({ ...p, discount_amount: e.target.value }))}
                    className="w-full p-2.5 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Internal & Customer Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Client Special Request / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={formData.customer_notes}
                    onChange={(e) => setFormData((p) => ({ ...p, customer_notes: e.target.value }))}
                    placeholder="e.g. Include 3 complimentary discovery samples..."
                    className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Internal Staff & Warehouse Note
                  </label>
                  <textarea
                    rows={3}
                    value={formData.internal_notes}
                    onChange={(e) => setFormData((p) => ({ ...p, internal_notes: e.target.value }))}
                    placeholder="e.g. VIP client concierge order — verify batch code before packaging."
                    className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-fade-in">
              {/* Payment & Fulfillment Configuration */}
              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))}
                    className="w-full p-2 text-xs rounded-xl bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Initial Fulfillment State
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                    className="w-full p-2 text-xs rounded-xl bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  >
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={formData.is_paid}
                      onChange={(e) => setFormData((p) => ({ ...p, is_paid: e.target.checked }))}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Mark as Paid Immediately</span>
                  </label>
                </div>
              </div>

              {/* Order Dossier Summary Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Customer & Items */}
                <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 bg-surface-50/50 dark:bg-surface-850/50">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                    Customer & Destination
                  </h4>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-surface-900 dark:text-white">
                      {formData.customer_name}
                    </p>
                    <p className="text-surface-500">{formData.customer_email} · {formData.customer_phone}</p>
                    <p className="text-surface-600 dark:text-surface-300 flex items-center gap-1.5 flex-wrap">
                      <span>{formData.shipping_address.address_line1}, {formData.shipping_address.city}</span>
                      {activeCountry && (
                        <span className="inline-flex items-center gap-1">
                          · <CountryFlag code={activeCountry.code} size="xs" /> {activeCountry.name}
                        </span>
                      )}
                    </p>
                  </div>

                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider pt-2 border-t border-surface-100 dark:border-surface-800">
                    Perfumes Ordered ({formData.items.length})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {formData.items.map((i) => (
                      <div key={i.product_id} className="flex justify-between text-xs">
                        <span className="truncate">
                          {i.quantity}× {i.product_name}
                        </span>
                        <span className="font-mono font-medium shrink-0">
                          {(i.unit_price * i.quantity).toFixed(financials.decimals)} {financials.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Financial Totals */}
                <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850/50 space-y-2.5 text-xs">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                    Financial Ledger
                  </h4>

                  <div className="flex justify-between text-surface-600 dark:text-surface-400">
                    <span>Items Subtotal</span>
                    <span className="font-mono font-semibold text-surface-900 dark:text-white">
                      {financials.subtotal.toFixed(financials.decimals)} {financials.currency}
                    </span>
                  </div>

                  {financials.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>VIP Promotional Discount</span>
                      <span className="font-mono font-semibold">
                        -{financials.discount.toFixed(financials.decimals)} {financials.currency}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-surface-600 dark:text-surface-400">
                    <span>Courier Shipping Fee</span>
                    <span className="font-mono font-semibold text-surface-900 dark:text-white">
                      {financials.shipping.toFixed(financials.decimals)} {financials.currency}
                    </span>
                  </div>

                  <div className="flex justify-between text-surface-600 dark:text-surface-400">
                    <span>Regional VAT ({financials.taxPct}%)</span>
                    <span className="font-mono font-semibold text-surface-900 dark:text-white">
                      {financials.taxAmount.toFixed(financials.decimals)} {financials.currency}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-between items-baseline text-sm font-bold text-surface-900 dark:text-white">
                    <span>Grand Total</span>
                    <span className="font-mono text-base text-purple-600 dark:text-purple-400">
                      {financials.grandTotal.toFixed(financials.decimals)} {financials.currency}
                    </span>
                  </div>

                  <div className="pt-2 text-[11px] text-surface-400">
                    Payment via <strong>{getPaymentMethodLabel(formData.payment_method)}</strong> · Initial Status:{' '}
                    <strong>{getOrderStatusConfig(formData.status).label}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Navigation Buttons ── */}
        <div className="px-6 py-4 border-t border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850/50 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-200 transition-colors"
              >
                <HiOutlineChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1) {
                    if (!formData.customer_name || !formData.customer_phone || !formData.customer_email) {
                      toast.error('Please enter required customer contact information');
                      return;
                    }
                    if (!formData.shipping_address.address_line1 || !formData.shipping_address.city) {
                      toast.error('Please enter delivery street address and city');
                      return;
                    }
                  }
                  if (currentStep === 2 && formData.items.length === 0) {
                    toast.error('Please select at least one perfume item');
                    return;
                  }
                  setCurrentStep((prev) => prev + 1);
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all"
              >
                <span>Continue</span>
                <HiOutlineChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-50"
              >
                <HiOutlineCheckCircle className="w-4 h-4" />
                <span>{submitting ? 'Confirming Order...' : 'Confirm & Place Order'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
