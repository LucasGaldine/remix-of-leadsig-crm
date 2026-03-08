import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "./SectionHeader";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

type Timeframe = "30d" | "week" | "month";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "30d", label: "30 Days" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

// Mock data — replace with real queries later
const revenueData = [
  { week: "W1", revenue: 8200, expenses: 3100 },
  { week: "W2", revenue: 11500, expenses: 4800 },
  { week: "W3", revenue: 9800, expenses: 3600 },
  { week: "W4", revenue: 13200, expenses: 5200 },
];

const funnelData = [
  { stage: "New Leads", count: 48 },
  { stage: "Qualified", count: 32 },
  { stage: "Approved", count: 18 },
  { stage: "Won", count: 12 },
];

const completionData = [
  { name: "On Time", value: 72, color: "hsl(var(--primary))" },
  { name: "Delayed", value: 18, color: "hsl(38 92% 50%)" },
  { name: "Not Completed", value: 10, color: "hsl(0 72% 51%)" },
];

const hoursData = [
  { job: "Smith Patio", planned: 16, actual: 14 },
  { job: "Jones Fence", planned: 8, actual: 11 },
  { job: "Lee Walkway", planned: 12, actual: 12.5 },
  { job: "Park Drive", planned: 20, actual: 18 },
];

const costData = [
  { name: "Smith Patio", quoted: 4800, actual: 4200, hours: { lead: 8, crew: 16 } },
  { name: "Jones Fence", quoted: 2400, actual: 2900, hours: { lead: 4, crew: 8 } },
  { name: "Lee Walkway", quoted: 3600, actual: 3400, hours: { lead: 6, crew: 12 } },
  { name: "Park Drive", quoted: 6200, actual: 5800, hours: { lead: 10, crew: 20 } },
];

const crewData = [
  { name: "Mike T.", role: "Lead", hours: 38 },
  { name: "Jake R.", role: "Crew", hours: 42 },
  { name: "Sam L.", role: "Crew", hours: 36 },
  { name: "Chris P.", role: "Lead", hours: 40 },
];

const LEAD_RATE = 27;
const CREW_RATE = 18;

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

function VisualCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function RevenueExpenses() {
  return (
    <VisualCard title="Revenue vs Expenses">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={revenueData} barGap={2}>
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
        {revenueData.map((d) => (
          <span key={d.week} className="text-primary font-semibold">
            +${((d.revenue - d.expenses) / 1000).toFixed(1)}k
          </span>
        ))}
      </div>
    </VisualCard>
  );
}

function LeadFunnel() {
  const maxCount = funnelData[0].count;
  return (
    <VisualCard title="Lead Conversion Funnel">
      <div className="space-y-2">
        {funnelData.map((stage, i) => {
          const pct = i === 0 ? 100 : Math.round((stage.count / funnelData[0].count) * 100);
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
    </VisualCard>
  );
}

function CompletionDonut() {
  const onTimePercent = completionData[0].value;
  return (
    <VisualCard title="Job Completion Rate">
      <div className="flex items-center justify-center">
        <div className="relative">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={completionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {completionData.map((entry, i) => (
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
        {completionData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.name} {d.value}%</span>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

function PlannedVsActual() {
  return (
    <VisualCard title="Planned vs Actual Hours">
      <div className="space-y-3">
        {hoursData.map((entry) => {
          const isOver = entry.actual > entry.planned * 1.15;
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
                <div className="h-full rounded bg-primary/80" style={{ width: `${(entry.planned / 24) * 100}%` }} />
                <div
                  className={cn("h-full rounded", isOver ? "bg-destructive/60" : "bg-primary/40")}
                  style={{ width: `${(entry.actual / 24) * 100}%` }}
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
    </VisualCard>
  );
}

function CostVsQuoted() {
  return (
    <VisualCard title="Cost vs Quoted">
      <div className="space-y-2 max-h-[220px] overflow-y-auto">
        {costData.map((job) => {
          const laborCost = job.hours.lead * LEAD_RATE + job.hours.crew * CREW_RATE;
          const totalActual = job.actual;
          const profitable = totalActual <= job.quoted;
          return (
            <div key={job.name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div>
                <div className="text-sm font-medium text-foreground">{job.name}</div>
                <div className="text-[11px] text-muted-foreground">Labor: ${laborCost.toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-right">
                  <div className="text-muted-foreground">${job.quoted.toLocaleString()}</div>
                  <div className={cn("font-semibold", profitable ? "text-primary" : "text-destructive")}>
                    ${totalActual.toLocaleString()}
                  </div>
                </div>
                <span className="text-lg">{profitable ? "✓" : "✗"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </VisualCard>
  );
}

function CrewHours() {
  const maxHours = 50;
  const totalHours = crewData.reduce((sum, c) => sum + c.hours, 0);
  return (
    <VisualCard title="Crew Hours This Week">
      <div className="text-center mb-3">
        <span className="text-2xl font-bold text-foreground">{totalHours}</span>
        <span className="text-sm text-muted-foreground ml-1">total hours</span>
      </div>
      <div className="space-y-2.5">
        {crewData.map((member) => (
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
        <RevenueExpenses />
        <LeadFunnel />
        <CompletionDonut />
        <PlannedVsActual />
        <CostVsQuoted />
        <CrewHours />
      </div>
    </section>
  );
}
