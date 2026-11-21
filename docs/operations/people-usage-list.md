# People Usage List

## Overview

CAMS-979. When leadership asks who uses CAMS, an authorized team member produces a list of everyone
who signed in during a time range. Each person gets one row with their work email, the roles,
offices and regions they held when they signed in, and the date they last used CAMS. Names are never
recorded.

The list comes from the **CAMS People Usage** workbook. It reads the `CAMS Sign-In` events that the
API sends to its own Application Insights resource (`appi-<api function app name>`). The workbook is
deployed by `ops/cloud-deployment/backend-api-deploy.bicep`, only in environments with Application
Insights.

The executive dashboard (**CAMS Executive Usage Overview**) does not show emails and does not link
to this workbook.

## Who can produce the list

The list contains work email addresses. Only team members the product owner has approved get Azure
read access to the API's Application Insights resource or the analytics workspace behind it.

Nothing technical separates the email data from other telemetry. Anyone with read access to that
Application Insights resource or workspace can open this workbook or query the events directly, so
grant that access only with the product owner's approval.

People without that access get no data from the workbook, so they see no email.

## Produce and export the list

1. In the Azure portal, open the API function app's Application Insights resource for the
   environment (for production, the production API's `appi-` resource).
2. Select **Workbooks** and open **CAMS People Usage**.
3. Pick the **Time range**. Use **Custom** for exact dates, such as the range leadership asked for.
4. Read the note under the time range. It gives the earliest sign-in data still kept, and says
   whether the chosen range starts before it.
5. To export, open the table's **...** menu and select **Export to Excel**.

Dates are UTC. A sign-in late in the evening Eastern time can show as the next day.

## What the list shows

| Column    | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| Email     | Work email, trimmed and lowercased. `(no email recorded)` groups sign-ins with no email |
| Roles     | Every role the person held at any sign-in in the range, as readable labels              |
| Offices   | Every office the person held at any sign-in in the range                                |
| Regions   | Every region of those offices, as `Region <number> (<region name>)`, in numeric order   |
| Last Used | Date of the person's latest sign-in in the range                                        |

- A person appears once, however many sign-ins, roles, offices or regions they have.
- Temporarily granted (PIM) access counts. Roles and offices are those held at sign-in, so a person
  who signed in with temporary access to an office lists that office even after the access ended.
- People who did not sign in during the range are not listed.
- A role CAMS adds later shows its internal name (for example `NewRole`) until the workbook's role
  labels are updated.

## How far back the list goes

CAMS keeps no usage history of its own. The list reaches back only as far as the environment's
Application Insights retention. When the chosen range starts before the earliest kept sign-in, the
list covers only the kept part, and the note under the time range says from which date.

The note finds the earliest kept sign-in by looking back up to two years, the longest retention
Application Insights allows. It does not depend on the environment's retention setting.

## The `CAMS Sign-In` event

The API sends one `CAMS Sign-In` custom event each time it builds a new session, which happens for
each new access token. An active person produces several events a day; the list and later reports
count people by email, so this does not inflate them. A cached session sends no event.

The event is a contract: the workbook and the later CAMS-979 executive dashboard slices query these
names. Don't rename them without updating those queries. The code that builds it is
`buildSignInEventProperties` in `backend/lib/use-cases/user-session/user-session.ts`.

| Property    | Value                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| email       | Work email, trimmed and lowercased; empty string when the identity provider sends none |
| roles       | JSON array of distinct `CamsRole` values, sorted (`common/src/cams/roles.ts`)          |
| officeCodes | JSON array of office codes, sorted by code                                             |
| officeNames | JSON array of office names, in the same order as `officeCodes`                         |
| regionIds   | JSON array of distinct region numbers as strings, in numeric order                     |
| regionNames | JSON array of region names, in the same order as `regionIds`                           |

The person's name and user ID are never included. To query the events directly:

```kusto
customEvents
| where name == "CAMS Sign-In"
| extend email = tostring(customDimensions.email), roles = parse_json(tostring(customDimensions.roles))
```
