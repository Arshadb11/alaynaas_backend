import { useState, useRef, useEffect, useMemo } from 'react';
import {
  HiOutlineSearch,
  HiOutlineCheck,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineChevronDown,
} from 'react-icons/hi';
import api from '../../services/api';
import { toast } from '../ui/Toast';

const UNITS = [
  { id: 'ml', label: 'ml (Milliliters)' },
  { id: 'gm', label: 'gm (Grams)' },
  { id: 'pcs', label: 'pcs (Pieces/Sets)' },
  { id: 'tola', label: 'tola (Tolas)' },
];

export default function SizeCombobox({
  value,
  onChange,
  sizes = [],
  onSizeCreated,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('ml');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected size object
  const selectedSize = useMemo(() => {
    if (!value) return null;
    return sizes.find((s) => s.id === parseInt(value)) || null;
  }, [value, sizes]);

  // Keep input display query synchronized with selected size when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedSize ? selectedSize.name : '');
    }
  }, [isOpen, selectedSize]);

  // Auto-detect unit when user types if they haven't explicitly toggled it
  useEffect(() => {
    if (!query) return;
    const lower = query.toLowerCase();
    if (lower.includes('gm') || lower.includes(' g') || lower.endsWith('g')) {
      setSelectedUnit('gm');
    } else if (lower.includes('pc') || lower.includes('piece') || lower.includes('set')) {
      setSelectedUnit('pcs');
    } else if (lower.includes('tola')) {
      setSelectedUnit('tola');
    } else if (lower.includes('ml')) {
      setSelectedUnit('ml');
    }
  }, [query]);

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

  // Filter existing sizes by query
  const filteredSizes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sizes;
    return sizes.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.unit.toLowerCase().includes(q) ||
        String(s.value).includes(q) ||
        (s.name_ar && s.name_ar.includes(q))
    );
  }, [sizes, query]);

  // Check if query is an exact match for an existing size
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return sizes.find(
      (s) =>
        s.name.toLowerCase() === q ||
        `${s.value}${s.unit}`.toLowerCase() === q ||
        `${s.value} ${s.unit}`.toLowerCase() === q
    );
  }, [sizes, query]);

  // Parse numeric value from query
  const parsedNumericValue = useMemo(() => {
    const match = query.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }, [query]);

  // Handle selecting an existing size
  const handleSelect = (size) => {
    onChange(size.id);
    setQuery(size.name);
    setIsOpen(false);
  };

  // Handle clearing the selected size
  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle creating a new size to add to the table
  const handleCreateNewSize = async () => {
    const cleanName = query.trim();
    if (!cleanName) return;

    setCreating(true);
    try {
      const payload = {
        name: cleanName,
        unit: selectedUnit,
        value: parsedNumericValue || 1,
      };

      const res = await api.post('/products/sizes', payload);
      const newSize = res.data.data;

      if (onSizeCreated) {
        onSizeCreated(newSize);
      }

      onChange(newSize.id);
      setQuery(newSize.name);
      setIsOpen(false);
      toast.success(`Size "${newSize.name}" added to catalog table`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add new size');
    } finally {
      setCreating(false);
    }
  };

  // Handle keyboard navigation in input
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (filteredSizes.length === 1 && query.trim()) {
        handleSelect(filteredSizes[0]);
      } else if (query.trim() && !exactMatch) {
        handleCreateNewSize();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Combobox Input Box */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`input-field flex items-center gap-2 cursor-pointer transition-all ${isOpen ? 'ring-2 ring-purple-500/30 border-purple-500' : ''
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <HiOutlineSearch className="w-4 h-4 text-surface-400 shrink-0" />

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? query : selectedSize ? selectedSize.name : ''}
          placeholder={selectedSize ? selectedSize.name : 'Type size (e.g. 75ml, 100ml, 50g)...'}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery(selectedSize ? selectedSize.name : '');
          }}
          onKeyDown={handleKeyDown}
          className="bg-transparent flex-1 border-none outline-none text-surface-900 dark:text-white placeholder-surface-400 text-sm p-0 focus:ring-0"
        />

        {/* Selected Size Badge if present and not currently typing */}
        {/* {selectedSize && !isOpen && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
            {selectedSize.unit}
          </span>
        )} */}

        {/* Clear Button */}
        {selectedSize && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Clear size"
          >
            <HiOutlineX className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown Chevron */}
        <HiOutlineChevronDown
          className={`w-4 h-4 text-surface-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-purple-500' : ''
            }`}
        />
      </div>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl overflow-hidden animate-slide-up max-h-80 flex flex-col">
          {/* Header info / Tip */}
          <div className="px-3.5 py-2 border-b border-surface-100 dark:border-surface-800/80 bg-surface-50/70 dark:bg-surface-800/40 flex items-center justify-between text-xs text-surface-500">
            <span>Select existing or type new size</span>
            <span className="font-mono text-[10px] text-surface-400">
              {filteredSizes.length} sizes in table
            </span>
          </div>

          {/* List of matching sizes from product_sizes table */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800/40">
            {filteredSizes.length > 0 ? (
              filteredSizes.map((s) => {
                const isSelected = selectedSize?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors text-sm ${isSelected
                      ? 'bg-purple-50/80 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-medium'
                      : 'hover:bg-surface-100/70 dark:hover:bg-surface-800/60 text-surface-800 dark:text-surface-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold">{s.name}</span>
                      {s.name_ar && (
                        <span className="text-xs text-surface-400 font-arabic" dir="rtl">
                          ({s.name_ar})
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 uppercase">
                        {s.unit}
                      </span>
                    </div>

                    {isSelected && (
                      <HiOutlineCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 text-xs text-surface-400 text-center">
                No existing size matches "{query}"
              </div>
            )}
          </div>

          {/* Quick Add New Size Action Section */}
          {query.trim() && !exactMatch && (
            <div className="p-3 border-t border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <HiOutlinePlus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Add new size: <span className="font-bold underline">"{query.trim()}"</span>
                </span>
                {parsedNumericValue && (
                  <span className="text-[11px] text-surface-500 font-mono">
                    Val: {parsedNumericValue}
                  </span>
                )}
              </div>

              {/* Unit Chooser Pills */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[11px] text-surface-500 font-medium mr-1">Unit:</span>
                {UNITS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUnit(u.id)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${selectedUnit === u.id
                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-600'
                      : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 border border-surface-200 dark:border-surface-700'
                      }`}
                  >
                    {u.id}
                  </button>
                ))}
              </div>

              {/* Confirm Add Button */}
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateNewSize}
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
                    Save & Select "{query.trim()}" ({selectedUnit})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
