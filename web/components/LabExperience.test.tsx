import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LabExperience } from "./LabExperience";
import { labs } from "@/lib/labs";

describe("LabExperience", () => {
  it("requires a substantive prediction before starting", () => {
    render(<LabExperience lab={labs[0]} />);
    const button = screen.getByRole("button", { name: /start real observation/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your prediction/i), { target: { value: "I expect a kernel exec event with an attributable host PID and timestamp." } });
    expect(button).toBeEnabled();
  });

  it("states that browser users cannot submit commands or code", () => {
    render(<LabExperience lab={labs[0]} />);
    expect(screen.getByText(/cannot submit commands or code/i)).toBeInTheDocument();
  });
});
