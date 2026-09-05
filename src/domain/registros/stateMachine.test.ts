import { describe, it, expect } from 'vitest';
import { transitionProcessStatus, DomainError, VALID_TRANSITIONS } from './stateMachine.js';
import { ProcessStatus } from '../types.js';

describe('Domain State Machine — ProcessStatus & ProcessEvent (I1 & I2)', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const registroId = 'reg-test-123';
  const atorUserId = 'usr-admin-999';

  describe('Transições válidas do fluxo principal', () => {
    it('pendente -> enviado [enviar lista]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'pendente',
        paraStatus: 'enviado',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: 'Lista enviada pelo parceiro para cobrança',
      });
      expect(res.novoStatus).toBe('enviado');
      expect(res.processEvent.de_status).toBe('pendente');
      expect(res.processEvent.para_status).toBe('enviado');
      expect(res.processEvent.ator_tipo).toBe('parceiro');
      expect(res.processEvent.registro_id).toBe(registroId);
      expect(res.processEvent.tenant_id).toBe(tenantId);
    });

    it('enviado -> pago [webhook PIX confirmado]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'enviado',
        paraStatus: 'pago',
        atorTipo: 'integracao',
        atorUserId: 'system-pix',
        motivo: 'Liquidação PIX recebida com sucesso',
      });
      expect(res.novoStatus).toBe('pago');
      expect(res.processEvent.de_status).toBe('enviado');
    });

    it('enviado -> aguardando_pagamento [comprovante manual]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'enviado',
        paraStatus: 'aguardando_pagamento',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: 'Comprovante anexado para conferência manual',
      });
      expect(res.novoStatus).toBe('aguardando_pagamento');
    });

    it('aguardando_pagamento -> pago [conciliação aprovada]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'aguardando_pagamento',
        paraStatus: 'pago',
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Comprovante conferido e aprovado pelo operador financeiro',
      });
      expect(res.novoStatus).toBe('pago');
    });

    it('aguardando_pagamento -> reprovado [conciliação rejeitada]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'aguardando_pagamento',
        paraStatus: 'reprovado',
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Comprovante ilegível ou divergente',
      });
      expect(res.novoStatus).toBe('reprovado');
    });

    it('reprovado -> aguardando_pagamento [novo comprovante enviado]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'reprovado',
        paraStatus: 'aguardando_pagamento',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: 'Reenvio de novo comprovante válido',
      });
      expect(res.novoStatus).toBe('aguardando_pagamento');
    });

    it('pago -> aguardando_protocolo [automático]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'pago',
        paraStatus: 'aguardando_protocolo',
        atorTipo: 'system',
        atorUserId: 'system',
        motivo: 'Registro liberado para montagem do pacote do lote',
      });
      expect(res.novoStatus).toBe('aguardando_protocolo');
    });

    it('aguardando_protocolo -> protocolado [protocolo registrado]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'aguardando_protocolo',
        paraStatus: 'protocolado',
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Lote protocolado junto aos birôs pelo escritório parceiro',
      });
      expect(res.novoStatus).toBe('protocolado');
    });

    it('protocolado -> baixado [retorno do birô]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'protocolado',
        paraStatus: 'baixado',
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Baixa confirmada em arquivo de retorno Serasa/SPC',
      });
      expect(res.novoStatus).toBe('baixado');
    });

    it('protocolado -> recusado [retorno com recusa]', () => {
      const res = transitionProcessStatus({
        registroId,
        tenantId,
        deStatus: 'protocolado',
        paraStatus: 'recusado',
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Recusa apontada pelo birô em arquivo de retorno',
      });
      expect(res.novoStatus).toBe('recusado');
    });

    it('qualquer status (exceto terminal) pode ir para cancelado com justificativa', () => {
      const testCases: ProcessStatus[] = [
        'pendente',
        'enviado',
        'aguardando_pagamento',
        'pago',
        'reprovado',
        'aguardando_protocolo',
        'protocolado',
      ];

      for (const st of testCases) {
        const res = transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: st,
          paraStatus: 'cancelado',
          atorTipo: 'admin',
          atorUserId,
          motivo: `Cancelamento de exceção por ordem da diretoria para ${st}`,
        });
        expect(res.novoStatus).toBe('cancelado');
      }
    });
  });

  describe('Transições proibidas (devem falhar com DomainError)', () => {
    it('pendente NÃO PODE ir direto para pago (sem envio/submissão)', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'pendente',
          paraStatus: 'pago',
          atorTipo: 'admin',
          atorUserId,
          motivo: 'Tentativa indevida',
        });
      }).toThrow(DomainError);
    });

    it('pendente NÃO PODE ir para protocolado', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'pendente',
          paraStatus: 'protocolado',
          atorTipo: 'admin',
          atorUserId,
          motivo: 'Pular etapas',
        });
      }).toThrow(DomainError);
    });

    it('baixado NÃO PODE regredir para pendente ou enviado', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'baixado',
          paraStatus: 'pendente',
          atorTipo: 'admin',
          atorUserId,
          motivo: 'Tentativa ilegal de regressão',
        });
      }).toThrow(DomainError);
    });

    it('cancelado é estado terminal e NÃO pode transitar para nada', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'cancelado',
          paraStatus: 'pendente',
          atorTipo: 'admin',
          atorUserId,
          motivo: 'Tentar reativar cancelado diretamente',
        });
      }).toThrow(DomainError);
    });

    it('cancelamento exige justificativa detalhada (mínimo 5 chars)', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'pendente',
          paraStatus: 'cancelado',
          atorTipo: 'admin',
          atorUserId,
          motivo: '   ',
        });
      }).toThrow('Cancelamento administrativo exige justificativa válida');
    });

    it('transição para o mesmo status é no-op e deve rejeitar', () => {
      expect(() => {
        transitionProcessStatus({
          registroId,
          tenantId,
          deStatus: 'pago',
          paraStatus: 'pago',
          atorTipo: 'admin',
          atorUserId,
          motivo: 'Mesmo status',
        });
      }).toThrow(DomainError);
    });
  });
});
