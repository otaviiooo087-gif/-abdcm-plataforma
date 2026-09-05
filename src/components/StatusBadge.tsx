import React from 'react';
import { ProcessStatus } from '../domain/types.js';

interface StatusBadgeProps {
  status: ProcessStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'pago':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Pago
        </span>
      );
    case 'baixado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Baixado
        </span>
      );
    case 'protocolado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
          Protocolado
        </span>
      );
    case 'aguardando_protocolo':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
          Aguardando Protocolo
        </span>
      );
    case 'aguardando_pagamento':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Aguardando Pagamento
        </span>
      );
    case 'enviado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5"></span>
          Enviado
        </span>
      );
    case 'pendente':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
          Pendente
        </span>
      );
    case 'reprovado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          Reprovado
        </span>
      );
    case 'recusado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
          Recusado
        </span>
      );
    case 'cancelado':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-300 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mr-1.5"></span>
          Cancelado
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
          {status}
        </span>
      );
  }
};
