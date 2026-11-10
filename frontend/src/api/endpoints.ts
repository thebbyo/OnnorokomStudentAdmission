import { apiRequest } from './client';
import type { ClassStats, CreatedClass, Hold, MyHold } from './types';

const enc = encodeURIComponent;

export const listClasses = (signal?: AbortSignal) => apiRequest<ClassStats[]>('/classes', { signal });

export const getClass = (id: string, signal?: AbortSignal) => apiRequest<ClassStats>(`/classes/${enc(id)}`, { signal });

export const createClass = (name: string, totalSeats: number) =>
  apiRequest<CreatedClass>('/classes', { method: 'POST', body: { name, totalSeats } });

export const createHold = (classId: string, studentId: string) =>
  apiRequest<Hold>(`/classes/${enc(classId)}/holds`, { method: 'POST', studentId });

export const getHold = (holdId: string, signal?: AbortSignal) => apiRequest<Hold>(`/holds/${enc(holdId)}`, { signal });

export const confirmHold = (holdId: string, studentId: string) =>
  apiRequest<Pick<Hold, 'holdId' | 'status'>>(`/holds/${enc(holdId)}/confirm`, { method: 'POST', studentId });

export const cancelHold = (holdId: string, studentId: string) =>
  apiRequest<void>(`/holds/${enc(holdId)}`, { method: 'DELETE', studentId });

export const listMyHolds = (studentId: string, signal?: AbortSignal) =>
  apiRequest<MyHold[]>('/me/holds', { studentId, signal });
