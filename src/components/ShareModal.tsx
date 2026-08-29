import React, { useState, useEffect } from 'react';
import { AnesthesiaDocument } from '../types';
import { X, Users, Mail, Plus, Trash2, ArrowRightLeft, ShieldCheck, AlertCircle, Loader2, UserCheck, ShieldAlert } from 'lucide-react';
import { lookupProfileByEmail } from '../lib/profileService';

interface ShareModalProps {
  document: AnesthesiaDocument;
  isDark: boolean;
  onClose: () => void;
  onUpdateDocument: (doc: Partial<AnesthesiaDocument>) => void;
  isSyncing: boolean;
  toggleSync: () => void;
  onOpenTransferModal?: () => void;
}

interface UserProfileInfo {
  uid: string;
  name?: string;
  crm?: string;
  uf?: string;
  email?: string;
  emailVerified?: boolean;
}

export default function ShareModal({
  document,
  isDark,
  onClose,
  onUpdateDocument,
  isSyncing,
  toggleSync,
  onOpenTransferModal
}: ShareModalProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  
  // Cache of fetched user profiles by UID
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileInfo>>({});
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const participantUids = document.participantUids || [];
  const sharedWithEmails = document.sharedWithEmails || [];

  // Fetch profiles for existing participantUids
  useEffect(() => {
    if (participantUids.length === 0) return;

    let isMounted = true;
    setIsLoadingProfiles(true);

    const fetchProfiles = async () => {
      const profilesMap: Record<string, UserProfileInfo> = { ...userProfiles };
      let updated = false;

      for (const uid of participantUids) {
        if (!profilesMap[uid]) {
          // RLS de profiles só permite SELECT da própria linha.
          // Participantes de terceiros aparecem pelo UID até a onda de fichas no Supabase.
          profilesMap[uid] = { uid, name: "Anestesiologista", email: "UID: " + uid };
          updated = true;
        }
      }

      if (isMounted && updated) {
        setUserProfiles(profilesMap);
      }
      if (isMounted) {
        setIsLoadingProfiles(false);
      }
    };

    fetchProfiles();

    return () => {
      isMounted = false;
    };
  }, [participantUids.join(',')]);

  const handleSearchAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchSuccess(null);

    const cleanEmail = searchEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setSearchError("Informe um endereço de e-mail válido.");
      return;
    }

    setIsSearching(true);
    try {
      const found = await lookupProfileByEmail(cleanEmail);

      if (found) {
        const targetUid = found.id;

        if (participantUids.includes(targetUid)) {
          setSearchError(`Dr(a). ${found.full_name || cleanEmail} já possui acesso concedido via UID.`);
          setIsSearching(false);
          return;
        }

        const newUids = Array.from(new Set([...participantUids, targetUid]));
        const updatedEmails = sharedWithEmails.filter(e => e.toLowerCase() !== cleanEmail);

        setUserProfiles(prev => ({
          ...prev,
          [targetUid]: {
            uid: targetUid,
            name: found.full_name,
            crm: found.crm,
            uf: found.uf,
            email: cleanEmail,
            emailVerified: true
          }
        }));

        onUpdateDocument({
          participantUids: newUids,
          sharedWithEmails: updatedEmails
        });

        setSearchSuccess(`Acesso concedido ao Dr(a). ${found.full_name || cleanEmail} (CRM ${found.crm || ''}/${found.uf || ''}).`);
        setSearchEmail("");
      } else {
        setSearchError(`Nenhum anestesiologista cadastrado com o e-mail "${cleanEmail}". O profissional precisa criar conta e confirmar o e-mail no AnestFlow.`);
      }
    } catch (err: any) {
      console.error("Erro ao buscar anestesiologista:", err);
      setSearchError("Falha na busca: " + (err.message || "Verifique sua conexão."));
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveUid = (uidToRemove: string) => {
    const isOwnerOrLead = uidToRemove === document.createdByUid || uidToRemove === document.currentResponsibleUid;
    if (isOwnerOrLead) {
      alert("Não é possível remover o criador ou o anestesiologista responsável atual.");
      return;
    }

    const updated = participantUids.filter(u => u !== uidToRemove);
    onUpdateDocument({ participantUids: updated });
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = sharedWithEmails.filter(e => e !== emailToRemove);
    onUpdateDocument({ sharedWithEmails: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`relative w-full max-w-lg p-6 rounded-lg shadow-md flex flex-col gap-5 ${isDark ? "bg-zinc-900 border border-zinc-800 text-zinc-100" : "bg-white text-zinc-900"}`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition ${isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-black"}`}
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-zinc-900"}`}>
            <Users className="w-5 h-5 text-indigo-500" />
            Compartilhamento por Firebase UID
          </h2>
          <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            A autorização de acesso é vinculada estritamente ao Firebase UID verificado do anestesiologista.
          </p>
        </div>

        {/* Action: Transfer of Responsibility */}
        {onOpenTransferModal && (
          <button
            onClick={() => {
              onClose();
              onOpenTransferModal();
            }}
            disabled={document.status === "Signed"}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Registrar Troca de Responsabilidade Anestésica</span>
          </button>
        )}

        <div className={`p-3.5 rounded-lg border flex items-center justify-between ${isDark ? "bg-zinc-800/50 border-zinc-700/50" : "bg-zinc-50 border-zinc-100"}`}>
          <div>
            <h3 className={`text-xs font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              Sincronização Nuvem
            </h3>
            <p className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {isSyncing ? "Ativa (Sincronizando com Firestore)" : "Pausada"}
            </p>
          </div>
          <button
            onClick={toggleSync}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              isSyncing
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                : isDark
                  ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                  : "bg-zinc-200 hover:bg-zinc-300 text-zinc-900"
            }`}
          >
            {isSyncing ? "Ativa" : "Ativar"}
          </button>
        </div>

        {/* Lookup form */}
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Localizar Anestesiologista por E-mail
          </h3>
          
          <form onSubmit={handleSearchAndAdd} className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <input
                type="email"
                placeholder="E-mail cadastrado do colega..."
                value={searchEmail}
                onChange={e => {
                  setSearchEmail(e.target.value);
                  setSearchError(null);
                  setSearchSuccess(null);
                }}
                disabled={document.status === "Signed" || isSearching}
                className={`w-full pl-9 pr-4 py-2 text-xs rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition ${
                  isDark
                    ? "bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500"
                    : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400"
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!searchEmail || document.status === "Signed" || isSearching}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Localizar UID</span>
            </button>
          </form>

          {searchError && (
            <div className="mb-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{searchError}</span>
            </div>
          )}

          {searchSuccess && (
            <div className="mb-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-start gap-2">
              <UserCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{searchSuccess}</span>
            </div>
          )}

          <div className="mt-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              Profissionais Autorizados (UIDs)
            </h4>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {participantUids.length === 0 && sharedWithEmails.length === 0 ? (
                <p className={`text-xs text-center py-4 italic ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  Nenhum profissional adicional autorizado.
                </p>
              ) : (
                <>
                  {participantUids.map(uid => {
                    const prof = userProfiles[uid];
                    const isCreator = uid === document.createdByUid;
                    const isResponsible = uid === document.currentResponsibleUid;

                    return (
                      <div
                        key={uid}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                          isDark ? "bg-zinc-800/40 border-zinc-700/50" : "bg-zinc-50 border-zinc-200"
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                              {prof?.name || "Anestesiologista"}
                            </span>
                            {prof?.crm && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-bold shrink-0">
                                CRM {prof.crm}/{prof.uf || 'BR'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>UID Concedido ({uid.substring(0, 8)}...)</span>
                            </span>
                            {isCreator && (
                              <span className="text-xs px-1 bg-amber-500/10 text-amber-500 font-bold rounded">
                                Criador
                              </span>
                            )}
                            {isResponsible && (
                              <span className="text-xs px-1 bg-blue-500/10 text-blue-500 font-bold rounded">
                                Responsável
                              </span>
                            )}
                          </div>
                        </div>

                        {!isCreator && !isResponsible && (
                          <button
                            onClick={() => handleRemoveUid(uid)}
                            disabled={document.status === "Signed"}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-30"
                            title="Revogar Acesso UID"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Display legacy sharedWithEmails pending migration */}
                  {sharedWithEmails.map(email => (
                    <div
                      key={email}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        isDark ? "bg-zinc-800/20 border-zinc-800" : "bg-slate-50 border-zinc-200"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                        <span className={`text-xs font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          {email}
                        </span>
                        <span className="text-xs text-amber-500/90 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Migração para UID pendente (Aguardando login)</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveEmail(email)}
                        disabled={document.status === "Signed"}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-30"
                        title="Remover convite por e-mail"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
