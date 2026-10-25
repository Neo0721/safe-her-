/**
 * Built-in safety guidance used when the AI assistant is unreachable or not configured.
 * It is a keyword lookup over fixed, reviewed text: NOT AI, and the UI labels it that way.
 */

export interface GuideEntry {
  id: string
  title: string
  keywords: RegExp
  steps: string[]
}

export const GUIDE: GuideEntry[] = [
  {
    id: 'followed',
    title: 'If someone is following you',
    keywords: /\b(follow(ed|ing)?|stalk(er|ing)?|chasing|behind me)\b/i,
    steps: [
      'Do not go home or to a quiet place. Head for people: a shop, petrol station, restaurant or a crowded street.',
      'Cross the road or change direction once to confirm. Keep your phone in your hand, not buried in a bag.',
      'Call someone and say your location aloud, or press SOS in SafeHer to start recording your position.',
      'Ask staff or other people for help. If you feel unsafe, call the emergency number.',
    ],
  },
  {
    id: 'night',
    title: 'Walking or travelling at night',
    keywords: /\b(night|dark|late|alone|walking|home|cab|taxi|auto)\b/i,
    steps: [
      'Plan the route first and prefer busy, well-lit roads even if they are longer. SafeHer\'s Safe route shows nearby police stations and hospitals.',
      'Tell someone your route and expected arrival time. Start live tracking so your path is recorded.',
      'In a cab or auto, share the vehicle number with a contact before you get in. Sit behind the passenger seat if you can.',
      'Keep one ear free of headphones and keep your battery charged.',
    ],
  },
  {
    id: 'plan',
    title: 'Making a personal safety plan',
    keywords: /\b(plan|prepare|preparing|ready|checklist)\b/i,
    steps: [
      'Add at least two trusted people to your circle and make sure they know they are on it.',
      'Turn on the power-button trigger and try an SOS drill so the steps feel familiar.',
      'Fill in your blood group and phone so your Emergency Card is useful to a helper.',
      'Save the emergency numbers: 112 (emergency), 100 (police), 1091 or 181 (women helplines), 108 (ambulance).',
    ],
  },
  {
    id: 'sos',
    title: 'Using the SafeHer SOS button',
    keywords: /\b(sos|button|use|how do i|trigger|hold)\b/i,
    steps: [
      'Press and hold the SOS button until the ring fills. SafeHer records your real GPS position and shows call and SMS shortcuts for your circle.',
      'SafeHer opens your dialer or SMS app with everything filled in. You press call or send yourself; it never claims a message was delivered.',
      'Use Drill to practise without contacting anyone.',
    ],
  },
  {
    id: 'harassment',
    title: 'Harassment or unwanted contact',
    keywords: /\b(harass(ed|ment|ing)?|abus(e|ed|ive)|threat(en|ened|ening)?|online|messages?|blackmail)\b/i,
    steps: [
      'Do not reply to threats. Keep screenshots, dates and phone numbers as evidence (Evidence in SafeHer saves photos to your own account).',
      'Block the person and tighten privacy settings on your accounts.',
      'Tell someone you trust, and report it: women helpline 181, or the cybercrime portal for online abuse.',
    ],
  },
]

/** Best matching entries for a message (up to 2), or the plan entry as a sensible default. */
export function findGuidance(text: string): GuideEntry[] {
  const hits = GUIDE.filter((g) => g.keywords.test(text))
  return hits.length ? hits.slice(0, 2) : GUIDE.filter((g) => g.id === 'plan')
}
