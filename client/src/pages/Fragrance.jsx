import { useState, useEffect, useCallback, Fragment } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import PermissionGate from '../components/ui/PermissionGate';
import { usePermission } from '../hooks/usePermission';
import FilePickerModal from '../components/files/FilePickerModal';
import Pagination from '../components/ui/Pagination';
import {
  HiOutlineSparkles,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiOutlineRefresh,
  HiOutlinePhotograph,
  HiOutlineFolder,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineTag,
  HiOutlineChevronDown,
  HiOutlineExclamation,
} from 'react-icons/hi';

const EMPTY_NOTE = {
  name: '',
  name_ar: '',
  slug: '',
  description: '',
  description_ar: '',
  image_url: '',
};

const EMPTY_FAMILY = {
  name: '',
  name_ar: '',
  slug: '',
  description: '',
  icon_url: '',
  is_active: true,
};

export default function Fragrance() {
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'families'

  // Data states
  const [notes, setNotes] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & display
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'
  const [levelFilter, setLevelFilter] = useState('all'); // for notes: 'all', 'top', 'heart', 'base', 'general'
  const [statusFilter, setStatusFilter] = useState('all'); // for families: 'all', 'active', 'inactive'
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [expandedFamilyId, setExpandedFamilyId] = useState(null);

  const toggleNoteExpand = (id) => {
    setExpandedNoteId((prev) => (prev === id ? null : id));
  };

  const toggleFamilyExpand = (id) => {
    setExpandedFamilyId((prev) => (prev === id ? null : id));
  };

  // Pagination state
  const [notesPage, setNotesPage] = useState(1);
  const [notesPerPage, setNotesPerPage] = useState(12);
  const [familiesPage, setFamiliesPage] = useState(1);
  const [familiesPerPage, setFamiliesPerPage] = useState(12);

  // Modals state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [familyForm, setFamilyForm] = useState(EMPTY_FAMILY);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'note' | 'family', item }
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerTarget, setFilePickerTarget] = useState(null); // 'note_image' | 'family_icon'

  // Full CRUD access bound to products.read
  const canManage = usePermission('products.read');

  // Load all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, familiesRes] = await Promise.all([
        api.get('/fragrance/notes'),
        api.get('/fragrance/olfactory-families'),
      ]);
      setNotes(notesRes.data.data || []);
      setFamilies(familiesRes.data.data || []);
    } catch {
      toast.error('Failed to load fragrance library data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Note CRUD Handlers ──────────────────────────────────
  const openCreateNote = () => {
    setEditingNote(null);
    setNoteForm(EMPTY_NOTE);
    setShowNoteModal(true);
  };

  const openEditNote = (note) => {
    setEditingNote(note);
    setNoteForm({
      name: note.name || '',
      name_ar: note.name_ar || '',
      slug: note.slug || '',
      description: note.description || '',
      description_ar: note.description_ar || '',
      image_url: note.image_url || '',
    });
    setShowNoteModal(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteForm.name.trim()) {
      toast.error('Note name (EN) is required');
      return;
    }

    try {
      if (editingNote) {
        await api.put(`/fragrance/notes/${editingNote.id}`, noteForm);
        toast.success(`Fragrance note "${noteForm.name}" updated`);
      } else {
        await api.post('/fragrance/notes', noteForm);
        toast.success(`Fragrance note "${noteForm.name}" created`);
      }
      setShowNoteModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fragrance note');
    }
  };

  // ── Family CRUD Handlers ────────────────────────────────
  const openCreateFamily = () => {
    setEditingFamily(null);
    setFamilyForm(EMPTY_FAMILY);
    setShowFamilyModal(true);
  };

  const openEditFamily = (family) => {
    setEditingFamily(family);
    setFamilyForm({
      name: family.name || '',
      name_ar: family.name_ar || '',
      slug: family.slug || '',
      description: family.description || '',
      icon_url: family.icon_url || '',
      is_active: !!family.is_active,
    });
    setShowFamilyModal(true);
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    if (!familyForm.name.trim()) {
      toast.error('Olfactory family name (EN) is required');
      return;
    }

    try {
      if (editingFamily) {
        await api.put(`/fragrance/olfactory-families/${editingFamily.id}`, familyForm);
        toast.success(`Olfactory family "${familyForm.name}" updated`);
      } else {
        await api.post('/fragrance/olfactory-families', familyForm);
        toast.success(`Olfactory family "${familyForm.name}" created`);
      }
      setShowFamilyModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save olfactory family');
    }
  };

  const handleToggleFamilyActive = async (family) => {
    try {
      await api.put(`/fragrance/olfactory-families/${family.id}`, {
        is_active: !family.is_active,
      });
      toast.success(
        `Family "${family.name}" marked as ${!family.is_active ? 'Active' : 'Inactive'}`
      );
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  // ── Delete Handler ──────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { type, item } = deleteConfirm;

    try {
      if (type === 'note') {
        await api.delete(`/fragrance/notes/${item.id}`);
        toast.success(`Deleted note "${item.name}"`);
      } else {
        await api.delete(`/fragrance/olfactory-families/${item.id}`);
        toast.success(`Deleted olfactory family "${item.name}"`);
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      n.name?.toLowerCase().includes(q) ||
      n.name_ar?.includes(q) ||
      n.description?.toLowerCase().includes(q);

    let matchesLevel = true;
    if (levelFilter !== 'all') {
      matchesLevel = n.levels_used?.toLowerCase().includes(levelFilter.toLowerCase());
    }

    return matchesSearch && matchesLevel;
  });

  // Filter families
  const filteredFamilies = families.filter((f) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      f.name?.toLowerCase().includes(q) ||
      f.name_ar?.includes(q) ||
      f.description?.toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = !!f.is_active;
    if (statusFilter === 'inactive') matchesStatus = !f.is_active;

    return matchesSearch && matchesStatus;
  });

  // Pagination computations
  const notesTotalPages = Math.ceil(filteredNotes.length / notesPerPage) || 1;
  const paginatedNotes = filteredNotes.slice(
    (notesPage - 1) * notesPerPage,
    notesPage * notesPerPage
  );

  const familiesTotalPages = Math.ceil(filteredFamilies.length / familiesPerPage) || 1;
  const paginatedFamilies = filteredFamilies.slice(
    (familiesPage - 1) * familiesPerPage,
    familiesPage * familiesPerPage
  );

  useEffect(() => {
    if (notesPage > notesTotalPages) {
      setNotesPage(Math.max(1, notesTotalPages));
    }
  }, [notesPage, notesTotalPages]);

  useEffect(() => {
    if (familiesPage > familiesTotalPages) {
      setFamiliesPage(Math.max(1, familiesTotalPages));
    }
  }, [familiesPage, familiesTotalPages]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <HiOutlineSparkles className="w-6 h-6" />
            </span>
            Fragrance Library & Profiles
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Master directory of fragrance olfactory families, accords, and botanical perfume notes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={activeTab === 'notes' ? openCreateNote : openCreateFamily}
              className="btn-primary flex items-center gap-2 text-xs py-2 px-4 shadow-md shadow-purple-500/20"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>{activeTab === 'notes' ? 'New Fragrance Note' : 'New Olfactory Family'}</span>
            </button>
          )}

          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors"
            title="Refresh Data"
          >
            <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="border-b border-surface-200 dark:border-surface-800 flex gap-4 text-sm font-semibold overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setActiveTab('notes');
            setSearch('');
            setNotesPage(1);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${activeTab === 'notes'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
            }`}
        >
          <span>Fragrance Notes</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
            {notes.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('families');
            setSearch('');
            setFamiliesPage(1);
          }}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${activeTab === 'families'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
            }`}
        >
          <span>Olfactory Families</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
            {families.length}
          </span>
        </button>
      </div>

      {/* Toolbar (Search & Filter - Single line on mobile) */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 sm:max-w-md">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <HiOutlineSearch className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setNotesPage(1);
                setFamiliesPage(1);
              }}
              placeholder={
                activeTab === 'notes'
                  ? 'Search notes...'
                  : 'Search families...'
              }
              className="input-field pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setNotesPage(1);
                  setFamiliesPage(1);
                }}
                className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
                title="Clear search"
              >
                <HiOutlineX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          {activeTab === 'notes' ? (
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setNotesPage(1);
              }}
              className="input-field py-1.5 sm:py-2 px-2 sm:px-3 text-xs w-auto shrink-0 max-w-[95px] xs:max-w-[125px] sm:max-w-none"
            >
              <option value="all">All Levels</option>
              <option value="top">Top</option>
              <option value="heart">Heart</option>
              <option value="base">Base</option>
              <option value="general">Accords</option>
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setFamiliesPage(1);
              }}
              className="input-field py-1.5 sm:py-2 px-2 sm:px-3 text-xs w-auto shrink-0 max-w-[95px] xs:max-w-[125px] sm:max-w-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </div>

        {/* View Mode Toggle on Mobile (single button) */}
        <button
          type="button"
          onClick={() => setViewMode((v) => (v === 'grid' ? 'table' : 'grid'))}
          className="sm:hidden p-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-surface-600 dark:text-surface-300 active:scale-95 shrink-0 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
          title={viewMode === 'grid' ? 'Switch to Table View' : 'Switch to Grid View'}
        >
          {viewMode === 'grid' ? (
            <HiOutlineViewList className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <HiOutlineViewGrid className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          )}
        </button>

        {/* View Mode Toggle on Desktop (Dual pill) */}
        <div className="hidden sm:flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-200'
            }`}
            title="Grid View"
          >
            <HiOutlineViewGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-surface-400 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-200'
            }`}
            title="Table View"
          >
            <HiOutlineViewList className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card p-4 h-48 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : activeTab === 'notes' ? (
        /* ─── TAB 1: FRAGRANCE NOTES ───────────────────────── */
        filteredNotes.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <HiOutlinePhotograph className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-surface-900 dark:text-white">
              No fragrance notes found
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Try adjusting your search query or add a new fragrance note.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {paginatedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="glass-card rounded-2xl overflow-hidden hover:border-purple-300 dark:hover:border-purple-600 transition-all hover:shadow-lg flex flex-col justify-between group"
                  >
                    <div>
                      {/* Image / Header Banner */}
                      <div className="h-36 bg-surface-100 dark:bg-surface-800/80 relative flex items-center justify-center overflow-hidden">
                        {note.image_url ? (
                          <img
                            src={note.image_url}
                            alt={note.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <HiOutlinePhotograph className="w-6 h-6" />
                          </div>
                        )}

                        {/* Product count badge */}
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-sm text-white">
                          {note.product_count} perfume{note.product_count === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Body Info */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                              {note.name}
                            </h3>
                            {note.name_ar && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium" dir="rtl">
                                {note.name_ar}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
                            {note.slug}
                          </span>
                        </div>

                        {note.description && (
                          <p className="text-xs text-surface-600 dark:text-surface-300 line-clamp-2">
                            {note.description}
                          </p>
                        )}

                        {/* Levels used */}
                        {note.levels_used && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {note.levels_used.split(', ').map((lvl) => (
                              <span
                                key={lvl}
                                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${lvl === 'top'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                    : lvl === 'heart'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                      : lvl === 'base'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                  }`}
                              >
                                {lvl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-3 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-surface-400 font-mono">ID #{note.id}</span>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditNote(note)}
                            className="p-1.5 rounded-lg text-surface-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                            title="Edit Note"
                          >
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ type: 'note', item: note })}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Delete Note"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View for Notes */
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-300 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-3 sm:px-4">Note</th>
                      <th className="hidden md:table-cell py-3 px-4">Arabic Name</th>
                      <th className="hidden md:table-cell py-3 px-4">Slug</th>
                      <th className="hidden md:table-cell py-3 px-4">Sensory Description</th>
                      <th className="hidden md:table-cell py-3 px-4">Levels</th>
                      <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-center sm:text-left">Products</th>
                      {canManage && <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {paginatedNotes.map((note) => {
                      const isExpanded = expandedNoteId === note.id;
                      return (
                        <Fragment key={note.id}>
                          <tr
                            onClick={() => toggleNoteExpand(note.id)}
                            className={`transition-colors cursor-pointer md:cursor-default ${
                              isExpanded
                                ? 'bg-purple-50/40 dark:bg-purple-950/20'
                                : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                            }`}
                          >
                            {/* 1. Note Name + Image + Expand Chevron on Mobile */}
                            <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <HiOutlineChevronDown
                                  className={`w-3.5 h-3.5 md:hidden shrink-0 text-surface-400 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
                                  }`}
                                />
                                {note.image_url ? (
                                  <img
                                    src={note.image_url}
                                    alt={note.name}
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover shrink-0"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0">
                                    <HiOutlinePhotograph className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span
                                    className="font-bold text-surface-900 dark:text-white truncate block max-w-[120px] xs:max-w-[160px] sm:max-w-none text-xs sm:text-sm"
                                    title={note.name}
                                  >
                                    {note.name}
                                  </span>
                                  <span className="text-[11px] text-surface-400 hidden md:block" dir="rtl">
                                    {note.name_ar}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. Arabic Name (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 text-surface-700 dark:text-surface-300 font-medium" dir="rtl">
                              {note.name_ar || '—'}
                            </td>

                            {/* 3. Slug (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 font-mono text-surface-500">
                              {note.slug}
                            </td>

                            {/* 4. Sensory Description (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 text-surface-600 dark:text-surface-300 max-w-xs truncate">
                              {note.description || '—'}
                            </td>

                            {/* 5. Levels (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4">
                              <span className="capitalize text-surface-500">{note.levels_used || 'None'}</span>
                            </td>

                            {/* 6. Products (visible on mobile & desktop) */}
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-purple-600 dark:text-purple-400 text-center sm:text-left whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold">
                                {note.product_count}
                              </span>
                            </td>

                            {/* 7. Actions (visible on mobile & desktop) */}
                            {canManage && (
                              <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditNote(note);
                                    }}
                                    className="p-1.5 text-surface-500 hover:text-purple-600 rounded active:scale-95 transition-all"
                                    title="Edit Note"
                                  >
                                    <HiOutlinePencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({ type: 'note', item: note });
                                    }}
                                    className="p-1.5 text-surface-400 hover:text-red-600 rounded active:scale-95 transition-all"
                                    title="Delete Note"
                                  >
                                    <HiOutlineTrash className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>

                          {/* Mobile Expanded Details Row */}
                          {isExpanded && (
                            <tr className="md:hidden bg-purple-50/25 dark:bg-purple-950/15 border-b border-surface-200/80 dark:border-surface-800">
                              <td colSpan={canManage ? 3 : 2} className="py-2.5 px-3">
                                <div className="space-y-2 text-xs animate-fade-in">
                                  {note.name_ar && (
                                    <div className="flex items-center justify-between pb-1.5 border-b border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 font-semibold uppercase">Arabic Name</span>
                                      <span className="text-surface-800 dark:text-surface-200 font-medium" dir="rtl">{note.name_ar}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Slug</span>
                                      <p className="font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5 truncate">
                                        {note.slug}
                                      </p>
                                    </div>

                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Levels</span>
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {note.levels_used ? (
                                          note.levels_used.split(', ').map((lvl) => (
                                            <span
                                              key={lvl}
                                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                lvl === 'top'
                                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                                  : lvl === 'heart'
                                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                                    : lvl === 'base'
                                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                              }`}
                                            >
                                              {lvl}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[11px] text-surface-400">None</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {note.description && (
                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Sensory Description</span>
                                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-0.5">
                                        {note.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Notes Pagination */}
            <Pagination
              page={notesPage}
              totalPages={notesTotalPages}
              totalItems={filteredNotes.length}
              itemsPerPage={notesPerPage}
              onPageChange={setNotesPage}
              onItemsPerPageChange={setNotesPerPage}
              itemsPerPageOptions={[12, 24, 48]}
              label="notes"
            />
          </div>
        )
      ) : (
        /* ─── TAB 2: OLFACTORY FAMILIES ────────────────────── */
        filteredFamilies.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <HiOutlineTag className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-surface-900 dark:text-white">
              No olfactory families found
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Try adjusting your search query or create a new olfactory family.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {paginatedFamilies.map((family) => (
                  <div
                    key={family.id}
                    className="glass-card rounded-2xl p-4 hover:border-purple-300 dark:hover:border-purple-600 transition-all hover:shadow-lg flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                          {family.icon_url ? (
                            <img
                              src={family.icon_url}
                              alt={family.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <HiOutlineSparkles className="w-6 h-6" />
                          )}
                        </div>

                        <span
                          onClick={() => canManage && handleToggleFamilyActive(family)}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer transition-colors ${family.is_active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                            }`}
                          title="Click to toggle status"
                        >
                          {family.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                          {family.name}
                        </h3>
                        {family.name_ar && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium" dir="rtl">
                            {family.name_ar}
                          </p>
                        )}
                        <p className="text-[10px] font-mono text-surface-400">{family.slug}</p>
                        {family.description && (
                          <p className="text-xs text-surface-600 dark:text-surface-300 line-clamp-3 pt-1">
                            {family.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-xs">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {family.product_count} product{family.product_count === 1 ? '' : 's'}
                      </span>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditFamily(family)}
                            className="p-1.5 rounded-lg text-surface-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                            title="Edit Family"
                          >
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ type: 'family', item: family })}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Delete Family"
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View for Families */
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-300 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-3 sm:px-4">Family</th>
                      <th className="hidden md:table-cell py-3 px-4">Arabic</th>
                      <th className="hidden md:table-cell py-3 px-4">Slug</th>
                      <th className="hidden md:table-cell py-3 px-4">Description</th>
                      <th className="hidden md:table-cell py-3 px-4">Status</th>
                      <th className="py-2.5 sm:py-3 px-2.5 sm:px-4 text-center sm:text-left">Products</th>
                      {canManage && <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {paginatedFamilies.map((family) => {
                      const isExpanded = expandedFamilyId === family.id;
                      return (
                        <Fragment key={family.id}>
                          <tr
                            onClick={() => toggleFamilyExpand(family.id)}
                            className={`transition-colors cursor-pointer md:cursor-default ${
                              isExpanded
                                ? 'bg-purple-50/40 dark:bg-purple-950/20'
                                : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                            }`}
                          >
                            {/* 1. Family Name + Icon + Expand Chevron on Mobile */}
                            <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <HiOutlineChevronDown
                                  className={`w-3.5 h-3.5 md:hidden shrink-0 text-surface-400 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
                                  }`}
                                />
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0 overflow-hidden">
                                  {family.icon_url ? (
                                    <img
                                      src={family.icon_url}
                                      alt={family.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <HiOutlineSparkles className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span
                                    className="font-bold text-surface-900 dark:text-white truncate block max-w-[120px] xs:max-w-[160px] sm:max-w-none text-xs sm:text-sm"
                                    title={family.name}
                                  >
                                    {family.name}
                                  </span>
                                  <span className="text-[11px] text-surface-400 hidden md:block" dir="rtl">
                                    {family.name_ar}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. Arabic Name (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 font-medium text-surface-700 dark:text-surface-300" dir="rtl">
                              {family.name_ar || '—'}
                            </td>

                            {/* 3. Slug (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 font-mono text-surface-500">
                              {family.slug}
                            </td>

                            {/* 4. Description (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4 text-surface-600 dark:text-surface-300 max-w-xs truncate">
                              {family.description || '—'}
                            </td>

                            {/* 5. Status (hidden on mobile) */}
                            <td className="hidden md:table-cell py-3 px-4">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canManage) handleToggleFamilyActive(family);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  family.is_active
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                                } ${canManage ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
                                title={canManage ? 'Click to toggle status' : undefined}
                              >
                                {family.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>

                            {/* 6. Products (visible on mobile & desktop) */}
                            <td className="py-2.5 sm:py-3 px-2.5 sm:px-4 font-semibold text-purple-600 dark:text-purple-400 text-center sm:text-left whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold">
                                {family.product_count}
                              </span>
                            </td>

                            {/* 7. Actions (visible on mobile & desktop) */}
                            {canManage && (
                              <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditFamily(family);
                                    }}
                                    className="p-1.5 text-surface-500 hover:text-purple-600 rounded active:scale-95 transition-all"
                                    title="Edit Family"
                                  >
                                    <HiOutlinePencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({ type: 'family', item: family });
                                    }}
                                    className="p-1.5 text-surface-400 hover:text-red-600 rounded active:scale-95 transition-all"
                                    title="Delete Family"
                                  >
                                    <HiOutlineTrash className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>

                          {/* Mobile Expanded Details Row */}
                          {isExpanded && (
                            <tr className="md:hidden bg-purple-50/25 dark:bg-purple-950/15 border-b border-surface-200/80 dark:border-surface-800">
                              <td colSpan={canManage ? 3 : 2} className="py-2.5 px-3">
                                <div className="space-y-2 text-xs animate-fade-in">
                                  {family.name_ar && (
                                    <div className="flex items-center justify-between pb-1.5 border-b border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 font-semibold uppercase">Arabic Name</span>
                                      <span className="text-surface-800 dark:text-surface-200 font-medium" dir="rtl">{family.name_ar}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Slug</span>
                                      <p className="font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5 truncate">
                                        {family.slug}
                                      </p>
                                    </div>

                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Status</span>
                                      <div className="mt-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (canManage) handleToggleFamilyActive(family);
                                          }}
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                                            family.is_active
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                              : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                                          } ${canManage ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}`}
                                          title={canManage ? 'Click to toggle status' : undefined}
                                        >
                                          {family.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {family.description && (
                                    <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                      <span className="text-[10px] text-surface-400 uppercase font-semibold block">Description</span>
                                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-0.5">
                                        {family.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Families Pagination */}
            <Pagination
              page={familiesPage}
              totalPages={familiesTotalPages}
              totalItems={filteredFamilies.length}
              itemsPerPage={familiesPerPage}
              onPageChange={setFamiliesPage}
              onItemsPerPageChange={setFamiliesPerPage}
              itemsPerPageOptions={[8, 12, 24]}
              label="families"
            />
          </div>
        )
      )}

      {/* ── Modal: Fragrance Note Create / Edit ─────────────── */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl animate-scale-up bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
            <div className="flex items-center justify-between pb-3 border-b border-surface-200 dark:border-surface-800 mb-4">
              <h3 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white font-display truncate">
                {editingNote ? `Edit Fragrance Note — ${editingNote.name}` : 'New Fragrance Note'}
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="p-1.5 rounded-xl text-surface-400 hover:text-surface-600 shrink-0"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                    Note Name (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cambodian Oud"
                    value={noteForm.name}
                    onChange={(e) => setNoteForm({ ...noteForm, name: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                    Note Name (Arabic)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: عود كمبودي"
                    dir="rtl"
                    value={noteForm.name_ar}
                    onChange={(e) => setNoteForm({ ...noteForm, name_ar: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. cambodian-oud (auto-generated if empty)"
                  value={noteForm.slug}
                  onChange={(e) => setNoteForm({ ...noteForm, slug: e.target.value })}
                  className="input-field text-xs w-full font-mono"
                />
              </div>

              {/* Botanical Image Field + File Picker Button */}
              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Botanical Illustration / Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://... or /uploads/..."
                    value={noteForm.image_url}
                    onChange={(e) => setNoteForm({ ...noteForm, image_url: e.target.value })}
                    className="input-field text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFilePickerTarget('note_image');
                      setShowFilePicker(true);
                    }}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 flex-shrink-0"
                  >
                    <HiOutlineFolder className="w-4 h-4 text-purple-600" />
                    <span>File System</span>
                  </button>
                </div>
                {noteForm.image_url && (
                  <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
                    <img
                      src={noteForm.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Sensory Description (English)
                </label>
                <textarea
                  rows={2}
                  placeholder="Aged, smoky agarwood oil with opulent earthy undertones..."
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Sensory Description (Arabic)
                </label>
                <textarea
                  rows={2}
                  placeholder="دهن عود معتق وغني بنفحات خشبية وبخورية ساحرة..."
                  dir="rtl"
                  value={noteForm.description_ar}
                  onChange={(e) => setNoteForm({ ...noteForm, description_ar: e.target.value })}
                  className="input-field text-xs w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-2 px-5 text-xs font-semibold">
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Olfactory Family Create / Edit ───────────── */}
      {showFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl animate-scale-up bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
            <div className="flex items-center justify-between pb-3 border-b border-surface-200 dark:border-surface-800 mb-4">
              <h3 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white font-display truncate">
                {editingFamily ? `Edit Olfactory Family — ${editingFamily.name}` : 'New Olfactory Family'}
              </h3>
              <button
                onClick={() => setShowFamilyModal(false)}
                className="p-1.5 rounded-xl text-surface-400 hover:text-surface-600 shrink-0"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFamily} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                    Family Name (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oriental Amber"
                    value={familyForm.name}
                    onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                    Family Name (Arabic)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: شرقي عنبري"
                    dir="rtl"
                    value={familyForm.name_ar}
                    onChange={(e) => setFamilyForm({ ...familyForm, name_ar: e.target.value })}
                    className="input-field text-xs w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Slug (URL identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. oriental-amber (auto-generated if empty)"
                  value={familyForm.slug}
                  onChange={(e) => setFamilyForm({ ...familyForm, slug: e.target.value })}
                  className="input-field text-xs w-full font-mono"
                />
              </div>

              {/* Icon / Image URL + File Picker Button */}
              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Icon / Accent Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://... or /uploads/..."
                    value={familyForm.icon_url}
                    onChange={(e) => setFamilyForm({ ...familyForm, icon_url: e.target.value })}
                    className="input-field text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFilePickerTarget('family_icon');
                      setShowFilePicker(true);
                    }}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 flex-shrink-0"
                  >
                    <HiOutlineFolder className="w-4 h-4 text-purple-600" />
                    <span>File System</span>
                  </button>
                </div>
                {familyForm.icon_url && (
                  <div className="mt-2 w-14 h-14 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 p-1 flex items-center justify-center">
                    <img
                      src={familyForm.icon_url}
                      alt="Icon Preview"
                      className="w-full h-full object-contain"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-400 mb-1">
                  Sensory Profile Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Opulent accords of spices, precious resins, and sensual sweetness..."
                  value={familyForm.description}
                  onChange={(e) => setFamilyForm({ ...familyForm, description: e.target.value })}
                  className="input-field text-xs w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="family_is_active"
                  checked={familyForm.is_active}
                  onChange={(e) => setFamilyForm({ ...familyForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 border-surface-300 focus:ring-purple-500"
                />
                <label htmlFor="family_is_active" className="text-xs font-semibold text-surface-700 dark:text-surface-300 cursor-pointer">
                  Active (available in perfume product forms and storefront filters)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => setShowFamilyModal(false)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary py-2 px-5 text-xs font-semibold">
                  {editingFamily ? 'Save Changes' : 'Create Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ─────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              Confirm Delete
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mb-4">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold">"{deleteConfirm.item.name}"</span>?
              {deleteConfirm.item.product_count > 0 && (
                <span className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <HiOutlineExclamation className="w-4 h-4 shrink-0" />
                  <span>Note: {deleteConfirm.item.product_count} product(s) are currently associated with this item!</span>
                </span>
              )}
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="btn-danger text-xs py-2 px-4"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Universal File Picker Modal for Images / Icons ── */}
      <FilePickerModal
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSelect={(selectedFile) => {
          const fileUrl = selectedFile.fullUrl || assetUrl(selectedFile.url);
          if (filePickerTarget === 'note_image') {
            setNoteForm((prev) => ({ ...prev, image_url: fileUrl }));
          } else if (filePickerTarget === 'family_icon') {
            setFamilyForm((prev) => ({ ...prev, icon_url: fileUrl }));
          }
          setShowFilePicker(false);
          toast.success('Asset selected from File System');
        }}
        multiple={false}
        imagesOnly={true}
        initialDir="Products"
        title="Choose Asset from File System"
      />
    </div>
  );
}
