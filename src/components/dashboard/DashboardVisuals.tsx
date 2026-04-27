import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  BarChart3,
  Clock3,
  TrendingDown,
  Loader as Loader2,
  Scale,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useRevenueExpenses,
  useLeadFunnel,
  useJobCompletion,
  usePlannedVsActual,
  useCostVsQuoted,
  useCrewHours,
} from "@/hooks/useDashboardVisuals";

type Timeframe = "week" | "month";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function TimeframeToggle({ value, onChange }: { value: Timeframe; onChange: (v: Timeframe) => void }) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as Timeframe)}>
      <TabsList className="h-11 rounded-lg p-1">
        {TIMEFRAMES.map((tf) => (
          <TabsTrigger
            key={tf.value}
            value={tf.value}
            className="min-w-[96px] px-4 py-2 text-sm font-semibold"
          >
            {tf.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function VisualCard({
  title,
  icon: Icon,
  children,
  isLoading,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <h3 className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{title}</span>
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

function RevenueExpenses({ timeframe }: { timeframe: Timeframe }) {
  const { data = [], isLoading } = useRevenueExpenses(timeframe);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const hasData = data.length > 0;
  const totalProfit = data.reduce((sum: number, period: any) => sum + ((period.revenue || 0) - (period.expenses || 0)), 0);
  const maxBarValue = Math.max(
    1000,
    ...data.map((period: any) => Math.max(Number(period.revenue) || 0, Number(period.expenses) || 0)),
  );
  const yDomain = Math.ceil((maxBarValue * 1.15) / 1000) * 1000;
  const drilldownGroups = data
    .map((period: any) => {
      const entriesByJobId = new Map<string, { id: string; name: string; revenue: number; expenses: number }>();

      (period.revenueJobs || []).forEach((entry: any) => {
        const existing = entriesByJobId.get(entry.id) || {
          id: entry.id,
          name: entry.name || "Unnamed Job",
          revenue: 0,
          expenses: 0,
        };
        existing.revenue += Number(entry.amount) || 0;
        entriesByJobId.set(entry.id, existing);
      });

      (period.expenseJobs || []).forEach((entry: any) => {
        const existing = entriesByJobId.get(entry.id) || {
          id: entry.id,
          name: entry.name || "Unnamed Job",
          revenue: 0,
          expenses: 0,
        };
        existing.expenses += Number(entry.amount) || 0;
        entriesByJobId.set(entry.id, existing);
      });

      return {
        week: period.week,
        entries: Array.from(entriesByJobId.values()),
      };
    })
    .filter((period: any) => period.entries.length > 0);

  return (
    <VisualCard title="Revenue vs Expenses" icon={BarChart3} isLoading={isLoading}>
      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No payment data yet</div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setIsDrilldownOpen(true)}
            aria-label="Open revenue and cost job details"
            className="w-full text-left rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mb-3 flex items-center justify-end gap-4 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                Expenses
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `$${(Math.abs(v) / 1000).toFixed(0)}k`}
                  domain={[0, yDomain]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    return [`$${Math.abs(Number(value)).toLocaleString()}`, name];
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="hsl(var(--destructive) / 0.7)" radius={[8, 8, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-3 pl-2 sm:pl-3 lg:pl-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[1.45fr_repeat(6,minmax(0,1fr))] lg:gap-x-2 lg:gap-y-2">
                <div className="h-28 py-3 flex items-start gap-8 lg:col-span-1 lg:h-32 lg:mr-5">
                  <div className="min-w-0 space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Profit</div>
                    <span
                      className={cn(
                        "block text-3xl font-semibold leading-none",
                        totalProfit >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {totalProfit < 0 ? "-" : ""}${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="ml-auto self-center grid h-12 w-12 place-items-center rounded-xl bg-destructive/10">
                    <TrendingDown className="h-6 w-6 text-destructive" />
                  </div>
                </div>
                {data.map((d: any) => (
                  <div
                    key={d.week}
                    className="h-28 px-3 py-3 flex flex-col items-center justify-center gap-4 text-center lg:h-32 lg:w-full"
                  >
                    <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">{d.week}</div>
                    <div
                      className={cn(
                        "w-full text-center text-xl leading-none font-semibold",
                        d.revenue - d.expenses > 0
                          ? "text-primary"
                          : d.revenue - d.expenses < 0
                            ? "text-destructive"
                            : "text-foreground",
                      )}
                    >
                      {(d.revenue - d.expenses) < 0 ? "-" : ""}${(Math.abs(d.revenue - d.expenses) / 1000).toFixed(1)}k
                    </div>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        (d.revenue - d.expenses) > 0
                          ? "bg-primary"
                          : (d.revenue - d.expenses) < 0
                            ? "bg-destructive"
                            : "bg-muted-foreground/35",
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          </button>

          <Dialog open={isDrilldownOpen} onOpenChange={setIsDrilldownOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Revenue and Costs by Job</DialogTitle>
                <DialogDescription>
                  Showing both revenue and cost totals for each job in the selected dashboard periods.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
                {drilldownGroups.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No revenue or cost entries in this timeframe.</div>
                ) : (
                  drilldownGroups.map((period: any) => (
                    <section key={period.week} className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {timeframe === "week" ? `Week of ${period.week}` : period.week}
                      </h4>
                      <ul className="space-y-1">
                        {period.entries.map((entry: any) => (
                          <li
                            key={entry.id}
                            className="text-xs flex items-center justify-between bg-muted/40 rounded px-2 py-1.5"
                          >
                            <span className="text-foreground font-medium">{entry.name}</span>
                            <span className="text-muted-foreground">
                              Revenue ${Number(entry.revenue || 0).toLocaleString()} | Costs ${Number(entry.expenses || 0).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </VisualCard>
  );
}

function LeadFunnel({ timeframe }: { timeframe: Timeframe }) {
  const { data = [], isLoading } = useLeadFunnel(timeframe);
  const maxCount = data.length > 0 ? Math.max(...data.map((d: any) => d.count), 1) : 1;
  const totalLeads = data.length > 0 ? data[0]?.count || 1 : 1;

  return (
    <VisualCard title="Lead Conversion Funnel" icon={Target} isLoading={isLoading}>
      {data.every((d: any) => d.count === 0) ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No leads yet</div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          {data.map((stage: any, i: number) => {
            const pct = i === 0 ? 100 : Math.round((stage.count / totalLeads) * 100);
            const widthPct = Math.max((stage.count / maxCount) * 100, 20);
            return (
              <div key={stage.stage} className="flex flex-1 flex-col justify-center gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{stage.stage}</span>
                  <span className="text-muted-foreground">{stage.count} ({pct}%)</span>
                </div>
                <div className="h-10 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VisualCard>
  );
}

function CompletionDonut({ timeframe }: { timeframe: Timeframe }) {
  const { data = [], isLoading } = useJobCompletion(timeframe);
  const completionPercent = data.length > 0 ? data[0]?.value || 0 : 0;

  return (
    <VisualCard title="Job Completion Rate" icon={BadgeCheck} isLoading={isLoading}>
      {data.every((d: any) => d.value === 0) ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No job data yet</div>
      ) : (
        <>
          <div className="flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {data.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{completionPercent}%</div>
                  <div className="text-[10px] text-muted-foreground">Completed</div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 text-xs">
            {data.map((d: any) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name} {d.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </VisualCard>
  );
}

function PlannedVsActual({ timeframe }: { timeframe: Timeframe }) {
  const { data = [], isLoading } = usePlannedVsActual(timeframe);

  return (
    <VisualCard title="Planned vs Actual Hours" icon={Clock3} isLoading={isLoading}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No hours data yet</div>
      ) : (
        <>
          <div className="space-y-3">
            {data.map((entry: any) => {
              const isOver = entry.actual > entry.planned * 1.15;
              const maxH = Math.max(entry.planned, entry.actual, 1);
              return (
                <div key={entry.job} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium flex items-center gap-1.5">
                      {entry.job}
                      {isOver && <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded font-semibold">⚠ Over</span>}
                    </span>
                    <span className="text-muted-foreground">{entry.actual}h / {entry.planned}h</span>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div className="h-full rounded bg-primary/80" style={{ width: `${(entry.planned / (maxH * 1.5)) * 100}%` }} />
                    <div
                      className={cn("h-full rounded", isOver ? "bg-destructive/60" : "bg-primary/40")}
                      style={{ width: `${(entry.actual / (maxH * 1.5)) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary/80" /> Planned</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary/40" /> Actual</span>
          </div>
        </>
      )}
    </VisualCard>
  );
}

function CostVsQuoted({ timeframe }: { timeframe: Timeframe }) {
  const navigate = useNavigate();
  const { data = [], isLoading } = useCostVsQuoted(timeframe);

  return (
    <VisualCard title="Cost vs Quoted" icon={Scale} isLoading={isLoading}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No cost data yet</div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto">
          {data.map((job: any) => {
            const profitable = job.actual <= job.quoted;
            const canNavigate = Boolean(job.customerId);
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(`/customers/${job.customerId}`)}
                className="w-full flex items-center justify-between p-2 rounded-md bg-muted/50 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                aria-label={`Open client ${job.name}`}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{job.name}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="text-right">
                    <div className="text-muted-foreground">${job.quoted.toLocaleString()}</div>
                    <div className={cn("font-semibold", profitable ? "text-primary" : "text-destructive")}>
                      ${job.actual.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-lg">{profitable ? "✓" : "✗"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </VisualCard>
  );
}

function CrewHours({ timeframe }: { timeframe: Timeframe }) {
  const { data = [], isLoading } = useCrewHours(timeframe);
  const maxHours = data.length > 0 ? Math.max(...data.map((c: any) => c.hours), 1) * 1.2 : 50;
  const totalHours = data.reduce((sum: number, c: any) => sum + c.hours, 0);

  return (
    <VisualCard title="Crew Member Hours" icon={Users} isLoading={isLoading}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No crew data yet</div>
      ) : (
        <>
          <div className="text-center mb-3">
            <span className="text-2xl font-bold text-foreground">{totalHours}</span>
            <span className="text-sm text-muted-foreground ml-1">total hours</span>
          </div>
          <div className="space-y-2.5">
            {data.map((member: any) => (
              <div key={member.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{member.name}</span>
                  <span className="text-muted-foreground">{member.role} • {member.hours}h</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", member.role === "Lead" ? "bg-primary" : "bg-primary/50")}
                    style={{ width: `${(member.hours / maxHours) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </VisualCard>
  );
}

export function DashboardVisuals() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-start">
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <RevenueExpenses timeframe={timeframe} />
        </div>
        <div className="lg:col-span-1 [&>div]:h-full">
          <LeadFunnel timeframe={timeframe} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CompletionDonut timeframe={timeframe} />
        <CostVsQuoted timeframe={timeframe} />
        <CrewHours timeframe={timeframe} />
      </div>
    </section>
  );
}
