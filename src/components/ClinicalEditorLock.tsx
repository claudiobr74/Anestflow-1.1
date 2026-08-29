import React from "react";

interface ClinicalEditorLockProps {
  canEdit: boolean;
  children: React.ReactNode;
}

/** Desabilita controles de formulário sem mudar o layout. */
export default function ClinicalEditorLock({ canEdit, children }: ClinicalEditorLockProps) {
  return (
    <fieldset disabled={!canEdit} className="m-0 min-w-0 w-full border-0 p-0">
      <legend className="absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0">
        {canEdit ? "Edição clínica autorizada" : "Somente leitura"}
      </legend>
      {children}
    </fieldset>
  );
}
