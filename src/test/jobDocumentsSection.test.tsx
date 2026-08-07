import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JobDocumentsSection } from "@/components/jobs/JobDocumentsSection";

const {
  supabaseFromMock,
  storageFromMock,
  getPublicUrlMock,
  getLeadPhotoPublicUrlMock,
  uploadJobDocumentMock,
  updateJobDocumentConfigMock,
  insertJobDocumentMock,
  updateJobDocumentMock,
} = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
  storageFromMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  getLeadPhotoPublicUrlMock: vi.fn(),
  uploadJobDocumentMock: vi.fn(),
  updateJobDocumentConfigMock: vi.fn(),
  insertJobDocumentMock: vi.fn(),
  updateJobDocumentMock: vi.fn(),
}));
const { buildTemplateDocumentPDFBlobMock, buildSignedTemplateDocumentPDFBlobMock } = vi.hoisted(() => ({
  buildTemplateDocumentPDFBlobMock: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
  buildSignedTemplateDocumentPDFBlobMock: vi.fn(() => Promise.resolve(new Blob(["signed-pdf"], { type: "application/pdf" }))),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseFromMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/pdfGenerator", () => ({
  buildTemplateDocumentPDFBlob: buildTemplateDocumentPDFBlobMock,
  buildSignedTemplateDocumentPDFBlob: buildSignedTemplateDocumentPDFBlobMock,
}));

describe("JobDocumentsSection", () => {
  const renderSection = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

  const templateRows = [
    {
      id: "tpl-job-agreement",
      account_id: "acct_1",
      name: "Job Agreement",
      slug: "job-agreement",
      system_key: "job_agreement",
      body: "",
      default_included_in_jobs: true,
      default_email_timing: "on_estimate_approval",
      default_requires_signature: true,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "tpl-warranty",
      account_id: "acct_1",
      name: "Warranty",
      slug: "warranty",
      system_key: "warranty_agreement",
      body: "",
      default_included_in_jobs: true,
      default_email_timing: "on_estimate_approval",
      default_requires_signature: true,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "tpl-custom",
      account_id: "acct_1",
      name: "Lien Waiver",
      slug: "lien-waiver",
      system_key: null,
      body: "Custom lien waiver text",
      default_included_in_jobs: false,
      default_email_timing: "manual",
      default_requires_signature: false,
      created_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  let configRows = [
    {
      id: "cfg-1",
      lead_id: "job_1",
      account_id: "acct_1",
      template_id: "tpl-job-agreement",
      include_in_job: true,
      email_timing: "on_estimate_approval",
      requires_signature: true,
      sort_order: 0,
      created_by: "user_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      template: templateRows[0],
    },
    {
      id: "cfg-2",
      lead_id: "job_1",
      account_id: "acct_1",
      template_id: "tpl-warranty",
      include_in_job: true,
      email_timing: "on_estimate_approval",
      requires_signature: true,
      sort_order: 1,
      created_by: "user_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      template: templateRows[1],
    },
  ];
  let jobDocumentRows: any[] = [];
  let jobReleaseRow: any = null;

  beforeEach(() => {
    vi.clearAllMocks();

    configRows = [
      {
        id: "cfg-1",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-job-agreement",
        include_in_job: true,
        email_timing: "on_estimate_approval",
        requires_signature: true,
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[0],
      },
      {
        id: "cfg-2",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-warranty",
        include_in_job: true,
        email_timing: "on_estimate_approval",
        requires_signature: true,
        sort_order: 1,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[1],
      },
    ];
    jobDocumentRows = [];
    jobReleaseRow = null;

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "document_templates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: templateRows, error: null }),
            })),
          })),
        };
      }

      if (table === "job_document_configs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: configRows, error: null }),
            })),
          })),
          update: updateJobDocumentConfigMock.mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
          insert: vi.fn((payload: any) => {
            const insertedRow = {
              id: "cfg-new",
              ...payload,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            };
            configRows = [...configRows, { ...insertedRow, template: templateRows[2] }];
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }),
              })),
            };
          }),
        };
      }

      if (table === "job_documents") {
        return {
          select: vi.fn(() => {
            const query: any = {
              eq: vi.fn(() => query),
              order: vi.fn().mockResolvedValue({ data: jobDocumentRows, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
            return query;
          }),
          insert: insertJobDocumentMock.mockResolvedValue({ error: null }),
          update: updateJobDocumentMock.mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      if (table === "job_releases") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: jobReleaseRow, error: null }),
            })),
          })),
        };
      }

      if (table === "leads") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getPublicUrlMock.mockReturnValue({ data: { publicUrl: "https://example.com/doc.pdf" } });
    getLeadPhotoPublicUrlMock.mockImplementation((filePath: string) => ({
      data: { publicUrl: `https://example.com/storage/v1/object/public/lead-photos/${filePath}` },
    }));
    uploadJobDocumentMock.mockResolvedValue({ error: null });
    storageFromMock.mockImplementation((bucket: string) => ({
      getPublicUrl: bucket === "lead-photos" ? getLeadPhotoPublicUrlMock : getPublicUrlMock,
      upload: uploadJobDocumentMock,
    }));
  });

  it("shows estimate and template document actions and allows viewing estimate", async () => {
    const onViewEstimate = vi.fn();

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        onViewEstimate={onViewEstimate}
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const viewButtons = await screen.findAllByRole("button", { name: "View" });
    expect(viewButtons.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("button", { name: /download estimate document/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download job agreement/i })).not.toBeInTheDocument();

    fireEvent.click(viewButtons[0]);
    expect(onViewEstimate).toHaveBeenCalledTimes(1);
  });

  it("creates and opens a template PDF when no uploaded file exists", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = configRows.map((row) =>
      row.id === "cfg-1"
        ? { ...row, template: { ...row.template, body: "# Agreement\n\n- Scope item" } }
        : row
    );
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId={null}
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const viewButtons = await screen.findAllByRole("button", { name: "View" });
    fireEvent.click(viewButtons[1]);

    await waitFor(() =>
      expect(buildTemplateDocumentPDFBlobMock).toHaveBeenCalledWith({
        title: "Job Agreement",
        fileName: "Job Agreement",
        content: "# Agreement\n\n- Scope item",
        requiresSignature: true,
      }),
    );
    expect(uploadJobDocumentMock).toHaveBeenCalledWith(
      expect.stringMatching(/^acct_1\/job_1\/tpl-job-agreement-\d+\.pdf$/),
      expect.any(Blob),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(insertJobDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      account_id: "acct_1",
      lead_id: "job_1",
      template_id: "tpl-job-agreement",
      config_id: "cfg-1",
      file_name: "job-agreement.pdf",
      mime_type: "application/pdf",
    }));
    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates a PDF from agreement template text when no uploaded file exists", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = configRows.map((row) =>
      row.id === "cfg-1"
        ? { ...row, template: { ...row.template, body: "Signed job agreement text" } }
        : row
    );
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId={null}
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const viewButtons = await screen.findAllByRole("button", { name: "View" });
    fireEvent.click(viewButtons[1]);

    await waitFor(() =>
      expect(buildTemplateDocumentPDFBlobMock).toHaveBeenCalledWith(expect.objectContaining({
        content: "Signed job agreement text",
      })),
    );
    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
    expect(screen.queryByText("Signed job agreement text")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download pdf/i })).not.toBeInTheDocument();
  });

  it("opens stored manual document PDFs instead of showing a preview", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = [
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: {
          ...templateRows[2],
          name: "Test manual",
          body: "Manual document for [[client_name]]",
        },
      },
    ];
    jobDocumentRows = [
      {
        id: "doc-manual",
        template_id: "tpl-custom",
        config_id: "cfg-3",
        document_key: "template_tpl-custom_cfg-3",
        file_name: "test-manual.pdf",
        file_path: "job_1/test-manual.pdf",
        mime_type: "application/pdf",
        created_at: "2026-01-02T00:00:00.000Z",
        resolved_merge_fields: {
          client_name: "Taylor Client",
        },
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const viewButtons = await screen.findAllByRole("button", { name: "View" });
    const manualViewButton = viewButtons.find((button) => !button.hasAttribute("disabled"));
    expect(manualViewButton).toBeDefined();
    fireEvent.click(manualViewButton!);

    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
    expect(screen.queryByText("Manual document for Taylor Client")).not.toBeInTheDocument();
  });

  it("uses merged variables when creating a PDF from template text", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = configRows.map((row) =>
      row.id === "cfg-1"
        ? { ...row, template: { ...row.template, body: "# Agreement for {{client_name}}\n\n- **Scope** item" } }
        : row
    );
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId={null}
        accountId="acct_1"
        userId="user_1"
        templateMergeFields={{
          client_name: "Taylor Client",
        }}
      />,
    );

    const viewButtons = await screen.findAllByRole("button", { name: "View" });
    fireEvent.click(viewButtons[1]);

    await waitFor(() =>
      expect(buildTemplateDocumentPDFBlobMock).toHaveBeenCalledWith({
        title: "Job Agreement",
        fileName: "Job Agreement",
        content: "# Agreement for Taylor Client\n\n- **Scope** item",
        requiresSignature: true,
      }),
    );
    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
  });

  it("shows Build for estimate when no estimate is available", async () => {
    const onBuildEstimate = vi.fn();

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId={null}
        onBuildEstimate={onBuildEstimate}
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const buildButton = await screen.findByRole("button", { name: "Build" });
    expect(buildButton).toBeInTheDocument();

    fireEvent.click(buildButton);
    expect(onBuildEstimate).toHaveBeenCalledTimes(1);
  });

  it("shows a settings icon action instead of inline editing controls", async () => {
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    const manageLink = await screen.findByRole("link", { name: "Manage document settings" });
    expect(manageLink).toHaveAttribute("href", "/settings/document-templates");
    expect(screen.queryByText("Include on job")).not.toBeInTheDocument();
    expect(screen.queryByText("Email timing")).not.toBeInTheDocument();
    expect(screen.queryByText("Requires signature")).not.toBeInTheDocument();
  });

  it("shows Shared for estimate approval documents and Not Shared for unshared manual documents", async () => {
    jobDocumentRows = [
      {
        id: "doc-job-agreement",
        template_id: "tpl-job-agreement",
        document_key: "job_agreement",
        file_name: "job-agreement.pdf",
        file_path: "job_1/job-agreement.pdf",
        mime_type: "application/pdf",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ];
    configRows = [
      ...configRows,
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        shared_at: null,
        sort_order: 2,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[2],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect((await screen.findAllByText("Shared")).length).toBeGreaterThan(0);
    expect(screen.getByText("Not Shared")).toBeInTheDocument();
    expect(screen.getByText("Unapproved")).toBeInTheDocument();
  });

  it("shows Shared for manual documents when shared_at is set", async () => {
    configRows = [
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: templateRows[2],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect(await screen.findByText("Shared")).toBeInTheDocument();
    expect(screen.queryByText("Not Shared")).not.toBeInTheDocument();
  });

  it("shows Signed for signed job release documents", async () => {
    configRows = [
      {
        id: "cfg-release",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-release",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: {
          ...templateRows[2],
          id: "tpl-release",
          name: "Job Release",
          slug: "job-release",
          system_key: "job_release",
          body: "Release text",
          default_requires_signature: true,
        },
      },
    ];
    jobReleaseRow = {
      release_text: "Release text",
      status: "signed",
      signed_at: "2026-01-03T00:00:00.000Z",
    };

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect(await screen.findByText("Signed")).toBeInTheDocument();
    expect(screen.queryByText("Shared")).not.toBeInTheDocument();
  });

  it("generates a signed copy when viewing a signed job release with a stored unsigned PDF", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = [
      {
        id: "cfg-release",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-release",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: {
          ...templateRows[2],
          id: "tpl-release",
          name: "Job Release",
          slug: "job-release",
          system_key: "job_release",
          body: "Release text",
          default_requires_signature: true,
        },
      },
    ];
    jobDocumentRows = [
      {
        id: "doc-release-unsigned",
        template_id: "tpl-release",
        config_id: "cfg-release",
        document_key: "job_release_cfg-release",
        file_name: "job-release.pdf",
        file_path: "job_1/job-release-unsigned.pdf",
        mime_type: "application/pdf",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ];
    jobReleaseRow = {
      release_text: "Release text",
      status: "signed",
      signed_at: "2026-01-03T00:00:00.000Z",
      signature_image_url:
        "http://kong:8000/storage/v1/object/public/lead-photos/estimate-approvals/est_1/signature.png",
    };

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    await screen.findByText("Signed");
    const releaseViewButton = (await screen.findAllByRole("button", { name: "View" }))
      .find((button) => !button.hasAttribute("disabled"));
    expect(releaseViewButton).toBeDefined();
    fireEvent.click(releaseViewButton!);

    await waitFor(() =>
      expect(buildSignedTemplateDocumentPDFBlobMock).toHaveBeenCalledWith({
        title: "Job Release",
        fileName: "Job Release",
        content: "Release text",
        requiresSignature: true,
        signatureImageUrl:
          "https://example.com/storage/v1/object/public/lead-photos/estimate-approvals/est_1/signature.png",
        signedAt: "2026-01-03T00:00:00.000Z",
      }),
    );
    expect(getLeadPhotoPublicUrlMock).toHaveBeenCalledWith("estimate-approvals/est_1/signature.png");
    expect(uploadJobDocumentMock).toHaveBeenCalledWith(
      expect.stringMatching(/^acct_1\/job_1\/tpl-release-\d+-signed\.pdf$/),
      expect.any(Blob),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(updateJobDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      file_path: expect.stringMatching(/^acct_1\/job_1\/tpl-release-\d+-signed\.pdf$/),
      mime_type: "application/pdf",
    }));
    expect(insertJobDocumentMock).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
  });

  it("shows Signed for document configs accepted on the estimate", async () => {
    configRows = [
      {
        id: "cfg-accepted",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: {
          ...templateRows[2],
          name: "Signed Addendum",
        },
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
        estimateAgreementAcceptance={{
          "cfg-accepted": true,
          accepted_at: "2026-01-03T00:00:00.000Z",
        }}
      />,
    );

    expect(await screen.findByText("Signed")).toBeInTheDocument();
    expect(screen.queryByText("Shared")).not.toBeInTheDocument();
  });

  it("generates a signed copy for estimate-accepted manual documents", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    configRows = [
      {
        id: "cfg-accepted",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: true,
        shared_at: "2026-01-02T00:00:00.000Z",
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        template: {
          ...templateRows[2],
          name: "Signed Addendum",
          body: "Signed addendum text",
        },
      },
    ];
    jobDocumentRows = [
      {
        id: "doc-accepted-unsigned",
        template_id: "tpl-custom",
        config_id: "cfg-accepted",
        document_key: "template_tpl-custom_cfg-accepted",
        file_name: "signed-addendum.pdf",
        file_path: "job_1/signed-addendum-unsigned.pdf",
        mime_type: "application/pdf",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
        estimateAgreementAcceptance={{
          "cfg-accepted": true,
          accepted_at: "2026-01-03T00:00:00.000Z",
        }}
        estimateSignatureImageUrl="http://kong:8000/storage/v1/object/public/lead-photos/estimate-approvals/est_1/estimate-signature.png"
        estimateSignedAt="2026-01-04T00:00:00.000Z"
      />,
    );

    await screen.findByText("Signed");
    const manualViewButton = (await screen.findAllByRole("button", { name: "View" }))
      .find((button) => !button.hasAttribute("disabled"));
    expect(manualViewButton).toBeDefined();
    fireEvent.click(manualViewButton!);

    await waitFor(() =>
      expect(buildSignedTemplateDocumentPDFBlobMock).toHaveBeenCalledWith({
        title: "Signed Addendum",
        fileName: "Signed Addendum",
        content: "Signed addendum text",
        requiresSignature: true,
        signatureImageUrl:
          "https://example.com/storage/v1/object/public/lead-photos/estimate-approvals/est_1/estimate-signature.png",
        signedAt: "2026-01-04T00:00:00.000Z",
      }),
    );
    expect(updateJobDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      file_path: expect.stringMatching(/^acct_1\/job_1\/tpl-custom-\d+-signed\.pdf$/),
      mime_type: "application/pdf",
    }));
    expect(insertJobDocumentMock).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith("https://example.com/doc.pdf", "_blank", "noopener,noreferrer");
  });

  it("shows Approved estimate status when estimate is accepted", async () => {
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        estimateStatus="accepted"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect(await screen.findByText("Approved")).toBeInTheDocument();
  });

  it("shows Pending changes estimate status when accepted estimate has pending changes", async () => {
    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        estimateStatus="accepted"
        estimateHasPendingChanges
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect(await screen.findByText("Pending changes")).toBeInTheDocument();
  });

  it("shows Send for unsent manual-send templates", async () => {
    configRows = [
      ...configRows,
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        sort_order: 2,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[2],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    expect(await screen.findByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("marks manual documents as shared when they are sent", async () => {
    configRows = [
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        sort_order: 0,
        shared_at: null,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[2],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Send" }));

    await waitFor(() => expect(insertJobDocumentMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(updateJobDocumentConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shared_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      ),
    );
  });

  it("shows Add & Send plus secondary Add in the modal when the selected template is manual", async () => {
    configRows = [
      {
        id: "cfg-1",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-job-agreement",
        include_in_job: true,
        email_timing: "on_estimate_approval",
        requires_signature: true,
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[0],
      },
      {
        id: "cfg-2",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-warranty",
        include_in_job: true,
        email_timing: "on_estimate_approval",
        requires_signature: true,
        sort_order: 1,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[1],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add Document" }));
    expect(await screen.findByRole("button", { name: "Add & Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("shows only Add in the modal when the selected template is not manual", async () => {
    configRows = [
      {
        id: "cfg-3",
        lead_id: "job_1",
        account_id: "acct_1",
        template_id: "tpl-custom",
        include_in_job: true,
        email_timing: "manual",
        requires_signature: false,
        sort_order: 0,
        created_by: "user_1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        template: templateRows[2],
      },
    ];

    renderSection(
      <JobDocumentsSection
        leadId="job_1"
        estimateId="est_1"
        accountId="acct_1"
        userId="user_1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Add Document" }));
    expect(await screen.findByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add & Send" })).not.toBeInTheDocument();
  });
});
