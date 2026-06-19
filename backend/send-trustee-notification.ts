import { EmailClient, EmailMessage } from "@azure/communication-email";
import * as fs from "fs";
import * as path from "path";

/**
 * Configuration for Azure Communication Services
 */
interface ACSConfig {
  connectionString: string;
  senderAddress: string;
}

/**
 * Data structure for trustee information
 */
interface TrusteeData {
  district?: string;
  divisions?: string;
  chapter?: string;
  type?: string;
  appointment_date?: string;
  status?: string;
  status_effective_date?: string;
  zoom_link?: string;
  zoom_phone?: string;
  meeting_id?: string;
  passcode?: string;
}

/**
 * Complete trustee change notification data
 */
interface TrusteeChangeData {
  trustee_name: string;
  previous: TrusteeData;
  new: TrusteeData;
}

/**
 * Field configuration for table rows
 */
interface FieldConfig {
  key: keyof TrusteeData;
  label: string;
  section: "appointment" | "meeting";
  stackValues?: boolean; // If true, splits comma/semicolon-separated values vertically
}

// Define all possible fields with their display labels
const FIELDS: FieldConfig[] = [
  { key: "district", label: "District", section: "appointment" },
  { key: "divisions", label: "Division(s)", section: "appointment", stackValues: true },
  { key: "chapter", label: "Chapter", section: "appointment" },
  { key: "type", label: "Type", section: "appointment" },
  { key: "appointment_date", label: "Appt. Date", section: "appointment" },
  { key: "status", label: "Status", section: "appointment" },
  { key: "status_effective_date", label: "Status Effective Date", section: "appointment" },
  { key: "zoom_link", label: "Zoom Link", section: "meeting" },
  { key: "zoom_phone", label: "Zoom Phone", section: "meeting" },
  { key: "meeting_id", label: "Meeting ID", section: "meeting" },
  { key: "passcode", label: "Passcode", section: "meeting" },
];

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Formats a cell value - handles arrays/comma-separated values for vertical stacking
 */
function formatCellValue(value: string, shouldStack: boolean = false): string {
  if (!value) return "";

  if (shouldStack) {
    // Split by comma, semicolon, or array brackets and trim whitespace
    const items = value
      .replace(/[\[\]]/g, "") // Remove array brackets if present
      .split(/[,;]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (items.length > 1) {
      // Stack items vertically using divs for better email client compatibility
      return items.map(item => `<div style="margin: 0; padding: 0;">${escapeHtml(item)}</div>`).join("");
    }
  }

  return escapeHtml(value);
}

/**
 * Generates a single table row HTML string
 */
function generateRow(
  label: string,
  previousValue: string,
  newValue: string,
  shouldStackValues: boolean = false
): string {
  const formattedPrevious = formatCellValue(previousValue, shouldStackValues);
  const formattedNew = formatCellValue(newValue, shouldStackValues);

  return `
                                <tr>
                                    <td width="200" style="border-bottom: 1px solid #000000; font-weight: bold; padding: 8px; width: 200px; min-width: 200px; max-width: 200px;">${escapeHtml(label)}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${formattedPrevious}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${formattedNew}</td>
                                </tr>`;
}

/**
 * Compiles dynamic rows for a specific section (appointment or meeting)
 */
function compileRows(
  data: TrusteeChangeData,
  section: "appointment" | "meeting"
): string {
  const relevantFields = FIELDS.filter((field) => field.section === section);
  const rows: string[] = [];

  for (const field of relevantFields) {
    const previousValue = data.previous[field.key];
    const newValue = data.new[field.key];

    // Only include row if values differ
    if (previousValue !== newValue) {
      rows.push(
        generateRow(
          field.label,
          previousValue || "",
          newValue || "",
          field.stackValues || false
        )
      );
    }
  }

  return rows.join("");
}

/**
 * Compiles the email template with dynamic data
 */
function compileEmailTemplate(
  templatePath: string,
  data: TrusteeChangeData
): string {
  // Read the template file
  const template = fs.readFileSync(templatePath, "utf-8");

  // Compile dynamic rows
  const appointmentRows = compileRows(data, "appointment");
  const meetingRows = compileRows(data, "meeting");

  // Replace placeholders
  let compiledHtml = template
    .replace("{{trustee_name}}", escapeHtml(data.trustee_name))
    .replace("{{appointment_info_rows}}", appointmentRows)
    .replace("{{meeting_info_rows}}", meetingRows);

  return compiledHtml;
}

/**
 * Sends the trustee change notification email via Azure Communication Services
 */
async function sendTrusteeChangeNotification(
  config: ACSConfig,
  recipientEmail: string,
  data: TrusteeChangeData
): Promise<void> {
  try {
    // Initialize the email client
    const emailClient = new EmailClient(config.connectionString);

    // Compile the email template
    const templatePath = path.join(__dirname, "trustee-change-notification.html");
    const htmlContent = compileEmailTemplate(templatePath, data);

    // Prepare the email message
    const message: EmailMessage = {
      senderAddress: config.senderAddress,
      content: {
        subject: `Trustee Information Changed: ${data.trustee_name}`,
        html: htmlContent,
      },
      recipients: {
        to: [{ address: recipientEmail }],
      },
    };

    // Send the email
    const poller = await emailClient.beginSend(message);
    const result = await poller.pollUntilDone();

    console.log("Email sent successfully!");
    console.log("Message ID:", result.id);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Example usage
 */
async function main() {
  // Configure Azure Communication Services
  const acsConfig: ACSConfig = {
    connectionString: process.env.ACS_CONNECTION_STRING || "",
    senderAddress: "DoNotReply@your-domain.com", // Replace with your verified sender address
  };

  // Example data with changes
  const changeData: TrusteeChangeData = {
    trustee_name: "Henry Green",
    previous: {
      district: "Southern District of New York",
      divisions: "Manhattan, Queens", // Multiple divisions - comma separated
      chapter: "Chapter 7",
      type: "Panel Trustee",
      appointment_date: "01/15/2020",
      status: "Active",
      status_effective_date: "01/15/2020",
      zoom_link: "https://zoom.us/j/1234567890",
      zoom_phone: "+1 234 567 8900",
      meeting_id: "123 456 7890",
      passcode: "abc123",
    },
    new: {
      district: "Eastern District of New York", // Changed
      divisions: "Brooklyn, Queens, Staten Island", // Changed - multiple divisions
      chapter: "Chapter 7",
      type: "Panel Trustee",
      appointment_date: "01/15/2020",
      status: "Active",
      status_effective_date: "01/15/2020",
      zoom_link: "https://zoom.us/j/9876543210", // Changed
      zoom_phone: "+1 987 654 3210", // Changed
      meeting_id: "987 654 3210", // Changed
      passcode: "xyz789", // Changed
    },
  };

  // Send the notification
  await sendTrusteeChangeNotification(
    acsConfig,
    "recipient@example.com",
    changeData
  );
}

// Run the example (comment out in production)
// main().catch(console.error);

// Export functions for use in other modules
export {
  compileEmailTemplate,
  sendTrusteeChangeNotification,
  TrusteeChangeData,
  TrusteeData,
  ACSConfig,
};
