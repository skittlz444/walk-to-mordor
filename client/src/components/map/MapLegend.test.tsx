import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { MapLegend } from './MapLegend';
import type { PartyMember } from '../../stores/partyStore';

describe('MapLegend', () => {
  const mockMembers: PartyMember[] = [
    { user_id: 1, display_name: 'Alice', contribution: 42.5, status: 'active', color: 0, avatar_id: null },
    { user_id: 2, display_name: 'Bob', contribution: 30.0, status: 'active', color: 1, avatar_id: 'gandalf-grey' },
    { user_id: 3, display_name: 'Charlie', contribution: 15.2, status: 'left', color: 2, avatar_id: null },
  ];

  it('renders party name', () => {
    const { getByText } = render(
      <MapLegend members={mockMembers} partyName="Fellowship of the Ring" />
    );
    expect(getByText('Fellowship of the Ring')).toBeTruthy();
  });

  it('renders all members with distances', () => {
    const { getByText } = render(
      <MapLegend members={mockMembers} partyName="Test Party" />
    );
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('42.5 km')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
    expect(getByText('30.0 km')).toBeTruthy();
    expect(getByText('Charlie')).toBeTruthy();
    expect(getByText('15.2 km')).toBeTruthy();
  });

  it('marks departed members with class', () => {
    const { container } = render(
      <MapLegend members={mockMembers} partyName="Test Party" />
    );
    const departedMembers = container.querySelectorAll('.map-legend-member.departed');
    expect(departedMembers).toHaveLength(1);
  });

  it('renders color swatches', () => {
    const { container } = render(
      <MapLegend members={mockMembers} partyName="Test Party" />
    );
    const swatches = container.querySelectorAll('.map-legend-swatch');
    expect(swatches).toHaveLength(3);
    // Each swatch should have a backgroundColor style
    for (const swatch of swatches) {
      expect((swatch as HTMLElement).style.backgroundColor).toBeTruthy();
    }
  });

  it('returns null for empty members', () => {
    const { container } = render(
      <MapLegend members={[]} partyName="Test Party" />
    );
    expect(container.querySelector('.map-legend')).toBeNull();
  });
});
