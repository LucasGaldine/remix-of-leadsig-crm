import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientPortalReviewRequestCard } from "@/components/client-portal/ClientPortalReviewRequestCard";

describe("ClientPortalReviewRequestCard", () => {
  it("dismisses when Not right now is clicked", () => {
    const onDismiss = vi.fn();

    render(
      <ClientPortalReviewRequestCard
        onLeaveReview={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Not right now/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onLeaveReview when Yes, I'll leave a review is clicked", () => {
    const onLeaveReview = vi.fn();

    render(
      <ClientPortalReviewRequestCard
        onLeaveReview={onLeaveReview}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Yes, I'll leave a review/i }));

    expect(onLeaveReview).toHaveBeenCalledTimes(1);
  });
});
