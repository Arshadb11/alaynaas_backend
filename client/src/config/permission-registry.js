/**
 * PERMISSION REGISTRY — Single Source of Truth Re-export
 * 
 * The canonical permission registry lives at /shared/permission-registry.js
 * Both server (Node.js CommonJS) and client (Vite ES Modules) use the single shared file.
 */

export * from '@shared/permission-registry';
export { default } from '@shared/permission-registry';
