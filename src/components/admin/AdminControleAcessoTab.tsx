import React, { useEffect, useState } from 'react';
import { Registro, Lote } from '../../domain/types.js';
import { UserSession } from '../../server/mockData.js';
import { KeyRound, ShieldCheck, ShieldOff, UserCog } from 'lucide-react';

interface UsuarioAcesso {
  id: string;
  nome: string;
  email: string;
  role: string;
  parceiro_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface AdminControleAcessoTabProps {
  registros: Registro[];
  lotes: Lote[];
  session: UserSession | null;
}

const ROLE_LABEL: Record<string, string> = {
  parceiro: 'Parceiro',
  administrador: 'Administrador',
  conciliador: 'Conciliador',
  operador: 'Operador de Lote',
  suporte: 'Suporte',
  financeiro: 'Financeiro',
};

export const AdminControleAcessoTab: React.FC<AdminControleAcessoTabProps> = ({ registros, lotes, session }) => {
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  const loadUsuarios = () => {
    setCarregando(true);
    fetch('/api/admin/usuarios')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: UsuarioAcesso[]) => setUsuarios(data))
      .catch(() => setUsuarios([]))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  const handleToggleAtivo = async (u: UsuarioAcesso) => {
    setAlterandoId(u.id);
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/ativo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Erro ao atualizar conta');
      }
      loadUsuarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar conta');
    } finally {
      setAlterandoId(null);
    }
  };

  // Uso por usuário: pra cada parceiro com conta real, qual lote/ação ele
  // mais movimenta — dado real (contagem de registros), não estimado.
  const usoDoParceiro = (parceiroId: string | null) => {
    if (!parceiroId) return null;
    const doParceiro = registros.filter((r) => r.parceiro_id === parceiroId);
    if (doParceiro.length === 0) return null;
    const porLote = new Map<string, number>();
    for (const r of doParceiro) porLote.set(r.lote_id, (porLote.get(r.lote_id) || 0) + 1);
    const [loteIdMaisUsado, qtd] = [...porLote.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const lote = lotes.find((l) => l.id === loteIdMaisUsado);
    return { nomeLote: lote?.nome || loteIdMaisUsado, qtd, totalNomes: doParceiro.length };
  };

  const podeGerenciar = session?.role === 'administrador';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <UserCog className="w-4 h-4 text-[#148296]" />
        <h3 className="text-sm font-bold text-slate-900">Controle de Acesso</h3>
        <span className="text-[11px] text-slate-400 font-medium">contas de login reais (parceiro e administrador)</span>
      </div>

      {carregando ? (
        <p className="px-6 py-8 text-center text-xs text-slate-400">Carregando...</p>
      ) : usuarios.length === 0 ? (
        <p className="px-6 py-8 text-center text-xs text-slate-400">Nenhuma conta de login criada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Conta</th>
                <th className="px-6 py-3">Papel</th>
                <th className="px-6 py-3">Uso mais frequente</th>
                <th className="px-6 py-3">Criada em</th>
                <th className="px-6 py-3">Status</th>
                {podeGerenciar && <th className="px-6 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {usuarios.map((u) => {
                const uso = usoDoParceiro(u.parceiro_id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3">
                      <p className="font-bold text-slate-900">{u.nome}</p>
                      <p className="text-[10px] text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {uso ? (
                        <>
                          <p className="font-semibold text-slate-800 truncate max-w-[180px]">{uso.nomeLote}</p>
                          <p className="text-[10px] text-slate-500">{uso.qtd} de {uso.totalNomes} nomes</p>
                        </>
                      ) : (
                        <span className="text-slate-400">sem uso registrado</span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          u.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {u.ativo ? <ShieldCheck className="w-2.5 h-2.5" /> : <ShieldOff className="w-2.5 h-2.5" />}
                        {u.ativo ? 'Ativa' : 'Desativada'}
                      </span>
                    </td>
                    {podeGerenciar && (
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          disabled={alterandoId === u.id}
                          onClick={() => handleToggleAtivo(u)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 ${
                            u.ativo ? 'text-rose-700 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
        <KeyRound className="w-3 h-3" />
        Contas dos outros 4 papéis (conciliador, operador, suporte, financeiro) continuam no
        troca-de-papel de demonstração — não têm login/conta própria ainda.
      </div>
    </div>
  );
};
