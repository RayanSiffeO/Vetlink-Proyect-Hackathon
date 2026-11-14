import { Building2, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DemoUserId } from '../../api/types';

export interface RoleCard {
  id: DemoUserId;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  primary: boolean;
}

export const ROLE_CARDS: RoleCard[] = [
  {
    id: 'laura',
    title: 'Soy clínica (Laura)',
    subtitle: 'Veterinaria generalista',
    description: 'Importa, revisa alertas y deriva.',
    icon: Building2,
    primary: true,
  },
  {
    id: 'marc',
    title: 'Soy especialista (Marc)',
    subtitle: 'Especialista ambulante',
    description: 'Acepta franjas y llega con el caso leído.',
    icon: Stethoscope,
    primary: false,
  },
];
