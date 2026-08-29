import React, { useState, useRef } from "react";
import { Mic, Square, Loader2, Info, Zap } from "lucide-react";
import { invokeAiFunction } from "../lib/aiFunctions";
export interface VoiceCommandButtonProps { 
  isDark?: boolean;
  onCommandProcessed?: (actions: any) => void;
  className?: string;
  startAiSupervisor?: (taskName: string, onTimeout: () => void) => void;
  stopAiSupervisor?: (reason: string) => void;
}

export function VoiceCommandButton({ 
  isDark, 
  onCommandProcessed, 
  className,
  startAiSupervisor,
  stopAiSupervisor
}: VoiceCommandButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMsg, setResultMsg] = useState<{type: "success" | "error" | "info", text: string} | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<any>(null);
  

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          options = { mimeType: "audio/ogg;codecs=opus" };
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
        } else if (MediaRecorder.isTypeSupported("audio/aac")) {
          options = { mimeType: "audio/aac" };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const mimeTypeUsed = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeTypeUsed });
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) {
            await sendToGemini(base64data, mimeTypeUsed);
          } else {
            setIsProcessing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResultMsg(null);

      // Auto-stop after 60 seconds to prevent extremely large audio payloads and latency
      timeoutRef.current = setTimeout(() => {
        handleStopRecording();
      }, 60000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      setResultMsg({ type: "error", text: "Erro ao acessar o microfone." });
    }
  };

  const handleStopRecording = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendToGemini = async (base64data: string, mimeTypeUsed: string) => {
    const controller = new AbortController();
    
    // Register the task with the AI Supervisor
    if (startAiSupervisor) {
      startAiSupervisor("Comando de Voz", () => {
        controller.abort();
      });
    }

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 55000); // 55s component-level safety timeout (letting central supervisor handle 60s)

    try {
      const data = await invokeAiFunction<{ identifiedActions?: unknown }>(
        "voice-command",
        { audioBase64: base64data, mimeType: mimeTypeUsed },
        controller.signal
      );
      
      clearTimeout(timeoutId);
      
      console.log("Comando de voz processado:", data);
      
      if (onCommandProcessed && data.identifiedActions) {
        onCommandProcessed(data.identifiedActions);
      }

      if (stopAiSupervisor) {
        stopAiSupervisor("Sucesso");
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(error);
      
      if (stopAiSupervisor) {
        stopAiSupervisor(error.name === "AbortError" ? "Interrompido por timeout do Supervisor" : `Erro: ${error.message || error}`);
      }

      let errMsg = "Falha ao processar áudio.";
      if (error.name === "AbortError") {
        errMsg = "O assistente de IA demorou muito para processar o áudio (limite de tempo atingido). Por favor, tente novamente.";
      } else if (error.message) {
        if (error.message.includes("quota") || error.message.includes("429")) {
          errMsg = "Erro 429: Cota excedida na API. Verifique seus créditos ou chave de acesso.";
        } else if (error.message.includes("503") || error.message.includes("UNAVAILABLE") || error.message.includes("overloaded")) {
          errMsg = "Erro 503: IA com alta demanda temporária. Tente novamente.";
        } else if (error.message.includes("{")) {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
          } catch(e) {}
        }
      }
      setResultMsg({ type: "error", text: errMsg });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setResultMsg(null), 8000);
    }
  };

  return (
    <div className={`relative flex items-center justify-center gap-2 ${className || ''}`}>
      {/* Indicadores de status em tempo real */}
      {(isRecording || isProcessing) && (
        <span className={`text-xs md:text-xs font-bold px-2 py-1 rounded-lg animate-pulse whitespace-nowrap ${
          isRecording 
            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" 
            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
        }`}>
          {isRecording ? <><Mic className="w-4 h-4" /> Gravando...</> : <><Zap className="w-4 h-4" /> Processando...</>}
        </span>
      )}

      {resultMsg && (
        <div className={`absolute top-full mt-2 right-0 md:-right-4 z-50 p-3 rounded-lg shadow-sm text-xs font-bold w-64 animate-fade-in ${
          resultMsg.type === "error" 
            ? "bg-red-500 text-white" 
            : resultMsg.type === "success" 
              ? "bg-emerald-500 text-white" 
              : "bg-indigo-500 text-white"
        }`}>
          {resultMsg.text}
        </div>
      )}
      
      <div className="relative">
        {isRecording && (
          <div className="absolute inset-0 rounded-full bg-rose-500 blur-md animate-pulse opacity-75"></div>
        )}
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isProcessing}
          title="Assistente de Voz IA"
          className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            isRecording 
              ? "bg-gradient-to-tr from-rose-600 to-rose-400 text-white ring-4 ring-rose-500/30" 
              : isProcessing
                ? "bg-gradient-to-tr from-amber-500 to-amber-400 text-white opacity-90 cursor-not-allowed"
                : isDark
                  ? "bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white ring-2 ring-indigo-500/20"
                  : "bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white ring-2 ring-indigo-600/20"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <div className="flex items-center justify-center gap-0.5">
               <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
