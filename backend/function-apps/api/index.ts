// Entry point for Azure Functions v4 - loads all function registrations
// Each import executes the app.http() registration at module load time

import './admin/privileged-identity-admin.function';
import './case-assignments/case.assignment.function';
import './case-associated/case-associated.function';
import './case-docket/case-docket.function';
import './case-history/case-history.function';
import './case-notes/case.notes.function';
import './case-summary/case-summary.function';
import './cases/cases.function';
import './consolidations/consolidations.function';
import './courts/courts.function';
import './healthcheck/healthcheck.function';
import './lists/lists.function';
import './me/me.function';
import './oauth2/mock-oauth2.function';
import './offices/offices.function';
import './orders/orders.function';
import './orders-suggestions/orders-suggestions.function';
import './staff/staff.function';
import './trustee-appointments/trustee-appointments.function';
import './trustee-assignments/trustee-assignments.function';
import './trustee-history/trustee-history.function';
import './trustees/trustees.function';
