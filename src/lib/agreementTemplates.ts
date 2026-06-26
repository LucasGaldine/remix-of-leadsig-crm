type AgreementTemplateKey = "job_release_agreement" | "job_agreement" | "warranty_agreement";

export type AgreementTemplates = Record<AgreementTemplateKey, string>;

export interface AgreementTemplateParams {
  todayIso: string;
  contractorName: string;
  contractorAddress: string;
  contractorPhone: string;
  contractorEmail: string;
  clientName: string;
  projectName: string;
  projectAddress: string;
  scopeItems: string[];
  totalCost: number;
  paymentMethod: string;
  paymentSchedule?: {
    depositPercentage: number;
    midpointPercentage: number;
    finalPercentage: number;
  };
  workmanshipWarrantyDuration?: string;
  startDate?: string;
  completionDate?: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizePercentage(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function generateAgreementTemplates(params: AgreementTemplateParams): AgreementTemplates {
  const depositPercentage = normalizePercentage(params.paymentSchedule?.depositPercentage, 33);
  const midpointPercentage = normalizePercentage(params.paymentSchedule?.midpointPercentage, 33);
  const finalPercentage = normalizePercentage(params.paymentSchedule?.finalPercentage, 34);
  const depositAmount = Number((params.totalCost * (depositPercentage / 100)).toFixed(2));
  const midpointAmount = Number((params.totalCost * (midpointPercentage / 100)).toFixed(2));
  const finalAmount = Number((params.totalCost - depositAmount - midpointAmount).toFixed(2));
  const workHours = "Monday-Friday, 7:00 AM - 6:00 PM";
  const startDate = params.startDate || params.todayIso;
  const completionDate = params.completionDate || startDate;
  const permitResponsibilityOverride = `${params.contractorName} will obtain all required permits unless stated otherwise in writing.`;
  const terminationNoticePeriod = "7 days";
  const workmanshipWarrantyDuration = (params.workmanshipWarrantyDuration || "2 years").trim() || "2 years";
  const numberedScope = (params.scopeItems.length > 0 ? params.scopeItems : ["Scope details to be finalized in writing."])
    .slice(0, 25)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return {
    job_release_agreement: `JOB RELEASE AGREEMENT

Date: ${params.todayIso}

PARTIES

Contractor: ${params.contractorName}
Address: ${params.contractorAddress}
Phone: ${params.contractorPhone}
Email: ${params.contractorEmail}

Client: ${params.clientName}
Project Name: ${params.projectName}
Project Address: ${params.projectAddress}

FINAL JOB RELEASE

This Job Release Agreement is being issued after completion of the project listed above.

By signing this agreement, the Client confirms that ${params.contractorName} has completed the agreed-upon work, that the completed work has been reviewed, and that the Client accepts the project as complete.

The purpose of this agreement is to confirm that the Contractor has fulfilled the agreed scope of work and that no further work, corrections, changes, or claims are being requested by the Client at this time, except for any written warranty obligations separately provided by the Contractor.

COMPLETED PROJECT SCOPE

The following scope of work was completed:

${numberedScope}

The Contractor confirms that the work was completed in a professional and workmanlike manner.

The Client confirms that they have had the opportunity to inspect the completed work and that the work has been completed to their satisfaction.

PAYMENT CONFIRMATION

Total Project Cost: $${formatCurrency(params.totalCost)}

The Client confirms that all payments due for the project have been received by the Contractor.

No remaining balance is due unless otherwise agreed to in writing by both parties.

CLIENT ACCEPTANCE

By signing this agreement, the Client acknowledges and agrees that:

The agreed scope of work has been completed.
The Client has reviewed the completed work.
The completed work is accepted as satisfactory.
All project payments have been made.
No additional work, corrections, or changes are being requested at this time.
This agreement does not waive any written warranty provided by the Contractor.

RELEASE OF PROJECT

The Client releases ${params.contractorName} from any further obligation related to the completed project, except for obligations specifically covered under a written warranty or separate written agreement.

This release confirms that the project is considered complete and closed as of the date signed below.`,
    job_agreement: `CONSTRUCTION CONTRACT / JOB AGREEMENT

Date: ${params.todayIso}

PARTIES

Contractor: ${params.contractorName}
Address: ${params.contractorAddress}
Phone: ${params.contractorPhone}
Email: ${params.contractorEmail}

Client: ${params.clientName}
Project Name: ${params.projectName}
Project Address: ${params.projectAddress}

This Construction Contract (“Agreement”) is entered into by and between ${params.contractorName} (“Contractor”) and ${params.clientName} (“Client”) for the project described below.

1. SCOPE OF WORK

The Contractor agrees to perform the following work:

${numberedScope}

All work shall be completed in a professional and workmanlike manner and in compliance with all applicable laws, codes, and regulations.

2. PROJECT TIMELINE
Estimated Start Date: ${startDate} (or upon deposit receipt)
Estimated Completion Date: ${completionDate}

The Contractor may adjust the schedule due to weather conditions, material availability, or unforeseen circumstances.

3. TOTAL CONTRACT PRICE

Total Cost: $${formatCurrency(params.totalCost)}

4. PAYMENT SCHEDULE

Payment shall be made as follows: deposit of ${depositPercentage}% ($${formatCurrency(depositAmount)}) due upon signing, midpoint payment of ${midpointPercentage}% ($${formatCurrency(midpointAmount)}) due at project midpoint, and final payment of ${finalPercentage}% ($${formatCurrency(finalAmount)}) due upon substantial completion.

Payment Method: ${params.paymentMethod}

Failure to make payments on time may result in project delays or suspension of work.

5. CHANGE ORDERS

Any modifications to the scope of work must be documented in a written Change Order signed by both parties prior to execution.

Change Orders may affect cost and timeline. Verbal agreements are not binding.

6. PERMITS AND INSPECTIONS

${params.contractorName} shall obtain all necessary permits and coordinate required inspections unless otherwise specified:

${permitResponsibilityOverride}

7. INSURANCE AND LIABILITY

The Contractor shall maintain general liability insurance and workers’ compensation insurance for employees and subcontractors throughout the duration of the project.

8. SITE ACCESS

The Client agrees to provide full access to the work site and ensure the area is clear of obstacles.

Work Hours: ${workHours} (e.g., Monday–Friday, 7:00 AM – 6:00 PM)

9. DISPUTE RESOLUTION

Any disputes arising from this Agreement shall be resolved through binding arbitration administered by the American Arbitration Association at or near ${params.projectAddress}.

The arbitrator’s decision shall be final and binding.

10. TERMINATION

Either party may terminate this Agreement with ${terminationNoticePeriod} written notice. Upon termination, the Client shall pay for all completed work and materials purchased, and the Contractor shall cease work promptly.

11. ENTIRE AGREEMENT

This document represents the full agreement between the parties and supersedes all prior discussions, agreements, or representations.
`,
    warranty_agreement: `WARRANTY AGREEMENT

Date: ${params.todayIso}

PARTIES

Contractor: ${params.contractorName}
Address: ${params.contractorAddress}
Phone: ${params.contractorPhone}
Email: ${params.contractorEmail}

Client: ${params.clientName}
Project Name: ${params.projectName}
Project Address: ${params.projectAddress}

This Warranty Agreement (“Agreement”) is provided by ${params.contractorName} (“Contractor”) to ${params.clientName} (“Client”) in connection with the completed project at the address listed above.

1. WORKMANSHIP WARRANTY

The Contractor warrants all workmanship for a period of:

${workmanshipWarrantyDuration}

from the date of substantial completion.

During this period, the Contractor will repair or correct, at no additional cost to the Client, any defects in workmanship arising under normal use and conditions.

2. MATERIALS WARRANTY

All materials are subject to their respective manufacturer warranties.

Warranty terms vary by product
The Contractor will assist in submitting claims when applicable

Manufacturer Warranty Details (optional):
Manufacturer warranty details available upon request.

3. SCOPE OF WARRANTY COVERAGE

This warranty applies to the following work:

${numberedScope}

4. EXCLUSIONS

This warranty does not cover:

Acts of God (e.g., floods, earthquakes, severe weather)
Misuse, neglect, or lack of proper maintenance
Normal wear and tear
Work altered or modified by others
Damage due to soil movement, settlement, or pre-existing structural conditions
5. WARRANTY CLAIM PROCESS

To submit a claim:

The Client must notify the Contractor in writing within the warranty period
The Contractor will inspect the issue within 14 business days (e.g., 14 business days)
If covered, the Contractor will provide a repair or correction plan

Contact for Claims:
${params.contractorEmail} | ${params.contractorPhone}

6. LIMITATION OF LIABILITY

The Contractor’s total liability under this warranty shall not exceed:

$${formatCurrency(params.totalCost)}

(as defined in the associated Construction Contract / Job Agreement)
`,
  };
}
