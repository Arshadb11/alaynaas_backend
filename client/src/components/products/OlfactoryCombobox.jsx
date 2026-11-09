import { useState, useRef, useEffect, useMemo } from 'react';
import {
  HiOutlineSearch,
  HiOutlineCheck,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineChevronDown,
  HiOutlineSparkles,
  HiStar,
  HiOutlineStar,
} from 'react-icons/hi';
import api from '../../services/api';
import { toast } from '../ui/Toast';

export default function OlfactoryCombobox({
  values = [], // Array of selected family IDs: [1, 9, 2]
  onChange,   // Callback: (newIds) => void
  families = [],
  onFamilyCreated,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [showArabicInput, setShowArabicInput] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize selected IDs ensuring integers and no duplicates
  const selectedIds = useMemo(() => {
    if (!Array.isArray(values)) {
      return values ? [parseInt(values)] : [];
    }
    return values.map((v) => parseInt(v)).filter((v) => !isNaN(v));
  }, [values]);

  // Selected family objects in priority order (0 is primary)
  const selectedFamilies = useMemo(() => {
    return selectedIds
      .map((id) => families.find((f) => f.id === id))
      .filter(Boolean);
  }, [selectedIds, families]);

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

  // Filter existing families by search query
  const filteredFamilies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.slug && f.slug.toLowerCase().includes(q)) ||
        (f.name_ar && f.name_ar.includes(q))
    );
  }, [families, query]);

  // Check if query is an exact match for an existing family
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return families.find((f) => f.name.toLowerCase() === q);
  }, [families, query]);

  // Toggle adding or removing a family
  const handleToggleFamily = (familyId) => {
    const id = parseInt(familyId);
    if (selectedIds.includes(id)) {
      // Remove
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      // Add to list (first added becomes primary if list was empty)
      onChange([...selectedIds, id]);
    }
    setQuery('');
  };

  // Set a specific family as the Primary family (moves it to index 0)
  const handleSetPrimary = (e, familyId) => {
    e.stopPropagation();
    const id = parseInt(familyId);
    const reordered = [id, ...selectedIds.filter((item) => item !== id)];
    onChange(reordered);
    const fam = families.find((f) => f.id === id);
    toast.success(`"${fam?.name || 'Family'}" set as Primary family`);
  };

  // Remove a family from selected
  const handleRemove = (e, familyId) => {
    e.stopPropagation();
    const id = parseInt(familyId);
    onChange(selectedIds.filter((item) => item !== id));
  };

  // Handle creating a new olfactory family to add to the master table & select it
  const handleCreateNewFamily = async () => {
    const cleanName = query.trim();
    if (!cleanName) return;

    setCreating(true);
    try {
      const payload = {
        name: cleanName,
        name_ar: nameAr.trim() || undefined,
      };

      const res = await api.post('/products/olfactory-families', payload);
      const newFamily = res.data.data;

      if (onFamilyCreated) {
        onFamilyCreated(newFamily);
      }

      // Add to selected list
      onChange([...selectedIds, newFamily.id]);
      setQuery('');
      setNameAr('');
      setShowArabicInput(false);
      setIsOpen(false);
      toast.success(`Olfactory family "${newFamily.name}" created and added`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add olfactory family');
    } finally {
      setCreating(false);
    }
  };

  // Handle keyboard events in input
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        handleToggleFamily(exactMatch.id);
      } else if (filteredFamilies.length === 1 && query.trim()) {
        handleToggleFamily(filteredFamilies[0].id);
      } else if (query.trim() && !exactMatch) {
        handleCreateNewFamily();
      }
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      {/* ── Selected Families Badges (Multi-select Chips) ── */}
      {selectedFamilies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700/60">
          {selectedFamilies.map((fam, index) => {
            const isPrimary = index === 0;
            return (
              <div
                key={fam.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  isPrimary
                    ? 'bg-purple-600 text-white font-semibold shadow-sm'
                    : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-200 font-medium'
                }`}
              >
                {/* Primary indicator star */}
                <button
                  type="button"
                  onClick={(e) => !isPrimary && handleSetPrimary(e, fam.id)}
                  title={isPrimary ? 'Primary Olfactory Family' : 'Click to set as Primary'}
                  className={`p-0.5 rounded transition-transform hover:scale-110 ${
                    isPrimary
                      ? 'text-amber-300 cursor-default'
                      : 'text-surface-400 hover:text-amber-500'
                  }`}
                >
                  {isPrimary ? (
                    <HiStar className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <HiOutlineStar className="w-3.5 h-3.5" />
                  )}
                </button>

                <span>{fam.name}</span>
                {isPrimary && (
                  <span className="text-[10px] bg-purple-700/80 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider text-purple-100">
                    Primary
                  </span>
                )}
                {fam.name_ar && !isPrimary && (
                  <span className="text-[11px] text-surface-400 font-arabic" dir="rtl">
                    ({fam.name_ar})
                  </span>
                )}

                {/* Remove button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, fam.id)}
                    className={`p-0.5 rounded-full transition-colors ${
                      isPrimary
                        ? 'hover:bg-purple-700 text-purple-200 hover:text-white'
                        : 'hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600'
                    }`}
                    title="Remove accord"
                  >
                    <HiOutlineX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          <span className="text-[11px] text-surface-400 ml-auto pr-1 flex items-center gap-1">
            <HiOutlineStar className="w-3.5 h-3.5 text-amber-500" /> Click star to set Primary
          </span>
        </div>
      )}

      {/* ── Search & Add Input Box ── */}
      <div className="relative">
        <div
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className={`input-field flex items-center gap-2 cursor-pointer transition-all ${
            isOpen ? 'ring-2 ring-purple-500/30 border-purple-500' : ''
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <HiOutlineSparkles className="w-4 h-4 text-purple-500 shrink-0" />

          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            placeholder={
              selectedFamilies.length > 0
                ? 'Type to add more fragrance accords (e.g. Spicy, Oriental, Woody)...'
                : 'Search & select fragrance families (e.g. Woody, Spicy, Oriental)...'
            }
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="bg-transparent flex-1 border-none outline-none text-surface-900 dark:text-white placeholder-surface-400 text-sm p-0 focus:ring-0"
          />

          {/* Badge counting selected */}
          {selectedFamilies.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
              {selectedFamilies.length} selected
            </span>
          )}

          {/* Dropdown Chevron */}
          <HiOutlineChevronDown
            className={`w-4 h-4 text-surface-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-purple-500' : ''
            }`}
          />
        </div>

        {/* ── Dropdown Menu Popover ── */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl overflow-hidden animate-slide-up max-h-80 flex flex-col">
            {/* Header info */}
            <div className="px-3.5 py-2 border-b border-surface-100 dark:border-surface-800/80 bg-surface-50/70 dark:bg-surface-800/40 flex items-center justify-between text-xs text-surface-500">
              <span>Select multiple accords or type new</span>
              <span className="font-mono text-[10px] text-surface-400">
                {filteredFamilies.length} available
              </span>
            </div>

            {/* List of matching olfactory families */}
            <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800/40">
              {filteredFamilies.length > 0 ? (
                filteredFamilies.map((f) => {
                  const isSelected = selectedIds.includes(f.id);
                  const isPrimary = selectedIds[0] === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleToggleFamily(f.id)}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors text-sm ${
                        isSelected
                          ? 'bg-purple-50/70 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 font-medium'
                          : 'hover:bg-surface-100/70 dark:hover:bg-surface-800/60 text-surface-800 dark:text-surface-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold">{f.name}</span>
                        {f.name_ar && (
                          <span className="text-xs text-surface-400 font-arabic" dir="rtl">
                            ({f.name_ar})
                          </span>
                        )}
                        {isPrimary && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <HiStar className="w-3 h-3" /> Primary
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-semibold">
                            <HiOutlineCheck className="w-4 h-4" />
                            Added
                          </span>
                        ) : (
                          <span className="text-xs text-surface-400 opacity-0 group-hover:opacity-100">
                            + Add
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-surface-400 text-center">
                  No existing olfactory family matches "{query}"
                </div>
              )}
            </div>

            {/* Quick Add New Olfactory Family Action Section */}
            {query.trim() && !exactMatch && (
              <div className="p-3 border-t border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <HiOutlinePlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Add new family: <span className="font-bold underline">"{query.trim()}"</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowArabicInput(!showArabicInput)}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {showArabicInput ? 'Hide Arabic' : '+ Add Arabic'}
                  </button>
                </div>

                {/* Optional Arabic Name Input */}
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

                {/* Confirm Add Button */}
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateNewFamily}
                  className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-2 rounded-lg"
                >
                  {creating ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding to table...
                    </span>
                  ) : (
                    <>
                      <HiOutlinePlus className="w-3.5 h-3.5" />
                      Save & Add "{query.trim()}" to Accords
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
