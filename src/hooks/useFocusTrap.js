import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Escape-to-close + tab focus trap for modal dialogs. Extracted from the
// drawer components, which each carried an identical copy.
export default function useFocusTrap(ref, active, onEscape) {
  // Call sites pass an inline arrow for onEscape, so its identity changes on
  // every parent render. Holding it in a ref keeps the effect below from
  // depending on that identity — otherwise any parent re-render while the
  // dialog is open would tear down and re-run the effect, re-stealing focus
  // to the first control mid-interaction.
  const escRef = useRef(onEscape);
  useEffect(() => { escRef.current = onEscape; });

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    const getFocusable = () => Array.from(node?.querySelectorAll(FOCUSABLE) || []);
    const onKey = (e) => {
      if (e.key === 'Escape') { escRef.current(); return; }
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node?.addEventListener('keydown', onKey);
    getFocusable()[0]?.focus();
    return () => node?.removeEventListener('keydown', onKey);
  }, [ref, active]);
}
