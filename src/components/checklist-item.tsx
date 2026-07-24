import { toggleChecklistItemAction } from "@/app/dashboard/actions";
import { AutoSubmitCheckbox } from "./auto-submit-checkbox";

export function ChecklistItem({
  entryId,
  index,
  label,
  checked,
}: {
  entryId: string;
  index: number;
  label: string;
  checked: boolean;
}) {
  return (
    <li className="flex gap-3">
      <form action={toggleChecklistItemAction} className="contents">
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="index" value={index} />
        <AutoSubmitCheckbox
          name="checked"
          value="true"
          defaultChecked={checked}
          aria-label={label}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[color:var(--accent)]"
        />
      </form>
      <span className={checked ? "text-muted line-through" : "text-foreground"}>{label}</span>
    </li>
  );
}
