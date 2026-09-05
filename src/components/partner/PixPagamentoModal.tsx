import React, { useState } from 'react';
import { X, QrCode, Copy, Check, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react';
import { QrCodeSvg } from './QrCodeSvg.js';

interface PixPagamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  valorTotalFormatted: string;
  pixPayload?: string;
  submissaoId?: string;
  onSimulatePaid?: () => void;
}

export const PixPagamentoModal: React.FC<PixPagamentoModalProps> = ({
  isOpen,
  onClose,
  valorTotalFormatted,
  pixPayload = '00020101021226800014br.gov.bcb.pix2558pix.abdcm.org.br/qr/v2/cobv/912849182301982340982352040000530398654054750.005802BR5925ABDCM COLETIVA LTDA6009SAO PAULO62070503***6304ABCD',
  submissaoId,
  onSimulatePaid,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [paidConfirmed, setPaidConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      if (submissaoId) {
        await fetch(`/api/submissoes/${submissaoId}/pagar`, {
          method: 'POST',
        });
      }
      setPaidConfirmed(true);
      if (onSimulatePaid) {
        onSimulatePaid();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Pagamento PIX</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            {valorTotalFormatted}
          </p>

          {/* QR Code Container */}
          <div className="flex justify-center my-2">
            <QrCodeSvg value={pixPayload} size={190} />
          </div>

          {/* PIX Copia e Cola */}
          <div className="text-left space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              PIX Copia e Cola
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={pixPayload}
                className="bg-transparent text-[11px] text-slate-600 font-mono flex-1 outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          {paidConfirmed ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pagamento Confirmado com Sucesso!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#148296]" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
              <button
                type="button"
                onClick={handleSimulate}
                disabled={isSimulating}
                className="text-[11px] font-semibold text-[#148296] hover:underline cursor-pointer"
              >
                {isSimulating ? 'Confirmando...' : '⚡ Simular Pagamento Aprovado'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              window.open('#fatura', '_blank');
            }}
            className="px-4 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            Ver Fatura
          </button>
        </div>
      </div>
    </div>
  );
};
