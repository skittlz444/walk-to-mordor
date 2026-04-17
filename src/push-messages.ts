export interface OneMoreMileMessageTemplate {
  readonly title: string;
  readonly bodyTemplate: string;
}

export const ONE_MORE_MILE_MESSAGES: ReadonlyArray<OneMoreMileMessageTemplate> = [
  {
    title: 'One More Mile, {goalTitle} Awaits!',
    bodyTemplate: "You're just {remainingKm} km away from {goalTitle}. Surely a short walk would take you there!",
  },
  {
    title: 'The Road Goes Ever On',
    bodyTemplate: 'Only {remainingKm} km to {goalTitle}. Even the smallest step forward can change the journey.',
  },
  {
    title: "Don't Stop Now, Traveller!",
    bodyTemplate: "{goalTitle} is a mere {remainingKm} km ahead. You've come too far to rest now.",
  },
  {
    title: 'Almost There!',
    bodyTemplate: 'If Samwise can carry Frodo up Mount Doom, you can walk {remainingKm} km to {goalTitle}.',
  },
  {
    title: 'A Shortcut to {goalTitle}',
    bodyTemplate: 'Just {remainingKm} km remain. Mushrooms optional, but the milestone is within reach!',
  },
  {
    title: 'The Eagles Are Coming!',
    bodyTemplate: "Well, not quite — but {goalTitle} is only {remainingKm} km away. Lace up those boots!",
  },
  {
    title: "Strider's Counsel",
    bodyTemplate: '"Not all those who wander are lost." And you\'re only {remainingKm} km from {goalTitle}.',
  },
  {
    title: 'A Light in the Darkness',
    bodyTemplate: '{goalTitle} glimmers just {remainingKm} km ahead. One walk is all it takes.',
  },
];

export function getOneMoreMileMessage(
  goalTitle: string,
  remainingKm: number,
): { title: string; body: string } {
  const template = ONE_MORE_MILE_MESSAGES[Math.floor(Math.random() * ONE_MORE_MILE_MESSAGES.length)];
  const formattedKm = remainingKm.toFixed(1);

  return {
    title: template.title.replace(/{goalTitle}/g, goalTitle).replace(/{remainingKm}/g, formattedKm),
    body: template.bodyTemplate.replace(/{goalTitle}/g, goalTitle).replace(/{remainingKm}/g, formattedKm),
  };
}
