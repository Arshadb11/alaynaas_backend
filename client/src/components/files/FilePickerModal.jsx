import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { getFileTypeInfo } from '../../utils/fileTypes';
import {
  HiOutlineFolder,
  HiOutlineUpload,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineChevronRight,
  HiOutlineArrowLeft,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineRefresh,
} from 'react-icons/hi';

const API_SERVER_URL = 'http://localhost:3000';

export default function FilePickerModal({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  imagesOnly = true,
  initialDir = 'Products',
  title = 'Select Media & Files',
}) {
  const [currentDir, setCurrentDir] = useState(initialDir || '');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: '' }]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedList, setSelectedList] = useState([]); // array of file objects
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fileInputRef = useRef(null);

  const fetchContents = useCallback(
    async (dirToLoad = currentDir) => {
      setLoading(true);
      try {
        const { data } = await api.get('/files', {
          params: {
            dir: dirToLoad,
            search,
            filterType: imagesOnly ? 'image' : '',
          },
        });
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setBreadcrumbs(data.breadcrumbs || [{ name: 'Home', path: '' }]);
      } catch (err) {
        toast.error('Failed to load folder');
      } finally {
        setLoading(false);
      }
    },
    [currentDir, search, imagesOnly]
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedList([]);
      fetchContents();
    }
  }, [isOpen, fetchContents]);

  if (!isOpen) return null;

  // Toggle selection
  const handleToggleSelect = (file) => {
    if (multiple) {
      const exists = selectedList.some((f) => f.path === file.path);
      if (exists) {
        setSelectedList(selectedList.filter((f) => f.path !== file.path));
      } else {
        setSelectedList([...selectedList, file]);
      }
    } else {
      setSelectedList([file]);
    }
  };

  // Upload directly into current folder
  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    formData.append('dir', currentDir);
    Array.from(fileList).forEach((f) => formData.append('files', f));

    setIsUploading(true);
    try {
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded ${fileList.length} file(s)`);
      fetchContents();
      // Auto select uploaded files
      if (data.files?.length > 0) {
        if (multiple) {
          setSelectedList((prev) => [...prev, ...data.files]);
        } else {
          setSelectedList([data.files[0]]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedList.length === 0) return;
    const fullUrls = selectedList.map((f) => ({
      ...f,
      fullUrl: `${API_SERVER_URL}${f.url}`,
    }));
    onSelect(multiple ? fullUrls : fullUrls[0]);
    onClose();
  };

  // Create folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post('/files/folder', { dir: currentDir, name: newFolderName.trim() });
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      fetchContents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-4xl h-[92vh] sm:h-[85vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
        {/* Hidden Upload Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple={multiple}
          accept={imagesOnly ? 'image/*' : '*'}
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white font-display truncate">
              {title}
            </h2>
            <p className="text-[11px] sm:text-xs text-surface-500 truncate">
              {multiple ? 'Choose one or multiple files' : 'Select a single file'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <HiOutlineUpload className="w-4 h-4" />
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Here'}</span>
              <span className="sm:hidden">{isUploading ? '...' : 'Upload'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation & Search Bar */}
        <div className="p-3 bg-surface-50 dark:bg-surface-800/40 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full sm:max-w-md pb-0.5 sm:pb-0">
            {currentDir && (
              <button
                onClick={() => {
                  const parts = currentDir.split('/');
                  parts.pop();
                  setCurrentDir(parts.join('/'));
                }}
                className="p-1 rounded text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 mr-1 shrink-0"
                title="Back"
              >
                <HiOutlineArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.path} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <HiOutlineChevronRight className="w-3 h-3 text-surface-400" />}
                <button
                  onClick={() => setCurrentDir(crumb.path)}
                  className={`px-2 py-0.5 rounded font-medium whitespace-nowrap ${idx === breadcrumbs.length - 1
                      ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-bold'
                      : 'text-surface-600 dark:text-surface-400 hover:text-surface-900'
                    }`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <HiOutlineSearch className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-8 py-1 text-xs w-full sm:w-48"
              />
            </div>

            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
              title="New Subfolder"
            >
              <HiOutlinePlus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => fetchContents()}
              className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
              title="Refresh"
            >
              <HiOutlineRefresh className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline New Folder Form */}
        {showNewFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="p-2.5 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/40 flex items-center gap-2 text-xs"
          >
            <span className="font-semibold text-purple-700 dark:text-purple-300">New Folder:</span>
            <input
              type="text"
              autoFocus
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="input-field py-1 px-2 text-xs flex-1 max-w-xs"
            />
            <button type="submit" className="btn-primary py-1 px-3 text-xs">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolder(false)}
              className="btn-secondary py-1 px-2 text-xs"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Browser Grid */}
        <div className="flex-1 p-4 overflow-y-auto min-h-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
              ))}
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-surface-400">
              <HiOutlineFolder className="w-12 h-12 mb-2 text-surface-300 dark:text-surface-600" />
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                This folder is empty
              </p>
              <p className="text-xs mt-1">Upload files using the button above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Folders */}
              {folders.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-2">
                    Folders ({folders.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {folders.map((folder) => (
                      <div
                        key={folder.name}
                        onClick={() => setCurrentDir(folder.path)}
                        className="p-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800/80 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer flex items-center gap-2.5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <HiOutlineFolder className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-surface-900 dark:text-white truncate">
                            {folder.name}
                          </p>
                          <p className="text-[10px] text-surface-400">
                            {folder.itemCount} items
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-2">
                    Files ({files.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {files.map((file) => {
                      const isSelected = selectedList.some((f) => f.path === file.path);
                      const typeInfo = getFileTypeInfo(file);
                      const isImage = typeInfo.type === 'image';
                      const fullUrl = `${API_SERVER_URL}${file.url}`;

                      return (
                        <div
                          key={file.name}
                          onClick={() => handleToggleSelect(file)}
                          className={`rounded-2xl border overflow-hidden cursor-pointer transition-all relative flex flex-col group ${isSelected
                              ? 'border-purple-600 ring-2 ring-purple-600 shadow-md bg-purple-50/20 dark:bg-purple-950/20'
                              : 'border-surface-200 dark:border-surface-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-surface-800'
                            }`}
                        >
                          {/* Selection Checkmark */}
                          <div
                            className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected
                                ? 'bg-purple-600 text-white'
                                : 'bg-black/40 text-transparent group-hover:text-white/60'
                              }`}
                          >
                            <HiOutlineCheck className="w-3.5 h-3.5" />
                          </div>

                          {/* Thumbnail */}
                          <div className="h-24 bg-surface-100 dark:bg-surface-800/80 flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img
                                src={fullUrl}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : (
                              <typeInfo.icon className="w-8 h-8 text-surface-400" />
                            )}
                          </div>

                          {/* Name & size */}
                          <div className="p-2">
                            <p className="text-xs font-medium text-surface-900 dark:text-white truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-surface-400 mt-0.5">
                              {file.sizeFormatted}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
          <span className="text-surface-500 font-medium text-center sm:text-left">
            {selectedList.length === 0
              ? 'No file selected'
              : `${selectedList.length} file${selectedList.length === 1 ? '' : 's'} selected`}
          </span>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary flex-1 sm:flex-none py-1.5 px-4 text-xs justify-center">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedList.length === 0}
              className="btn-primary flex-1 sm:flex-none py-1.5 px-4 text-xs font-semibold disabled:opacity-50 justify-center"
            >
              Choose {selectedList.length > 0 ? `(${selectedList.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
