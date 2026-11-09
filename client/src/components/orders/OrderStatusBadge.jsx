import { getOrderStatusConfig } from '../../config/orderConfig';

/**
 * Reusable enterprise-tier Order Status Badge
 * Encapsulates the luxury pill styling, accessible dot indicator, and fallback handling.
 */
export default function OrderStatusBadge({
  status,
  size = 'sm',
  showDot = true,
  className = '',
}) {
  const config = getOrderStatusConfig(status);

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
  }[size] || 'px-2.5 py-0.5 text-xs';

  const dotSizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2 h-2',
  }[size] || 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${config.color} ${sizeClasses} ${className}`}
      title={config.description || config.label}
    >
      {showDot && (
        <span
          className={`status-dot rounded-full inline-block shrink-0 ${config.dot} ${dotSizeClasses}`}
          aria-hidden="true"
        />
      )}
      <span className="capitalize">{config.label}</span>
    </span>
  );
}
