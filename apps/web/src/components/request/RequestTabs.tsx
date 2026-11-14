import { useRef } from 'react';
import { ClipboardList, ScrollText, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RequestTab } from '../../lib/requests';

interface TabItem {
  id: RequestTab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'detail', label: 'Detalle', icon: ClipboardList },
  { id: 'briefing', label: 'Briefing', icon: Sparkles },
  { id: 'audit', label: 'Auditoría', icon: ScrollText },
];

function tabId(tab: RequestTab): string {
  return `request-tab-${tab}`;
}

function panelId(tab: RequestTab): string {
  return `request-panel-${tab}`;
}

export function RequestTabs({
  tab,
  onSelect,
}: {
  tab: RequestTab;
  onSelect: (tab: RequestTab) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (event: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(TABS[next].id);
    requestAnimationFrame(() => refs.current[next]?.focus());
  };

  return (
    <div
      className="glass inline-flex w-full max-w-md gap-1 overflow-x-auto rounded-full p-1"
      role="tablist"
      aria-label="Secciones de la solicitud"
    >
      {TABS.map((item, index) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={tabId(item.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(item.id)}
            tabIndex={active ? 0 : -1}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition duration-200 ease-smooth ${
              active
                ? 'bg-indigo text-ink shadow-lift'
                : 'text-para hover:bg-white/70 hover:text-indigo-700'
            }`}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => move(event, index)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
