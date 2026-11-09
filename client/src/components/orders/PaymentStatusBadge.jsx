import { getPaymentStatusConfig } from '../../config/orderConfig';

/**
 * Reusable enterprise-tier Payment Status Badge
 * Encapsulates the luxury pill styling and fallback handling.
 */
export default function PaymentStatusBadge({
  status,
  size = 'sm',
  className = '',
}) {
  const config = getPaymentStatusConfig(status);

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
  }[size] || 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-block rounded-full font-bold border ${config.color} ${sizeClasses} ${className}`}
    >
      {config.label}
    </span>
  );
}
