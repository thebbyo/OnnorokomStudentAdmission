import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isValidStudentId } from '../lib/studentId';

const STORAGE_KEY = 'admission.studentId';

interface StudentState {
  studentId: string | null;
  setStudentId: (id: string) => void;
  clearStudentId: () => void;
}

const StudentContext = createContext<StudentState | null>(null);

function readStored(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && isValidStudentId(value) ? value : null;
  } catch {
    return null; // storage blocked (private mode): the id just won't persist
  }
}

/** The student's 17-digit id is their identity in this app (no login). Persisted across reloads. */
export function StudentProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState<string | null>(readStored);

  const setStudentId = useCallback((id: string) => {
    if (!isValidStudentId(id)) return;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    setState(id);
  }, []);

  const clearStudentId = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(null);
  }, []);

  // Keep several open tabs on the same student.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setState(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ studentId, setStudentId, clearStudentId }), [studentId, setStudentId, clearStudentId]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent(): StudentState {
  const context = useContext(StudentContext);
  if (!context) throw new Error('useStudent must be used inside <StudentProvider>');
  return context;
}
