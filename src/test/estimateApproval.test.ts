import { beforeEach, describe, expect, it, vi } from "vitest";

import { approveEstimateManuallyById } from "@/lib/estimateApproval";

const {
  estimateEq,
  estimateUpdate,
  estimateFrom,
  storageUpload,
  storageRemove,
  storageGetPublicUrl,
  storageFrom,
} = vi.hoisted(() => ({
  estimateEq: vi.fn(),
  estimateUpdate: vi.fn(),
  estimateFrom: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  storageGetPublicUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: estimateFrom,
    storage: {
      from: storageFrom,
    },
  },
}));

describe("approveEstimateManuallyById", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    estimateEq.mockResolvedValue({ error: null });
    estimateUpdate.mockReturnValue({ eq: estimateEq });
    estimateFrom.mockReturnValue({ update: estimateUpdate });

    storageUpload.mockResolvedValue({ error: null });
    storageRemove.mockResolvedValue({ error: null });
    storageGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/signature.jpg" } });
    storageFrom.mockReturnValue({
      upload: storageUpload,
      remove: storageRemove,
      getPublicUrl: storageGetPublicUrl,
    });
  });

  it("stores signature URL when approving with signature data", async () => {
    await approveEstimateManuallyById("est_1", "data:image/png;base64,c2lnbmF0dXJl");

    expect(storageUpload).toHaveBeenCalled();
    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        approved_via: "manual_signature",
        manual_approval_photo_url: "https://example.com/signature.jpg",
      }),
    );
  });

  it("does not upload signature when approving without signature data", async () => {
    await approveEstimateManuallyById("est_2");

    expect(storageUpload).not.toHaveBeenCalled();
    expect(estimateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        approved_via: "manual",
      }),
    );
    expect(estimateUpdate.mock.calls[0][0]).not.toHaveProperty("manual_approval_photo_url");
  });
});
