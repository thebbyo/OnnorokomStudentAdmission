import { listMyHolds } from '../api/endpoints';
import type { MyHold } from '../api/types';
import { useStudent } from '../state/StudentContext';
import { usePolling, type PollingState } from './usePolling';

/** The current student's applications, refreshed every 5 s. Empty when no student id is set. */
export function useMyHolds(): PollingState<MyHold[]> {
  const { studentId } = useStudent();
  return usePolling<MyHold[]>(
    (signal) => (studentId ? listMyHolds(studentId, signal) : Promise.resolve([])),
    5000,
    [studentId],
  );
}
