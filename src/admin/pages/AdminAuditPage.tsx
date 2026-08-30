import React from "react";
import { adminListAuditEvents } from "../api";
import type { AuditEvent } from "../types";
import { formatDateTime, uniqueStrings } from "../format";
import {
  Badge,
  DataTable,
  ErrorBanner,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  paginate,
  SelectFilter,
} from "../components/ui";

const PAGE_SIZE = 10;

function tipoTone(tipo: string): "brand" | "success" | "warning" | "danger" | "info" | "neutral" {
  if (tipo === "PROCEDURE_SIGNED") return "success";
  if (tipo === "ADDENDUM_CREATED") return "info";
  if (tipo === "ADMIN_ACTION") return "brand";
  if (tipo === "CLINICAL_VOID") return "warning";
  if (tipo === "RESPONSIBILITY_TRANSFER") return "warning";
  if (tipo.includes("FAIL") || tipo.includes("INTEGRITY")) return "danger";
  return "neutral";
}

export default function AdminAuditPage({ isDark }: { isDark: boolean }) {
  const [rows, setRows] = React.useState<AuditEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [tipo, setTipo] = React.useState("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminListAuditEvents(200)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tipos = uniqueStrings(rows.map((row) => row.tipo));
  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const blob = `${row.descricao} ${row.actor_name ?? ""} ${row.action} ${row.tipo}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (tipo !== "all" && row.tipo !== tipo) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, tipo]);

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Registro completo de ações e eventos do sistema."
        breadcrumb={[{ label: "Administração" }, { label: "Auditoria" }]}
        isDark={isDark}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading ? <LoadingBlock isDark={isDark} /> : null}
      {!loading ? (
        <>
          <FilterBar search={search} onSearch={setSearch} placeholder="Buscar registros de auditoria..." isDark={isDark}>
            <SelectFilter
              isDark={isDark}
              label="Tipo de evento"
              value={tipo}
              onChange={setTipo}
              options={[{ value: "all", label: "Tipo de evento" }, ...tipos.map((value) => ({ value, label: value }))]}
            />
          </FilterBar>
          <DataTable<AuditEvent>
            isDark={isDark}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum evento de auditoria"
            emptyDescription="Eventos administrativos e clínicos (sem PHI) aparecem aqui quando existirem."
            columns={[
              { key: "when", header: "Horário", render: (row) => <span className="tabular-nums">{formatDateTime(row.created_at)}</span> },
              {
                key: "tipo",
                header: "Tipo",
                render: (row) => (
                  <Badge tone={tipoTone(row.tipo)} isDark={isDark}>
                    {row.tipo}
                  </Badge>
                ),
              },
              { key: "desc", header: "Descrição", render: (row) => row.descricao || row.action },
              { key: "user", header: "Usuário", render: (row) => row.actor_name || "—" },
              { key: "org", header: "Organização", render: (row) => row.organization_name || "—" },
              { key: "ip", header: "IP", render: (row) => row.ip || "—" },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="logs" isDark={isDark} />
        </>
      ) : null}
    </div>
  );
}
