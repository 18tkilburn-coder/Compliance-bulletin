"use client";

export function AutoSubmitCheckbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      onChange={(e) => {
        e.currentTarget.form?.requestSubmit();
      }}
      {...props}
    />
  );
}
