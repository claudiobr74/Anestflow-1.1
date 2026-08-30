import React from "react";
import { adminListProceduresMeta } from "../api";
import type { ProcedureMeta } from "../types";
import { formatDateTime, formatInt, formatMinutes, procedureStatusLabel, shortId, uniqueStrings } from "../format";
import {
  Badge,
  DataTable,
  ErrorBanner,
  FilterBar,
  LoadingBlock,
  PageHeader,
  Pagination,
  paginate,
  SecondaryButton,
  SelectFilter,
  StatTile,
} from "../components/ui";

const PAGE_SIZE = 10;
const FICHA_RESTRICTED = "Acesso ao prontuário permanece restrito à equipe clínica";

function statusTone(status: string): "brand" | "success" | "warning" | "neutral" {
  if (status === "signed") return "success";
  if (status === "in_progress") return "brand";
  if (status === "draft") return "warning";
  return "neutral";
}

export default function AdminProceduresPage({ isDark }: { isDark: boolean }) {
  const [rows, setRows] = React.useState<ProcedureMeta[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [hospital, setHospital] = React.useState("all");
  const [integrity, setIntegrity] = React.useState("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminListProceduresMeta(200)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao listar procedimentos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hospitals = uniqueStrings(rows.map((row) => row.hospital));

  const integrityOf = (row: ProcedureMeta): "integro" | "nao_verificado" =>
    row.has_hash && row.status === "signed" ? "integro" : "nao_verificado";

  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const blob = `${row.id} ${row.responsible_name ?? ""} ${row.hospital ?? ""} ${shortId(row.id)}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    if (status !== "all" && row.status !== status) return false;
    if (hospital !== "all" && row.hospital !== hospital) return false;
    if (integrity !== "all" && integrityOf(row) !== integrity) return false;
    return true;
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, status, hospital, integrity]);

  const signed = rows.filter((row) => row.status === "signed").length;
  const inProgress = rows.filter((row) => row.status === "in_progress").length;
  const incidents = rows.filter((row) => row.has_incident).length;

  return (
    <div>
      <PageHeader
        title="Procedimentos"
        description="Visão administrativa de todos os procedimentos registrados no AnestFlow."
        breadcrumb={[{ label: "Administração" }, { label: "Procedimentos" }]}
        isDark={isDark}
      />
      {error ? <ErrorBanner message={error} isDark={isDark} /> : null}
      {loading ? <LoadingBlock isDark={isDark} /> : null}
      {!loading ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile isDark={isDark} label="Total período" value={formatInt(rows.length)} />
            <StatTile isDark={isDark} label="Concluídos" value={formatInt(signed)} tone="success" />
            <StatTile isDark={isDark} label="Em andamento" value={formatInt(inProgress)} tone="brand" />
            <StatTile isDark={isDark} label="Com intercorrência" value={formatInt(incidents)} tone="warning" />
          </div>
          <FilterBar search={search} onSearch={setSearch} placeholder="Buscar por ID, médico ou organização..." isDark={isDark}>
            <SelectFilter
              isDark={isDark}
              label="Organização"
              value={hospital}
              onChange={setHospital}
              options={[{ value: "all", label: "Organização" }, ...hospitals.map((value) => ({ value, label: value }))]}
            />
            <SelectFilter
              isDark={isDark}
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Status" },
                { value: "draft", label: "Pendente" },
                { value: "in_progress", label: "Em andamento" },
                { value: "signed", label: "Concluído" },
              ]}
            />
            <SelectFilter
              isDark={isDark}
              label="Integridade"
              value={integrity}
              onChange={setIntegrity}
              options={[
                { value: "all", label: "Integridade" },
                { value: "integro", label: "Íntegro" },
                { value: "nao_verificado", label: "Não verificado" },
              ]}
            />
          </FilterBar>
          <DataTable<ProcedureMeta>
            isDark={isDark}
            rows={paginate(filtered, page, PAGE_SIZE)}
            rowKey={(row) => row.id}
            emptyTitle="Nenhum procedimento no período"
            emptyDescription="A listagem usa apenas metadados operacionais. Dados clínicos não são exibidos."
            columns={[
              {
                key: "id",
                header: "ID",
                render: (row) => <span className="font-mono text-xs font-semibold text-[#6c5ce7]">{shortId(row.id)}</span>,
              },
              {
                key: "org",
                header: "Organização",
                render: (row) => row.hospital || "—",
              },
              {
                key: "resp",
                header: "Responsável",
                render: (row) => {
                  const crm = row.responsible_crm ? `CRM ${row.responsible_crm}/${row.responsible_uf || "—"}` : "";
                  return (
                    <div>
                      <p className="font-medium">{row.responsible_name || "—"}</p>
                      {crm ? <p className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{crm}</p> : null}
                    </div>
                  );
                },
              },
              {
                key: "date",
                header: "Data",
                render: (row) => formatDateTime(row.created_at),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <Badge tone={statusTone(String(row.status))} isDark={isDark}>
                    {procedureStatusLabel(String(row.status))}
                  </Badge>
                ),
              },
              {
                key: "dur",
                header: "Duração",
                render: (row) => formatMinutes(row.duration_anes_min),
              },
              {
                key: "ai",
                header: "IA",
                render: (row) =>
                  row.used_voice ? (
                    <Badge tone="brand" isDark={isDark}>
                      Voice
                    </Badge>
                  ) : (
                    <span className={isDark ? "text-zinc-500" : "text-[#636e72]"}>—</span>
                  ),
              },
              {
                key: "integrity",
                header: "Integridade",
                render: (row) =>
                  integrityOf(row) === "integro" ? (
                    <span className={isDark ? "text-emerald-300" : "text-emerald-700"}>Íntegro</span>
                  ) : (
                    <span className={isDark ? "text-zinc-500" : "text-[#636e72]"}>Não verificado</span>
                  ),
              },
              {
                key: "actions",
                header: "Ações",
                render: () => (
                  <SecondaryButton isDark={isDark} title={FICHA_RESTRICTED} onClick={() => undefined}>
                    Ver Ficha
                  </SecondaryButton>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} noun="procedimentos" isDark={isDark} />
        </>
      ) : null}
    </div>
  );
}
