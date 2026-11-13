import { XIcon } from "./icons";

/** Dialog title bar with a close (×) button on the right. */
export default function DialogHeader({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="dlg-head">
      <span>{title}</span>
      <button type="button" className="dlg-x" onClick={onClose} aria-label="Close" title="Close">
        <XIcon />
      </button>
    </div>
  );
}
