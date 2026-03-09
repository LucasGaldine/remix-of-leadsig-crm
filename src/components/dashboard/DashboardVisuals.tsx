import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  useRevenueExpenses,
  useLeadFunnel,
  useJobCompletion,
  usePlannedVsActual,
  useCostVsQuoted,
  useCrewHours,
} from "@/hooks/useDashboardVisuals";

type Timeframe = "30d" | "week" | "month";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "30d", label: "30 Days" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function TimeframeToggle({ value, onChange }: { value: Timeframe; onChange: (v: Timeframe) => void }) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
            value === tf.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

function VisualCard({ title, children, isLoading }: { title: string; children: React.ReactNode; isLoading?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
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

  const hasData = data.length > 0;

  return (
    <VisualCard title="Revenue vs Expenses" isLoading={isLoading}>
      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No payment data yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="hsl(var(--destructive) / 0.5)" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            {data.map((d: any) => (
              <span key={d.week} className="text-primary font-semibold">
                +${((d.revenue - d.expenses) / 1000).toFixed(1)}k
              </span>
            ))}
          </div>
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
    <VisualCard title="Lead Conversion Funnel" isLoading={isLoading}>
      {data.every((d: any) => d.count === 0) ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No leads yet</div>
      ) : (
        <div className="space-y-2">
          {data.map((stage: any, i: number) => {
            const pct = i === 0 ? 100 : Math.round((stage.count / totalLeads) * 100);
            const widthPct = Math.max((stage.count / maxCount) * 100, 20);
            return (
              <div key={stage.stage} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{stage.stage}</span>
                  <span className="text-muted-foreground">{stage.count} ({pct}%)</span>
                </div>
                <div className="h-6 rounded-md overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-primary to-primary/60 transition-all"
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
  const onTimePercent = data.length > 0 ? data[0]?.value || 0 : 0;

  return (
    <VisualCard title="Job Completion Rate" isLoading={isLoading}>
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
                  <div className="text-2xl font-bold text-foreground">{onTimePercent}%</div>
                  <div className="text-[10px] text-muted-foreground">On Time</div>
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
    <VisualCard title="Planned vs Actual Hours" isLoading={isLoading}>
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
  const { data = [], isLoading } = useCostVsQuoted(timeframe);

  return (
    <VisualCard title="Cost vs Quoted" isLoading={isLoading}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No cost data yet</div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto">
          {data.map((job: any) => {
            const profitable = job.actual <= job.quoted;
            return (
              <div key={job.name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
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
              </div>
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
    <VisualCard title="Crew Hours This Week" isLoading={isLoading}>
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
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2">Analytics</h2>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RevenueExpenses timeframe={timeframe} />
        <LeadFunnel timeframe={timeframe} />
        <CompletionDonut timeframe={timeframe} />
        <PlannedVsActual timeframe={timeframe} />
        <CostVsQuoted timeframe={timeframe} />
        <CrewHours timeframe={timeframe} />
      </div>
    </section>
  );
}
