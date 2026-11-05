export function SavedLine({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-sm text-done">已记下</p>;
}
