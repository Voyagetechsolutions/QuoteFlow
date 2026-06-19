import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendDocumentOptions {
  to: string;
  subject: string;
  text: string;
  filename: string;
  pdf: Buffer;
}

/**
 * Sends branded quote/invoice PDFs to customers.
 *
 * Real delivery needs SMTP env vars (SMTP_HOST/PORT/USER/PASS/FROM). With none
 * set, falls back to nodemailer's jsonTransport — the message is built and
 * logged but NOT delivered, so the flow is testable end-to-end without creds.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  readonly configured: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from =
      config.get<string>('SMTP_FROM') ??
      'QuoteFlow <no-reply@quoteflow.local>';

    if (host) {
      this.configured = true;
      const user = config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT') ?? 587),
        secure: config.get('SMTP_SECURE') === 'true',
        auth: user
          ? { user, pass: config.get<string>('SMTP_PASS') }
          : undefined,
      });
    } else {
      this.configured = false;
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  async sendDocument(opts: SendDocumentOptions) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      attachments: [
        {
          filename: opts.filename,
          content: opts.pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!this.configured) {
      this.logger.warn(
        `SMTP not configured — email NOT delivered. Would send "${opts.subject}" ` +
          `to ${opts.to} (attachment: ${opts.filename}). Set SMTP_* to enable.`,
      );
      return { sent: false, preview: true, to: opts.to };
    }
    return {
      sent: true,
      to: opts.to,
      messageId: (info as { messageId?: string }).messageId,
    };
  }
}
