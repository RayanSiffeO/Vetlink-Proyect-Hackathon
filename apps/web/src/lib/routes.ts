import type { User } from '../api/types';
import { isSpecialist } from './format';

export function homeFor(user: User | null | undefined): string {
  return isSpecialist(user) ? '/requests' : '/patients';
}

export function resolveLoginTarget(from: string | undefined, user: User): string {
  return from && from !== '/login' ? from : homeFor(user);
}
