interface ClientPortalReviewRequestCardProps {
  onLeaveReview: () => void;
  onDismiss: () => void;
}

export function ClientPortalReviewRequestCard({
  onLeaveReview,
  onDismiss,
}: ClientPortalReviewRequestCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
      <div className="px-6 sm:px-8 py-6">
        <h2 className="text-lg font-semibold text-slate-900">How did we do?</h2>
        <p className="text-slate-600 mt-2">
          Your job is complete. Would you be willing to leave us a quick review?
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onLeaveReview}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Yes, I'll leave a review
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Not right now
          </button>
        </div>
      </div>
    </div>
  );
}
