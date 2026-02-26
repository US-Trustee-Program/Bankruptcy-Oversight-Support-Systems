/**
 * Azure Functions API Entry Point
 *
 * This file imports all function handlers to trigger their app.http() registrations.
 * Using a single entry point allows esbuild to create one bundle with shared code
 * included once, instead of duplicating it across 22 separate bundles.
 */

// Import all functions to register them with Azure Functions
import './admin/case-reload.function';
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
import './orders-suggestions/orders-suggestions.function';
import './orders/orders.function';
import './staff/staff.function';
import './trustee-appointments/trustee-appointments.function';
import './trustee-assistants/trustee-assistants.function';
import './trustee-assignments/trustee-assignments.function';
import './trustee-history/trustee-history.function';
import './trustee-notes/trustee-notes.function';
import './trustees/trustees.function';

// All functions are now registered via their app.http() calls
