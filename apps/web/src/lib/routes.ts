import type { User } from '../api/types';
import { isSpecialist } from './format';

/** Pantalla de aterrizaje según rol. */
export function homeFor(user: User | null | undefined): string {
  return isSpecialist(user) ? '/requests' : '/patients';
}
