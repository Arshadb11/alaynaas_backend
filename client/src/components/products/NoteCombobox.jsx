import { useState, useRef, useEffect, useMemo } from 'react';
import {
  HiOutlineSearch,
  HiOutlineCheck,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineChevronDown,
  HiOutlineSparkles,
} from 'react-icons/hi';
import api from '../../services/api';
import { toast } from '../ui/Toast';

const LEVEL_THEMES = {
  top: {
    border: 'border-amber-200 dark:border-amber-900/40',
    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    badgeBtn: 'hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300',
    headerText: 'text-amber-700 dark:text-amber-300',
    focusRing: 'focus:border-amber-500 ring-amber-500/30',
  },
  heart: {
    border: 'border-rose-200 dark:border-rose-900/40',
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
    badgeBtn: 'hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-700 dark:text-rose-300',
    headerText: 'text-rose-700 dark:text-rose-300',
    focusRing: 'focus:border-rose-500 ring-rose-500/30',
  },
  base: {
    border: 'border-purple-200 dark:border-purple-900/40',
    bg: 'bg-purple-50/40 dark:bg-purple-950/20',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800',
    badgeBtn: 'hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300',
    headerText: 'text-purple-700 dark:text-purple-300',
    focusRing: 'focus:border-purple-500 ring-purple-500/30',
  },
  general: {
    border: 'border-indigo-200 dark:border-indigo-900/40',
    bg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
    badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
    badgeBtn: 'hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300',
    headerText: 'text-indigo-700 dark:text-indigo-300',
    focusRing: 'focus:border-indigo-500 ring-indigo-500/30',
  },
};

export default function NoteCombobox({
  level = 'general',
  title,
  subtitle,
  icon,
  selectedNotes = [], // Array of { note_id, name, name_ar, image_url, note_level }
  allNotes = [],
  onAddNote,
  onRemoveNote,
  onNoteCreated,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [showArabicInput, setShowArabicInput] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const theme = LEVEL_THEMES[level] || LEVEL_THEMES.general;

  // Set of selected note IDs for quick lookup
  const selectedNoteIds = useMemo(() => {
    return new Set(selectedNotes.map((n) => n.note_id));
  }, [selectedNotes]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter master notes matching query
  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.slug && n.slug.toLowerCase().includes(q)) ||
        (n.name_ar && n.name_ar.includes(q)) ||
        (n.description && n.description.toLowerCase().includes(q))
    );
  }, [allNotes, query]);

  // Exact match check
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allNotes.find((n) => n.name.toLowerCase() === q);
  }, [allNotes, query]);

  // Toggle note addition or removal
  const handleToggleNote = (note) => {
    if (selectedNoteIds.has(note.id)) {
      onRemoveNote(note.id);
    } else {
      onAddNote(note);
    }
    setQuery('');
  };

  // Create new master note on-the-fly
  const handleCreateNewNote = async () => {
    const cleanName = query.trim();
    if (!cleanName) return;

    setCreating(true);
    try {
      const payload = {
        name: cleanName,
        name_ar: nameAr.trim() || undefined,
      };

      const res = await api.post('/products/notes', payload);
      const newNote = res.data.data;

      if (onNoteCreated) {
        onNoteCreated(newNote);
      }

      onAddNote(newNote);
      setQuery('');
      setNameAr('');
      setShowArabicInput(false);
      setIsOpen(false);
      toast.success(`Fragrance note "${newNote.name}" created and added`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add fragrance note');
    } finally {
      setCreating(false);
    }
  };

  // Handle keyboard events in search input
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        handleToggleNote(exactMatch);
      } else if (filteredNotes.length === 1 && query.trim()) {
        handleToggleNote(filteredNotes[0]);
      } else if (query.trim() && !exactMatch) {
        handleCreateNewNote();
      }
    }
  };

  return (
    <div className={`p-4 rounded-2xl border ${theme.border} ${theme.bg} space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.headerText}`}>
              {title}
            </h4>
            {subtitle && <p className="text-[11px] text-surface-400">{subtitle}</p>}
          </div>
        </div>
        <span className="text-xs font-semibold text-surface-500">
          {selectedNotes.length} selected
        </span>
      </div>

      {/* ── Selected Notes Chips ── */}
      {selectedNotes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-surface-900/60 border border-surface-200/60 dark:border-surface-800">
          {selectedNotes.map((note) => (
            <div
              key={note.note_id}
              className={`flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg text-xs border font-medium transition-all ${theme.badge}`}
            >
              {note.image_url ? (
                <img
                  src={note.image_url}
                  alt={note.name}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center text-[10px]">
                  <HiOutlineSparkles className="w-2.5 h-2.5 text-surface-400" />
                </span>
              )}
              <span>{note.name}</span>
              {note.name_ar && (
                <span className="text-[11px] opacity-70 font-arabic" dir="rtl">
                  ({note.name_ar})
                </span>
              )}

              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveNote(note.note_id)}
                  className={`p-0.5 rounded-full transition-colors ${theme.badgeBtn}`}
                  title="Remove note"
                >
                  <HiOutlineX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Search & Add Combobox Input ── */}
      <div ref={containerRef} className="relative">
        <div
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className={`input-field flex items-center gap-2 cursor-pointer bg-white dark:bg-surface-900 transition-all ${
            isOpen ? `ring-2 ${theme.focusRing}` : ''
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <HiOutlineSearch className="w-4 h-4 text-surface-400 shrink-0" />

          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            placeholder={`Search or type new note for ${title}...`}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="bg-transparent flex-1 border-none outline-none text-surface-900 dark:text-white placeholder-surface-400 text-sm p-0 focus:ring-0"
          />

          <HiOutlineChevronDown
            className={`w-4 h-4 text-surface-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-purple-500' : ''
            }`}
          />
        </div>

        {/* ── Dropdown Popover ── */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl overflow-hidden animate-slide-up max-h-72 flex flex-col">
            <div className="px-3.5 py-2 border-b border-surface-100 dark:border-surface-800/80 bg-surface-50/70 dark:bg-surface-800/40 flex items-center justify-between text-xs text-surface-500">
              <span>Select note from library or type to create</span>
              <span className="font-mono text-[10px] text-surface-400">
                {filteredNotes.length} notes
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800/40">
              {filteredNotes.length > 0 ? (
                filteredNotes.map((note) => {
                  const isSelected = selectedNoteIds.has(note.id);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => handleToggleNote(note)}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors text-sm ${
                        isSelected
                          ? 'bg-purple-50/80 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 font-medium'
                          : 'hover:bg-surface-100/70 dark:hover:bg-surface-800/60 text-surface-800 dark:text-surface-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {note.image_url ? (
                          <img
                            src={note.image_url}
                            alt={note.name}
                            className="w-6 h-6 rounded-full object-cover border border-surface-200 dark:border-surface-700 shrink-0"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs shrink-0">
                            <HiOutlineSparkles className="w-3.5 h-3.5 text-surface-400" />
                          </span>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{note.name}</span>
                            {note.name_ar && (
                              <span className="text-xs text-surface-400 font-arabic" dir="rtl">
                                ({note.name_ar})
                              </span>
                            )}
                          </div>
                          {note.description && (
                            <p className="text-[11px] text-surface-400 line-clamp-1">
                              {note.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-semibold shrink-0">
                          <HiOutlineCheck className="w-4 h-4" />
                          Added
                        </span>
                      ) : (
                        <span className="text-xs text-surface-400 opacity-0 group-hover:opacity-100 shrink-0">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-surface-400 text-center">
                  No note matches "{query}"
                </div>
              )}
            </div>

            {/* Quick Add New Note Section */}
            {query.trim() && !exactMatch && (
              <div className="p-3 border-t border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <HiOutlinePlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Add new note: <span className="font-bold underline">"{query.trim()}"</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowArabicInput(!showArabicInput)}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {showArabicInput ? 'Hide Arabic' : '+ Add Arabic'}
                  </button>
                </div>

                {showArabicInput && (
                  <div className="mb-2">
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="الاسم بالعربية (اختياري)..."
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-arabic"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateNewNote}
                  className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-2 rounded-lg"
                >
                  {creating ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding to library...
                    </span>
                  ) : (
                    <>
                      <HiOutlinePlus className="w-3.5 h-3.5" />
                      Save & Add "{query.trim()}" to {title}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
