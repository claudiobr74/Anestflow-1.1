# Reuso de componentes — Admin vs AnestFlow

Não criar um segundo design system. Tokens clínicos (Inter, `rounded-xl`, `shadow-card`, lucide) + cores Figma Admin (`#6c5ce7` marca).

| Elemento Figma | Componente existente | Reusar | Adaptar | Criar novo |
| -------------- | -------------------- | ------ | ------- | ---------- |
| Marca “AnestFlow Admin” | `AnestFlowLogo` | marca institucional | Figma usa mark 28px HeartPulse + texto; lucide `HeartPulse` coincide | — |
| Tabs 10 itens, underline 3px | `AppNav` | padrão overflow-x mobile | labels/hierarquia ERP; não as 5 abas da ficha | `AdminShell` tabs |
| Avatar + nome + “Super Admin” | iniciais em `AppHeader` | padrão iniciais | sem chip de paciente | bloco no `AdminShell` |
| Sino | lucide `Bell` | glifo coincide | badge só se `admin_issues` abertos > 0 | — |
| Botão primário indigo/roxo | botões login/header | tokens | `#6c5ce7` no Admin | — |
| Segmented Hoje/7d/30d | nenhum | tokens | — | `AdminSegmentedControl` |
| Metric card + sparkline | nenhum ERP | card `rounded-xl` `shadow-card` | sparkline SVG com **série real** (não asset Figma) | `AdminMetricCard` |
| KPI menor | nenhum | tokens | — | `AdminStatTile` |
| Chart linha/barra/donut/heatmap | `ClinicalChart` (d3 intraop) | d3 no projeto | **não** o gráfico da ficha | `AdminChartCard` SVG |
| Data table | cards do `ProceduresManagerModal` | não | — | `AdminDataTable` |
| Busca / filtros | inputs `LoginScreen` | classes de input | — | `AdminFilterBar` |
| Badges status/plano/severidade | `StatusBadge` clínico | não (semântica distinta) | — | `AdminBadge` |
| Breadcrumb | nenhum | — | — | `AdminBreadcrumb` |
| Drawer usuário 480px / problema 520px | `AnesthesiaDescriptionDrawer` | overlay, close, scroll | conteúdo ERP | `AdminUserDrawer`, `AdminIssueDrawer` |
| Modal “Nova organização” | `SettingsModal` overlay | `bg-black/60` | — | modal pequeno no page |
| Empty / loading / error | avisos login | — | — | `AdminEmptyState` |
| Pagination | nenhum | — | — | `AdminPagination` |
| Toggle feature flag | nenhum | — | — | toggle no settings |
| Dark/light | `anesthesia_theme` | sim | Figma só light; mapear tokens | shell `isDark` |
| Tooltip | `title` nativo | sim | — | — |
| Date picker | nenhum | — | filtro período = segmented Figma | não criar datepicker |
| Skeleton | `animate-pulse` | sim | — | — |
| Toast | nenhum | mensagens inline | — | não adicionar lib |
| Error boundary | `ClinicalErrorBoundary` | envolver AdminApp | — | — |
