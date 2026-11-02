import {lawMechanismContract} from './lever-contract.js';
export {LAW_LEVER_TYPES,LAW_MECHANISM_VERSION} from './lever-contract.js';
/** Exact supplied laws11–100. IDs are reviewed keys, never fuzzy title matches.
 * Parameter magnitudes below are explicit synthetic assumptions, not supplied
 * legal quantities, empirical effect sizes or implementation authority.
 */
const MAPPINGS={
 21:{engine:'city',status:'partial-proxy',mechanism:'parcel-entitlements',intervention:{type:'upzone',amount:4,cost:0},scope:['residential parcels','housing permitting agencies'],assumptions:['Four additional capacity units per modeled parcel at full compliance. All synthetic model parcels are assumed eligible; this is not real residential-lot eligibility. The source does not supply a density magnitude.'],limitations:['Additional entitlements are not completed homes. Duplex/triplex/cottage building codes and dwelling types are not represented.','The existing upzone mechanism also increases FAR. No real parcel eligibility or legal adoption is inferred.']},
 22:{engine:'city',status:'partial-proxy',mechanism:'parking-construction-cost',parameterFactors:{constructionCost:.9},scope:['residential development','planning and parking-code agencies'],assumptions:['A10% reduction in the existing per-unit construction-cost input represents avoided mandated parking construction cost. This magnitude is an analyst assumption.'],limitations:['Parking mandates, stalls, land requirements and actual parking construction costs are absent. This is a cost-channel proxy only.','Parking prices and pedestrian/transit speed are not changed. The global construction-cost input can also affect existing project-overrun calculations; there is no parking-specific cost ledger.']},
 23:{engine:'city',status:'partial-proxy',mechanism:'permit-queue-capacity',parameterFactors:{permits:2},scope:['permit offices','construction projects'],assumptions:['Doubling monthly permit-processing capacity is an illustrative queue-throughput proxy.'],limitations:['The engine has no discretionary review, code-compliance adjudication or statutory by-right entitlement process.','Only actual permit bottlenecks can affect output; financing, staffing, utilities and construction remain active constraints.']},
 25:{engine:'city',status:'partial-proxy',mechanism:'shared-housing-entitlement-capacity',intervention:{type:'upzone',amount:2,cost:0},scope:['housing and land-use agencies','residential parcels'],assumptions:['Two additional permission-capacity units per modeled parcel represent a narrow shared-housing supply-option proxy.'],limitations:['Boarding houses, room-by-room leases, co-living operations and occupancy codes are absent. This is generic entitlement capacity, not a boarding-house forecast.','No instant homes, household reassignment or rent reduction is applied.']},
 44:{engine:'population',status:'partial-proxy',mechanism:'school-recess-duration',parameterPatch:{schoolRecessMinutes:40},scope:['school schedules','school playgrounds'],assumptions:['40 minutes of modeled recess per school day versus the default20. This is an illustrative input, not a duration supplied by the law.'],limitations:['Only the existing recess schedule changes. Playground construction, risky-play equipment, injuries and child-development effects are not modeled.','Instructional time, actual attendance and fatigue proxies may change through existing routines; no educational or health improvement is guaranteed.']},
 45:{engine:'population',status:'partial-proxy',mechanism:'independent-child-walking-age',parameterPatch:{childIndependentWalkAge:6},scope:['child pedestrian permissions','school and neighborhood access'],assumptions:['Age6 replaces the default age8 unescorted walking permission. This age is a declared analyst scenario, not the text of Utah or Texas law.'],limitations:['Only the existing child walking permission threshold changes. The independent-supervision threshold and transit permissions remain unchanged; cycling still has the existing minimum age10.','No guardian escort, route safety, traffic injury or legal immunity is modeled. Minors cannot drive.']},
 46:{engine:'population',status:'partial-proxy',mechanism:'summer-camp-access-and-fee',parameterPatch:{summerCampEnabled:1,summerCampCapacity:500,summerCampDailyCost:0},scope:['summer camp services','modeled child and guardian schedules'],assumptions:['500 represented-child seats and a zero household daily camp fee are an illustrative free-camp scenario.','The existing summer calendar and weekday/age/guardian/service/availability checks remain active; no calendar is changed to force attendance.'],limitations:['Only summer camps are mapped here, not a new after-school program or physical camp construction. Camps operate only in the existing summer window; outside it there may be no effect.','Household fees are modeled, but camp operating costs, staffing, provider finances and government funding are unavailable. A zero household fee is not zero public cost.']},
 47:{engine:'population',status:'partial-proxy',mechanism:'childcare-subsidy-and-capacity',parameterPatch:{childcareSubsidyFraction:.75,childcareCapacity:500},scope:['modeled child-care capacity','household care budgets','guardian work availability'],assumptions:['A75% care-cost subsidy and500 represented-child seats replace the default0% subsidy and200 seats. These magnitudes are analyst assumptions.'],limitations:['This is the existing subsidy/capacity proxy, not an income-share cap, provider licensing reform, new childcare workers or an observed price estimate. The shared care subsidy input also discounts any enrolled camp fees.','Existing enrollment, committed care attendance, guardian constraints and daily household accounting determine actual effects. Subsidy exposure is recorded separately; government financing and public subsidy costs are unavailable.']},
 50:{engine:'population',status:'partial-proxy',mechanism:'later-teen-school-start',parameterPatch:{teenSchoolStartMinute:555},scope:['teen school schedules','school-bound travel'],assumptions:['09:15 (minute555) is an illustrative45-minute delay from the default08:30 (minute510). The source specifies08:30 or after; it does not specify a45-minute delay.'],limitations:['Only the existing teen schedule start changes. Primary school times and school-day duration remain unchanged; the actual contrast depends on the supplied initial schedule.','Recorded sleep, attendance, school-bound trips and fatigue/academic-exposure proxies are model outputs, not clinical sleep benefits, grades or measured educational effects. School/transport implementation costs are unavailable.']},
 83:{engine:'population',status:'partial-proxy',mechanism:'transit-service-frequency',parameterFactors:{transitService:1.5},scope:['bus service','transit agencies','mode-choice households'],assumptions:['A50% increase in the existing transit-service index represents an illustrative service-frequency increase; the source gives no numerical frequency target.'],limitations:['The existing service index reduces modeled wait and changes transit availability/capacity; it also affects rail and housing-choice transit utility. These coupled effects are explicit.','Walking speed and in-vehicle speeds are unchanged. District straight-line travel is not a timetable, GTFS network or dedicated-lane model.','No assumption guarantees that more service lowers the realized mean trip time: choices, demand and shared capacity can change.']}
};
const SCOPES={
 'Time & work':['workplaces','labor agencies','tax and benefit administration'],
 'Housing & places':['residential housing','planning and housing agencies','neighborhood services'],
 'Health':['healthcare facilities','insurers and clinical services'],
 'Kids, youth & tech':['schools','childcare providers','youth programs','digital services'],
 'Money & economic security':['households','banks and financial regulators','benefits administration'],
 'Education & learning':['schools','colleges','education agencies'],
 'Government & trust':['government offices','election and legislative institutions'],
 'Nature, transport & environment':['transport agencies','parks','utilities','environmental services'],
 'Meaning, culture & civic life':['civic and cultural institutions','public spaces','community groups']
};
const SPECIFIC_UNAVAILABLE={17:'Automatic IRS prefill, tax-return forms, liability reconciliation and filing acceptance are not implemented. Work-time or wage parameters are not a substitute for tax administration.',19:'Occupational credentials, licensing eligibility, interstate reciprocity and career-specific entry barriers are not implemented. Existing adult job matching alone does not model licensing reform.',20:'Portable health coverage, retirement accounts, benefit accrual, vesting and job-to-job benefit transfers are not implemented. Paid leave entitlements are not portable health or retirement benefits.',41:'Class-time phone use is not modeled as a policy lever. Home screen routines and a phone-free modeled classroom do not establish an additional effect of a phone-free-schools law.',42:'No youth social-platform accounts, platform incentives or platform restrictions are modeled.',43:'No platform age verification, recommendation system or online child-safety enforcement mechanism is modeled.',48:'No child-tax-credit eligibility, tax liability, transfer or government-funding ledger is implemented. A tax credit is not replaced with an income multiplier.',49:'Youth job matching, apprenticeship slots, eligibility and youth labor rules are not implemented as reviewed mechanisms. Adult job-search and household guardians are not youth jobs.',26:'No reviewed voucher eligibility, earmarked rent-payment and public-funding ledger exists in the pure population/city engine. Vouchers are not replaced with generic construction, a rent discount or an unrestricted income grant.',31:'Health coverage and insurance enrollment are not modeled.',35:'988 staffing, crisis response and clinical outcomes are not modeled.',75:'Electoral districts and redistricting rules are not modeled.',76:'Ballots, election rules and voter behavior are not modeled.'};

const SOURCE_ROWS=[
  {
    "id": "law-11",
    "number": 11,
    "title": "Guarantee paid sick days nationwide.",
    "text": "Guarantee paid sick days nationwide.",
    "category": "Time & work"
  },
  {
    "id": "law-12",
    "number": 12,
    "title": "Provide paid family leave, at least 12 weeks.",
    "text": "Provide paid family leave, at least 12 weeks.",
    "category": "Time & work"
  },
  {
    "id": "law-13",
    "number": 13,
    "title": "Set a minimum paid vacation floor (most rich countries guarantee 20+ days).",
    "text": "Set a minimum paid vacation floor (most rich countries guarantee 20+ days).",
    "category": "Time & work"
  },
  {
    "id": "law-14",
    "number": 14,
    "title": "Run 4-day-week pilots in public agencies and publish the results.",
    "text": "Run 4-day-week pilots in public agencies and publish the results.",
    "category": "Time & work"
  },
  {
    "id": "law-15",
    "number": 15,
    "title": "Pass right-to-disconnect rules for after-hours messages.",
    "text": "Pass right-to-disconnect rules for after-hours messages.",
    "category": "Time & work"
  },
  {
    "id": "law-16",
    "number": 16,
    "title": "Require predictable scheduling for hourly workers (2 weeks’ notice).",
    "text": "Require predictable scheduling for hourly workers (2 weeks’ notice).",
    "category": "Time & work"
  },
  {
    "id": "law-17",
    "number": 17,
    "title": "Make tax filing automatic: the IRS pre-fills your return and you click “accept.”",
    "text": "Make tax filing automatic: the IRS pre-fills your return and you click “accept.”",
    "category": "Time & work"
  },
  {
    "id": "law-18",
    "number": 18,
    "title": "Cut commute time through remote-work tax neutrality and more housing near jobs.",
    "text": "Cut commute time through remote-work tax neutrality and more housing near jobs.",
    "category": "Time & work"
  },
  {
    "id": "law-19",
    "number": 19,
    "title": "Reform occupational licensing so people can switch careers and move states easily.",
    "text": "Reform occupational licensing so people can switch careers and move states easily.",
    "category": "Time & work"
  },
  {
    "id": "law-20",
    "number": 20,
    "title": "Make benefits portable so health and retirement follow the worker, not the job.",
    "text": "Make benefits portable so health and retirement follow the worker, not the job.",
    "category": "Time & work"
  },
  {
    "id": "law-21",
    "number": 21,
    "title": "Legalize duplexes, triplexes and backyard cottages on most residential lots.",
    "text": "Legalize duplexes, triplexes and backyard cottages on most residential lots.",
    "category": "Housing & places"
  },
  {
    "id": "law-22",
    "number": 22,
    "title": "Remove parking minimums.",
    "text": "Remove parking minimums.",
    "category": "Housing & places"
  },
  {
    "id": "law-23",
    "number": 23,
    "title": "Fast-track permits: approve “by right” if a project meets code.",
    "text": "Fast-track permits: approve “by right” if a project meets code.",
    "category": "Housing & places"
  },
  {
    "id": "law-24",
    "number": 24,
    "title": "Allow single-stair apartment buildings for more family-sized units.",
    "text": "Allow single-stair apartment buildings for more family-sized units.",
    "category": "Housing & places"
  },
  {
    "id": "law-25",
    "number": 25,
    "title": "Restore boarding houses and co-living as legal options.",
    "text": "Restore boarding houses and co-living as legal options.",
    "category": "Housing & places"
  },
  {
    "id": "law-26",
    "number": 26,
    "title": "Expand housing vouchers to all eligible families, not a lottery.",
    "text": "Expand housing vouchers to all eligible families, not a lottery.",
    "category": "Housing & places"
  },
  {
    "id": "law-27",
    "number": 27,
    "title": "Support community land trusts for permanently affordable ownership.",
    "text": "Support community land trusts for permanently affordable ownership.",
    "category": "Housing & places"
  },
  {
    "id": "law-28",
    "number": 28,
    "title": "Make every neighborhood walkable to a grocery store, park and school.",
    "text": "Make every neighborhood walkable to a grocery store, park and school.",
    "category": "Housing & places"
  },
  {
    "id": "law-29",
    "number": 29,
    "title": "Plant street trees and shade in heat-prone cities.",
    "text": "Plant street trees and shade in heat-prone cities.",
    "category": "Housing & places"
  },
  {
    "id": "law-30",
    "number": 30,
    "title": "Offer a federal “starter home” path with low-down-payment loans for first-time buyers.",
    "text": "Offer a federal “starter home” path with low-down-payment loans for first-time buyers.",
    "category": "Housing & places"
  },
  {
    "id": "law-31",
    "number": 31,
    "title": "Make sure everyone has health coverage, via single-payer, a public option or market reforms.",
    "text": "Make sure everyone has health coverage, via single-payer, a public option or market reforms.",
    "category": "Health"
  },
  {
    "id": "law-32",
    "number": 32,
    "title": "Publish real prices for all medical services, with enforcement.",
    "text": "Publish real prices for all medical services, with enforcement.",
    "category": "Health"
  },
  {
    "id": "law-33",
    "number": 33,
    "title": "Cap out-of-pocket costs for insulin and other essential drugs.",
    "text": "Cap out-of-pocket costs for insulin and other essential drugs.",
    "category": "Health"
  },
  {
    "id": "law-34",
    "number": 34,
    "title": "Bring mental health care to parity in practice, not just on paper.",
    "text": "Bring mental health care to parity in practice, not just on paper.",
    "category": "Health"
  },
  {
    "id": "law-35",
    "number": 35,
    "title": "Fund 988 and mobile crisis teams in every county.",
    "text": "Fund 988 and mobile crisis teams in every county.",
    "category": "Health"
  },
  {
    "id": "law-36",
    "number": 36,
    "title": "Put a school nurse and counselor in every school.",
    "text": "Put a school nurse and counselor in every school.",
    "category": "Health"
  },
  {
    "id": "law-37",
    "number": 37,
    "title": "Run large anti-ultra-processed food pilots in school meals.",
    "text": "Run large anti-ultra-processed food pilots in school meals.",
    "category": "Health"
  },
  {
    "id": "law-38",
    "number": 38,
    "title": "Reduce medical debt and stop it from appearing on credit reports.",
    "text": "Reduce medical debt and stop it from appearing on credit reports.",
    "category": "Health"
  },
  {
    "id": "law-39",
    "number": 39,
    "title": "Expand telehealth permanently, including across state lines.",
    "text": "Expand telehealth permanently, including across state lines.",
    "category": "Health"
  },
  {
    "id": "law-40",
    "number": 40,
    "title": "Make hearing aids, eyeglasses and dental care easier to afford.",
    "text": "Make hearing aids, eyeglasses and dental care easier to afford.",
    "category": "Health"
  },
  {
    "id": "law-41",
    "number": 41,
    "title": "Phone-free school days, bell to bell.",
    "text": "Phone-free school days, bell to bell.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-42",
    "number": 42,
    "title": "Enforce age verification or safety-by-design rules for social media.",
    "text": "Enforce age verification or safety-by-design rules for social media.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-43",
    "number": 43,
    "title": "Ban addictive design features like infinite scroll and autoplay for minors.",
    "text": "Ban addictive design features like infinite scroll and autoplay for minors.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-44",
    "number": 44,
    "title": "Bring back recess, longer recess, and playgrounds with real risk.",
    "text": "Bring back recess, longer recess, and playgrounds with real risk.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-45",
    "number": 45,
    "title": "Allow kids to walk, bike and play alone (“free-range” laws, as Utah and Texas have).",
    "text": "Allow kids to walk, bike and play alone (“free-range” laws, as Utah and Texas have).",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-46",
    "number": 46,
    "title": "Offer free or cheap summer camps and after-school programs.",
    "text": "Offer free or cheap summer camps and after-school programs.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-47",
    "number": 47,
    "title": "Make child care affordable: subsidies, a cap at a share of income, or more providers.",
    "text": "Make child care affordable: subsidies, a cap at a share of income, or more providers.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-48",
    "number": 48,
    "title": "Expand the child tax credit.",
    "text": "Expand the child tax credit.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-49",
    "number": 49,
    "title": "Make youth jobs and apprenticeships easy to find and hire for.",
    "text": "Make youth jobs and apprenticeships easy to find and hire for.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-50",
    "number": 50,
    "title": "Start school later for teens (8:30 or after) for better sleep.",
    "text": "Start school later for teens (8:30 or after) for better sleep.",
    "category": "Kids, youth & tech"
  },
  {
    "id": "law-51",
    "number": 51,
    "title": "Create an emergency savings feature in every paycheck (auto-enroll, withdraw anytime).",
    "text": "Create an emergency savings feature in every paycheck (auto-enroll, withdraw anytime).",
    "category": "Money & economic security"
  },
  {
    "id": "law-52",
    "number": 52,
    "title": "Offer baby bonds: a small invested account at birth.",
    "text": "Offer baby bonds: a small invested account at birth.",
    "category": "Money & economic security"
  },
  {
    "id": "law-53",
    "number": 53,
    "title": "Expand the EITC, including for workers without children.",
    "text": "Expand the EITC, including for workers without children.",
    "category": "Money & economic security"
  },
  {
    "id": "law-54",
    "number": 54,
    "title": "Run guaranteed income pilots and study the results.",
    "text": "Run guaranteed income pilots and study the results.",
    "category": "Money & economic security"
  },
  {
    "id": "law-55",
    "number": 55,
    "title": "Ban junk fees and require all-in pricing.",
    "text": "Ban junk fees and require all-in pricing.",
    "category": "Money & economic security"
  },
  {
    "id": "law-56",
    "number": 56,
    "title": "Make cancelling a subscription as easy as signing up.",
    "text": "Make cancelling a subscription as easy as signing up.",
    "category": "Money & economic security"
  },
  {
    "id": "law-57",
    "number": 57,
    "title": "Cap payday loan interest rates.",
    "text": "Cap payday loan interest rates.",
    "category": "Money & economic security"
  },
  {
    "id": "law-58",
    "number": 58,
    "title": "Simplify the tax code and lower filing burden.",
    "text": "Simplify the tax code and lower filing burden.",
    "category": "Money & economic security"
  },
  {
    "id": "law-59",
    "number": 59,
    "title": "Provide wage insurance for workers displaced by trade or automation.",
    "text": "Provide wage insurance for workers displaced by trade or automation.",
    "category": "Money & economic security"
  },
  {
    "id": "law-60",
    "number": 60,
    "title": "Offer free, basic public banking accounts (e.g., through the Postal Service).",
    "text": "Offer free, basic public banking accounts (e.g., through the Postal Service).",
    "category": "Money & economic security"
  },
  {
    "id": "law-61",
    "number": 61,
    "title": "Make universal pre-K available.",
    "text": "Make universal pre-K available.",
    "category": "Education & learning"
  },
  {
    "id": "law-62",
    "number": 62,
    "title": "Use high-dosage tutoring for kids who fall behind.",
    "text": "Use high-dosage tutoring for kids who fall behind.",
    "category": "Education & learning"
  },
  {
    "id": "law-63",
    "number": 63,
    "title": "Teach phonics-based reading in all early grades.",
    "text": "Teach phonics-based reading in all early grades.",
    "category": "Education & learning"
  },
  {
    "id": "law-64",
    "number": 64,
    "title": "Expand vocational and trade pathways in high school.",
    "text": "Expand vocational and trade pathways in high school.",
    "category": "Education & learning"
  },
  {
    "id": "law-65",
    "number": 65,
    "title": "Make community college tuition-free.",
    "text": "Make community college tuition-free.",
    "category": "Education & learning"
  },
  {
    "id": "law-66",
    "number": 66,
    "title": "Simplify student loan repayment so it’s tied to income.",
    "text": "Simplify student loan repayment so it’s tied to income.",
    "category": "Education & learning"
  },
  {
    "id": "law-67",
    "number": 67,
    "title": "Allow more school choice (charters, ESAs or open enrollment, depending on your view).",
    "text": "Allow more school choice (charters, ESAs or open enrollment, depending on your view).",
    "category": "Education & learning"
  },
  {
    "id": "law-68",
    "number": 68,
    "title": "Teach financial literacy as a required course.",
    "text": "Teach financial literacy as a required course.",
    "category": "Education & learning"
  },
  {
    "id": "law-69",
    "number": 69,
    "title": "Offer lifelong learning accounts for adults to retrain.",
    "text": "Offer lifelong learning accounts for adults to retrain.",
    "category": "Education & learning"
  },
  {
    "id": "law-70",
    "number": 70,
    "title": "Teach civics and media literacy that’s practical, not just memorized.",
    "text": "Teach civics and media literacy that’s practical, not just memorized.",
    "category": "Education & learning"
  },
  {
    "id": "law-71",
    "number": 71,
    "title": "Make government services work online in minutes (a “Digital Service” in every agency).",
    "text": "Make government services work online in minutes (a “Digital Service” in every agency).",
    "category": "Government & trust"
  },
  {
    "id": "law-72",
    "number": 72,
    "title": "Offer one login and one form for all benefits.",
    "text": "Offer one login and one form for all benefits.",
    "category": "Government & trust"
  },
  {
    "id": "law-73",
    "number": 73,
    "title": "Ban stock trading by members of Congress.",
    "text": "Ban stock trading by members of Congress.",
    "category": "Government & trust"
  },
  {
    "id": "law-74",
    "number": 74,
    "title": "Strengthen lobbying disclosure in real time.",
    "text": "Strengthen lobbying disclosure in real time.",
    "category": "Government & trust"
  },
  {
    "id": "law-75",
    "number": 75,
    "title": "Use independent redistricting commissions.",
    "text": "Use independent redistricting commissions.",
    "category": "Government & trust"
  },
  {
    "id": "law-76",
    "number": 76,
    "title": "Try ranked-choice or approval voting in more places.",
    "text": "Try ranked-choice or approval voting in more places.",
    "category": "Government & trust"
  },
  {
    "id": "law-77",
    "number": 77,
    "title": "Hold citizens’ assemblies on hard issues, randomly selected like juries.",
    "text": "Hold citizens’ assemblies on hard issues, randomly selected like juries.",
    "category": "Government & trust"
  },
  {
    "id": "law-78",
    "number": 78,
    "title": "Make the DMV and passport process fast (appointments, mail, digital IDs).",
    "text": "Make the DMV and passport process fast (appointments, mail, digital IDs).",
    "category": "Government & trust"
  },
  {
    "id": "law-79",
    "number": 79,
    "title": "Have agencies track and publish a well-being dashboard alongside GDP.",
    "text": "Have agencies track and publish a well-being dashboard alongside GDP.",
    "category": "Government & trust"
  },
  {
    "id": "law-80",
    "number": 80,
    "title": "Sunset old regulations by default unless renewed.",
    "text": "Sunset old regulations by default unless renewed.",
    "category": "Government & trust"
  },
  {
    "id": "law-81",
    "number": 81,
    "title": "Put a park within a 10-minute walk of every home.",
    "text": "Put a park within a 10-minute walk of every home.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-82",
    "number": 82,
    "title": "Build protected bike lanes and safe sidewalks.",
    "text": "Build protected bike lanes and safe sidewalks.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-83",
    "number": 83,
    "title": "Run more frequent buses: shorter waits matter more than new lines.",
    "text": "Run more frequent buses: shorter waits matter more than new lines.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-84",
    "number": 84,
    "title": "Restore intercity rail on corridors where it makes sense.",
    "text": "Restore intercity rail on corridors where it makes sense.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-85",
    "number": 85,
    "title": "Reduce traffic deaths with Vision Zero street design.",
    "text": "Reduce traffic deaths with Vision Zero street design.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-86",
    "number": 86,
    "title": "Curb noise pollution (loud mufflers, leaf blowers, highway walls).",
    "text": "Curb noise pollution (loud mufflers, leaf blowers, highway walls).",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-87",
    "number": 87,
    "title": "Clean up lead pipes everywhere.",
    "text": "Clean up lead pipes everywhere.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-88",
    "number": 88,
    "title": "Expand public lands access and trails near cities.",
    "text": "Expand public lands access and trails near cities.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-89",
    "number": 89,
    "title": "Improve air quality with cleaner school buses and filtration in schools.",
    "text": "Improve air quality with cleaner school buses and filtration in schools.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-90",
    "number": 90,
    "title": "Prepare for extreme heat with cooling centers and tree canopy.",
    "text": "Prepare for extreme heat with cooling centers and tree canopy.",
    "category": "Nature, transport & environment"
  },
  {
    "id": "law-91",
    "number": 91,
    "title": "Make Election Day a holiday, or move it to a weekend.",
    "text": "Make Election Day a holiday, or move it to a weekend.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-92",
    "number": 92,
    "title": "Fund public arts, murals and free concerts.",
    "text": "Fund public arts, murals and free concerts.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-93",
    "number": 93,
    "title": "Provide free museum and park days each month.",
    "text": "Provide free museum and park days each month.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-94",
    "number": 94,
    "title": "Support faith and civic groups that run community services.",
    "text": "Support faith and civic groups that run community services.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-95",
    "number": 95,
    "title": "Expand public broadcasting and local creators.",
    "text": "Expand public broadcasting and local creators.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-96",
    "number": 96,
    "title": "Encourage mentorship programs pairing retirees with young people.",
    "text": "Encourage mentorship programs pairing retirees with young people.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-97",
    "number": 97,
    "title": "Hold “kindness” and civic pride events: community clean-ups, local festivals.",
    "text": "Hold “kindness” and civic pride events: community clean-ups, local festivals.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-98",
    "number": 98,
    "title": "Reduce political polarization through cross-partisan dialogue programs.",
    "text": "Reduce political polarization through cross-partisan dialogue programs.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-99",
    "number": 99,
    "title": "Celebrate local history with markers, walking tours and oral histories.",
    "text": "Celebrate local history with markers, walking tours and oral histories.",
    "category": "Meaning, culture & civic life"
  },
  {
    "id": "law-100",
    "number": 100,
    "title": "Ask people regularly how they’re doing with a national well-being survey that guides policy.",
    "text": "Ask people regularly how they’re doing with a national well-being survey that guides policy.",
    "category": "Meaning, culture & civic life"
  }
];

const REVIEWED_SCOPES={21:{buildingKinds:['home'],roads:false,people:false},22:{buildingKinds:['home','parking'],roads:false,people:false},23:{buildingKinds:['home','work','government'],roads:false,people:false},25:{buildingKinds:['home'],roads:false,people:false},44:{buildingKinds:['school','kindergarten','park'],roads:false,people:false},45:{buildingKinds:['home','school','park'],roads:true,people:false},46:{buildingKinds:['camp','summer_camp','school','park','community'],roads:false,people:false},47:{buildingKinds:['childcare','daycare','kindergarten'],roads:false,people:false},50:{buildingKinds:['school'],roads:false,people:false},83:{buildingKinds:['transit','bus-stop','bus-station'],roads:true,people:false}};
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
export const LAW_CATALOG_SOURCE=freeze({type:'user-supplied-policy-list',numberRange:[11,100],enactedLaw:false,empiricallyCalibrated:false});
export const LAW_CATALOG=freeze(SOURCE_ROWS.map(row=>{const mapping=MAPPINGS[row.number]||null;const law={...row,label:row.title,lawId:row.id,supported:!!mapping,...(mapping?{scope:REVIEWED_SCOPES[row.number]}:{}),modelStatus:mapping?.status||'mechanism-unavailable',mapping:mapping?{...mapping,scope:REVIEWED_SCOPES[row.number],cadence:mapping.engine==='city'?'monthly':'15-minute',...(mapping.engine==='city'?{defaultYears:5}:{defaultMinutes:1440}),fiscalCostsModeled:false}:null,institutions:mapping?.scope||SCOPES[row.category]||[],potentialScopeOnly:true,source:LAW_CATALOG_SOURCE,limitations:mapping?[...mapping.limitations,'Direct legislative/administrative costs are not estimated. Budget changes cover only existing endogenous model flows; this is not a fiscal cost-benefit result.']: [SPECIFIC_UNAVAILABLE[row.number]||`No reviewed implemented mechanism maps this specific law into ${row.category.toLowerCase()} outcomes. Institution scope remains available for exploration; no outcome is invented.`]};const contract=lawMechanismContract(law);law.mechanismContract=contract;if(law.mapping){law.mapping.mechanismContract=contract;if(contract.status!=='reviewed-executable-proxy'||contract.verification.status!=='execution-tested'){law.supported=false;law.modelStatus='execution-review-required';law.limitations.unshift('This staged mapping has not passed its exact-parameter consumer and execution gate; no law effect is run.');}}return law;}));
export const laws=LAW_CATALOG;
export function getLaw(lawId){const number=typeof lawId==='number'?lawId:typeof lawId==='string'&&/^(?:law-)?\d+$/.test(lawId)?Number(lawId.replace(/^law-/,'')):null;const law=LAW_CATALOG.find(row=>row.number===number);return law?structuredClone(law):null;}
export function listLaws({category=null,supported=null}={}){return LAW_CATALOG.filter(row=>(category===null||row.category===category)&&(supported===null||row.supported===supported)).map(row=>structuredClone(row));}
