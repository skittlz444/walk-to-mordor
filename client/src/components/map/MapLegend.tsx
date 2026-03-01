/**
 * MapLegend – HTML overlay showing party member names with color swatches.
 * Rendered as a Preact component on top of the Konva canvas.
 */

import type { PartyMember } from '../../stores/partyStore';
import { getMemberColor, getMutedMemberColor } from '../../utils/party-colors';

interface MapLegendProps {
  members: PartyMember[];
  partyName: string;
}

export function MapLegend({ members, partyName }: MapLegendProps) {
  if (members.length === 0) return null;

  return (
    <div className="map-legend">
      <div className="map-legend-title">{partyName}</div>
      <div className="map-legend-members">
        {members.map((member) => {
          const isDeparted = member.status === 'departed';
          const color = isDeparted
            ? getMutedMemberColor(member.color)
            : getMemberColor(member.color);
          return (
            <div
              key={member.user_id}
              className={`map-legend-member${isDeparted ? ' departed' : ''}`}
            >
              <span
                className="map-legend-swatch"
                style={{ backgroundColor: color }}
              />
              <span className="map-legend-name">{member.display_name}</span>
              <span className="map-legend-distance">
                {member.contribution.toFixed(1)} km
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
