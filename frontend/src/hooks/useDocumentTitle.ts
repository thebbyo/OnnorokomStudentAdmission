import { useEffect } from 'react';

/** Sets the browser tab title (also what screen readers announce on navigation). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · School Admission`;
  }, [title]);
}
