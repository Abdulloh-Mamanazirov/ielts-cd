"use client";

import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Every half band, plus a blank for "not published". */
export const BAND_OPTIONS = Array.from({ length: 19 }, (_, index) => (index * 0.5).toFixed(1));

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-subtle">
        {label.toUpperCase()}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full rounded-lg bg-white px-3 py-2 text-sm text-ink outline-none shadow-[inset_0_0_0_1.5px_rgba(11,17,32,.16)] transition focus:shadow-[inset_0_0_0_2px_#0154f8]";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "resize-y leading-relaxed", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL, props.className)} />;
}

export function BandSelect({
  value,
  onChange,
  allowBlank = true,
}: {
  value: string;
  onChange: (value: string) => void;
  allowBlank?: boolean;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {allowBlank && <option value="">—</option>}
      {BAND_OPTIONS.map((band) => (
        <option key={band} value={band}>
          {band}
        </option>
      ))}
    </Select>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#0154f8]"
      />
      {label}
    </label>
  );
}

/**
 * An uploaded image, with room for a warning directly above the control.
 *
 * The warning is a prop rather than a fixed string because only one of these
 * fields carries a privacy risk, and a notice shown on every upload is a notice
 * nobody reads by the third time.
 */
export function ImageField({
  label,
  warning,
  hint,
  value,
  slug,
  onChange,
}: {
  label: string;
  warning?: ReactNode;
  hint?: ReactNode;
  value: string;
  /** Names the stored file, so uploads are findable on disk later. */
  slug: string;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("slug", slug || "image");

      const response = await fetch("/api/admin/images", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Upload failed.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-[11px] font-bold tracking-[0.12em] text-ink-subtle">
        {label.toUpperCase()}
      </p>

      {warning && (
        <p
          role="note"
          className="mb-2 rounded-lg bg-brand-red-soft px-3 py-2 text-[12px] leading-relaxed text-ink"
        >
          {warning}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => upload(event.target.files?.[0])}
          className="hidden"
        />

        {value ? (
          /* Uploaded art of unknown intrinsic size, which next/image requires. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-12 w-16 flex-none rounded bg-surface-alt object-contain"
          />
        ) : (
          <span className="text-[11.5px] font-semibold text-ink-subtle">None yet</span>
        )}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-ink/85 disabled:opacity-60"
        >
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg bg-surface-alt px-3 py-1.5 text-[12px] font-bold text-ink-muted transition hover:bg-brand-red-cta hover:text-white"
          >
            Remove
          </button>
        )}
      </div>

      {hint && <p className="mt-1.5 text-[11.5px] text-ink-subtle">{hint}</p>}
      {error && <p className="mt-1.5 text-[12px] font-semibold text-brand-red-cta">{error}</p>}
    </div>
  );
}

/** Move, hide and delete, shared by both lists. Delete asks once. */
export function RowActions({
  onUp,
  onDown,
  onEdit,
  onDelete,
  busy,
  hidden,
}: {
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
  hidden: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-none flex-wrap items-center gap-1.5">
      {hidden && (
        <span className="rounded bg-surface-alt px-2 py-1 text-[10px] font-bold tracking-[0.1em] text-ink-subtle">
          HIDDEN
        </span>
      )}

      <IconButton label="Move up" onClick={onUp} disabled={busy}>
        ↑
      </IconButton>
      <IconButton label="Move down" onClick={onDown} disabled={busy}>
        ↓
      </IconButton>

      <button
        type="button"
        onClick={onEdit}
        disabled={busy}
        className="rounded-lg bg-surface-alt px-3 py-1.5 text-[12px] font-bold text-ink transition hover:bg-ink hover:text-white disabled:opacity-50"
      >
        Edit
      </button>

      {confirming ? (
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg bg-brand-red-cta px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50"
          >
            Delete for good
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-ink-subtle hover:text-ink"
          >
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-ink-subtle transition hover:text-brand-red-cta disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-[30px] w-[30px] rounded-lg bg-surface-alt text-sm font-bold text-ink-muted transition hover:bg-ink hover:text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function FormShell({
  title,
  saving,
  error,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      className="bg-white p-5 shadow-[0_1px_2px_rgba(11,17,32,.08)]"
    >
      <p className="mb-4 font-display text-[15px] tracking-[-0.01em] text-ink">{title}</p>

      <div className="grid gap-4 sm:grid-cols-2">{children}</div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink/85 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg bg-surface-alt px-5 py-2.5 text-sm font-bold text-ink-muted transition hover:bg-ink hover:text-white disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
