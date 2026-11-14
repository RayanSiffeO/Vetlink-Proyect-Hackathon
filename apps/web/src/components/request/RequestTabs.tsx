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

export function RequestTabs({
  tab,
  onSelect,
}: {
  tab: RequestTab;
  onSelect: (tab: RequestTab) => void;
}) {
  return (
    <div role="tablist" className="tabs tabs-boxed w-full max-w-md bg-base-100 p-1">
      {TABS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab flex-1 gap-1.5 text-[13px] ${tab === item.id ? 'tab-active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
