import { useEffect, useRef } from 'react';

// Calls onSave(value) after `delay` ms of no changes to `value`.
// Skips the first value (initial load) so opening a document does not save.
export function useAutosave(value, onSave, delay = 1500) {
  const timer = useRef(null);
  const isFirst = useRef(true);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSaveRef.current(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);
}
