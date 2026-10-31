import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends through Brevo's HTTPS API when BREVO_API_KEY is set (works on hosts that block SMTP,
 * e.g. Render free tier), otherwise falls back to Gmail SMTP for local development.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly brevoKey: string | undefined;
    private readonly fromEmail: string;
    private readonly fromName: string;
    private readonly transporter: nodemailer.Transporter | null = null;
    private readonly appDownloadUrl: string;

    constructor(config: ConfigService) {
        this.appDownloadUrl =
            config.get<string>('APP_DOWNLOAD_URL') || 'https://safkatms.github.io/app-store-site/';
        this.brevoKey = config.get<string>('BREVO_API_KEY');

        const gmailUser = config.get<string>('GMAIL_USER');
        const gmailPass = config.get<string>('GMAIL_APP_PASSWORD');

        // MAIL_FROM_EMAIL must be a verified sender in Brevo
        this.fromEmail = config.get<string>('MAIL_FROM_EMAIL') || gmailUser || '';
        this.fromName = config.get<string>('MAIL_FROM_NAME') || 'ByteCode';

        if (this.brevoKey) {
            if (!this.fromEmail) this.logger.warn('BREVO_API_KEY is set but MAIL_FROM_EMAIL is missing — emails will fail');
            return;
        }

        if (!gmailUser || !gmailPass) {
            this.logger.warn('Neither BREVO_API_KEY nor GMAIL_USER / GMAIL_APP_PASSWORD set — emails are disabled');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: gmailUser, pass: gmailPass },
            // fail fast instead of hanging the request when the host blocks SMTP
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        });
    }

    get enabled(): boolean {
        return !!this.brevoKey || this.transporter !== null;
    }

    /** Never throws — a mail failure must not break the calling flow. Returns true if sent. */
    async send(
        to: string,
        subject: string,
        html: string,
        text?: string,
        attachments?: MailAttachment[],
    ): Promise<boolean> {
        if (!this.enabled) return false;
        try {
            if (this.brevoKey) {
                await this.sendViaBrevo(to, subject, html, text, attachments);
            } else {
                await this.transporter!.sendMail({
                    from: `"${this.fromName}" <${this.fromEmail}>`,
                    replyTo: this.fromEmail,
                    to, subject, html, text, attachments,
                });
            }
            return true;
        } catch (err) {
            this.logger.error(`Failed to send mail to ${to}: ${(err as Error).message}`);
            return false;
        }
    }

    private async sendViaBrevo(
        to: string, subject: string, html: string, text?: string, attachments?: MailAttachment[],
    ) {
        const res = await fetch(BREVO_URL, {
            method: 'POST',
            headers: { 'api-key': this.brevoKey!, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                sender: { name: this.fromName, email: this.fromEmail },
                replyTo: { email: this.fromEmail },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                ...(text && { textContent: text }),
                ...(attachments?.length && {
                    attachment: attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })),
                }),
            }),
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }


    sendAccountCreated(to: string, name: string, temporaryPassword: string) {
        const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
        const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.5">
                <h2>Welcome, ${esc(name)}!</h2>
                <p>Your account has been created.</p>
                <p><b>Email:</b> ${esc(to)}<br/><b>Temporary password:</b> <code>${esc(temporaryPassword)}</code></p>
                <p>Please download the app and sign in with the details above:</p>
                <p><a href="${this.appDownloadUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Download the app</a></p>
                <p style="font-size:12px;color:#666">Or open: ${this.appDownloadUrl}</p>
                <p>You will be asked to change your password after your first login.</p>
            </div>`;
        const text = [
            `Welcome, ${name}!`,
            '',
            'Your ByteCode account has been created.',
            `Email: ${to}`,
            `Temporary password: ${temporaryPassword}`,
            '',
            `Download the app: ${this.appDownloadUrl}`,
            '',
            'You will be asked to change your password after your first login.',
        ].join('\n');
        return this.send(to, 'Welcome to ByteCode – your login details', html, text);
    }
}
