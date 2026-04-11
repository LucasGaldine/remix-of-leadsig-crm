import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListPageFilters } from "@/components/layout/ListPageFilters";

describe("ListPageFilters", () => {
  it("anchors the search icon inside a relative wrapper", () => {
    const onSearchChange = vi.fn();

    render(
      <ListPageFilters
        searchQuery=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search leads..."
        tabs={[{ value: "all", label: "All", count: 3 }]}
        activeTab="all"
        onTabChange={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search leads...");
    const searchWrapper = searchInput.parentElement;
    expect(searchWrapper).not.toBeNull();
    expect(searchWrapper?.className).toContain("relative");
  });

  it("forwards search query changes", () => {
    const onSearchChange = vi.fn();

    render(
      <ListPageFilters
        searchQuery=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search jobs..."
        tabs={[{ value: "all", label: "All", count: 2 }]}
        activeTab="all"
        onTabChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search jobs..."), {
      target: { value: "roof" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("roof");
  });

  it("renders search actions in the search row", () => {
    const onSearchChange = vi.fn();

    render(
      <ListPageFilters
        searchQuery=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search leads..."
        tabs={[{ value: "all", label: "All", count: 3 }]}
        activeTab="all"
        onTabChange={vi.fn()}
        searchActions={<button type="button" aria-label="Sort leads">sort</button>}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search leads...");
    const searchRow = searchInput.closest("div")?.parentElement;
    const sortButton = screen.getByRole("button", { name: /sort leads/i });

    expect(searchRow).not.toBeNull();
    expect(searchRow).toContainElement(sortButton);
  });
});
