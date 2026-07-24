import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  console.log("Seeding database...");

  await prisma.bulletinEntry.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Priya Anand",
      email: "admin@cqcbulletin.co.uk",
      passwordHash: hashPassword("AdminDemo123!"),
      role: "ADMIN",
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Janet Okoye",
      email: "manager@sunnymeadowscare.co.uk",
      passwordHash: hashPassword("DemoPass123!"),
      role: "CUSTOMER",
      subscription: {
        create: {
          careHomeName: "Sunny Meadows Care Group",
          tier: "SMALL_GROUP",
          billingStatus: "ACTIVE",
        },
      },
    },
  });

  console.log(`Created admin user: ${admin.email}`);
  console.log(`Created customer user: ${customer.email}`);

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

  const entries = [
    {
      title: "CQC tightens expectations on safeguarding notifications after regulation 13 review",
      sourceName: "CQC",
      sourceUrl: "https://www.cqc.org.uk/guidance-providers/notifications/notification-safeguarding-concern",
      rawText:
        "Following a review of provider compliance with Regulation 13 (Safeguarding service users from abuse and improper treatment), CQC has confirmed that providers must notify CQC of any safeguarding referral made to the local authority without delay, and no later than within one working day. Inspectors will now routinely cross-check safeguarding referral logs against CQC notification records during inspection. Providers found to have under-reported safeguarding concerns may receive a requirement notice even where the underlying safeguarding response was appropriate, because the notification duty itself is a fundamental standard. CQC has also clarified that this applies to allegations against staff as well as concerns about third parties.",
      summary:
        "CQC now expects safeguarding referrals notified within one working day, and inspectors will cross-check your referral log against your CQC notifications at the next inspection. Under-reporting alone — even with a good safeguarding response — can now trigger a requirement notice.",
      impactLevel: "HIGH",
      topics: "safeguarding,governance",
      regulatedActivities:
        "Personal care,Accommodation for persons who require nursing or personal care",
      actionChecklist: [
        "Escalate to the registered manager and nominated individual today — confirm who owns this update and by when it will be actioned.",
        "Audit the last 3 months of safeguarding referrals against your CQC notification records to check for gaps.",
        "Update your safeguarding policy to state the one-working-day notification timescale explicitly.",
        "Brief all staff on the change at the next handover or team meeting.",
        "Set a reminder or workflow trigger so notifications are logged the same day a referral is made.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(2),
    },
    {
      title: "MHRA and CQC issue joint alert on controlled drugs record-keeping failures",
      sourceName: "CQC",
      sourceUrl: "https://www.cqc.org.uk/guidance-providers/adult-social-care/controlled-drugs",
      rawText:
        "A joint alert from the MHRA and CQC highlights a rise in controlled drug (CD) discrepancies identified during inspections, including missing witness signatures on CD register entries and unexplained stock discrepancies not reported within 24 hours. This is now treated as a medicines management enforcement priority. Homes with unresolved CD discrepancies risk an immediate requirement notice under Regulation 12 (Safe care and treatment), and repeated failures may trigger a referral to the accountable officer for controlled drugs. Providers must ensure two staff members witness and countersign every CD administration and that stock balance checks happen at every shift change.",
      summary:
        "Controlled drug record-keeping is now an enforcement priority: missing witness signatures or unreported stock discrepancies can bring an immediate requirement notice under Regulation 12, even without a safety incident. Two-person witnessing and shift-change stock checks are the main things inspectors will look for.",
      impactLevel: "HIGH",
      topics: "medicines,governance",
      regulatedActivities: "Treatment of disease, disorder or injury,Nursing care",
      actionChecklist: [
        "Escalate to the registered manager and nominated individual today — confirm who owns this update and by when it will be actioned.",
        "Review medicines administration records (MAR charts) for compliance with the update.",
        "Spot-check the controlled drugs register for missing witness signatures over the last month.",
        "Brief the medicines lead and refresh staff competency checks if needed.",
        "Confirm stock balance checks are happening at every shift change and are documented.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(5),
    },
    {
      title: "Skills for Care updates Care Certificate standards and induction expectations",
      sourceName: "Skills for Care",
      sourceUrl: "https://www.skillsforcare.org.uk/Documents/Learning-and-development/Care-Certificate/",
      rawText:
        "Skills for Care has published a revised Care Certificate framework, with updated assessment criteria for Standard 1 (Understanding Your Role) and Standard 3 (Duty of Care). The revision is intended to bring induction training in line with the CQC's Single Assessment Framework quality statements. New starters recruited from 1 September should be assessed against the revised criteria. Providers should also review existing staff records, as CQC inspectors increasingly ask to see evidence of ongoing Care Certificate competency, not just completion at induction, particularly for staff working with residents who lack capacity.",
      summary:
        "The Care Certificate has been revised to align with CQC's Single Assessment Framework. New starters from 1 September need assessing against the updated criteria, and inspectors are now asking for evidence of ongoing competency, not just a completion certificate from induction.",
      impactLevel: "MEDIUM",
      topics: "staffing,training",
      regulatedActivities:
        "Personal care,Accommodation for persons who require nursing or personal care",
      actionChecklist: [
        "Schedule this into the next management or team meeting — confirm who owns this update and by when it will be actioned.",
        "Check current rotas and staffing levels against the new expectation.",
        "Update recruitment and induction checklists to reflect the change.",
        "Check which staff need refresher training in light of this update.",
        "Update the training matrix and set completion deadlines.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(9),
    },
    {
      title: "UKHSA revises winter infection prevention and control guidance for care homes",
      sourceName: "UKHSA",
      sourceUrl: "https://www.gov.uk/government/publications/infection-prevention-and-control-in-care-homes",
      rawText:
        "UKHSA has revised its winter infection prevention and control (IPC) guidance ahead of the seasonal respiratory illness period. Updates include revised PPE stock recommendations, a lower threshold for declaring a respiratory outbreak (two or more linked cases within 48 hours, down from 72), and a requirement to notify the local health protection team within 24 hours of a suspected outbreak. CQC has confirmed IPC audits will reference this updated guidance from this winter's inspection cycle onward. Homes should review their outbreak management policy and ensure staff know the revised reporting threshold.",
      summary:
        "The bar for declaring a respiratory outbreak has dropped to two linked cases in 48 hours, with a new 24-hour notification duty to the local health protection team. CQC will check IPC audits against this revised threshold from this winter's inspections onward.",
      impactLevel: "MEDIUM",
      topics: "infection-control,governance",
      regulatedActivities:
        "Personal care,Accommodation for persons who require nursing or personal care,Nursing care",
      actionChecklist: [
        "Schedule this into the next management or team meeting — confirm who owns this update and by when it will be actioned.",
        "Review the infection prevention and control (IPC) policy against this update.",
        "Check PPE stock levels and hand hygiene audit schedules.",
        "Brief staff on any changed cleaning or outbreak procedures.",
        "Check whether this update introduces a new statutory notification requirement.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(12),
    },
    {
      title: "CQC revises scoring guidance for 'Safe' and 'Well-led' quality statements",
      sourceName: "CQC",
      sourceUrl: "https://www.cqc.org.uk/guidance-providers/single-assessment-framework",
      rawText:
        "CQC has published revised scoring guidance for evidence categories under the 'Safe' and 'Well-led' quality statements within the Single Assessment Framework. The update clarifies how inspectors should weigh people's experience evidence against process/policy evidence, giving greater weight to what residents and relatives say happened in practice over what a policy document states should happen. Providers should expect inspectors to ask residents and relatives directly about safety incidents and how concerns were handled, and should ensure care plans and incident records are consistent with what staff and residents describe.",
      summary:
        "Inspectors will now weigh what residents and relatives actually say over what your policies claim. Make sure incident records and care plans match the story residents and families would tell if asked directly — that gap is what the revised scoring targets.",
      impactLevel: "MEDIUM",
      topics: "governance",
      regulatedActivities: "Accommodation for persons who require nursing or personal care",
      actionChecklist: [
        "Schedule this into the next management or team meeting — confirm who owns this update and by when it will be actioned.",
        "Check whether this update introduces a new statutory notification requirement.",
        "Update your governance and quality assurance framework documentation.",
        "Talk to a sample of residents and relatives to check their account matches your incident records.",
        "Add this update to your evidence folder ahead of the next inspection or PIR.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(16),
    },
    {
      title: "CQC issues minor clarification on ligature risk assessment documentation",
      sourceName: "CQC",
      sourceUrl: "https://www.cqc.org.uk/guidance-providers/adult-social-care/premises-safety",
      rawText:
        "CQC has issued a short clarification note confirming that ligature risk assessments for residential care homes (as opposed to mental health inpatient settings) do not need to follow the same standalone format required in mental health services, provided ligature risk is addressed within the wider premises risk assessment. This is an administrative clarification rather than a change to underlying expectations — homes already covering ligature risk within general premises risk assessments do not need to create a new standalone document.",
      summary:
        "A minor clarification: residential homes don't need a standalone ligature risk document, provided it's already covered in your general premises risk assessment. No new requirement — just confirms existing practice is acceptable.",
      impactLevel: "LOW",
      topics: "environment-premises",
      regulatedActivities: "Accommodation for persons who require nursing or personal care",
      actionChecklist: [
        "Note for the next routine policy review — confirm who owns this update and by when it will be actioned.",
        "Walk the building against the updated requirement and log any gaps.",
        "Update your premises risk assessment to reflect the change.",
        "Record the action taken in your evidence folder in case CQC ask about it at inspection.",
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(20),
    },
  ];

  const createdByTitle = new Map<string, Awaited<ReturnType<typeof prisma.bulletinEntry.create>>>();

  for (const entry of entries) {
    const created = await prisma.bulletinEntry.create({
      data: {
        ...entry,
        actionChecklist: JSON.stringify(entry.actionChecklist),
      },
    });
    createdByTitle.set(entry.title, created);
  }

  console.log(`Created ${entries.length} bulletin entries.`);

  // Demo data for the favourites and checklist-progress features: pin a
  // couple of entries for the demo customer and partially tick a couple of
  // checklists, so both features have something to show on first login.
  const safeguardingEntry = createdByTitle.get(
    "CQC tightens expectations on safeguarding notifications after regulation 13 review"
  )!;
  const medicinesEntry = createdByTitle.get(
    "MHRA and CQC issue joint alert on controlled drugs record-keeping failures"
  )!;
  const careCertificateEntry = createdByTitle.get(
    "Skills for Care updates Care Certificate standards and induction expectations"
  )!;

  await prisma.favouriteEntry.createMany({
    data: [
      { userId: customer.id, entryId: safeguardingEntry.id },
      { userId: customer.id, entryId: careCertificateEntry.id },
    ],
  });

  await prisma.checklistProgress.createMany({
    data: [
      // Favourited and partway through the checklist (3 of 6).
      { userId: customer.id, entryId: safeguardingEntry.id, completedItems: JSON.stringify([0, 1, 3]) },
      // Not favourited, but progress is tracked independently (2 of 6).
      { userId: customer.id, entryId: medicinesEntry.id, completedItems: JSON.stringify([0, 2]) },
    ],
  });

  console.log("Seeded favourites and checklist progress for the demo customer.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
