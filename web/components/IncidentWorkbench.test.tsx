import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentWorkbench } from "./IncidentWorkbench";
import { labs } from "@/lib/labs";
vi.mock("next/dynamic", () => ({ default: () => () => <div aria-label="3D renderer unavailable in DOM test"/> }));
beforeEach(() => localStorage.clear());
describe("application-wide workbench", () => {
  it("gives every investigation a real route and marks the current one", () => {
    render(<IncidentWorkbench initialLab="03"/>);
    const nav = screen.getByRole("navigation", { name: "Choose a lab" });
    labs.forEach(lab => expect(within(nav).getByRole("link", { name: new RegExp(lab.shortTitle, "i") })).toHaveAttribute("href", `/labs/${lab.id}`));
    expect(within(nav).getByRole("link", { name: /connect failures/i })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: /previous and next/i })).getByRole("link", { name: /dns latency/i })).toHaveAttribute("href", "/labs/04");
  });
  it("keeps a local investigation inside the app without offering hosted execution", () => {
    render(<IncidentWorkbench initialLab="03"/>);
    fireEvent.click(screen.getByRole("button", { name: /begin investigation/i }));
    expect(screen.getByText(/LOCAL VM · USER-PROVIDED EVIDENCE/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start real observation/i })).not.toBeInTheDocument();
    expect(screen.getByText(/00 HOSTED OBSERVATIONS/)).toBeInTheDocument();
  });
  it("restores a draft after closing and reopening the notebook", () => {
    render(<IncidentWorkbench initialLab="02"/>);
    fireEvent.click(screen.getByRole("button", { name: /begin investigation/i }));
    fireEvent.change(screen.getByLabelText(/your prediction/i), { target: { value: "Correlate thread identity between syscall entry and exit." } });
    fireEvent.click(screen.getByRole("button", { name: /back to incident brief/i }));
    fireEvent.click(screen.getByRole("button", { name: /resume investigation/i }));
    expect(screen.getByLabelText(/your prediction/i)).toHaveValue("Correlate thread identity between syscall entry and exit.");
  });
});
