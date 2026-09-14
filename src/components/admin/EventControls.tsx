"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  regenerateMockEventLink,
  releaseMockEventTests,
  setMockEventStatus,
} from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type Status = "DRAFT" | "OPEN" | "CLOSED";

/**
 * The link and the switches around it: open, close, a fresh link if this one
 * leaked, and — once closed — putting the paper on the practice shelf.
 */
export function EventControls({
  eventId,
  status,
  joinUrl,
  released,
}: {
  eventId: string;
  status: Status;
  joinUrl: string;
  /** Whether the paper is already on the shelf, so the button can say so. */
  released: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    start(async () => {
      setMessage(null);
      setError(null);
      const result = await action();
      if (result.ok) setMessage(result.message);
      else setError(result.error);
      router.refresh();
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The field is selectable; copying by hand still works.
    }
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]">
      <p className="text-[11px] font-bold text-ink-subtle">JOIN LINK</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={joinUrl}
          onFocus={(event) => event.target.select()}
          className="min-w-0 flex-1 rounded-[9px] bg-surface-alt px-3 py-2 font-mono text-[13px] text-ink outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-[9px] bg-ink px-4 py-2 text-[13px] font-bold text-white transition hover:bg-ink/90"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-subtle">
        {status === "OPEN"
          ? "Anyone with this link can join."
          : status === "DRAFT"
            ? "The link is not live yet — open the event to let people in."
            : "Closed: the link no longer accepts new entries. Sittings already under way can finish."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {status !== "OPEN" && (
          <Button
            tone="primary"
            disabled={pending}
            onClick={() => run(() => setMockEventStatus({ id: eventId, status: "OPEN" }))}
          >
            {status === "DRAFT" ? "Open the event" : "Reopen"}
          </Button>
        )}
        {status === "OPEN" && (
          <Button
            tone="danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Close the event? The link will stop accepting new entries.")) {
                run(() => setMockEventStatus({ id: eventId, status: "CLOSED" }));
              }
            }}
          >
            Close the event
          </Button>
        )}
        <Button
          disabled={pending}
          onClick={() => {
            if (window.confirm("Generate a new link? The current one will stop working at once.")) {
              run(() => regenerateMockEventLink(eventId));
            }
          }}
        >
          New link
        </Button>
        {status === "CLOSED" && (
          <Button
            disabled={pending || released}
            onClick={() => run(() => releaseMockEventTests(eventId))}
          >
            {released ? "Tests are on the shelf" : "Release tests to the library"}
          </Button>
        )}
      </div>

      {message && <p className="mt-3 text-[13px] font-bold text-ok">{message}</p>}
      {error && <p className="mt-3 text-[13px] font-bold text-bad">{error}</p>}
    </section>
  );
}

function Button({
  tone = "neutral",
  disabled,
  onClick,
  children,
}: {
  tone?: "primary" | "neutral" | "danger";
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[9px] px-4 py-2 text-[13px] font-bold transition disabled:opacity-60",
        tone === "primary" && "bg-ok text-white hover:opacity-90",
        tone === "danger" && "bg-bad-soft text-bad hover:bg-bad hover:text-white",
        tone === "neutral" && "bg-surface-alt text-ink-muted hover:bg-ink hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
