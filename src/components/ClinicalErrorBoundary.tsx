import React from "react";

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

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h1 className="text-lg font-bold mb-2">Falha inesperada na interface</h1>
          <p className="text-sm text-slate-600 mb-5">
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
