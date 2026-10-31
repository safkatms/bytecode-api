import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: nodemailer.Transporter | null;
    private readonly from: string;
    private readonly appDownloadUrl: string;

    constructor(config: ConfigService) {
        this.appDownloadUrl =
            config.get<string>('APP_DOWNLOAD_URL') || 'https://safkatms.github.io/app-store-site/';
        const user = config.get<string>('GMAIL_USER');
        const pass = config.get<string>('GMAIL_APP_PASSWORD');
        this.from = config.get<string>('MAIL_FROM') || (user ? `"ByteCode" <${user}>` : '');

        if (!user || !pass) {
            this.logger.warn('GMAIL_USER / GMAIL_APP_PASSWORD not set — emails are disabled');
            this.transporter = null;
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user, pass },
        });
    }

    /** Never throws — a mail failure must not break the calling flow. Returns true if sent. */
    async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
        if (!this.transporter) return false;
        try {
            await this.transporter.sendMail({ from: this.from, replyTo: this.from, to, subject, html, text });
            return true;
        } catch (err) {
            this.logger.error(`Failed to send mail to ${to}: ${(err as Error).message}`);
            return false;
        }
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
