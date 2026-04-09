import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CrewRoleSelect } from "@/components/crew/CrewRoleSelect";
import { crewOnlyRoles, ownerManageableRoles, roleBadgeColors, roleLabels } from "@/lib/crewRoles";

describe("CrewRoleSelect", () => {
  it("exposes the same owner-manageable role set and labels used by regular member edit", () => {
    expect(ownerManageableRoles).toEqual([
      "owner",
      "admin",
      "sales",
      "crew_lead",
      "crew_member",
    ]);

    expect(roleLabels.owner).toBe("Owner");
    expect(roleLabels.admin).toBe("Admin");
    expect(roleLabels.sales).toBe("Sales");
    expect(roleLabels.crew_lead).toBe("Crew Lead");
    expect(roleLabels.crew_member).toBe("Crew Member");
  });

  it("keeps crew-only roles and uses the same badge styling in selected value", () => {
    expect(crewOnlyRoles).toEqual(["crew_lead", "crew_member"]);
    expect(roleBadgeColors.crew_lead).toBe("bg-orange-500");
    expect(roleBadgeColors.crew_member).toBe("bg-gray-500");

    render(
      <CrewRoleSelect value="crew_member" onValueChange={vi.fn()} roles={crewOnlyRoles} />,
    );

    const selectedBadge = screen.getByText("Crew Member").closest("div");
    expect(selectedBadge).toHaveClass("bg-gray-500");
  });
});
