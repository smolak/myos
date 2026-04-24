interface Props {
  showCompleted: boolean;
  onShowCompletedChange: (value: boolean) => void;
}

export function TodoSettings({ showCompleted, onShowCompletedChange }: Props) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Todo Settings</h3>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(e) => onShowCompletedChange(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-zinc-300">Show completed todos in widget</span>
      </label>
    </div>
  );
}
