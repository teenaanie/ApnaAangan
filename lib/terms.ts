/**
 * The vendor listing agreement, in one place.
 *
 * Adapted from the Montvert Pristine draft. Two clauses were rewritten rather
 * than copied, because the draft describes a commission-on-orders model and
 * Aangan charges per accepted enquiry:
 *
 *   §3 Fees — was "10–15% of the value of each completed order". Aangan never
 *     sees an order value, so it cannot compute a percentage of one. Replaced
 *     with the per-accepted-enquiry terms the database actually enforces.
 *
 *   §4 Non-circumvention — removed. It existed to protect commission revenue
 *     from customers who order again off-platform. Per-lead pricing has already
 *     been paid by then, so there is nothing left to protect, and the clause
 *     costs trust with exactly the people hardest to recruit.
 *
 * VERSION: bump this whenever the text below changes in a way that alters what
 * a provider agreed to. It is stored on the provider row at acceptance, so you
 * can always tell which wording someone signed up under.
 */
export const TERMS_VERSION = "2026-08-v1";

export const TERMS_EFFECTIVE = "19 August 2026";

export type Clause = { n: string; title: string; body: string[] };

export const TERMS_INTRO =
  "This sets out the terms on which your business is listed on Aangan, a neighbourhood directory and enquiry service run by two residents. It is written to be read in five minutes, not to be impressive. If a clause is unclear, ask before you accept it.";

export const TERMS: Clause[] = [
  {
    n: "1",
    title: "What Aangan does, and what it does not do",
    body: [
      "Aangan lists your business so residents nearby can find it, and passes their enquiries to you. That is the whole of the service.",
      "Aangan does not sell your goods, does not take payment from customers, does not deliver anything, and does not guarantee you any volume of enquiries or any income.",
      "You operate as an independent business. Nothing here creates employment, partnership, agency, or any exclusive arrangement between you and Aangan.",
    ],
  },
  {
    n: "2",
    title: "Your listing",
    body: [
      "You will give accurate details of what you offer, your pricing, and your availability, and you will keep them current. A listing that is months out of date wastes a neighbour's time and reflects on everyone here.",
      "New listings, and changes to existing ones, are reviewed before they appear. This normally takes a day or less.",
      "Your phone number is never published on your listing. It is stored separately and is not readable by residents browsing the directory.",
    ],
  },
  {
    n: "3",
    title: "Fulfilment is yours",
    body: [
      "You remain solely responsible for delivering what you have agreed with the customer — the quality of it, the timing of it, and putting it right if it goes wrong.",
      "You are responsible for any licences, registrations, or safety requirements that apply to your work. FSSAI registration for food businesses is the common one; there may be others for what you do. Aangan does not verify these and does not act as your regulator.",
    ],
  },
  {
    n: "4",
    title: "What you pay",
    body: [
      "Nothing. Aangan is free to list on and free to use for the whole of the pilot: no joining fee, no monthly fee, and no charge for taking an enquiry.",
      "Aangan takes no commission and no percentage of what you earn. What the customer pays you is between you and them, and Aangan never sees the amount.",
      "Charging may begin later, and if it does you will be told at least 30 days beforehand and told exactly what it would cost you. Nothing is ever charged retrospectively — enquiries you accept while the pilot is free stay free, whatever happens afterwards.",
      "If a future charge does not suit you, you may end this agreement under clause 8 and owe nothing.",
    ],
  },
  {
    n: "5",
    title: "How money actually moves — during the pilot",
    body: [
      "Nothing is being collected at present. Your balance accrues and is shown on your dashboard so you can see what the service would cost you on your own real numbers.",
      "Aangan does not collect payment from your customers on your behalf, and does not hold your money at any point. Customers pay you directly, by whatever means you agree with them.",
      "When collection begins, you will be told at least 30 days beforehand, and settlement will be monthly and itemised — you will be able to see which enquiries you are being billed for.",
    ],
  },
  {
    n: "6",
    title: "Your customers are your own",
    body: [
      "Once you have accepted an enquiry and paid for it, that customer is yours. Aangan places no restriction on how you deal with them afterwards.",
      "You may take their repeat orders directly, on WhatsApp or over the wall, without telling Aangan and without paying anything further. There is no exclusivity period and no non-circumvention clause here, deliberately: the fee is charged for the introduction, and the introduction has already happened.",
      "Customers you already had before joining Aangan are entirely outside this agreement.",
    ],
  },
  {
    n: "7",
    title: "Complaints, reviews, and conduct",
    body: [
      "If a resident complains, it will be passed to you so that you can resolve it directly. Most things end there.",
      "Repeated complaints that go unresolved may lead to your listing being paused or removed. You will be told first, and told why.",
      "Residents may leave public reviews and ratings. Genuine reviews are not edited or removed at a provider's request. Reviews that are abusive, or that are not from a real customer, are removed.",
      "Listings that are misleading about what is offered, or that publish another person's contact details, are removed without notice.",
    ],
  },
  {
    n: "8",
    title: "Ending it",
    body: [
      "Either side may end this agreement with 7 days' notice. A WhatsApp message or an email is enough; no paperwork is required.",
      "There is no termination fee. Any balance you have accrued up to that point remains payable if collection has begun.",
      "You can also ask to have your listing paused at any time — while you are travelling, or fully booked — without ending the agreement at all.",
    ],
  },
  {
    n: "9",
    title: "Information",
    body: [
      "A resident's name and phone number are shown to you only after you accept their enquiry. They are given to you so you can fulfil that enquiry. Please do not add them to a broadcast list or pass them to anyone else.",
      "Your own phone number is shown to a resident only after you have accepted their enquiry.",
      "The people who run Aangan can see enquiries and contact details, because someone has to be able to sort out a dispute or a blocked number.",
      "Enquiry records, ratings and platform statistics belong to Aangan and are used to run and improve the directory. Your own business information — what you make, how you make it, your recipes, designs and materials — remains entirely yours.",
    ],
  },
  {
    n: "10",
    title: "Where this applies",
    body: [
      "Aangan currently operates in specific societies in Pune, and this agreement covers your listing in the society you registered under.",
      "This is a small pilot run by residents, not a company with a support desk. Terms may be revised as it grows; material changes will be sent to you and you will be asked to accept them again.",
    ],
  },
];

/** Shown under the acceptance checkbox and at the foot of the terms page. */
export const TERMS_PLAIN_SUMMARY = [
  "Listing is free, and so is taking an enquiry — for the whole pilot.",
  "Aangan takes no cut of your earnings and never handles your customers' money.",
  "You are responsible for the work itself, and for any licences it needs.",
  "A customer who finds you here is yours, with no strings and no exclusivity.",
  "Either side can walk away with a week's notice.",
];
