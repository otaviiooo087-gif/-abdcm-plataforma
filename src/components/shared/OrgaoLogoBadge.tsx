import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { OrgaoBureau, ORGAO_BUREAU_LABEL } from '../../domain/types.js';
import { ORGAO_LOGO_URL } from '../../lib/orgaos/logos.js';

interface OrgaoLogoBadgeProps {
  orgao: OrgaoBureau;
  baixado?: boolean;
  /** Próximo órgão da fila — pulsa em âmbar enquanto ainda não deu baixa. */
  aguardando?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

const TAMANHOS: Record<NonNullable<OrgaoLogoBadgeProps['size']>, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
};

// Logo real do órgão — cinza/apagado enquanto pendente, colorido (com leve
// pulso) assim que o órgão dá baixa. Usado em toda tela que mostra o
// andamento por órgão (I2/I9 não se aplicam aqui, é só apresentação).
export const OrgaoLogoBadge: React.FC<OrgaoLogoBadgeProps> = ({
  orgao,
  baixado = false,
  aguardando = false,
  size = 'md',
  className = '',
  showLabel = true,
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-colors ${
      baixado ? 'bg-white border-emerald-200' : aguardando ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200/80'
    } ${className}`}
    title={ORGAO_BUREAU_LABEL[orgao]}
  >
    <motion.img
      src={ORGAO_LOGO_URL[orgao]}
      alt={ORGAO_BUREAU_LABEL[orgao]}
      className={`${TAMANHOS[size]} w-auto object-contain rounded ${baixado ? '' : 'grayscale opacity-40'}`}
      animate={baixado ? { scale: [1, 1.06, 1] } : aguardando ? { scale: [1, 1.08, 1] } : {}}
      transition={
        baixado
          ? { duration: 1.2, repeat: 2, ease: 'easeInOut' }
          : aguardando
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : undefined
      }
    />
    {showLabel && (
      <span className={`text-[9px] font-bold uppercase tracking-wide ${baixado ? 'text-emerald-600' : 'text-slate-400'}`}>
        {baixado ? 'Baixado' : 'Pendente'}
      </span>
    )}
    {aguardando && !baixado && (
      <span className="text-[8px] text-amber-600 font-semibold flex items-center gap-0.5">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        aguardando
      </span>
    )}
  </div>
);
