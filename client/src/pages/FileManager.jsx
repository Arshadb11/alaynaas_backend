import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import PermissionGate from '../components/ui/PermissionGate';
import { getFileTypeInfo, formatFileSize } from '../utils/fileTypes';
import {
  HiOutlineFolder,
  HiOutlineUpload,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiOutlineChevronRight,
  HiOutlineArrowLeft,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineDownload,
  HiOutlineClipboardCopy,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineEye,
  HiOutlineCheck,
} from 'react-icons/hi';

const API_SERVER_URL = 'http://localhost:3000';

export default function FileManager() {
  const [currentDir, setCurrentDir] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: '' }]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Filters & display
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'size' | 'modified'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  // Selected file for inspector
  const [selectedItem, setSelectedItem] = useState(null);

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(null); // { item, isDirectory }
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // item to delete

  // Drag & drop upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Load directory contents
  const fetchContents = useCallback(
    async (dirToLoad = currentDir) => {
      setLoading(true);
      try {
        const { data } = await api.get('/files', {
          params: {
            dir: dirToLoad,
            search,
            filterType,
            sortBy,
            sortOrder,
          },
        });
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setBreadcrumbs(data.breadcrumbs || [{ name: 'Home', path: '' }]);
      } catch (err) {
        toast.error('Failed to load folder contents');
      } finally {
        setLoading(false);
      }
    },
    [currentDir, search, filterType, sortBy, sortOrder]
  );

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/files/stats');
      setStats(data.data);
    } catch {}
  };

  useEffect(() => {
    fetchContents();
    fetchStats();
  }, [fetchContents]);

  // Navigate into folder
  const handleOpenFolder = (folderPath) => {
    setSelectedItem(null);
    setCurrentDir(folderPath);
  };

  // Navigate up one level
  const handleNavigateUp = () => {
    if (!currentDir) return;
    const parts = currentDir.split('/');
    parts.pop();
    handleOpenFolder(parts.join('/'));
  };

  // File upload handler
  const handleUploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    formData.append('dir', currentDir);
    Array.from(fileList).forEach((file) => {
      formData.append('files', file);
    });

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });
      toast.success(`Successfully uploaded ${fileList.length} file(s)`);
      fetchContents();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop listeners
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if leaving the window/target
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Create folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await api.post('/files/folder', {
        dir: currentDir,
        name: newFolderName.trim(),
      });
      toast.success(`Folder "${newFolderName.trim()}" created`);
      setNewFolderName('');
      setShowNewFolderModal(false);
      fetchContents();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create folder');
    }
  };

  // Rename item
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !showRenameModal) return;

    try {
      await api.patch('/files/rename', {
        dir: currentDir,
        oldName: showRenameModal.name,
        newName: renameValue.trim(),
      });
      toast.success('Renamed successfully');
      setShowRenameModal(null);
      setRenameValue('');
      if (selectedItem?.name === showRenameModal.name) {
        setSelectedItem((prev) => (prev ? { ...prev, name: renameValue.trim() } : null));
      }
      fetchContents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rename item');
    }
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete('/files', {
        data: {
          dir: currentDir,
          name: deleteConfirm.name,
        },
      });
      toast.success(`Deleted "${deleteConfirm.name}"`);
      if (selectedItem?.name === deleteConfirm.name) {
        setSelectedItem(null);
      }
      setDeleteConfirm(null);
      fetchContents();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // Copy full URL
  const handleCopyUrl = (fileUrl) => {
    const fullUrl = `${API_SERVER_URL}${fileUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('File URL copied to clipboard');
  };

  return (
    <div
      className="space-y-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => handleUploadFiles(e.target.files)}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary-600/10 dark:bg-primary-900/30 backdrop-blur-sm border-2 border-dashed border-primary-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-surface-800 shadow-xl flex items-center justify-center text-primary-600 mb-3 animate-bounce">
            <HiOutlineUpload className="w-8 h-8" />
          </div>
          <p className="text-lg font-bold text-surface-900 dark:text-white">
            Drop files to upload
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Uploading into: <span className="font-semibold">{currentDir || 'Home'}</span>
          </p>
        </div>
      )}

      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">
            File Manager
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            Local storage file explorer & asset library
          </p>
        </div>

        {/* Storage stats pill */}
        {stats && (
          <div className="px-4 py-2 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-sm flex items-center gap-4 text-xs">
            <div>
              <span className="text-surface-400">Disk Used: </span>
              <span className="font-bold text-surface-800 dark:text-surface-200">
                {stats.totalSizeFormatted}
              </span>
            </div>
            <div className="h-4 w-px bg-surface-200 dark:bg-surface-700" />
            <div>
              <span className="text-surface-400">Files: </span>
              <span className="font-bold text-surface-800 dark:text-surface-200">
                {stats.totalFiles}
              </span>
            </div>
            <div className="h-4 w-px bg-surface-200 dark:bg-surface-700" />
            <div>
              <span className="text-surface-400">Folders: </span>
              <span className="font-bold text-surface-800 dark:text-surface-200">
                {stats.totalFolders}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Breadcrumbs & Top Actions */}
      <div className="glass-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-sm">
          {currentDir && (
            <button
              onClick={handleNavigateUp}
              className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white transition-colors mr-1"
              title="Go up one folder"
            >
              <HiOutlineArrowLeft className="w-4 h-4" />
            </button>
          )}

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.path} className="flex items-center gap-1.5">
                {idx > 0 && <HiOutlineChevronRight className="w-3.5 h-3.5 text-surface-400" />}
                <button
                  onClick={() => handleOpenFolder(crumb.path)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    isLast
                      ? 'font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                      : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  {crumb.name}
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <PermissionGate permission="files.create">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>New Folder</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <HiOutlineUpload className="w-4 h-4" />
              <span>{isUploading ? `Uploading ${uploadProgress}%` : 'Upload Files'}</span>
            </button>
          </PermissionGate>

          <button
            onClick={() => fetchContents()}
            className="p-2 rounded-xl text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Refresh"
          >
            <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Upload Progress Bar (when active) */}
      {isUploading && (
        <div className="glass-card p-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-surface-600 dark:text-surface-300">Uploading files to disk...</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <HiOutlineSearch className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files or folders..."
              className="input-field pl-9 py-1.5 text-xs w-full"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
              >
                <HiOutlineX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-auto"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="document">Documents & PDFs</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="archive">Archives</option>
          </select>
        </div>

        {/* View Mode & Sort */}
        <div className="flex items-center gap-2 self-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field py-1.5 px-2.5 text-xs w-auto"
          >
            <option value="name">Sort by Name</option>
            <option value="modified">Sort by Date</option>
            <option value="size">Sort by Size</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 text-xs font-semibold"
            title="Toggle sort direction"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
            <button
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
      </div>

      {/* Main Layout: Explorer + Inspector */}
      <div className="flex items-start gap-4">
        {/* Explorer Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="glass-card p-4 h-28 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <HiOutlineFolder className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-surface-900 dark:text-white">
                This folder is empty
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-sm mx-auto">
                Drag and drop files here, or use the Upload button above to add assets to this directory.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders Section */}
              {folders.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3">
                    Folders ({folders.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {folders.map((folder) => (
                      <div
                        key={folder.name}
                        onDoubleClick={() => handleOpenFolder(folder.path)}
                        onClick={() => setSelectedItem({ ...folder, isFolder: true })}
                        className={`glass-card p-3 rounded-2xl cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-all hover:shadow-md group relative flex flex-col justify-between ${
                          selectedItem?.name === folder.name && selectedItem?.isFolder
                            ? 'ring-2 ring-purple-500 border-purple-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <HiOutlineFolder className="w-6 h-6" />
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PermissionGate permission="files.update">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRenameModal(folder);
                                  setRenameValue(folder.name);
                                }}
                                className="p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded text-surface-500"
                                title="Rename"
                              >
                                <HiOutlinePencil className="w-3.5 h-3.5" />
                              </button>
                            </PermissionGate>

                            <PermissionGate permission="files.delete">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(folder);
                                }}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-red-500"
                                title="Delete"
                              >
                                <HiOutlineTrash className="w-3.5 h-3.5" />
                              </button>
                            </PermissionGate>
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <p className="text-xs font-semibold text-surface-900 dark:text-white truncate" title={folder.name}>
                            {folder.name}
                          </p>
                          <p className="text-[10px] text-surface-400 mt-0.5">
                            {folder.itemCount} item{folder.itemCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {files.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3">
                    Files ({files.length})
                  </p>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {files.map((file) => {
                        const typeInfo = getFileTypeInfo(file);
                        const isSelected = selectedItem?.name === file.name && !selectedItem?.isFolder;
                        const isImage = typeInfo.type === 'image';
                        const fileFullUrl = `${API_SERVER_URL}${file.url}`;

                        return (
                          <div
                            key={file.name}
                            onClick={() => setSelectedItem(file)}
                            className={`glass-card rounded-2xl overflow-hidden cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-all hover:shadow-md group flex flex-col ${
                              isSelected ? 'ring-2 ring-purple-500 border-purple-500' : ''
                            }`}
                          >
                            {/* Preview Area */}
                            <div className="h-28 bg-surface-100 dark:bg-surface-800/60 relative flex items-center justify-center overflow-hidden">
                              {isImage ? (
                                <img
                                  src={fileFullUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              ) : (
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${typeInfo.color}`}>
                                  <typeInfo.icon className="w-7 h-7" />
                                </div>
                              )}

                              {/* Extension Pill */}
                              <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white">
                                {file.extension}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="p-2.5">
                              <p className="text-xs font-medium text-surface-900 dark:text-white truncate" title={file.name}>
                                {file.name}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-surface-400 mt-1">
                                <span>{file.sizeFormatted}</span>
                                <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Table View */
                    <div className="glass-card overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-300">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">Name</th>
                            <th className="py-2.5 px-4 font-semibold">Type</th>
                            <th className="py-2.5 px-4 font-semibold">Size</th>
                            <th className="py-2.5 px-4 font-semibold">Modified</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                          {files.map((file) => {
                            const typeInfo = getFileTypeInfo(file);
                            return (
                              <tr
                                key={file.name}
                                onClick={() => setSelectedItem(file)}
                                className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors ${
                                  selectedItem?.name === file.name ? 'bg-purple-50/50 dark:bg-purple-950/20' : ''
                                }`}
                              >
                                <td className="py-2.5 px-4 flex items-center gap-2.5 font-medium text-surface-900 dark:text-white truncate max-w-xs">
                                  <typeInfo.icon className="w-4 h-4 text-surface-500 flex-shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                </td>
                                <td className="py-2.5 px-4 text-surface-500 uppercase">{file.extension}</td>
                                <td className="py-2.5 px-4 text-surface-500">{file.sizeFormatted}</td>
                                <td className="py-2.5 px-4 text-surface-500">
                                  {new Date(file.modifiedAt).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyUrl(file.url);
                                    }}
                                    className="p-1 text-surface-400 hover:text-purple-600 rounded mr-1"
                                    title="Copy Link"
                                  >
                                    <HiOutlineClipboardCopy className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Inspector Drawer */}
        {selectedItem && (
          <div className="w-72 glass-card p-4 rounded-2xl flex-shrink-0 space-y-4 animate-slide-left sticky top-6">
            <div className="flex items-center justify-between pb-2 border-b border-surface-200 dark:border-surface-700">
              <span className="text-xs font-bold uppercase tracking-wider text-surface-400">
                {selectedItem.isFolder ? 'Folder Details' : 'File Inspector'}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Box */}
            <div className="h-40 rounded-xl bg-surface-100 dark:bg-surface-800/80 overflow-hidden flex items-center justify-center relative">
              {selectedItem.isFolder ? (
                <div className="text-purple-600 flex flex-col items-center gap-1">
                  <HiOutlineFolder className="w-12 h-12" />
                  <span className="text-xs font-semibold">{selectedItem.name}</span>
                </div>
              ) : getFileTypeInfo(selectedItem).type === 'image' ? (
                <img
                  src={`${API_SERVER_URL}${selectedItem.url}`}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-surface-700 flex items-center justify-center shadow-sm">
                    {(() => {
                      const TypeIcon = getFileTypeInfo(selectedItem).icon;
                      return <TypeIcon className="w-7 h-7 text-purple-600" />;
                    })()}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-700">
                    {selectedItem.extension}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Fields */}
            <div className="space-y-2 text-xs">
              <div>
                <p className="text-surface-400 text-[10px]">Name</p>
                <p className="font-semibold text-surface-900 dark:text-white break-words">
                  {selectedItem.name}
                </p>
              </div>

              {!selectedItem.isFolder && (
                <>
                  <div>
                    <p className="text-surface-400 text-[10px]">Size</p>
                    <p className="font-semibold text-surface-900 dark:text-white">
                      {selectedItem.sizeFormatted} ({selectedItem.size?.toLocaleString()} bytes)
                    </p>
                  </div>

                  <div>
                    <p className="text-surface-400 text-[10px]">URL Path</p>
                    <p className="font-mono text-[11px] text-surface-600 dark:text-surface-300 break-all bg-surface-100 dark:bg-surface-800 p-1.5 rounded-lg select-all">
                      {selectedItem.url}
                    </p>
                  </div>
                </>
              )}

              <div>
                <p className="text-surface-400 text-[10px]">Last Modified</p>
                <p className="text-surface-700 dark:text-surface-300">
                  {new Date(selectedItem.modifiedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-surface-200 dark:border-surface-700 space-y-2">
              {!selectedItem.isFolder && (
                <>
                  <button
                    onClick={() => handleCopyUrl(selectedItem.url)}
                    className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2"
                  >
                    <HiOutlineClipboardCopy className="w-4 h-4" />
                    <span>Copy Direct Link</span>
                  </button>

                  <a
                    href={`${API_SERVER_URL}${selectedItem.url}`}
                    download={selectedItem.name}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2"
                  >
                    <HiOutlineDownload className="w-4 h-4" />
                    <span>Download File</span>
                  </a>
                </>
              )}

              <PermissionGate permission="files.update">
                <button
                  onClick={() => {
                    setShowRenameModal(selectedItem);
                    setRenameValue(selectedItem.name);
                  }}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2"
                >
                  <HiOutlinePencil className="w-4 h-4" />
                  <span>Rename</span>
                </button>
              </PermissionGate>

              <PermissionGate permission="files.delete">
                <button
                  onClick={() => setDeleteConfirm(selectedItem)}
                  className="w-full py-2 px-3 text-xs rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center gap-2 transition-colors font-semibold"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                  <span>Delete {selectedItem.isFolder ? 'Folder' : 'File'}</span>
                </button>
              </PermissionGate>
            </div>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">
              Create New Folder
            </h3>
            <p className="text-xs text-surface-500 mb-4">
              Creating folder in: <span className="font-semibold">{currentDir || 'Home'}</span>
            </p>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Summer Collection 2026"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="input-field w-full text-sm"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-4">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">
              Rename Item
            </h3>
            <p className="text-xs text-surface-500 mb-4">
              Current: <span className="font-semibold">{showRenameModal.name}</span>
            </p>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="input-field w-full text-sm"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenameModal(null);
                    setRenameValue('');
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-4">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 rounded-2xl shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              Confirm Delete
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mb-4">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold">"{deleteConfirm.name}"</span>?
              {deleteConfirm.isDirectory && ' All subfolders and files inside will also be removed from disk.'}
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
                onClick={handleDeleteItem}
                className="btn-danger text-xs py-2 px-4"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
