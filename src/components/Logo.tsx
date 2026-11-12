export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="#0C1219" stroke="#22303E" />
      <path d="M8 8h8M8 8v8" stroke="#3F9BFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 32h-8M32 32v-8" stroke="#FF7A2F" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M15 12v16M25 12v16M15 20h10" stroke="#EDF4FB" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
