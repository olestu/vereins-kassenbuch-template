import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
} from "react";

/* text-base auf Mobile verhindert iOS-Auto-Zoom; ab sm wieder kompakter */
const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted sm:text-sm " +
  "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-page";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD} ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} ${className}`} {...props} />;
}

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1 block text-sm font-medium text-ink-secondary ${className}`}
      {...props}
    />
  );
}
