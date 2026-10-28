import type { ReactNode } from "react";

const INPUT =
  "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-primary";

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 flex justify-between text-text-muted">
        <span>{label}</span>
        {unit && <span>{unit}</span>}
      </span>
      <input
        type="number"
        className={INPUT}
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.value === "" ? NaN : Number(e.target.value);
          onChange(v);
        }}
      />
      {hint && <span className="mt-0.5 block text-[11px] text-text-muted">{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-text-muted">{label}</span>
      <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-0.5 block text-[11px] text-text-muted">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-text-muted">{label}</span>
      <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="mt-0.5 block text-[11px] text-text-muted">{hint}</span>}
    </label>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  title?: string;
  className?: string;
}) {
  const styles = {
    primary: "bg-primary text-white hover:bg-primary-hover disabled:opacity-50",
    secondary: "border border-border bg-surface text-text hover:bg-surface-alt disabled:opacity-50",
    ghost: "text-text-muted hover:bg-surface-alt disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
