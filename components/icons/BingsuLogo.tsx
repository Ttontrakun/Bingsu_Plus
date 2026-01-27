import React from 'react';

type BingsuLogoProps = {
  className?: string;
  title?: string;
};

const BingsuLogo: React.FC<BingsuLogoProps> = ({ className, title = 'Bingsu' }) => {
  return (
    <svg
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>

      {/* Headset */}
      <path
        d="M28 60c0-22 18-40 40-40s40 18 40 40"
        fill="none"
        stroke="#F6C443"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M20 62c0-6 5-11 11-11h4v28h-4c-6 0-11-5-11-11z"
        fill="#F6C443"
      />
      <path
        d="M108 62c0-6-5-11-11-11h-4v28h4c6 0 11-5 11-11z"
        fill="#F6C443"
      />
      <path
        d="M92 84c0 10-8 18-18 18h-6"
        fill="none"
        stroke="#F6C443"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Ice cream */}
      <circle cx="64" cy="58" r="30" fill="#FFF3D6" stroke="#E6D6B4" strokeWidth="2" />

      {/* Topping */}
      <path
        d="M40 54c6-10 16-16 28-16 13 0 24 7 30 18-4 6-9 10-16 12-4 1-9 0-14-2-8-4-16-4-28-1z"
        fill="#F26B1D"
      />
      <circle cx="52" cy="50" r="4" fill="#1F1B16" opacity="0.15" />
      <circle cx="68" cy="46" r="4" fill="#1F1B16" opacity="0.15" />
      <circle cx="82" cy="54" r="4" fill="#1F1B16" opacity="0.15" />

      {/* Face */}
      <circle cx="54" cy="62" r="4" fill="#2B2117" />
      <circle cx="74" cy="62" r="4" fill="#2B2117" />
      <path
        d="M56 74c5 6 11 6 16 0"
        fill="none"
        stroke="#2B2117"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="45" cy="72" r="6" fill="#FF9AA5" opacity="0.7" />
      <circle cx="83" cy="72" r="6" fill="#FF9AA5" opacity="0.7" />

      {/* Bowl */}
      <path
        d="M28 78h72c0 18-16 34-36 34S28 96 28 78z"
        fill="#FFD34D"
        stroke="#E2B63A"
        strokeWidth="2"
      />
      <path
        d="M30 78h68"
        stroke="#F7C94B"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
};

export default BingsuLogo;

