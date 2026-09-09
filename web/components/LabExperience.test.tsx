import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

// Only the external runner transport is replaced; the learner flow runs in full.
class RunnerStream extends EventTarget {
  static current: RunnerStream;
  constructor() { super(); RunnerStream.current = this; }
  close() {}
}

afterEach(() => vi.unstubAllGlobals());

async function reachFeedback() {
  const transport = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: "session-1", status: "queued" })));
  vi.stubGlobal("fetch", transport);
  vi.stubGlobal("EventSource", RunnerStream);
  render(<LabExperience lab={labs[0]} />);
  fireEvent.change(screen.getByLabelText(/your prediction/i), { target: { value: "I expect a kernel exec event with a host PID." } });
  fireEvent.click(screen.getByRole("button", { name: /start real observation/i }));
  await screen.findByText("queued");
  act(() => {
    for (const event of [
      { sequence: 1, kind: "observation", timestamp: 1, data: "pid=100 exec attempt" },
      { sequence: 2, kind: "terminal", timestamp: 2, data: "completed" },
    ]) RunnerStream.current.dispatchEvent(new MessageEvent(event.kind, { data: JSON.stringify(event) }));
  });
  fireEvent.click(screen.getByRole("button", { name: /interpret 1 observation/i }));
  fireEvent.change(screen.getByLabelText(/your explanation/i), { target: { value: "This establishes an exec attempt but does not establish process health." } });
  fireEvent.click(screen.getByRole("button", { name: /continue to transfer/i }));
  fireEvent.click(screen.getByRole("button", { name: /host PID\/TGID with the event timestamp/i }));
  fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "The evidence boundary was clear." } });
  fireEvent.click(screen.getByRole("checkbox"));
  return transport;
}

describe("feedback submission", () => {
  it.each([400, 429, 500])("keeps feedback available after HTTP %s and allows a successful retry", async (status) => {
    const transport = await reachFeedback();
    transport.mockResolvedValueOnce(new Response("{}", { status }));
    fireEvent.click(screen.getByRole("button", { name: /save feedback and finish/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/feedback.*(save|saved)/i);
    expect(screen.queryByText("INCIDENT COMPLETE")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Comment")).toHaveValue("The evidence boundary was clear.");
    transport.mockResolvedValueOnce(new Response("{}"));
    fireEvent.click(screen.getByRole("button", { name: /save feedback and finish/i }));
    expect(await screen.findByText("INCIDENT COMPLETE")).toBeInTheDocument();
  });

  it("prevents repeat submissions while pending and completes only after success", async () => {
    const transport = await reachFeedback();
    let finish!: (response: Response) => void;
    transport.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
    const save = screen.getByRole("button", { name: /save feedback and finish/i });
    fireEvent.click(save);
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("INCIDENT COMPLETE")).not.toBeInTheDocument();
    await act(async () => finish(new Response("{}")));
    expect(screen.getByText("INCIDENT COMPLETE")).toBeInTheDocument();
  });

  it("shows a network error and allows finishing without feedback", async () => {
    const transport = await reachFeedback();
    transport.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: /save feedback and finish/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /finish without feedback/i }));
    expect(screen.getByText("INCIDENT COMPLETE")).toBeInTheDocument();
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
