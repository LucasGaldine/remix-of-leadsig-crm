import { FileText, Phone, Mail, MessageSquare, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface ActivityItem {
  type: string;
  summary?: string;
  created_at: string;
}

interface ClientPortalActivityProps {
  activity: ActivityItem[];
}

const activityIcons: Record<string, React.ReactNode> = {
  note: <FileText className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  status_change: <ArrowRight className="h-4 w-4" />,
};

const activityLabels: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  sms: "Message",
  status_change: "Status Update",
};

export function ClientPortalActivity({ activity }: ClientPortalActivityProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-4">
        <div className="space-y-0">
          {activity.map((item, index) => (
            <div key={index} className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                {activityIcons[item.type] || <FileText className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 uppercase">
                    {activityLabels[item.type] || item.type}
                  </span>
                  <span className="text-xs text-slate-300">
                    {format(new Date(item.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                {item.summary && (
                  <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
