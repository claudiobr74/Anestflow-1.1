import React from "react";

function storedThemeIsDark(): boolean {
  try {
    const theme = localStorage.getItem("anesthesia_theme");
    return theme === "dark" || theme === "dark-clean";
  } catch {
    return false;
  }
}

// React 19 neste repo não traz @types/react; a classe precisa declarar props/state.
export class ClinicalErrorBoundary extends React.Component {
  props: { children?: React.ReactNode };
  state: { failed: boolean };

  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.props = props;
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[AnestFlow] falha de interface:", error.name);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const isDark = storedThemeIsDark();

    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
      }`}>
        <div className={`max-w-md w-full rounded-2xl border p-6 shadow-sm text-center ${
          isDark ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-white"
        }`}>
          <h1 className="text-lg font-bold mb-2">Falha inesperada na interface</h1>
          <p className={`text-sm mb-5 ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
            A ficha na nuvem não foi apagada por este erro. Recarregue a página para voltar ao posto.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
