import React, { createContext, useContext } from "react";

export type IntraoperativeUi = Record<string, any>;

const IntraoperativeUiContext = createContext<IntraoperativeUi | null>(null);

export function IntraoperativeUiProvider({
  value,
  children,
}: {
  value: IntraoperativeUi;
  children: React.ReactNode;
}) {
  return (
    <IntraoperativeUiContext.Provider value={value}>
      {children}
    </IntraoperativeUiContext.Provider>
  );
}

export function useIntraUi(): IntraoperativeUi {
  const ctx = useContext(IntraoperativeUiContext);
  if (!ctx) throw new Error("useIntraUi fora do IntraoperativeUiProvider");
  return ctx;
}
