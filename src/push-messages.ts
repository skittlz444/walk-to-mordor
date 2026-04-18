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

export interface ReengageMessageTemplate {
  readonly title: string;
  readonly bodyTemplate: string;
}

export const REENGAGE_MESSAGES: ReadonlyMap<number, ReadonlyArray<ReengageMessageTemplate>> = new Map([
  [1, [
    { title: "Gandalf Notices Your Absence", bodyTemplate: '"Even the smallest step counts," he says. {goalTitle} still waits for you ahead.' },
    { title: "The Road Misses You", bodyTemplate: "Six days without a step — the path to {goalTitle} grows no shorter on its own." },
    { title: "A Gentle Nudge from the Shire", bodyTemplate: "Sam's been keeping your pack ready. {goalTitle} is still out there, waiting." },
    { title: "Your Journey Pauses", bodyTemplate: "The road to {goalTitle} is patient, but Gandalf is watching the horizon for you." },
  ]],
  [2, [
    { title: "The Fellowship Grows Worried", bodyTemplate: "Sam keeps glancing back down the road… {goalTitle} feels further each day." },
    { title: "Shadows Lengthen", bodyTemplate: "Ten days off the path. The road to {goalTitle} grows darker without your footsteps." },
    { title: "Aragorn Scouts Ahead Alone", bodyTemplate: "Without you, the company is incomplete. {goalTitle} needs every member of the fellowship." },
    { title: "Whispers at the Council", bodyTemplate: '"Where is our walker?" they ask. The road to {goalTitle} awaits your return.' },
  ]],
  [3, [
    { title: "Darkness Spreads", bodyTemplate: "Without you, the journey to {goalTitle} may be lost. Return, friend!" },
    { title: "The Enemy Does Not Rest", bodyTemplate: "Fifteen days have passed. Sauron's reach grows while {goalTitle} remains unconquered." },
    { title: "Gandalf's Urgent Summons", bodyTemplate: '"To delay is to risk all." The path to {goalTitle} cannot wait much longer.' },
    { title: "The Beacons Are Lit!", bodyTemplate: "Middle-earth calls for aid! The road to {goalTitle} needs you now more than ever." },
  ]],
  [4, [
    { title: "A Moth Brings a Message", bodyTemplate: 'A moth finds you with a message from Gandalf: "It is not too late." {goalTitle} still stands.' },
    { title: "One Last Hope", bodyTemplate: "Even in the darkest hour, a single step towards {goalTitle} can change everything." },
    { title: "The Grey Pilgrim's Final Plea", bodyTemplate: '"I will not say: do not weep; for not all tears are an evil." But the road to {goalTitle} still remains.' },
    { title: "All Is Not Lost", bodyTemplate: "Twenty-five days in shadow, yet {goalTitle} endures. One walk. That is all that is asked of you." },
  ]],
]);

export function getReengageMessage(
  tier: number,
  goalTitle: string,
): { title: string; body: string } {
  const templates = REENGAGE_MESSAGES.get(tier);
  if (!templates || templates.length === 0) {
    throw new Error(`Invalid re-engagement tier: ${tier}`);
  }

  const template = templates[Math.floor(Math.random() * templates.length)];
  return {
    title: template.title.replace(/{goalTitle}/g, goalTitle),
    body: template.bodyTemplate.replace(/{goalTitle}/g, goalTitle),
  };
}
