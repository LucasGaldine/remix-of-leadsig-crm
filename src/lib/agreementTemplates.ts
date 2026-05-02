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
  const arbitrationBody = "American Arbitration Association";
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

AUTHORIZATION TO PROCEED

The Client hereby authorizes ${params.contractorName} (“Contractor”) to begin work on the project described below. By signing this Job Release Agreement, the Client agrees to the following terms and conditions.

PROJECT SCOPE

We are pleased to provide the following scope of work:

${numberedScope}

The Contractor agrees to complete the work in a professional and workmanlike manner, maintaining a clean and safe job site throughout the duration of the project.

FINANCIAL TERMS

Total Project Cost: $${formatCurrency(params.totalCost)}

Payment Schedule:

Deposit (${depositPercentage}%): $${formatCurrency(depositAmount)} — due upon signing
Midpoint Payment (${midpointPercentage}%): $${formatCurrency(midpointAmount)} — due at project midpoint
Final Payment (${finalPercentage}%): $${formatCurrency(finalAmount)} — due upon completion

Payment Method: ${params.paymentMethod} (e.g., Stripe, check, ACH)

Work will commence only after the initial deposit has been received.

SITE ACCESS

The Client agrees to provide the Contractor with full and unobstructed access to the project site during regular business hours:

Hours: ${workHours} (e.g., Monday–Friday, 7:00 AM – 6:00 PM)

INSURANCE

The Contractor shall maintain appropriate insurance coverage, including:

General Liability Insurance
Workers’ Compensation Insurance

Coverage will remain active for the duration of the project and apply to all employees and subcontractors.

ACKNOWLEDGMENT

The Client confirms that:

The scope of work is accurate and understood
The pricing and payment schedule are agreed upon
Authorization is granted to begin work upon deposit receipt
SIGNATURES

Client Signature: ___________________________
Printed Name: ${params.clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${params.contractorName}
Date: _______________`,
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

Payment shall be made as follows:

Deposit (${depositPercentage}%): $${formatCurrency(depositAmount)} — due upon signing
Midpoint Payment (${midpointPercentage}%): $${formatCurrency(midpointAmount)} — due at project midpoint
Final Payment (${finalPercentage}%): $${formatCurrency(finalAmount)} — due upon substantial completion

Payment Method: ${params.paymentMethod}

Failure to make payments on time may result in project delays or suspension of work.

5. CHANGE ORDERS

Any modifications to the scope of work must be documented in a written Change Order signed by both parties prior to execution.

Change Orders may affect cost and timeline
Verbal agreements are not binding
6. PERMITS AND INSPECTIONS

${params.contractorName} shall obtain all necessary permits and coordinate required inspections unless otherwise specified:

${permitResponsibilityOverride}

7. INSURANCE AND LIABILITY

The Contractor shall maintain:

General Liability Insurance
Workers’ Compensation Insurance

Coverage applies to all employees and subcontractors throughout the duration of the project.

8. SITE ACCESS

The Client agrees to:

Provide full access to the work site
Ensure the area is clear of obstacles

Work Hours: ${workHours} (e.g., Monday–Friday, 7:00 AM – 6:00 PM)

9. DISPUTE RESOLUTION

Any disputes arising from this Agreement shall be resolved through:

Method: Binding arbitration
Governing Body: American Arbitration Association (or ${arbitrationBody})
Location: ${params.projectAddress}

The arbitrator’s decision shall be final and binding.

10. TERMINATION

Either party may terminate this Agreement with:

${terminationNoticePeriod} (e.g., 7 days) written notice

Upon termination:

The Client shall pay for all completed work and materials purchased
The Contractor shall cease work promptly
11. ENTIRE AGREEMENT

This document represents the full agreement between the parties and supersedes all prior discussions, agreements, or representations.

SIGNATURES

Client Signature: ___________________________
Printed Name: ${params.clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${params.contractorName}
Date: _______________`,
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

SIGNATURES

Client Signature: ___________________________
Printed Name: ${params.clientName}
Date: _______________

Contractor Signature: ___________________________
Printed Name: ${params.contractorName}
Date: _______________`,
  };
}
