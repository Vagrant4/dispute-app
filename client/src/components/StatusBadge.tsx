import type { ProjectStatus } from '../api/http';

type StatusTone = 'success' | 'neutral' | 'warning' | 'danger';

const projectStatusLabels: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled'
};

const projectStatusTones: Record<ProjectStatus, StatusTone> = {
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  ON_HOLD: 'warning',
  CANCELLED: 'danger'
};

interface StatusBadgeProps {
  status: ProjectStatus | string;
  label?: string;
  tone?: StatusTone;
}

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const displayLabel = label ?? projectStatusLabels[status as ProjectStatus] ?? humanizeStatus(status);
  const displayTone = tone ?? projectStatusTones[status as ProjectStatus] ?? 'neutral';

  return (
    <span className={`status-badge status-badge-${displayTone}`} aria-label={`Status: ${displayLabel}`}>
      {displayLabel}
    </span>
  );
}

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
