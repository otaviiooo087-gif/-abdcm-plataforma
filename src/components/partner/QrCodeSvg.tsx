import React from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ size = 200 }) => {
  // Matriz visual estática elegante simulando perfeitamente o QR Code PIX oficial
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="w-full h-auto max-w-[220px]"
        fill="currentColor"
      >
        {/* Fundo branco */}
        <rect width="100" height="100" fill="#ffffff" />

        {/* Canto Superior Esquerdo - Finder Pattern */}
        <rect x="6" y="6" width="24" height="24" fill="#0f172a" rx="2" />
        <rect x="10" y="10" width="16" height="16" fill="#ffffff" rx="1" />
        <rect x="14" y="14" width="8" height="8" fill="#0f172a" rx="1" />

        {/* Canto Superior Direito - Finder Pattern */}
        <rect x="70" y="6" width="24" height="24" fill="#0f172a" rx="2" />
        <rect x="74" y="10" width="16" height="16" fill="#ffffff" rx="1" />
        <rect x="78" y="14" width="8" height="8" fill="#0f172a" rx="1" />

        {/* Canto Inferior Esquerdo - Finder Pattern */}
        <rect x="6" y="70" width="24" height="24" fill="#0f172a" rx="2" />
        <rect x="10" y="74" width="16" height="16" fill="#ffffff" rx="1" />
        <rect x="14" y="78" width="8" height="8" fill="#0f172a" rx="1" />

        {/* Alinhamento Central */}
        <rect x="64" y="64" width="12" height="12" fill="#0f172a" rx="1" />
        <rect x="66" y="66" width="8" height="8" fill="#ffffff" />
        <rect x="68" y="68" width="4" height="4" fill="#0f172a" />

        {/* Timing Lines */}
        <line x1="32" y1="18" x2="68" y2="18" stroke="#0f172a" strokeWidth="2" strokeDasharray="3 3" />
        <line x1="18" y1="32" x2="18" y2="68" stroke="#0f172a" strokeWidth="2" strokeDasharray="3 3" />

        {/* Módulos de Dados aleatórios fixos de alta densidade padrão QR Code */}
        <rect x="36" y="6" width="4" height="4" fill="#0f172a" />
        <rect x="44" y="6" width="4" height="4" fill="#0f172a" />
        <rect x="52" y="6" width="4" height="4" fill="#0f172a" />
        <rect x="60" y="6" width="4" height="4" fill="#0f172a" />
        <rect x="36" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="56" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="40" y="24" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="24" width="4" height="4" fill="#0f172a" />
        <rect x="60" y="24" width="4" height="4" fill="#0f172a" />
        <rect x="6" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="12" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="24" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="36" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="44" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="52" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="68" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="76" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="88" y="36" width="4" height="4" fill="#0f172a" />
        <rect x="6" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="18" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="28" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="40" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="60" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="72" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="84" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="92" y="44" width="4" height="4" fill="#0f172a" />
        <rect x="12" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="24" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="32" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="44" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="56" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="64" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="80" y="52" width="4" height="4" fill="#0f172a" />
        <rect x="6" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="20" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="36" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="52" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="84" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="92" y="60" width="4" height="4" fill="#0f172a" />
        <rect x="36" y="68" width="4" height="4" fill="#0f172a" />
        <rect x="44" y="68" width="4" height="4" fill="#0f172a" />
        <rect x="52" y="68" width="4" height="4" fill="#0f172a" />
        <rect x="80" y="68" width="4" height="4" fill="#0f172a" />
        <rect x="88" y="68" width="4" height="4" fill="#0f172a" />
        <rect x="32" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="40" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="56" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="80" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="92" y="76" width="4" height="4" fill="#0f172a" />
        <rect x="36" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="44" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="52" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="64" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="76" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="88" y="84" width="4" height="4" fill="#0f172a" />
        <rect x="32" y="92" width="4" height="4" fill="#0f172a" />
        <rect x="48" y="92" width="4" height="4" fill="#0f172a" />
        <rect x="60" y="92" width="4" height="4" fill="#0f172a" />
        <rect x="72" y="92" width="4" height="4" fill="#0f172a" />
        <rect x="84" y="92" width="4" height="4" fill="#0f172a" />
      </svg>
    </div>
  );
};
