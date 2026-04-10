import { Address, PhoneNumber } from './contact';
import { TrusteeAppointment } from './trustee-appointments';

export type TrusteeSearchResult = {
  trusteeId: string;
  name: string;
  address?: Address;
  phone?: PhoneNumber;
  email?: string;
  appointments: TrusteeAppointment[];
};
