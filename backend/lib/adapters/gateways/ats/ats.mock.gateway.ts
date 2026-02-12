import { ApplicationContext } from '../../types/basic';
import { AtsGateway } from '../../../use-cases/gateways.types';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../types/ats.types';

const MODULE_NAME = 'ATS-MOCK-GATEWAY';

/**
 * Mock implementation of ATS gateway for testing.
 * Returns sample trustee and appointment data.
 */
export class MockAtsGateway implements AtsGateway {
  private static instance: MockAtsGateway;

  private constructor() {}

  static getInstance(): MockAtsGateway {
    if (!this.instance) {
      this.instance = new MockAtsGateway();
    }
    return this.instance;
  }

  async getTrusteesPage(
    context: ApplicationContext,
    lastTrusteeId: number | null,
    pageSize: number,
  ): Promise<AtsTrusteeRecord[]> {
    context.logger.debug(
      MODULE_NAME,
      `Mock: Getting trustees page with lastId: ${lastTrusteeId}, pageSize: ${pageSize}`,
    );

    // Return mock trustees for testing
    const mockTrustees: AtsTrusteeRecord[] = [];
    const startId = lastTrusteeId ? lastTrusteeId + 1 : 1;
    const endId = Math.min(startId + pageSize - 1, 5); // Mock has 5 trustees total

    for (let i = startId; i <= endId; i++) {
      mockTrustees.push({
        ID: i,
        LAST_NAME: `LastName${i}`,
        FIRST_NAME: `FirstName${i}`,
        MIDDLE: `M${i}`,
        COMPANY: i % 2 === 0 ? `Company ${i}` : undefined,
        STREET: `${i * 100} Main Street`,
        STREET1: i % 3 === 0 ? `Suite ${i}` : undefined,
        STREET_A2: undefined,
        CITY: 'New York',
        STATE: 'NY',
        ZIP: `1000${i}`,
        TELEPHONE: `555-000${i}`,
        EMAIL_ADDRESS: `trustee${i}@example.com`,
      });
    }

    return mockTrustees;
  }

  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: number,
  ): Promise<AtsAppointmentRecord[]> {
    context.logger.debug(MODULE_NAME, `Mock: Getting appointments for trustee ${trusteeId}`);

    // Return mock appointments for testing
    const mockAppointments: AtsAppointmentRecord[] = [
      {
        ID: trusteeId,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: 'PA',
        EFFECTIVE_DATE: new Date('2023-01-15'),
      },
      {
        ID: trusteeId,
        DISTRICT: '02',
        DIVISION: '071',
        CHAPTER: '13',
        DATE_APPOINTED: new Date('2023-06-01'),
        STATUS: 'P',
        EFFECTIVE_DATE: new Date('2023-06-01'),
      },
    ];

    // Add special case appointments for testing mapping logic
    if (trusteeId === 1) {
      mockAppointments.push({
        ID: trusteeId,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '12CBC',
        DATE_APPOINTED: new Date('2023-03-01'),
        STATUS: 'C',
        EFFECTIVE_DATE: new Date('2023-03-01'),
      });
    }

    return mockAppointments;
  }

  async getTrusteeCount(context: ApplicationContext): Promise<number> {
    context.logger.debug(MODULE_NAME, 'Mock: Getting trustee count');
    return 5; // Mock has 5 trustees
  }

  async testConnection(context: ApplicationContext): Promise<boolean> {
    context.logger.debug(MODULE_NAME, 'Mock: Testing connection');
    return true; // Mock always succeeds
  }
}
