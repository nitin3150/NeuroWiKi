const typeStyles: Record<string, string> = {
  concept: 'bg-indigo-950 text-indigo-300',
  person: 'bg-emerald-950 text-emerald-300',
  place: 'bg-amber-950 text-amber-300',
  event: 'bg-red-950 text-red-300',
  tool: 'bg-violet-950 text-violet-300',
  organization: 'bg-blue-950 text-blue-300',
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`${typeStyles[type] || 'bg-zinc-900 text-zinc-400'} text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full`}>
      {type}
    </span>
  )
}
