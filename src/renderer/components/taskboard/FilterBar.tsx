export type FilterType = 'all' | 'my_tasks' | 'agent_tasks' | 'blocked'

interface FilterBarProps {
  active: FilterType
  onChange: (filter: FilterType) => void
  counts: Record<FilterType, number>
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'my_tasks', label: 'My Tasks' },
  { id: 'agent_tasks', label: 'Agent Tasks' },
  { id: 'blocked', label: 'Blocked' },
]

export function FilterBar({ active, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 border-b border-border">
      {FILTERS.map((f) => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-accent/20 text-accent-light border border-accent/30'
                : 'text-muted hover:text-white border border-transparent hover:border-border'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 font-mono text-[10px] ${isActive ? 'text-accent-light' : 'text-muted'}`}>
              {counts[f.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
