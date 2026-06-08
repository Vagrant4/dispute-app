import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders accessible project status labels', () => {
    render(<StatusBadge status="ON_HOLD" />);

    expect(screen.getByText('On hold')).toBeTruthy();
    expect(screen.getByLabelText('Status: On hold')).toBeTruthy();
  });
});
