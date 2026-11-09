import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import SizeCombobox from './SizeCombobox';
import OlfactoryCombobox from './OlfactoryCombobox';
import NoteCombobox from './NoteCombobox';
import {
  HiOutlineX,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePhotograph,
  HiOutlineLockClosed,
  HiOutlineCheck,
  HiOutlineSparkles,
  HiOutlineTag,
  HiOutlineGlobeAlt,
  HiOutlineEye,
  HiOutlineSearch,
  HiOutlineFolder,
  HiOutlineUpload,
  HiOutlineChevronRight,
  HiOutlineGift,
  HiStar,
  HiOutlineDuplicate,
  HiOutlineLink,
  HiOutlineHeart,
  HiOutlineCube,
} from 'react-icons/hi';
import FilePickerModal from '../files/FilePickerModal';
import CountryFlag from '../ui/CountryFlag';
import { useRef } from 'react';

const SPEC_PRESETS = [
  { key: 'fragrance_type', label: 'Fragrance Type', defaultVal: 'Eau De Parfum' },
  { key: 'fragrance_category', label: 'Fragrance Category', defaultVal: 'Oriental' },
  { key: 'dispenser_type', label: 'Dispenser Type', defaultVal: 'Spray' },
  { key: 'sillage', label: 'Sillage', defaultVal: 'Strong' },
  { key: 'longevity', label: 'Longevity', defaultVal: '12+ Hours' },
  { key: 'season', label: 'Season', defaultVal: 'All Season' },
  { key: 'occasion', label: 'Occasion', defaultVal: 'Evening / Signature' },
  { key: 'origin', label: 'Origin', defaultVal: 'United Arab Emirates' },
  { key: 'character', label: 'Character sliders (Fresh-Warm, Bright-Dark, Soft-Bold, Airy-Deep: 0-100)', defaultVal: '50,50,50,50' },
  { key: 'wear', label: 'Wear it when (en|ar; separated by ;)', defaultVal: 'Evenings out|الأمسيات; Special occasions|المناسبات الخاصة; Cooler weather|الأجواء الباردة' },
];

// Absolute origin of the API server (so uploaded files get a full URL, not a hardcoded localhost)
const apiOrigin = () => String(api.defaults?.baseURL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
const toAbsUrl = (u) => (/^https?:\/\//i.test(u) ? u : `${apiOrigin()}${u}`);

/**
 * Reconstruct hierarchical category ID path [rootId, subId1, subId2, ...] from metadata
 */
const buildCategoryPath = (catId, subcatId, categories = []) => {
  if (!categories || categories.length === 0) return [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Start with deepest known category
  const targetId = subcatId || catId;
  if (!targetId) return [];

  const path = [];
  let curr = catMap.get(parseInt(targetId, 10));
  const visited = new Set();

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    path.unshift(curr.id);
    if (curr.parent_id === 0) break;
    curr = catMap.get(curr.parent_id);
  }

  // Prepend root if catId was supplied and is a root category not already in path
  if (catId && path.length > 0 && !path.includes(parseInt(catId, 10))) {
    const rootCurr = catMap.get(parseInt(catId, 10));
    if (rootCurr && rootCurr.parent_id === 0) {
      path.unshift(rootCurr.id);
    }
  }

  return path;
};

export default function ProductEditor({ productId, cloneFromId = null, isOpen, onClose, onSaved }) {
  // Clone mode: behaves like "create" but is pre-filled from an existing product
  const sourceId = productId || cloneFromId;
  const isCloning = !productId && !!cloneFromId;
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [metadata, setMetadata] = useState({
    categories: [],
    brands: [],
    sizes: [],
    olfactoryFamilies: [],
    fragranceNotes: [],
    countries: [],
  });

  const canFullUpdate = usePermission('products.update');
  const canEditPricing = canFullUpdate;

  // Form State
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    slug: '',
    brand_id: 1,
    category_id: '',
    subcategory_id: '',
    olfactory_family_ids: [],
    size_id: '',
    gender: 'unisex',
    short_description: '',
    short_description_ar: '',
    description: '',
    sku: '',
    status: 'draft',
    is_featured: false,
    is_limited_edition: false,
    edition_size: '',
    is_bundle: false,
  });

  // Bundle Items (Option B: sub-products/minis packaged in this gift set)
  const [bundleItems, setBundleItems] = useState([]);

  // Dynamic Specifications: array of { key, value }
  const [specsList, setSpecsList] = useState([]);

  // Fragrance Notes: array of { note_id, note_level, sort_order }
  const [notesMode, setNotesMode] = useState('pyramid'); // 'pyramid' | 'general'
  const [selectedNotes, setSelectedNotes] = useState([]); // { note_id, note_level }

  // Multi-Country Pricing: array of { country_id, price, cost_price, is_available }
  const [pricingList, setPricingList] = useState([]);

  // Images: array of { url, alt_text, is_primary, sort_order }
  const [imagesList, setImagesList] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);
  const [bundlePickerIndex, setBundlePickerIndex] = useState(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const productFileInputRef = useRef(null);

  // Relations: array of { related_product_id, relation_type }
  const [relationsList, setRelationsList] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Country-specific SEO: array of { country_id, country_code, country_name, seo_title, seo_description, seo_keywords }
  const [countrySeoList, setCountrySeoList] = useState([]);
  const [activeSeoCountryId, setActiveSeoCountryId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, productId, cloneFromId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [metaRes, prodsRes] = await Promise.all([
        api.get('/products/metadata'),
        api.get('/products?limit=100'),
      ]);
      setMetadata(metaRes.data.data);
      setAvailableProducts(prodsRes.data.products.filter((p) => p.id !== productId));

      if (sourceId) {
        // Edit / Clone Mode: fetch full product
        const { data } = await api.get(`/products/${sourceId}`);
        const prod = data.data;

        const catList = metaRes.data?.data?.categories || [];
        const path = buildCategoryPath(prod.category_id, prod.subcategory_id, catList);
        setSelectedCategoryPath(path.length > 0 ? path : (prod.category_id ? [parseInt(prod.category_id, 10)] : []));

        setForm({
          name: isCloning ? `${prod.name || ''} (Copy)` : prod.name || '',
          name_ar: prod.name_ar || '',
          // Clones start with a blank slug (auto-generated from the name) and SKU (must be unique)
          slug: isCloning ? '' : prod.slug || '',
          brand_id: prod.brand_id || 1,
          category_id: prod.category_id || '',
          subcategory_id: prod.subcategory_id || '',
          olfactory_family_ids: prod.olfactory_families?.map((f) => f.id) || prod.olfactory_family_ids || [],
          size_id: prod.size_id || '',
          gender: prod.gender || 'unisex',
          short_description: prod.short_description || '',
          short_description_ar: prod.short_description_ar || '',
          description: prod.description || '',
          description_ar: prod.description_ar || '',
          sku: isCloning ? '' : prod.sku || '',
          status: isCloning ? 'draft' : prod.status || 'draft',
          is_featured: !!prod.is_featured,
          is_limited_edition: !!prod.is_limited_edition,
          edition_size: prod.edition_size ?? '',
          is_bundle: Boolean(prod.is_bundle),
        });
        setBundleItems(
          (prod.bundle_items || []).map((b) => ({
            id: b.id,
            bundle_product_id: b.bundle_product_id,
            name: b.name || '',
            name_ar: b.name_ar || '',
            size: b.size || '',
            quantity: b.quantity ?? 1,
            image_url: b.image_url || '',
            scent_profile: b.scent_profile || '',
            notes_summary: b.notes_summary || '',
            notes_summary_ar: b.notes_summary_ar || '',
            description: b.description || '',
            description_ar: b.description_ar || '',
            sort_order: b.sort_order ?? 0,
          }))
        );

        // Convert specifications object to array
        const rawSpecs = prod.specifications || {};
        const specArr = Object.entries(rawSpecs).map(([key, value]) => ({ key, value }));
        setSpecsList(specArr);

        // Notes
        const rawNotes = (prod.notes || []).map((n) => ({
          note_id: n.note_id,
          note_level: n.note_level,
          name: n.name,
          name_ar: n.name_ar,
          image_url: n.image_url,
        }));
        setSelectedNotes(rawNotes);
        const hasGeneral = rawNotes.some((n) => n.note_level === 'general');
        setNotesMode(hasGeneral ? 'general' : 'pyramid');

        // Pricing & Country Stock
        const rawPricing = (prod.pricing || []).map((pr) => ({
          country_id: parseInt(pr.country_id ?? pr.id, 10),
          price: pr.price || 0,
          cost_price: pr.cost_price || 0,
          price_10ml: pr.price_10ml || '',
          stock_quantity: isCloning ? 0 : pr.stock_quantity ?? 0,
          low_stock_threshold: pr.low_stock_threshold ?? 5,
          is_available: pr.is_available === null || pr.is_available === undefined
            ? true
            : Boolean(pr.is_available === true || pr.is_available === 1 || pr.is_available === '1'),
          country_name: pr.country_name,
          currency_code: pr.currency_code,
          currency_symbol: pr.currency_symbol,
          decimal_places: pr.decimal_places ?? 2,
        }));
        setPricingList(rawPricing);

        // Images
        setImagesList(
          (prod.images || []).map((img) => ({
            ...img,
            is_primary: Boolean(img.is_primary),
          }))
        );

        // Relations
        setRelationsList(
          (prod.relations || []).map((r) => ({
            related_product_id: r.related_product_id,
            relation_type: r.relation_type,
            name: r.related_name,
          }))
        );

        // Country-specific SEO (scoped to user's assigned countries)
        const allowedCountries = metaRes.data.data.countries || [];
        const allowedCountryIdSet = new Set(allowedCountries.map((c) => c.id));
        const rawCountrySeo = (prod.country_seo && prod.country_seo.length > 0)
          ? prod.country_seo.filter((c) => allowedCountryIdSet.has(c.country_id))
          : allowedCountries.map((c) => ({
            country_id: c.id,
            country_code: c.code,
            country_name: c.name,
            seo_title: '',
            seo_description: '',
            seo_keywords: '',
          }));
        setCountrySeoList(rawCountrySeo);
        setActiveSeoCountryId(rawCountrySeo[0]?.country_id || allowedCountries[0]?.id || null);
      } else {
        // Create Mode: set defaults
        const catList = metaRes.data?.data?.categories || [];
        const rootCats = catList.filter((c) => c.parent_id === 0);
        const defaultRootId = rootCats[0]?.id || catList[0]?.id || '';
        setSelectedCategoryPath(defaultRootId ? [parseInt(defaultRootId, 10)] : []);

        setForm({
          name: '',
          name_ar: '',
          slug: '',
          brand_id: 1,
          category_id: defaultRootId,
          subcategory_id: '',
          olfactory_family_ids: [],
          size_id: '',
          gender: 'unisex',
          short_description: '',
          short_description_ar: '',
          description: '',
          description_ar: '',
          sku: '',
          status: 'draft',
          is_featured: false,
          is_limited_edition: false,
          edition_size: '',
          is_bundle: false,
        });

        setBundleItems([]);

        // Default specifications
        setSpecsList([
          { key: 'fragrance_type', value: 'Eau De Parfum' },
          { key: 'fragrance_category', value: 'Occidental' },
          { key: 'dispenser_type', value: 'Spray' },
          { key: 'sillage', value: 'Strong' },
          { key: 'longevity', value: '12+ Hours' },
        ]);

        // Default empty pricing for all allowed countries
        const countries = metaRes.data.data.countries || [];
        const initialPricing = countries.map((c) => ({
          country_id: c.id,
          price: 0,
          cost_price: 0,
          price_10ml: '',
          stock_quantity: 0,
          low_stock_threshold: 5,
          is_available: true,
          country_name: c.name,
          currency_code: c.currency_code,
          currency_symbol: c.currency_symbol,
          decimal_places: c.decimal_places ?? 2,
        }));
        setPricingList(initialPricing);

        // Default empty country-specific SEO
        const initialCountrySeo = countries.map((c) => ({
          country_id: c.id,
          country_code: c.code,
          country_name: c.name,
          seo_title: '',
          seo_description: '',
          seo_keywords: '',
        }));
        setCountrySeoList(initialCountrySeo);
        setActiveSeoCountryId(countries[0]?.id || null);

        setSelectedNotes([]);
        setImagesList([]);
        setRelationsList([]);
      }
    } catch (err) {
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  // ── Bundle Items Handlers (Option B) ───────────────────────
  const handleAddBundleItem = () => {
    setBundleItems((prev) => [
      ...prev,
      {
        name: '',
        name_ar: '',
        size: '10ml',
        quantity: 1,
        image_url: '',
        scent_profile: '',
        notes_summary: '',
        notes_summary_ar: '',
        description: '',
        description_ar: '',
        sort_order: prev.length + 1,
      },
    ]);
  };

  const handleUpdateBundleItem = (index, field, val) => {
    setBundleItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveBundleItem = (index) => {
    setBundleItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Specifications Handlers ────────────────────────────────
  const addSpecRow = (key = '', value = '') => {
    setSpecsList((prev) => [...prev, { key, value }]);
  };

  // Set (or create / clear) a single spec by key
  const upsertSpec = (key, value) => {
    setSpecsList((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      if (!value) return i === -1 ? prev : prev.filter((_, idx) => idx !== i);
      if (i === -1) return [...prev, { key, value }];
      const copy = [...prev];
      copy[i] = { ...copy[i], value };
      return copy;
    });
  };
  const specVal = (key) => specsList.find((r) => r.key === key)?.value || '';
  const [filmBusy, setFilmBusy] = useState('');
  const uploadFilm = async (file, key, maxMb) => {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File is too large (max ${maxMb}MB). Compress it first.`);
      return;
    }
    const fd = new FormData();
    fd.append('dir', 'Products');
    fd.append('files', file);
    setFilmBusy(key);
    try {
      const { data } = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = data.files?.[0]?.url;
      if (url) {
        upsertSpec(key, toAbsUrl(url));
        toast.success(key === 'video_url' ? 'Video uploaded. Save the product to publish it.' : 'Poster uploaded. Save the product to publish it.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setFilmBusy('');
    }
  };

  const updateSpecRow = (index, field, val) => {
    setSpecsList((prev) => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  const removeSpecRow = (index) => {
    setSpecsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Fragrance Notes Handlers ────────────────────────────────
  const handleSwitchNotesMode = (newMode) => {
    if (newMode === notesMode) return;
    setNotesMode(newMode);
    if (newMode === 'pyramid') {
      // Deselect general notes when switching to pyramid
      setSelectedNotes((prev) => prev.filter((n) => n.note_level !== 'general'));
    } else {
      // Deselect pyramid notes (top, heart, base) when switching to general
      setSelectedNotes((prev) => prev.filter((n) => n.note_level === 'general'));
    }
  };

  const handleAddNoteToLevel = (masterNote, level) => {
    setSelectedNotes((prev) => {
      if (prev.some((n) => n.note_id === masterNote.id && n.note_level === level)) {
        return prev;
      }
      return [
        ...prev,
        {
          note_id: masterNote.id,
          note_level: level,
          name: masterNote.name,
          name_ar: masterNote.name_ar,
          image_url: masterNote.image_url,
        },
      ];
    });
  };

  const handleRemoveNoteFromLevel = (noteId, level) => {
    setSelectedNotes((prev) =>
      prev.filter((n) => !(n.note_id === noteId && n.note_level === level))
    );
  };

  // ── Pricing Handlers ────────────────────────────────────────
  const updatePricingRow = (countryId, field, val) => {
    setPricingList((prev) =>
      prev.map((item) => (item.country_id === countryId ? { ...item, [field]: val } : item))
    );
  };

  // ── Images Handlers ─────────────────────────────────────────
  const addImage = () => {
    if (!newImageUrl.trim()) return;
    setImagesList((prev) => [
      ...prev,
      {
        url: newImageUrl.trim(),
        alt_text: form.name || 'Product Image',
        is_primary: prev.length === 0,
        sort_order: prev.length + 1,
      },
    ]);
    setNewImageUrl('');
  };

  // The first image is always the primary one; the list order is the storefront order.
  const normalizeImageOrder = (list) =>
    list.map((img, idx) => ({ ...img, is_primary: idx === 0, sort_order: idx }));

  // Move an image from one position to another (drag & drop)
  const [dragImageIdx, setDragImageIdx] = useState(null);
  const [dragOverImageIdx, setDragOverImageIdx] = useState(null);
  const moveImage = (from, to) => {
    if (from === null || to === null || from === to) return;
    setImagesList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalizeImageOrder(next);
    });
  };

  // "Set Primary" moves the chosen image to the front
  const setPrimaryImage = (index) => moveImage(index, 0);

  const removeImage = (index) => {
    setImagesList((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      if (filtered.length > 0 && !filtered.some((img) => img.is_primary)) {
        filtered[0].is_primary = true;
      }
      return filtered;
    });
  };

  // ── Relations Handlers ──────────────────────────────────────
  const addRelation = (relatedProductId, relationType) => {
    if (!relatedProductId) return;
    const prod = availableProducts.find((p) => p.id === parseInt(relatedProductId));
    if (!prod) return;

    if (relationsList.some((r) => r.related_product_id === prod.id && r.relation_type === relationType)) {
      toast.info('This relation is already added');
      return;
    }

    setRelationsList((prev) => [
      ...prev,
      {
        related_product_id: prod.id,
        relation_type: relationType,
        name: prod.name,
      },
    ]);
  };

  const removeRelation = (index) => {
    setRelationsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Country SEO Handlers ────────────────────────────────────
  const updateCountrySeo = (countryId, field, val) => {
    setCountrySeoList((prev) =>
      prev.map((item) => (item.country_id === countryId ? { ...item, [field]: val } : item))
    );
  };

  const copySeoToAllCountries = (sourceCountryId) => {
    const source = countrySeoList.find((s) => s.country_id === sourceCountryId);
    if (!source) return;
    setCountrySeoList((prev) =>
      prev.map((item) => ({
        ...item,
        seo_title: source.seo_title,
        seo_description: source.seo_description,
        seo_keywords: source.seo_keywords,
      }))
    );
    toast.success(`Copied SEO from ${source.country_name || 'selected country'} to all countries`);
  };

  // ── Submit / Save ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!form.category_id) {
      toast.error('Please select a category');
      return;
    }

    setSaving(true);
    try {
      // Serialize specifications array to JSON object
      const specsObj = {};
      specsList.forEach(({ key, value }) => {
        if (key && key.trim()) {
          specsObj[key.trim()] = value;
        }
      });

      const payload = {
        ...form,
        is_limited_edition: Boolean(form.is_limited_edition),
        edition_size: form.is_limited_edition && form.edition_size ? parseInt(form.edition_size, 10) : null,
        is_bundle: Boolean(form.is_bundle),
        bundle_items: bundleItems.map((item, idx) => ({
          name: item.name,
          name_ar: item.name_ar || null,
          size: item.size || null,
          quantity: parseInt(item.quantity, 10) || 1,
          image_url: item.image_url || null,
          scent_profile: item.scent_profile || null,
          notes_summary: item.notes_summary || null,
          notes_summary_ar: item.notes_summary_ar || null,
          description: item.description || null,
          description_ar: item.description_ar || null,
          sort_order: item.sort_order ?? idx + 1,
        })),
        brand_id: form.brand_id ? parseInt(form.brand_id, 10) : 1,
        category_id: form.category_id ? parseInt(form.category_id, 10) : null,
        subcategory_id: form.subcategory_id ? parseInt(form.subcategory_id, 10) : null,
        size_id: form.size_id ? parseInt(form.size_id, 10) : null,
        olfactory_family_ids: form.olfactory_family_ids || [],
        specifications: specsObj,
        notes: selectedNotes.map((n) => ({
          note_id: n.note_id,
          note_level: n.note_level,
        })),
        images: imagesList.map((img, idx) => ({
          url: img.url,
          alt_text: img.alt_text || null,
          sort_order: idx,
          is_primary: idx === 0,
        })),
        relations: relationsList.map((r) => ({
          related_product_id: r.related_product_id,
          relation_type: r.relation_type,
        })),
        country_seo: countrySeoList.map((s) => ({
          country_id: s.country_id,
          seo_title: s.seo_title || null,
          seo_description: s.seo_description || null,
          seo_keywords: s.seo_keywords || null,
        })),
      };

      // Pricing & Warehouse Stock (Only sent if user has full update access)
      if (canFullUpdate) {
        payload.pricing = pricingList
          .filter((pr) => pr.country_id !== undefined && pr.country_id !== null && !isNaN(parseInt(pr.country_id, 10)))
          .map((pr) => ({
            country_id: parseInt(pr.country_id, 10),
            price: parseFloat(pr.price) || 0,
            cost_price: parseFloat(pr.cost_price) || 0,
            price_10ml: parseFloat(pr.price_10ml) > 0 ? parseFloat(pr.price_10ml) : null,
            stock_quantity: parseInt(pr.stock_quantity, 10) || 0,
            low_stock_threshold: parseInt(pr.low_stock_threshold, 10) ?? 5,
            is_available: Boolean(pr.is_available),
          }));
      } else {
        delete payload.status;
        delete payload.pricing;
      }

      if (productId) {
        await api.put(`/products/${productId}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Product created successfully');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  // Dynamic Cascading Category Levels for arbitrary nesting
  const categoryLevels = [];
  const rootCategories = metadata.categories.filter((c) => c.parent_id === 0);
  categoryLevels.push({
    levelIndex: 0,
    label: 'Main Category *',
    subLabel: null,
    placeholder: 'Select Main Category...',
    selectedId: selectedCategoryPath[0] || '',
    options: rootCategories,
  });

  for (let i = 0; i < selectedCategoryPath.length; i++) {
    const parentId = selectedCategoryPath[i];
    if (!parentId) break;

    const children = metadata.categories.filter((c) => c.parent_id === parentId);
    if (children.length > 0) {
      const parentCat = metadata.categories.find((c) => c.id === parentId);
      const parentName = parentCat ? parentCat.name : `Level ${i + 1}`;
      categoryLevels.push({
        levelIndex: i + 1,
        label: i === 0 ? 'Subcategory' : `Subcategory (L${i + 2})`,
        subLabel: `Under ${parentName}`,
        placeholder: i === 0 ? 'None / Direct Category' : `None / Stop at ${parentName}`,
        selectedId: selectedCategoryPath[i + 1] || '',
        options: children,
      });
    }
  }

  const handleCategoryLevelChange = (levelIdx, newIdVal) => {
    const newId = newIdVal ? parseInt(newIdVal, 10) : null;
    let newPath;

    if (!newId) {
      // Stop here: slice path up to levelIdx
      newPath = selectedCategoryPath.slice(0, levelIdx);
    } else {
      // Pick new id at this level, discard deeper levels
      newPath = [...selectedCategoryPath.slice(0, levelIdx), newId];
    }

    setSelectedCategoryPath(newPath);

    const rootId = newPath[0] || '';
    const deepestSubcatId = newPath.length > 1 ? newPath[newPath.length - 1] : null;

    setForm((prev) => ({
      ...prev,
      category_id: rootId,
      subcategory_id: deepestSubcatId || '',
    }));
  };

  const selectedPathObjects = selectedCategoryPath
    .map((id) => metadata.categories.find((c) => c.id === id))
    .filter(Boolean);

  const activeSeoCountry = countrySeoList.find(
    (c) => c.country_id === (activeSeoCountryId || countrySeoList[0]?.country_id)
  ) || countrySeoList[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-6 overflow-hidden">
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <HiOutlineSparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white font-display truncate">
                {productId ? `Edit Product — ${form.name || 'Perfume'}` : isCloning ? 'Duplicate Product' : 'New Perfume Product'}
              </h2>
              <p className="text-[11px] sm:text-xs text-surface-500 dark:text-surface-400 truncate">
                Alaynaa's Parfums luxury fragrance catalog management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 rounded-xl text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 shrink-0"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 border-b border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30 flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { id: 'general', label: '1. General Info' },
            ...(form.is_bundle ? [{ id: 'bundle', label: `Gift Set Items (${bundleItems.length})` }] : []),
            { id: 'specs', label: '2. Specifications' },
            { id: 'notes', label: '3. Fragrance Notes' },
            ...(canFullUpdate ? [{ id: 'pricing', label: '4. Country Pricing & Stock' }] : []),
            { id: 'seo_media', label: `${canFullUpdate ? '5' : '4'}. Descriptions & SEO` },
            { id: 'relations', label: `${canFullUpdate ? '6' : '5'}. Relations` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 sm:py-3 px-3 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-surface-900'
                : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6">
          {loading ? (
            <div className="py-24 text-center text-surface-400">Loading product data...</div>
          ) : (
            <form id="productForm" onSubmit={handleSubmit} className="space-y-6">
              {/* ── TAB 1: GENERAL INFO ────────────────────────────────────────── */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Product Name (EN) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Dulook"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Product Name (Arabic)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: دلوك"
                        dir="rtl"
                        value={form.name_ar}
                        onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Slug (URL identifier)
                      </label>
                      <input
                        type="text"
                        placeholder="Leave blank to auto-generate from product name"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        className="input-field text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Brand
                      </label>
                      <select
                        value={form.brand_id}
                        onChange={(e) => setForm({ ...form, brand_id: parseInt(e.target.value) })}
                        className="input-field text-xs"
                      >
                        {metadata.brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Gender
                      </label>
                      <select
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="input-field text-xs capitalize"
                      >
                        <option value="unisex">Unisex (مناسب للجنسين)</option>
                        <option value="men">Men (رجالي)</option>
                        <option value="women">Women (نسائي)</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400">
                          Size / Volume
                        </label>
                      </div>
                      <SizeCombobox
                        value={form.size_id}
                        sizes={metadata.sizes}
                        onChange={(newSizeId) => setForm({ ...form, size_id: newSizeId })}
                        onSizeCreated={(newSize) => {
                          setMetadata((prev) => ({
                            ...prev,
                            sizes: [...prev.sizes, newSize],
                          }));
                        }}
                      />
                    </div>
                  </div>

                  {/* ── Dynamic Category & Nested Subcategories Classification ── */}
                  <div className="space-y-3 p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <HiOutlineFolder className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-surface-800 dark:text-surface-200">
                          Category & Subcategory Hierarchy
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                        {selectedCategoryPath.length > 1
                          ? `${selectedCategoryPath.length} Levels Configured`
                          : selectedCategoryPath.length === 1
                            ? 'Main Level Only'
                            : 'Select Main Category'}
                      </span>
                    </div>

                    {/* Dynamic Cascading Dropdowns Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {categoryLevels.map((lvl) => (
                        <div key={lvl.levelIndex}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 truncate">
                              {lvl.label}
                            </label>
                            {lvl.subLabel && (
                              <span
                                className="text-[10px] text-purple-600 dark:text-purple-400 truncate max-w-[110px]"
                                title={lvl.subLabel}
                              >
                                {lvl.subLabel}
                              </span>
                            )}
                          </div>
                          <select
                            value={lvl.selectedId}
                            onChange={(e) => handleCategoryLevelChange(lvl.levelIndex, e.target.value)}
                            className="input-field text-xs py-2 w-full"
                            required={lvl.levelIndex === 0}
                          >
                            <option value="">{lvl.placeholder}</option>
                            {lvl.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name} {opt.name_ar ? `(${opt.name_ar})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Hierarchy Breadcrumb Trail */}
                    {selectedPathObjects.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-surface-200/70 dark:border-surface-700/60 text-xs">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                          Path:
                        </span>
                        {selectedPathObjects.map((cat, idx) => (
                          <span key={cat.id} className="inline-flex items-center gap-1">
                            {idx > 0 && <HiOutlineChevronRight className="w-3.5 h-3.5 text-surface-400 shrink-0" />}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${idx === selectedPathObjects.length - 1
                                ? 'bg-purple-600 text-white shadow-xs font-semibold'
                                : 'bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700'
                                }`}
                            >
                              {cat.name}
                              {cat.name_ar ? ` (${cat.name_ar})` : ''}
                            </span>
                          </span>
                        ))}
                        {selectedPathObjects.length === 1 && (
                          <span className="text-[11px] text-surface-400 italic ml-1">
                            (Direct category without subcategories)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        SKU Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AAM-DUL-100"
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        className="input-field font-mono text-xs uppercase"
                      />
                    </div>

                    {canFullUpdate && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                          Status
                        </label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm({ ...form, status: e.target.value })}
                          className="input-field capitalize"
                        >
                          <option value="draft">Draft (مسودة)</option>
                          <option value="active">Active (منشور)</option>
                          <option value="archived">Archived (مؤرشف)</option>
                        </select>
                      </div>
                    )}
                  </div>



                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_featured"
                      checked={form.is_featured}
                      onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="is_featured" className="text-sm font-medium text-surface-800 dark:text-surface-200 cursor-pointer flex items-center gap-1.5">
                      <HiStar className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Feature this perfume on storefront home showcase & banner carousels</span>
                    </label>
                  </div>

                  {/* Limited Edition flag (drives the Exclusive Creations section) */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_limited_edition"
                      checked={!!form.is_limited_edition}
                      onChange={(e) => setForm({ ...form, is_limited_edition: e.target.checked })}
                      className="w-4 h-4 rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="is_limited_edition" className="text-sm font-medium text-surface-800 dark:text-surface-200 cursor-pointer">
                      Limited Edition (shown in Exclusive Creations)
                    </label>
                    {form.is_limited_edition && (
                      <input
                        type="number"
                        min="1"
                        placeholder="Edition size (e.g. 500)"
                        value={form.edition_size}
                        onChange={(e) => setForm({ ...form, edition_size: e.target.value })}
                        className="input-field w-48"
                      />
                    )}
                  </div>

                  {/* Gift Set / Bundle Option */}
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="is_bundle"
                        checked={form.is_bundle}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm({ ...form, is_bundle: checked });
                          if (checked && bundleItems.length === 0) {
                            handleAddBundleItem();
                          }
                        }}
                        className="w-4 h-4 mt-0.5 rounded border-surface-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <label htmlFor="is_bundle" className="text-sm font-bold text-surface-900 dark:text-white cursor-pointer flex items-center gap-2">
                          <HiOutlineGift className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>Gift Set / Discovery Collection (Bundle)</span>
                        </label>
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                          Check this if this product contains sub-items or miniature bottles (e.g. 3x 10ml bottles) not sold separately.
                        </p>
                      </div>
                    </div>
                    {form.is_bundle && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('bundle')}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                      >
                        Edit Set Items ({bundleItems.length}) →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB: GIFT SET / BUNDLE ITEMS (OPTION B) ────────────────── */}
              {activeTab === 'bundle' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-200 dark:border-surface-800">
                    <div>
                      <h3 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                        <HiOutlineGift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        Gift Set & Collection Contents
                      </h3>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        Define the sub-products, miniature bottles, or items included inside this gift set box. These items are not sold separately and do not clutter your catalog.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBundleItem}
                      className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700"
                    >
                      <HiOutlinePlus className="w-4 h-4" />
                      Add Item to Gift Set
                    </button>
                  </div>

                  {bundleItems.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-800/20">
                      <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                        <HiOutlineGift className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                        No bundle items added yet
                      </p>
                      <p className="text-xs text-surface-400 max-w-sm mx-auto mt-1 mb-4">
                        Add the bottles, miniatures, or perfume items included in this gift set box.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddBundleItem}
                        className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                      >
                        <HiOutlinePlus className="w-4 h-4" />
                        Add First Item
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bundleItems.map((item, index) => (
                        <div
                          key={index}
                          className="p-4 sm:p-5 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm space-y-4 transition-all"
                        >
                          {/* Item Card Header */}
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-surface-100 dark:border-surface-800">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                                {index + 1}
                              </span>
                              <h4 className="font-bold text-sm text-surface-900 dark:text-white">
                                {item.name || `Item #${index + 1}`}
                              </h4>
                              {item.size && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                                  {item.size}
                                </span>
                              )}
                              {item.quantity > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium">
                                  Qty: {item.quantity}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveBundleItem(index)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Remove item"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Row 1: Bilingual Names */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Item Name (EN) *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. The Roots 2000"
                                value={item.name}
                                onChange={(e) => handleUpdateBundleItem(index, 'name', e.target.value)}
                                className="input-field text-xs py-2"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Item Name (Arabic)
                              </label>
                              <input
                                type="text"
                                placeholder="مثال: الجذور ٢٠٠٠"
                                dir="rtl"
                                value={item.name_ar || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'name_ar', e.target.value)}
                                className="input-field text-xs py-2 font-arabic"
                              />
                            </div>
                          </div>

                          {/* Row 2: Size, Quantity & Scent Profile */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Bottle Size / Volume
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 10ml, 15ml, 50ml"
                                value={item.size || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'size', e.target.value)}
                                className="input-field text-xs py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Quantity in Box
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity || 1}
                                onChange={(e) => handleUpdateBundleItem(index, 'quantity', e.target.value)}
                                className="input-field text-xs py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Scent Profile / Olfactory Family
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Oriental Aldehydic Woody"
                                value={item.scent_profile || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'scent_profile', e.target.value)}
                                className="input-field text-xs py-2"
                              />
                            </div>
                          </div>

                          {/* Row 3: Notes Summary (Bilingual) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Fragrance Notes Breakdown (EN)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Top: Grapefruit, Aldehydes | Heart: White Flowers, Rose | Base: Indian Oud, Vanilla"
                                value={item.notes_summary || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'notes_summary', e.target.value)}
                                className="input-field text-xs py-2 resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                ملخص النوتات العطرية (عربي)
                              </label>
                              <textarea
                                rows={2}
                                dir="rtl"
                                placeholder="القمة: جريب فروت، ألدهيدات | القلب: زهور بيضاء، ورد | القاعدة: عود هندي، فانيليا"
                                value={item.notes_summary_ar || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'notes_summary_ar', e.target.value)}
                                className="input-field text-xs py-2 font-arabic resize-none"
                              />
                            </div>
                          </div>

                          {/* Row 4: Image (URL / Path) */}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                              Item Image (URL / Path)
                            </label>
                            <div className="flex items-center gap-2">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-lg object-cover bg-surface-100 dark:bg-surface-800 shrink-0 border border-surface-200 dark:border-surface-700"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400 shrink-0 border border-surface-200 dark:border-surface-700">
                                  <HiOutlinePhotograph className="w-4 h-4" />
                                </div>
                              )}
                              <input
                                type="text"
                                placeholder="e.g. octophotos/the-roots.jpg"
                                value={item.image_url || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'image_url', e.target.value)}
                                className="input-field text-xs py-2 flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setBundlePickerIndex(index)}
                                className="btn-secondary px-2.5 py-2 text-xs flex items-center gap-1 shrink-0 text-surface-700 dark:text-surface-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-surface-200 dark:border-surface-700"
                                title="Open File System to choose an image"
                              >
                                <HiOutlineFolder className="w-4 h-4 text-indigo-500" />
                                <span className="hidden sm:inline text-[11px] font-medium">Browse</span>
                              </button>
                            </div>
                          </div>

                          {/* Row 5: Bilingual Descriptions (description & description_ar) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                Item Description (EN)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Detailed story, formulation notes, or application advice for this miniature bottle"
                                value={item.description || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'description', e.target.value)}
                                className="input-field text-xs py-2 resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                                وصف العنصر (عربي)
                              </label>
                              <textarea
                                rows={2}
                                dir="rtl"
                                placeholder="وصف تفصيلي أو نصائح الاستخدام الخاصة بهذه العبوة المصغرة"
                                value={item.description_ar || ''}
                                onChange={(e) => handleUpdateBundleItem(index, 'description_ar', e.target.value)}
                                className="input-field text-xs py-2 font-arabic resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddBundleItem}
                          className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
                        >
                          <HiOutlinePlus className="w-4 h-4" />
                          Add Another Item ({bundleItems.length + 1})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: SPECIFICATIONS (DYNAMIC KEY-VALUE BUILDER) ────────── */}
              {activeTab === 'specs' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                      Dynamic Product Specifications
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                      Store flexible attributes like Fragrance Type, Sillage, Dispenser, and Longevity in a single JSON column. Click any preset pill or add custom attributes.
                    </p>
                  </div>

                  {/* Fragrance family: drives the storefront "Discover" sliders (moved here from General Info) */}
                  <div className="rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400">
                        Fragrance Family (Olfactory Families &amp; Accords)
                      </label>
                      <span className="text-[10px] text-surface-400">First one is Primary</span>
                    </div>
                    <OlfactoryCombobox
                      values={form.olfactory_family_ids}
                      families={metadata.olfactoryFamilies}
                      onChange={(newFamilyIds) =>
                        setForm({ ...form, olfactory_family_ids: newFamilyIds })
                      }
                      onFamilyCreated={(newFamily) => {
                        setMetadata((prev) => ({
                          ...prev,
                          olfactoryFamilies: [...prev.olfactoryFamilies, newFamily],
                        }));
                      }}
                    />
                    <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1.5">
                      Decides which family slider (Floral, Woody, Oriental...) this product appears in on the website homepage.
                    </p>
                  </div>

                  {/* Product film: shown on the storefront product page as a click-to-play video section */}
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-700 dark:text-surface-300">
                        Product Film (video section on product page)
                      </h4>
                      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1">
                        Upload an MP4/WebM (H.264, 720-1080p, ideally under 15MB, max 50MB) or paste a YouTube / Vimeo link.
                        The video only downloads when a visitor presses play, so page speed is not affected. Leave empty to hide the section.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">Video file or link</label>
                        <input
                          type="text"
                          value={specVal('video_url')}
                          onChange={(e) => upsertSpec('video_url', e.target.value.trim())}
                          placeholder="https://… or upload below"
                          className="input-field w-full text-sm"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <label className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer inline-flex items-center gap-1.5 hover:bg-surface-50">
                            <HiOutlineUpload className="w-3.5 h-3.5" />
                            {filmBusy === 'video_url' ? 'Uploading…' : 'Upload video'}
                            <input
                              type="file"
                              accept="video/mp4,video/webm"
                              className="hidden"
                              disabled={!!filmBusy}
                              onChange={(e) => { uploadFilm(e.target.files?.[0], 'video_url', 50); e.target.value = ''; }}
                            />
                          </label>
                          {specVal('video_url') && (
                            <button type="button" onClick={() => upsertSpec('video_url', '')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 inline-flex items-center gap-1.5 hover:bg-red-50">
                              <HiOutlineTrash className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>
                        {/\.(mp4|webm)(\?|$)/i.test(specVal('video_url')) && (
                          <video src={specVal('video_url')} controls preload="metadata" className="mt-2 w-full max-h-40 rounded-lg bg-black" />
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">Poster image (optional, defaults to the 2nd product image)</label>
                        <input
                          type="text"
                          value={specVal('video_poster')}
                          onChange={(e) => upsertSpec('video_poster', e.target.value.trim())}
                          placeholder="https://… or upload below"
                          className="input-field w-full text-sm"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <label className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 cursor-pointer inline-flex items-center gap-1.5 hover:bg-surface-50">
                            <HiOutlinePhotograph className="w-3.5 h-3.5" />
                            {filmBusy === 'video_poster' ? 'Uploading…' : 'Upload poster'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={!!filmBusy}
                              onChange={(e) => { uploadFilm(e.target.files?.[0], 'video_poster', 8); e.target.value = ''; }}
                            />
                          </label>
                          {specVal('video_poster') && (
                            <button type="button" onClick={() => upsertSpec('video_poster', '')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 inline-flex items-center gap-1.5 hover:bg-red-50">
                              <HiOutlineTrash className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </div>
                        {specVal('video_poster') && (
                          <img src={specVal('video_poster')} alt="" className="mt-2 h-20 rounded-lg object-cover" />
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">Section title (English)</label>
                        <input type="text" value={specVal('video_title')} onChange={(e) => upsertSpec('video_title', e.target.value)} placeholder="Defaults to the product name" className="input-field w-full text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">Section title (Arabic)</label>
                        <input type="text" dir="rtl" value={specVal('video_title_ar')} onChange={(e) => upsertSpec('video_title_ar', e.target.value)} className="input-field w-full text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Preset Quick-Add Chips */}
                  <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                      Suggested Presets:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SPEC_PRESETS.map((preset) => {
                        const isAdded = specsList.some((s) => s.key === preset.key);
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => !isAdded && addSpecRow(preset.key, preset.defaultVal)}
                            disabled={isAdded}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${isAdded
                              ? 'bg-surface-100 dark:bg-surface-800 text-surface-400 opacity-60 cursor-not-allowed'
                              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                              }`}
                          >
                            <HiOutlinePlus className="w-3.5 h-3.5" />
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Rows */}
                  <div className="space-y-3">
                    {specsList.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl text-surface-400">
                        No specifications added yet. Click a preset pill above or add a custom row.
                      </div>
                    ) : (
                      specsList.map((spec, index) => (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/20"
                        >
                          <div className="w-full sm:w-1/3">
                            <input
                              type="text"
                              placeholder="Key (e.g. fragrance_type)"
                              value={spec.key}
                              onChange={(e) => updateSpecRow(index, 'key', e.target.value)}
                              className="input-field text-xs font-mono"
                            />
                          </div>
                          <span className="hidden sm:inline text-surface-400 font-bold">:</span>
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Value (e.g. Eau De Parfum)"
                              value={spec.value}
                              onChange={(e) => updateSpecRow(index, 'value', e.target.value)}
                              className="input-field text-xs flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeSpecRow(index)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
                              title="Remove row"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSpecRow('', '')}
                    className="btn-secondary text-xs flex items-center gap-2"
                  >
                    <HiOutlinePlus className="w-4 h-4" /> Add Custom Specification
                  </button>
                </div>
              )}

              {/* ── TAB 3: FRAGRANCE NOTES ────────────────────────────────────── */}
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                        Olfactory Fragrance Notes
                      </h3>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        Attach notes from the master ingredient library. Supports 3-tier pyramid or single-level pure accords.
                      </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
                      <button
                        type="button"
                        onClick={() => handleSwitchNotesMode('pyramid')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${notesMode === 'pyramid'
                          ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-300 shadow-sm'
                          : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'
                          }`}
                      >
                        Pyramid (Top, Heart, Base)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchNotesMode('general')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${notesMode === 'general'
                          ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-300 shadow-sm'
                          : 'text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200'
                          }`}
                      >
                        Single-Level (Pure Accord / Bakhoor)
                      </button>
                    </div>
                  </div>

                  {notesMode === 'pyramid' ? (
                    <div className="space-y-6">
                      {/* Top Notes Combobox */}
                      <NoteCombobox
                        level="top"
                        title="Top Notes (Opening 15 mins)"
                        subtitle="Volatile, sparkling notes detected immediately after application"
                        icon={<HiOutlineSparkles className="w-4 h-4 text-amber-500" />}
                        selectedNotes={selectedNotes.filter((n) => n.note_level === 'top')}
                        allNotes={metadata.fragranceNotes || []}
                        onAddNote={(note) => handleAddNoteToLevel(note, 'top')}
                        onRemoveNote={(id) => handleRemoveNoteFromLevel(id, 'top')}
                        onNoteCreated={(newNote) => {
                          setMetadata((prev) => ({
                            ...prev,
                            fragranceNotes: [...(prev.fragranceNotes || []), newNote],
                          }));
                        }}
                      />

                      {/* Heart Notes Combobox */}
                      <NoteCombobox
                        level="heart"
                        title="Heart / Middle Notes (2 - 4 hours)"
                        subtitle="The true personality and core theme of the fragrance"
                        icon={<HiOutlineHeart className="w-4 h-4 text-rose-500" />}
                        selectedNotes={selectedNotes.filter((n) => n.note_level === 'heart')}
                        allNotes={metadata.fragranceNotes || []}
                        onAddNote={(note) => handleAddNoteToLevel(note, 'heart')}
                        onRemoveNote={(id) => handleRemoveNoteFromLevel(id, 'heart')}
                        onNoteCreated={(newNote) => {
                          setMetadata((prev) => ({
                            ...prev,
                            fragranceNotes: [...(prev.fragranceNotes || []), newNote],
                          }));
                        }}
                      />

                      {/* Base Notes Combobox */}
                      <NoteCombobox
                        level="base"
                        title="Base Notes (Dry Down 6+ hours)"
                        subtitle="Heavy fixatives providing depth, sillage, and longevity"
                        icon={<HiOutlineCube className="w-4 h-4 text-purple-500" />}
                        selectedNotes={selectedNotes.filter((n) => n.note_level === 'base')}
                        allNotes={metadata.fragranceNotes || []}
                        onAddNote={(note) => handleAddNoteToLevel(note, 'base')}
                        onRemoveNote={(id) => handleRemoveNoteFromLevel(id, 'base')}
                        onNoteCreated={(newNote) => {
                          setMetadata((prev) => ({
                            ...prev,
                            fragranceNotes: [...(prev.fragranceNotes || []), newNote],
                          }));
                        }}
                      />
                    </div>
                  ) : (
                    /* Single-Level General Notes Combobox */
                    <div className="space-y-4">
                      <NoteCombobox
                        level="general"
                        title="General Notes & Pure Accords"
                        subtitle="For linear scents, pure concentrated perfume oils, or traditional incense/bakhoor"
                        icon={<HiOutlineSparkles className="w-4 h-4 text-indigo-500" />}
                        selectedNotes={selectedNotes.filter((n) => n.note_level === 'general')}
                        allNotes={metadata.fragranceNotes || []}
                        onAddNote={(note) => handleAddNoteToLevel(note, 'general')}
                        onRemoveNote={(id) => handleRemoveNoteFromLevel(id, 'general')}
                        onNoteCreated={(newNote) => {
                          setMetadata((prev) => ({
                            ...prev,
                            fragranceNotes: [...(prev.fragranceNotes || []), newNote],
                          }));
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: COUNTRY PRICING & INVENTORY ────────────────────────────── */}
              {activeTab === 'pricing' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-surface-50 to-surface-100 dark:from-purple-950/20 dark:via-surface-900 dark:to-surface-800 border border-purple-200/50 dark:border-purple-800/40">
                    <div>
                      <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
                        <HiOutlineGlobeAlt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        Country Pricing & Warehouse Stock
                      </h3>
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        Configure warehouse stock quantity, low-stock alerts, and market pricing per GCC country.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-surface-400 uppercase font-semibold">Total GCC Stock</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
                          {pricingList.reduce((acc, curr) => acc + (parseInt(curr.stock_quantity) || 0), 0)} units
                        </p>
                      </div>
                    </div>
                  </div>

                  {!canEditPricing && (
                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 flex items-center gap-3">
                      <HiOutlineLockClosed className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-bold">Role Note (Content / Operations):</span> Pricing fields are hidden as you don't have finance/pricing permissions. You have full access to view and update warehouse stock quantities and thresholds.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pricingList.map((countryPricing) => {
                      const countryMeta = metadata.countries.find(
                        (c) => c.id === countryPricing.country_id
                      ) || {};
                      const decimals = countryPricing.decimal_places ?? countryMeta.decimal_places ?? 2;
                      const stockQty = parseInt(countryPricing.stock_quantity) || 0;
                      const lowThreshold = parseInt(countryPricing.low_stock_threshold) ?? 5;
                      const isLowStock = stockQty > 0 && stockQty <= lowThreshold;
                      const isOutOfStock = stockQty <= 0;

                      return (
                        <div
                          key={countryPricing.country_id}
                          className={`p-4 rounded-2xl border transition-all ${countryPricing.is_available
                            ? 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 shadow-sm'
                            : 'bg-surface-50 dark:bg-surface-800/40 border-surface-200 dark:border-surface-800 opacity-60'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-surface-100 dark:border-surface-700/60">
                            <div className="flex items-center gap-2.5">
                              <CountryFlag code={countryMeta.code} name={countryPricing.country_name || countryMeta.name} size="md" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-surface-900 dark:text-white">
                                    {countryPricing.country_name || countryMeta.name}
                                  </h4>
                                  {countryPricing.is_available && (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOutOfStock
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                        : isLowStock
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        }`}
                                    >
                                      {isOutOfStock ? 'Out of Stock' : isLowStock ? `Low Stock (${stockQty})` : `In Stock (${stockQty})`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-surface-500 dark:text-surface-400">
                                  Currency: {countryPricing.currency_code} ({countryPricing.currency_symbol}) · {decimals} Decimals
                                </p>
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(countryPricing.is_available)}
                                onChange={(e) =>
                                  updatePricingRow(
                                    countryPricing.country_id,
                                    'is_available',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                              />
                              Available
                            </label>
                          </div>

                          {/* Pricing Section (Visible only with products.update_pricing permission) */}
                          {canEditPricing && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-[11px] font-semibold uppercase text-surface-600 dark:text-surface-400 mb-1">
                                  Retail Price ({countryPricing.currency_code}) *
                                </label>
                                <input
                                  type="number"
                                  step={decimals === 3 ? '0.001' : '0.01'}
                                  min="0"
                                  placeholder={decimals === 3 ? '0.000' : '0.00'}
                                  value={countryPricing.price}
                                  onChange={(e) =>
                                    updatePricingRow(countryPricing.country_id, 'price', e.target.value)
                                  }
                                  className="input-field text-sm font-semibold"
                                  required={countryPricing.is_available}
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold uppercase text-surface-600 dark:text-surface-400 mb-1">
                                  Cost Price ({countryPricing.currency_code})
                                </label>
                                <input
                                  type="number"
                                  step={decimals === 3 ? '0.001' : '0.01'}
                                  min="0"
                                  placeholder={decimals === 3 ? '0.000' : '0.00'}
                                  value={countryPricing.cost_price}
                                  onChange={(e) =>
                                    updatePricingRow(
                                      countryPricing.country_id,
                                      'cost_price',
                                      e.target.value
                                    )
                                  }
                                  className="input-field text-sm"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold uppercase text-surface-600 dark:text-surface-400 mb-1">
                                  10ml Price ({countryPricing.currency_code}) <span className="normal-case font-normal">(optional)</span>
                                </label>
                                <input
                                  type="number"
                                  step={decimals === 3 ? '0.001' : '0.01'}
                                  min="0"
                                  placeholder="Leave blank if no 10ml size"
                                  value={countryPricing.price_10ml ?? ''}
                                  onChange={(e) =>
                                    updatePricingRow(countryPricing.country_id, 'price_10ml', e.target.value)
                                  }
                                  className="input-field text-sm"
                                />
                              </div>
                            </div>
                          )}

                          {/* Warehouse Stock & Threshold Section */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-100 dark:border-surface-700/40">
                            <div>
                              <label className="text-[11px] font-semibold uppercase text-surface-600 dark:text-surface-400 mb-1 flex items-center justify-between">
                                <span>Warehouse Stock</span>
                                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{stockQty} units</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={countryPricing.stock_quantity ?? 0}
                                onChange={(e) =>
                                  updatePricingRow(
                                    countryPricing.country_id,
                                    'stock_quantity',
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="input-field text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase text-surface-600 dark:text-surface-400 mb-1">
                                Low Stock Alert
                              </label>
                              <input
                                type="number"
                                min="0"
                                placeholder="5"
                                value={countryPricing.low_stock_threshold ?? 5}
                                onChange={(e) =>
                                  updatePricingRow(
                                    countryPricing.country_id,
                                    'low_stock_threshold',
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="input-field text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB 5: DESCRIPTIONS, SEO & MEDIA ──────────────────────────── */}
              {activeTab === 'seo_media' && (
                <div className="space-y-6">
                  {/* Descriptions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Short Description (EN)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Catchy fragrance summary for catalog card..."
                        value={form.short_description}
                        onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Short Description (Arabic)
                      </label>
                      <textarea
                        rows={2}
                        dir="rtl"
                        placeholder="نبذة عطرية مختصرة..."
                        value={form.short_description_ar}
                        onChange={(e) => setForm({ ...form, short_description_ar: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Full Description (EN)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Detailed olfactory story and artistic notes..."
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1.5">
                        Full Description (Arabic)
                      </label>
                      <textarea
                        rows={4}
                        dir="rtl"
                        placeholder="الوصف التفصيلي والقصة العطرية..."
                        value={form.description_ar}
                        onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>

                  {/* Country-Specific SEO Section */}
                  <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <HiOutlineGlobeAlt className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
                            Country-Specific Search Engine Optimization (SEO)
                          </h4>
                          <p className="text-[11px] text-surface-400">
                            Configure localized meta title, description, and keywords for each GCC storefront market.
                          </p>
                        </div>
                      </div>

                      {activeSeoCountry && (
                        <button
                          type="button"
                          onClick={() => copySeoToAllCountries(activeSeoCountry.country_id)}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                          title="Copy current country's SEO metadata to all other countries"
                        >
                          <HiOutlineDuplicate className="w-3.5 h-3.5 inline mr-1.5" />
                          <span>Copy to All Countries</span>
                        </button>
                      )}
                    </div>

                    {/* Country Switcher Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-surface-200 dark:border-surface-700/60">
                      {countrySeoList.map((c) => {
                        const isCurrent = (activeSeoCountryId || countrySeoList[0]?.country_id) === c.country_id;
                        const hasCustom = !!(c.seo_title || c.seo_description);
                        return (
                          <button
                            key={c.country_id}
                            type="button"
                            onClick={() => setActiveSeoCountryId(c.country_id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${isCurrent
                              ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/20'
                              : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 border border-surface-200 dark:border-surface-700'
                              }`}
                          >
                            <CountryFlag code={c.country_code} name={c.country_name} size="xs" />
                            <span>{c.country_name || c.country_code}</span>
                            {hasCustom && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-emerald-500'
                                  }`}
                                title="Custom SEO defined"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Country SEO Inputs */}
                    {activeSeoCountry ? (
                      <div className="space-y-4 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-surface-700 dark:text-surface-200 flex items-center gap-1.5">
                            <CountryFlag code={activeSeoCountry.country_code} name={activeSeoCountry.country_name} size="xs" />
                            SEO for {activeSeoCountry.country_name} ({activeSeoCountry.country_code})
                          </span>
                          <span className="text-[11px] text-surface-400 font-mono">
                            /{activeSeoCountry.country_code?.toLowerCase() || 'ae'}/products/{form.slug || 'product-slug'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400">
                                Meta Title Tag (Max 60 chars)
                              </label>
                              <span className={`text-[10px] ${(activeSeoCountry.seo_title || '').length > 60 ? 'text-amber-500 font-semibold' : 'text-surface-400'}`}>
                                {(activeSeoCountry.seo_title || '').length}/60
                              </span>
                            </div>
                            <input
                              type="text"
                              placeholder={`e.g. ${form.name || 'Perfume'} | Alaynaa's Parfums ${activeSeoCountry.country_name}`}
                              value={activeSeoCountry.seo_title || ''}
                              onChange={(e) => updateCountrySeo(activeSeoCountry.country_id, 'seo_title', e.target.value)}
                              className="input-field text-xs"
                              maxLength={255}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400">
                                Keywords (comma-separated)
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder={`perfume ${activeSeoCountry.country_code?.toLowerCase() || ''}, oud ${activeSeoCountry.country_name?.toLowerCase() || ''}, alaynaa's parfums`}
                              value={activeSeoCountry.seo_keywords || ''}
                              onChange={(e) => updateCountrySeo(activeSeoCountry.country_id, 'seo_keywords', e.target.value)}
                              className="input-field text-xs"
                              maxLength={500}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400">
                              Meta Description (Max 160 chars recommended)
                            </label>
                            <span className={`text-[10px] ${(activeSeoCountry.seo_description || '').length > 160 ? 'text-amber-500 font-semibold' : 'text-surface-400'}`}>
                              {(activeSeoCountry.seo_description || '').length}/160
                            </span>
                          </div>
                          <textarea
                            rows={2}
                            placeholder={`Captivating summary for Google search in ${activeSeoCountry.country_name}...`}
                            value={activeSeoCountry.seo_description || ''}
                            onChange={(e) => updateCountrySeo(activeSeoCountry.country_id, 'seo_description', e.target.value)}
                            className="input-field text-xs"
                            maxLength={500}
                          />
                        </div>

                        {/* Google Search Result Preview */}
                        <div className="p-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] text-surface-400 font-mono truncate">
                            <span className="text-surface-400">https://dulook.com/{activeSeoCountry.country_code?.toLowerCase() || 'ae'}/products/{form.slug || 'product-slug'}</span>
                          </div>
                          <h5 className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate">
                            {activeSeoCountry.seo_title || form.name || 'Product Title'}
                          </h5>
                          <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-2">
                            {activeSeoCountry.seo_description || form.short_description || 'Meta description for Google search snippet...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-surface-400">
                        No countries configured
                      </div>
                    )}
                  </div>

                  {/* Images Section */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
                          Product Packshots & Media Gallery
                        </h4>
                        <p className="text-[11px] text-surface-400 mt-0.5">
                          Pick from your local File System or upload directly to <code className="text-purple-600 font-mono">/uploads/Products</code>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Hidden input for direct upload */}
                        <input
                          type="file"
                          ref={productFileInputRef}
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            const formData = new FormData();
                            formData.append('dir', 'Products');
                            Array.from(files).forEach((f) => formData.append('files', f));

                            setIsUploadingImages(true);
                            try {
                              const { data } = await api.post('/files/upload', formData, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              if (data.files?.length > 0) {
                                const newImgs = data.files.map((f, i) => ({
                                  url: `http://localhost:3000${f.url}`,
                                  alt_text: (f.name || form.name || 'Perfume').replace(/\.[^/.]+$/, ''),
                                  is_primary: imagesList.length === 0 && i === 0,
                                  sort_order: imagesList.length + i,
                                }));
                                setImagesList((prev) => [...prev, ...newImgs]);
                                toast.success(`Uploaded & added ${newImgs.length} packshot(s)`);
                              }
                            } catch (err) {
                              toast.error(err.response?.data?.error || 'Failed to upload packshots');
                            } finally {
                              setIsUploadingImages(false);
                              if (productFileInputRef.current) productFileInputRef.current.value = '';
                            }
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => setShowFilePickerModal(true)}
                          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
                        >
                          <HiOutlineFolder className="w-4 h-4" />
                          <span>Browse File System</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => productFileInputRef.current?.click()}
                          disabled={isUploadingImages}
                          className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                        >
                          <HiOutlineUpload className="w-4 h-4" />
                          <span>{isUploadingImages ? 'Uploading...' : 'Upload Packshots'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="p-1.5 text-surface-400 hover:text-surface-600 rounded-lg border border-surface-200 dark:border-surface-700 text-xs"
                          title="Add via external URL"
                        >
                          <HiOutlineLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* External URL Input (collapsible fallback) */}
                    {showUrlInput && (
                      <div className="flex gap-2 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 animate-fade-in">
                        <input
                          type="url"
                          placeholder="External Image CDN URL (e.g. https://images.unsplash.com/...)"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          className="input-field text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={addImage}
                          className="btn-primary text-xs flex items-center gap-1.5 py-1 px-3"
                        >
                          <HiOutlinePlus className="w-4 h-4" /> Add URL
                        </button>
                      </div>
                    )}

                    {/* Drag and Drop Zone inside Tab 5 */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const formData = new FormData();
                          formData.append('dir', 'Products');
                          Array.from(e.dataTransfer.files).forEach((f) => formData.append('files', f));

                          setIsUploadingImages(true);
                          try {
                            const { data } = await api.post('/files/upload', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            if (data.files?.length > 0) {
                              const newImgs = data.files.map((f, i) => ({
                                url: `http://localhost:3000${f.url}`,
                                alt_text: (f.name || form.name || 'Perfume').replace(/\.[^/.]+$/, ''),
                                is_primary: imagesList.length === 0 && i === 0,
                                sort_order: imagesList.length + i,
                              }));
                              setImagesList((prev) => [...prev, ...newImgs]);
                              toast.success(`Dropped & added ${newImgs.length} packshot(s)`);
                            }
                          } catch (err) {
                            toast.error('Upload failed');
                          } finally {
                            setIsUploadingImages(false);
                          }
                        }
                      }}
                      className="border-2 border-dashed border-surface-200 dark:border-surface-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-surface-50/50 dark:bg-surface-800/20"
                      onClick={() => productFileInputRef.current?.click()}
                    >
                      <HiOutlinePhotograph className="w-8 h-8 text-surface-400 mx-auto mb-1" />
                      <p className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                        Drag and drop fragrance packshots here, or click to browse
                      </p>
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        High-res images (.webp, .jpg, .png) automatically saved to local storage
                      </p>
                    </div>

                    {/* Image Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {imagesList.map((img, idx) => (
                        <div
                          key={img.id || img.url + idx}
                          draggable
                          onDragStart={(e) => {
                            setDragImageIdx(idx);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(idx));
                          }}
                          onDragOver={(e) => {
                            if (dragImageIdx === null) return; // ignore file drags
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverImageIdx(idx);
                          }}
                          onDrop={(e) => {
                            if (dragImageIdx === null) return;
                            e.preventDefault();
                            e.stopPropagation();
                            moveImage(dragImageIdx, idx);
                            setDragImageIdx(null);
                            setDragOverImageIdx(null);
                          }}
                          onDragEnd={() => {
                            setDragImageIdx(null);
                            setDragOverImageIdx(null);
                          }}
                          className={`relative group rounded-xl overflow-hidden border p-2 transition-all cursor-grab active:cursor-grabbing ${dragImageIdx === idx ? 'opacity-40' : ''} ${dragOverImageIdx === idx && dragImageIdx !== idx ? 'ring-2 ring-sky-400' : ''} ${img.is_primary
                            ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20'
                            : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800'
                            }`}
                        >
                          <span className="absolute top-3 left-3 z-10 text-[10px] font-bold bg-black/60 text-white rounded px-1.5 py-0.5">{idx + 1}</span>
                          <img
                            src={img.url}
                            alt={img.alt_text}
                            className="w-full h-28 object-cover rounded-lg pointer-events-none"
                          />
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => setPrimaryImage(idx)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${img.is_primary
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-surface-500 hover:text-purple-600 hover:bg-surface-100 dark:hover:bg-surface-700'
                                }`}
                            >
                              {img.is_primary ? (
                                <span className="flex items-center gap-1">
                                  <HiStar className="w-3 h-3 text-amber-300" /> Primary
                                </span>
                              ) : (
                                'Set Primary'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Remove image"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 6: RELATIONS ──────────────────────────────────────────── */}
              {activeTab === 'relations' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                      Product Cross-Sells & Same-Family Groupings
                    </h3>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Link complementary perfumes for 'You May Also Like' or products sharing the same fragrance identity (e.g. EDP + Concentrated Oil + Hair Mist).
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end p-3.5 sm:p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/30">
                    <div className="w-full sm:flex-1 sm:min-w-[200px]">
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Select Product
                      </label>
                      <select id="relProdSelect" className="input-field text-xs">
                        <option value="">Choose a product...</option>
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-48">
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Relationship Type
                      </label>
                      <select id="relTypeSelect" className="input-field text-xs">
                        <option value="related">Related / Cross-Sell</option>
                        <option value="same_family">Same Fragrance Family</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const pId = document.getElementById('relProdSelect').value;
                        const rType = document.getElementById('relTypeSelect').value;
                        addRelation(pId, rType);
                      }}
                      className="btn-secondary text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
                    >
                      <HiOutlinePlus className="w-4 h-4" /> Add Link
                    </button>
                  </div>

                  <div className="space-y-2">
                    {relationsList.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-2xl text-surface-400 text-xs">
                        No linked products yet. Select a product above to add a recommendation link.
                      </div>
                    ) : (
                      relationsList.map((rel, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-md font-semibold uppercase ${rel.relation_type === 'same_family'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                }`}
                            >
                              {rel.relation_type === 'same_family' ? 'Same Family' : 'Cross-Sell'}
                            </span>
                            <span className="text-sm font-medium text-surface-900 dark:text-white">
                              {rel.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRelation(idx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-surface-400 text-center sm:text-left">
            {productId ? `Editing ID #${productId}` : isCloning ? `Duplicating ID #${cloneFromId}` : 'Creating new perfume'}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-none justify-center" disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              form="productForm"
              disabled={saving || loading}
              className="btn-primary flex-1 sm:flex-none justify-center flex items-center gap-2"
            >
              {saving ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </div>
      </div>

      {/* Universal File Picker Modal */}
      <FilePickerModal
        isOpen={showFilePickerModal}
        onClose={() => setShowFilePickerModal(false)}
        onSelect={(selected) => {
          const items = Array.isArray(selected) ? selected : [selected];
          const newImgs = items.map((f, i) => ({
            url: f.fullUrl || (f.url.startsWith('http') ? f.url : `http://localhost:3000${f.url}`),
            alt_text: (f.name || form.name || 'Perfume').replace(/\.[^/.]+$/, ''),
            is_primary: imagesList.length === 0 && i === 0,
            sort_order: imagesList.length + i,
          }));
          setImagesList((prev) => [...prev, ...newImgs]);
          toast.success(`Selected and added ${newImgs.length} packshot(s)`);
        }}
        multiple={true}
        imagesOnly={true}
        initialDir="Products"
        title="Choose Fragrance Packshots from File System"
      />

      {/* File Picker for Gift Set Bundle Items */}
      <FilePickerModal
        isOpen={bundlePickerIndex !== null}
        onClose={() => setBundlePickerIndex(null)}
        onSelect={(selected) => {
          const file = Array.isArray(selected) ? selected[0] : selected;
          if (file && bundlePickerIndex !== null) {
            const selectedUrl = file.fullUrl || (file.url?.startsWith('http') ? file.url : `http://localhost:3000${file.url}`);
            handleUpdateBundleItem(bundlePickerIndex, 'image_url', selectedUrl);
            toast.success(`Selected image: ${file.name || 'image'}`);
          }
          setBundlePickerIndex(null);
        }}
        multiple={false}
        imagesOnly={true}
        initialDir="Products"
        title={
          bundlePickerIndex !== null && bundleItems[bundlePickerIndex]?.name
            ? `Choose Image for "${bundleItems[bundlePickerIndex].name}"`
            : 'Choose Gift Set Item Image from File System'
        }
      />
    </div>
  );
}
