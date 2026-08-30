import React from "react";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { Sparkline } from "./charts";

export type AdminTokens = {
  isDark: boolean;
  page: string;
  header: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  input: string;
  brand: string;
};

export function adminTokens(isDark: boolean): AdminTokens {
  return {
    isDark,
    page: isDark ? "bg-zinc-950 text-zinc-100" : "bg-[#f8f9fa] text-[#2d3436]",
    header: isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#e8ecf0]",
    card: isDark
      ? "bg-zinc-900 border-zinc-800"
      : "bg-white border-[#e8ecf0]",
    text: isDark ? "text-zinc-100" : "text-[#2d3436]",
    muted: isDark ? "text-zinc-400" : "text-[#636e72]",
    border: isDark ? "border-zinc-800" : "border-[#e8ecf0]",
    input: isDark
      ? "bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
      : "bg-white border-[#e8ecf0] text-[#2d3436] placeholder:text-[#636e72]",
    brand: "#6c5ce7",
  };
}

export function cardClass(isDark: boolean, extra = ""): string {
  return `rounded-xl border shadow-[var(--shadow-card)] ${
    isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#e8ecf0]"
  } ${extra}`;
}

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const BADGE_LIGHT: Record<BadgeTone, string> = {
  neutral: "bg-[#f1f2f6] text-[#636e72]",
  brand: "bg-[#efeaff] text-[#6c5ce7]",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
};

const BADGE_DARK: Record<BadgeTone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  brand: "bg-violet-500/20 text-violet-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-rose-500/15 text-rose-300",
  info: "bg-sky-500/15 text-sky-300",
};

export function Badge({
  children,
  tone = "neutral",
  isDark = false,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  isDark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isDark ? BADGE_DARK[tone] : BADGE_LIGHT[tone]
      }`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  isDark,
}: {
  title: string;
  description?: string;
  isDark: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
      <Inbox className="h-8 w-8 opacity-60" />
      <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-[#2d3436]"}`}>{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed">{description}</p> : null}
    </div>
  );
}

export function Breadcrumb({
  items,
  isDark,
}: {
  items: { label: string; href?: string; onClick?: () => void }[];
  isDark: boolean;
}) {
  return (
    <nav className={`text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="mx-1.5">›</span> : null}
          {item.onClick || item.href ? (
            <button
              type="button"
              onClick={item.onClick}
              className={`hover:underline ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}
            >
              {item.label}
            </button>
          ) : (
            <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-[#2d3436]"}`}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  isDark,
}: {
  title: string;
  description: string;
  breadcrumb: { label: string; href?: string; onClick?: () => void }[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <Breadcrumb items={breadcrumb} isDark={isDark} />
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-zinc-50" : "text-[#2d3436]"}`}>{title}</h1>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{description}</p>
        {meta}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  series,
  isDark,
}: {
  label: string;
  value: string;
  hint?: string;
  series?: number[];
  isDark: boolean;
}) {
  return (
    <div className={cardClass(isDark, "p-4")}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={`text-2xl font-bold tabular-nums ${isDark ? "text-zinc-50" : "text-[#2d3436]"}`}>{value}</p>
        <Sparkline values={series ?? []} stroke="#6c5ce7" isDark={isDark} />
      </div>
      {hint ? <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{hint}</p> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
  isDark,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "brand";
  isDark: boolean;
}) {
  const valueClass =
    tone === "success"
      ? isDark
        ? "text-emerald-300"
        : "text-emerald-700"
      : tone === "warning"
        ? isDark
          ? "text-amber-300"
          : "text-amber-700"
        : tone === "brand"
          ? "text-[#6c5ce7]"
          : isDark
            ? "text-zinc-50"
            : "text-[#2d3436]";
  return (
    <div className={cardClass(isDark, "p-4")}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.6px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export function ChartCard({
  title,
  actions,
  children,
  isDark,
  className = "",
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div className={cardClass(isDark, `p-4 ${className}`)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={`text-[11px] font-bold uppercase tracking-[0.6px] ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  isDark,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  isDark: boolean;
}) {
  return (
    <div
      className={`inline-flex flex-wrap items-center rounded-lg border p-0.5 ${
        isDark ? "border-zinc-700 bg-zinc-950" : "border-[#e8ecf0] bg-white"
      }`}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[#6c5ce7] text-white"
                : isDark
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-[#636e72] hover:text-[#2d3436]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterBar({
  search,
  onSearch,
  placeholder,
  isDark,
  children,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  placeholder?: string;
  isDark: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
      {onSearch ? (
        <label className="relative min-w-0 flex-1">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? "text-zinc-500" : "text-[#636e72]"}`} />
          <input
            type="search"
            value={search ?? ""}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7]/40 ${
              isDark
                ? "bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                : "bg-white border-[#e8ecf0] text-[#2d3436] placeholder:text-[#636e72]"
            }`}
          />
        </label>
      ) : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function SelectFilter({
  value,
  onChange,
  options,
  isDark,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  isDark: boolean;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7]/40 ${
        isDark
          ? "bg-zinc-950 border-zinc-700 text-zinc-100"
          : "bg-white border-[#e8ecf0] text-[#2d3436]"
      }`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  emptyTitle,
  emptyDescription,
  isDark,
}: {
  columns: DataTableColumn<NoInfer<T>>[];
  rows: T[];
  rowKey: (row: NoInfer<T>) => string;
  onRowClick?: (row: NoInfer<T>) => void;
  selectedKey?: string | null;
  emptyTitle: string;
  emptyDescription?: string;
  isDark: boolean;
}) {
  return (
    <div className={cardClass(isDark, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={isDark ? "border-b border-zinc-800" : "border-b border-[#e8ecf0]"}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.6px] ${
                    isDark ? "text-zinc-500" : "text-[#636e72]"
                  } ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} isDark={isDark} />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKey != null && selectedKey === key;
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`${isDark ? "border-b border-zinc-800" : "border-b border-[#e8ecf0]"} ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${
                      selected
                        ? isDark
                          ? "bg-violet-500/10"
                          : "bg-[#efeaff]"
                        : isDark
                          ? "hover:bg-zinc-800/60"
                          : "hover:bg-[#f8f9fa]"
                    }`}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-3 align-middle ${column.className ?? ""}`}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  noun,
  isDark,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  noun: string;
  isDark: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const shown = total === 0 ? 0 : Math.min(pageSize, total - (current - 1) * pageSize);
  const btn = (disabled: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm disabled:opacity-40 ${
      isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-[#e8ecf0] hover:bg-[#f8f9fa]"
    } ${disabled ? "pointer-events-none" : ""}`;

  return (
    <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-xs ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>
      <span>
        Mostrando {shown} de {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn(current <= 1)} disabled={current <= 1} onClick={() => onPage(current - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[#6c5ce7] px-2 text-xs font-semibold text-white">
          {current}
        </span>
        <button type="button" className={btn(current >= pageCount)} disabled={current >= pageCount} onClick={() => onPage(current + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6c5ce7] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  isDark,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isDark: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
        isDark
          ? "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          : "border-[#e8ecf0] bg-white text-[#2d3436] hover:bg-[#f8f9fa]"
      }`}
    >
      {children}
    </button>
  );
}

export function GhostSelect({
  value,
  onChange,
  options,
  isDark,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  isDark: boolean;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-lg border px-3 py-2 text-sm ${
        isDark
          ? "bg-zinc-950 border-zinc-700 text-zinc-100"
          : "bg-white border-[#e8ecf0] text-[#2d3436]"
      }`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-zinc-300"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-4.5 translate-x-0 left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  isDark,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  isDark: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-[#636e72]"}`}>{label}</span>
      {children}
      {hint ? <span className={`block text-[11px] ${isDark ? "text-zinc-500" : "text-[#636e72]"}`}>{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  isDark,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7]/40 disabled:opacity-70 ${
        isDark
          ? "bg-zinc-950 border-zinc-700 text-zinc-100"
          : "bg-[#f8f9fa] border-[#e8ecf0] text-[#2d3436]"
      }`}
    />
  );
}

export function ErrorBanner({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isDark ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {message}
    </div>
  );
}

export function LoadingBlock({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className={`h-24 animate-pulse rounded-xl ${isDark ? "bg-zinc-800" : "bg-[#e8ecf0]"}`}
        />
      ))}
    </div>
  );
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
