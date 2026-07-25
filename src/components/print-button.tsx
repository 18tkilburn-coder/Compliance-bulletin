"use client";

import { useEffect } from "react";

export function PrintButton() {
  useEffect(() => {
    // Fires the browser's print dialog automatically when this page opens,
    // since the whole point of the route is to export/print. The button
    // below stays as a manual fallback if the dialog gets dismissed.
    window.print();
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
    >
      Print / Save as PDF
    </button>
  );
}
