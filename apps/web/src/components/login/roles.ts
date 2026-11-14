import { Building2, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DemoUserId } from '../../api/types';

export interface RoleCard {
  id: DemoUserId;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  primary: boolean;
}

export const ROLE_CARDS: RoleCard[] = [
  {
    id: 'laura',
    title: 'Soy clínica (Laura)',
    subtitle: 'Veterinaria generalista',
    description: 'Importa historias, revisa alertas y deriva al especialista que toca.',
    bullets: ['Subir Word / Excel / JSON', 'Ficha canónica con alertas', 'Buscar y derivar'],
    icon: Building2,
    primary: true,
  },
  {
    id: 'marc',
    title: 'Soy especialista (Marc)',
    subtitle: 'Especialista ambulante',
    description: 'Recibe solicitudes, acepta franjas y llega con el caso leído.',
    bullets: ['Solicitudes con resumen anónimo', 'Briefing pre-visita', 'Agenda unificada'],
    icon: Stethoscope,
    primary: false,
  },
];
