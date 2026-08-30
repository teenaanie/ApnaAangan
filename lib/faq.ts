/**
 * The resident-facing FAQ.
 *
 * Adapted from the Montvert Pristine draft, with three answers changed because
 * the draft described a different platform:
 *
 *   "Can I order directly next time?" — the draft nudged residents to keep
 *     ordering through the platform. Aangan has already been paid for that
 *     introduction, so the honest answer is "yes, freely", and saying so is
 *     worth more than the nudge.
 *
 *   "Do I pay through the platform?" — unchanged in substance, but Aangan has
 *     no plan to ever take the payment, so the draft's "not yet" is misleading.
 *
 *   "Is the vendor verified?" — Aangan moderates every listing before it
 *     appears and has an ID-verified badge, so the answer can be more specific
 *     than the draft's.
 *
 * Provider-facing questions live on /rates, which residents cannot see.
 */

export type FaqSection = { title: string; items: { q: string; a: string }[] };

export const CUSTOMER_FAQ: FaqSection[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Aangan?",
        a: "A directory of the people in and around your society who cook, teach, stitch, train and fix — home bakers, tuition teachers, tailors, technicians, dog walkers. Instead of scrolling back through months of society WhatsApp messages to find the number of the woman who makes good dhoklas, they are all in one list you can search.",
      },
      {
        q: "Does it cost me anything?",
        a: "No. Browsing and sending a request are free for residents, and always will be. There is no charge, no membership, and no fee added to what you pay the provider.",
      },
      {
        q: "Do I need an account?",
        a: "No. You can browse the whole directory and send a request without signing up for anything. There is no password to forget.",
      },
      {
        q: "Which societies does it cover?",
        a: "Aangan is running as a pilot in a small number of Pune societies, Mont Vert Pristine among them. You can filter the directory by society to see who is genuinely nearby.",
      },
    ],
  },
  {
    title: "Ordering",
    items: [
      {
        q: "How do I place an order?",
        a: "Open the provider's page, write what you are looking for in the request box — be specific, it saves a round of messages — add your phone number and name, and send. You get a reference code straight away. That code is your record if you need to follow anything up.",
      },
      {
        q: "What happens after I send a request?",
        a: "It goes to the provider, who either accepts or declines it. If they accept, they get your number and contact you directly to sort out the details. Aangan does not sit in the middle relaying messages — after the introduction, the conversation is yours and theirs.",
      },
      {
        q: "How long should I wait for a reply?",
        a: "Most people reply the same day. These are neighbours running small businesses around the rest of their lives, not a call centre — if something is urgent, say so in the request, and consider sending it to two providers rather than waiting.",
      },
      {
        q: "Do I pay through Aangan?",
        a: "No. You pay the provider directly, by cash, UPI or whatever the two of you agree — exactly as you would if you had found them on WhatsApp. Aangan never handles the money and takes nothing from what you pay.",
      },
      {
        q: "Can I cancel a request?",
        a: "Just tell the provider once they contact you. A request is an enquiry, not a binding order, and nothing is charged to you at any stage.",
      },
      {
        q: "I got a message saying I have sent too many requests.",
        a: "There is a limit of five requests an hour from one phone number, which exists to stop the directory being spammed. If you have genuinely hit it while organising a party, wait an hour or tell us and it will be sorted out.",
      },
    ],
  },
  {
    title: "Trust and privacy",
    items: [
      {
        q: "Who can see my phone number?",
        a: "Only the provider you wrote to, and only after they accept your request — plus the two people who run Aangan, who can see enquiries in order to resolve disputes. It is never shown on the site, never visible to other residents, and never given to a provider you did not write to. This is enforced by the database itself, not just hidden in the interface.",
      },
      {
        q: "Are providers verified?",
        a: "Partly, and it is worth being clear about the limits. Every provider and every listing is checked before it appears, so nothing goes public unseen. Some providers carry a 'Neighbour confirmed' badge: their phone number was called and answered, and they confirmed the flat and society they live in. That is the whole of it — no government ID has been seen, no licence or kitchen has been inspected, and the quality of anyone's work is not vouched for. Treat it as a trusted neighbourhood directory, not a certification.",
      },
      {
        q: "What if something goes wrong — bad quality, a no-show?",
        a: "Speak to the provider first. They fulfilled the order and they are almost always the fastest route to fixing it. If it does not get resolved, tell us, quoting your reference code. Repeated complaints that a provider does not resolve affect whether they stay listed.",
      },
      {
        q: "Can I leave a review?",
        a: "Reviews and ratings appear on provider pages. Genuine ones are not removed because a provider dislikes them. Being fair matters here more than on a big marketplace — this is someone who lives four buildings away.",
      },
    ],
  },
  {
    title: "Afterwards",
    items: [
      {
        q: "Can I contact a provider directly next time, without using Aangan?",
        a: "Yes, completely. Once you have found someone, they are your baker or your tailor and the arrangement is entirely between you. There is no rule asking you to keep coming back through Aangan, and neither of you pays anything extra for dealing directly. The point of a directory is to be useful once, not to trap you.",
      },
      {
        q: "Why would I use it again, then?",
        a: "Because you will want someone else. Most people come back when they need a category they have not needed before — a maths tutor in June, an AC technician in April. The 'Happening today' strip at the top is also worth a glance: it is where providers post the day's menu, a limited batch, or newly free slots.",
      },
      {
        q: "Can I suggest someone who isn't listed?",
        a: "Please do. Send them the 'List your work' link, or tell us and they will be approached directly. The directory is only as good as who is in it, and the best additions come from residents who already use someone and rate them.",
      },
      {
        q: "Who do I contact about anything else?",
        a: "Teena, and Tincy in Mont Vert Pristine. Aangan is a resident-run pilot rather than a company, so you are talking to a neighbour, not a support line.",
      },
    ],
  },
];
