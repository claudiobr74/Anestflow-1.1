import React, { useState } from 'react';
import { 
  Settings, X, Building2, UserCheck, Activity, Clock, 
  Volume2, VolumeX, Moon, Sun, LayoutGrid, Cloud, 
  CheckCircle2, Trash2, ShieldCheck, Save
} from 'lucide-react';
import {
  clearClinicalSessionDrafts,
  purgeClinicalPhiFromLocalStorage,
} from '../lib/clinicalStorageKeys';

export interface AppSettings {
  defaultHospital: string;
  defaultAnesthesiologistName: string;
  defaultCrm: string;
  vitalIntervalMinutes: number;
  soundAlertsEnabled: boolean;
  compactMode: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultHospital: '',
  defaultAnesthesiologistName: '',
  defaultCrm: '',
  vitalIntervalMinutes: 5,
  soundAlertsEnabled: true,
  compactMode: false,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  isDark: boolean;
  toggleTheme: () => void;
  userEmail?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isDark,
  toggleTheme,
  userEmail,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'vitals' | 'appearance' | 'sync'>('general');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showClearSuccess, setShowClearSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const handleClearLocalCache = () => {
    try {
      purgeClinicalPhiFromLocalStorage();
      clearClinicalSessionDrafts();
      setShowClearSuccess(true);
      setTimeout(() => setShowClearSuccess(false), 3000);
    } catch (e) {
      console.error("Erro ao limpar cache local:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-2xl rounded-lg shadow-lg flex flex-col max-h-[90vh] overflow-hidden border transition-colors ${
          isDark ? "bg-zinc-900 text-zinc-100 border-zinc-800" : "bg-white text-slate-800 border-slate-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/50"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configurações do Sistema</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Personalize preferências de atendimento e interface</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b overflow-x-auto px-6 gap-2 text-sm font-medium ${isDark ? "border-zinc-800" : "border-slate-100"}`}>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'general' 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold" 
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Padrões de Atendimento
          </button>
          <button
            onClick={() => setActiveTab('vitals')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'vitals' 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold" 
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            Monitorização
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'appearance' 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold" 
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Aparência
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sync' 
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold" 
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Cloud className="w-4 h-4" />
            Sincronização & Dados
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: Padrões de Atendimento */}
          {activeTab === 'general' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-800 dark:text-indigo-300">
                Os dados configurados abaixo serão pré-preenchidos automaticamente ao iniciar novas fichas anestésicas.
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    Hospital / Instituição Padrão
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Hospital das Clínicas"
                    value={formData.defaultHospital}
                    onChange={(e) => handleChange('defaultHospital', e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                      isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      Anestesiologista Responsável
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Dr. Carlos Eduardo"
                      value={formData.defaultAnesthesiologistName}
                      onChange={(e) => handleChange('defaultAnesthesiologistName', e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                        isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                      CRM / Registro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456/SP"
                      value={formData.defaultCrm}
                      onChange={(e) => handleChange('defaultCrm', e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                        isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Monitorização */}
          {activeTab === 'vitals' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Intervalo Padrão de Sinais Vitais (minutos)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[5, 10, 15].map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => handleChange('vitalIntervalMinutes', interval)}
                      className={`p-3 rounded-lg border text-sm font-semibold transition-all text-center ${
                        formData.vitalIntervalMinutes === interval
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                          : isDark
                          ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-700/80 text-zinc-200"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {interval} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                  isDark ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.soundAlertsEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-200 text-slate-400 dark:bg-zinc-800'}`}>
                      {formData.soundAlertsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold block">Alertas Sonoros de Temporizador</span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">Tocar bipe suave ao alcançar metas de tempo cirúrgico</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.soundAlertsEnabled}
                    onChange={(e) => handleChange('soundAlertsEnabled', e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Aparência */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-fade-in">
              <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isDark ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-200 hover:bg-slate-50"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                    {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold block">Tema Visual ({isDark ? 'Escuro' : 'Claro'})</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Alternar modo noturno com alto contraste cirúrgico</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Alternar
                </button>
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isDark ? "border-zinc-800 hover:bg-zinc-800/50" : "border-slate-200 hover:bg-slate-50"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold block">Modo Alta Densidade</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Reduz espaçamentos para visualização otimizada em monitores menores</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.compactMode}
                  onChange={(e) => handleChange('compactMode', e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Sincronização & Dados */}
          {activeTab === 'sync' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Sincronização em Nuvem Nativa e Criptografada</h4>
                  <p className="text-xs leading-relaxed opacity-90">
                    O sistema de sincronização em tempo real do Supabase está ativo. As alterações da ficha são gravadas em Postgres com RLS e distribuídas via Realtime aos participantes da ficha.
                  </p>
                </div>
              </div>

              {userEmail && (
                <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${isDark ? "border-zinc-800 bg-zinc-800/40" : "border-slate-200 bg-slate-50"}`}>
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Conta Autenticada:</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-200">{userEmail}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Cache Local Temporário</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Apaga o rascunho desta aba e qualquer cópia legado no disco. Fichas já salvas na nuvem permanecem.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLocalCache}
                    className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar Cache
                  </button>
                </div>

                {showClearSuccess && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    Cache local da sessão limpo com sucesso!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/50"}`}>
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-md flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
