import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EventoNoticia } from '../../domain/types.js';
import { Megaphone, X, ExternalLink } from 'lucide-react';

// Banner de anúncio patrocinado — publicado pelo admin na aba Serviços >
// Marketing ("disparar o anúncio na página dos usuários ativos"). Reaparece
// a cada novo anúncio publicado (dispensa é por id, guardada só no
// navegador — não é dado que precise ir pro servidor).
interface AnuncioBannerProps {
  eventosNoticias: EventoNoticia[];
}

const CHAVE_DISPENSADOS = 'abdcm_anuncios_dispensados';

function lerDispensados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || '[]');
  } catch {
    return [];
  }
}

export const AnuncioBanner: React.FC<AnuncioBannerProps> = ({ eventosNoticias }) => {
  const [dispensados, setDispensados] = useState<string[]>(lerDispensados);

  const anuncio = eventosNoticias
    .filter((e) => e.tipo === 'anuncio' && e.ativo && !dispensados.includes(e.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (!anuncio) return null;

  const dispensar = () => {
    const proximos = [...dispensados, anuncio.id];
    setDispensados(proximos);
    try {
      localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(proximos));
    } catch {
      /* localStorage indisponível — não é crítico, banner só reaparece na próxima visita */
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={anuncio.id}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        className="relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-50 via-white to-amber-50 shadow-2xs flex items-center gap-3 p-3 sm:p-4"
      >
        {anuncio.imagem_url ? (
          <img src={anuncio.imagem_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-amber-200 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-200/70 text-amber-800">
            Publicidade
          </span>
          <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{anuncio.titulo}</p>
          <p className="text-[11px] text-slate-500 truncate">{anuncio.descricao}</p>
        </div>
        {anuncio.link_externo && (
          <a
            href={anuncio.link_externo}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            Ver
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          type="button"
          onClick={dispensar}
          title="Dispensar anúncio"
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
