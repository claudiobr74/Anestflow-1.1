import { useCallback, useEffect, useRef, useState } from "react";

function supervisorDevLog(message: string) {
  if (import.meta.env.DEV) {
    console.log(message);
  }
}

export function useAiSupervisor() {
  const [aiSupervisorActive, setAiSupervisorActive] = useState(false);
  const [aiSupervisorTask, setAiSupervisorTask] = useState<string>("");
  const [aiSupervisorElapsed, setAiSupervisorElapsed] = useState<number>(0);
  const aiSupervisorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiSupervisorStartRef = useRef<number | null>(null);

  const stopAiSupervisor = useCallback((reason: string = "Concluído com sucesso") => {
    if (aiSupervisorTimerRef.current) {
      clearInterval(aiSupervisorTimerRef.current);
      aiSupervisorTimerRef.current = null;
    }
    const totalElapsed = aiSupervisorStartRef.current
      ? Math.floor((Date.now() - aiSupervisorStartRef.current) / 1000)
      : 0;
    supervisorDevLog(
      `[Supervisor de IA] <<< PARANDO monitoramento. Motivo: "${reason}". Tempo total monitorado: ${totalElapsed}s.`
    );
    setAiSupervisorActive(false);
    setAiSupervisorTask("");
    setAiSupervisorElapsed(0);
    aiSupervisorStartRef.current = null;
  }, []);

  const startAiSupervisor = useCallback(
    (taskName: string, onTimeout: () => void) => {
      supervisorDevLog(`[Supervisor de IA] >>> INICIANDO monitoramento para a tarefa: "${taskName}"`);
      setAiSupervisorActive(true);
      setAiSupervisorTask(taskName);
      setAiSupervisorElapsed(0);
      aiSupervisorStartRef.current = Date.now();

      if (aiSupervisorTimerRef.current) {
        clearInterval(aiSupervisorTimerRef.current);
      }

      aiSupervisorTimerRef.current = setInterval(() => {
        const elapsedSeconds = Math.floor(
          (Date.now() - (aiSupervisorStartRef.current || Date.now())) / 1000
        );
        setAiSupervisorElapsed(elapsedSeconds);

        supervisorDevLog(
          `[Supervisor de IA - Diagnóstico] Estado: ATIVO | Tarefa: "${taskName}" | Tempo Decorrido: ${elapsedSeconds}s / 60s`
        );

        if (elapsedSeconds >= 60) {
          console.warn(
            `[Supervisor de IA - ALERTA] Limite de tempo de 60 segundos ATINGIDO para a tarefa: "${taskName}". Forçando interrupção do processo!`
          );
          try {
            onTimeout();
          } catch (e) {
            console.error(`[Supervisor de IA - Erro] Falha ao invocar callback de interrupção:`, e);
          }
          stopAiSupervisor("Timeout atingido (60s)");
        }
      }, 1000);
    },
    [stopAiSupervisor]
  );

  useEffect(() => {
    return () => {
      if (aiSupervisorTimerRef.current) {
        clearInterval(aiSupervisorTimerRef.current);
      }
    };
  }, []);

  return {
    aiSupervisorActive,
    aiSupervisorTask,
    aiSupervisorElapsed,
    startAiSupervisor,
    stopAiSupervisor
  };
}
