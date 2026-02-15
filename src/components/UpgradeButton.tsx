'use client';

import { useCheckout } from '@/hooks/useCheckout';

interface UpgradeButtonProps {
  plan: 'pro' | 'premium';
  label: string;
  className: string;
}

export function UpgradeButton({ plan, label, className }: UpgradeButtonProps) {
  const { handleUpgrade, loading } = useCheckout();

  return (
    <button
      onClick={() => handleUpgrade(plan)}
      disabled={loading}
      className={className}
    >
      {loading ? '処理中...' : label}
    </button>
  );
}
