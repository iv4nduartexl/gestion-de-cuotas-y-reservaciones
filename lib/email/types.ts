export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// Implement this interface to plug in a real provider (SMTP, Resend, SES...).
export interface EmailTransport {
  send(message: EmailMessage & { from: string }): Promise<void>;
}
