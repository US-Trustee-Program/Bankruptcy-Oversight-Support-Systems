/**
 * HTML template for the trustee change notification email.
 *
 * Inline string constant (rather than a separate .html asset) so the template
 * survives esbuild bundling without any loader configuration. Designers who
 * need to revise the markup can lift this constant into a scratch .html file,
 * edit, and paste it back.
 *
 * Placeholder grammar (substituted by `compileTrusteeChangeTemplate` via plain
 * string `.replace()`):
 *
 *   {{trustee_name}}            — escaped trustee display name
 *   {{appointment_info_rows}}   — pre-rendered <tr> rows for the Appointment
 *                                 Information section, or empty string if no
 *                                 appointment-section fields changed
 *   {{meeting_info_rows}}       — pre-rendered <tr> rows for the 341 Meeting
 *                                 Information section, or empty string if no
 *                                 meeting-section fields changed
 *
 *   {{author_name}}              — escaped editing user's display name
 *   {{author_email_display}}     — " (email)" with parens, or empty string
 *   {{timestamp}}                — ISO 8601 UTC timestamp of the change
 *   {{profile_link}}             — full URL to the trustee profile page
 *
 * The grammar is intentionally simple — no logic, no loops; the compiler
 * handles all conditional rendering (omitting sections when data is absent).
 *
 * Ported from the prototype at commit 11ea9cc25
 * (backend/trustee-change-notification.html).
 */
export const TRUSTEE_CHANGE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trustee Information Change</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; color: #000000;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0; padding: 0;">
        <tr>
            <td style="padding: 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 800px; margin: 0 auto;">

                    <!-- Header Text -->
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <p style="margin: 0; font-size: 14px; color: #000000;">Trustee {{trustee_name}}'s information has changed.</p>
                        </td>
                    </tr>

                    <!-- Appointment Information Section -->
                    <tr>
                        <td style="padding-bottom: 15px;">
                            <h2 style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #000000;">Appointment Information</h2>

                            <table role="presentation" cellspacing="0" cellpadding="8" border="0" width="100%" style="border-collapse: collapse;">
                                <!-- Header Row -->
                                <tr>
                                    <th width="200" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: normal; padding: 8px; width: 200px; min-width: 200px; max-width: 200px;">&nbsp;</th>
                                    <th width="50%" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: bold; padding: 8px;">Previous</th>
                                    <th width="50%" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: bold; padding: 8px;">New</th>
                                </tr>
                                {{appointment_info_rows}}
                            </table>
                        </td>
                    </tr>

                    <!-- 341 Meeting Information Section -->
                    <tr>
                        <td style="padding-top: 20px;">
                            <h2 style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #000000;">341 Meeting Information</h2>

                            <table role="presentation" cellspacing="0" cellpadding="8" border="0" width="100%" style="border-collapse: collapse;">
                                <!-- Header Row -->
                                <tr>
                                    <th width="200" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: normal; padding: 8px; width: 200px; min-width: 200px; max-width: 200px;">&nbsp;</th>
                                    <th width="50%" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: bold; padding: 8px;">Previous</th>
                                    <th width="50%" style="border-bottom: 1px solid #000000; background-color: #ffffff; text-align: left; font-weight: bold; padding: 8px;">New</th>
                                </tr>
                                {{meeting_info_rows}}
                            </table>
                        </td>
                    </tr>

                    <!-- Author & Link Section -->
                    <tr>
                        <td style="padding-top: 20px; border-top: 1px solid #cccccc;">
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #333333;">Changed by {{author_name}}{{author_email_display}} on {{timestamp}}</p>
                            <p style="margin: 0; font-size: 13px;"><a href="{{profile_link}}" style="color: #005ea2;">View Trustee Profile in CAMS</a></p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
