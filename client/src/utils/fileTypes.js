import {
  HiOutlinePhotograph,
  HiOutlineDocumentText,
  HiOutlineFilm,
  HiOutlineMusicNote,
  HiOutlineArchive,
  HiOutlineDocument,
  HiOutlineTable,
  HiOutlineCode,
} from 'react-icons/hi';

export function getFileTypeInfo(file) {
  const ext = (file.extension || file.name?.split('.').pop() || '').toLowerCase();

  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'ico'].includes(ext)) {
    return {
      type: 'image',
      label: 'Image',
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      icon: HiOutlinePhotograph,
    };
  }

  if (['pdf'].includes(ext)) {
    return {
      type: 'document',
      label: 'PDF Document',
      color: 'text-red-500 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      icon: HiOutlineDocumentText,
    };
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'document',
      label: 'Spreadsheet',
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
      icon: HiOutlineTable,
    };
  }

  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return {
      type: 'document',
      label: 'Document',
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
      icon: HiOutlineDocument,
    };
  }

  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return {
      type: 'video',
      label: 'Video',
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
      icon: HiOutlineFilm,
    };
  }

  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return {
      type: 'audio',
      label: 'Audio',
      color: 'text-pink-500 bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800',
      icon: HiOutlineMusicNote,
    };
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      type: 'archive',
      label: 'Archive',
      color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
      icon: HiOutlineArchive,
    };
  }

  if (['json', 'xml', 'html', 'css', 'js', 'md'].includes(ext)) {
    return {
      type: 'code',
      label: 'Code / Data',
      color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800',
      icon: HiOutlineCode,
    };
  }

  return {
    type: 'other',
    label: ext.toUpperCase() || 'File',
    color: 'text-surface-500 bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700',
    icon: HiOutlineDocument,
  };
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
