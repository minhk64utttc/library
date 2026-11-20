import { createConnection } from 'node:net';

interface MailMessage { to: string; subject: string; text: string }

function encodedHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim();
}

export async function sendSmtpMail(message: MailMessage): Promise<void> {
  const host = process.env.SMTP_HOST ?? 'localhost';
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const from = cleanHeader(process.env.SMTP_FROM ?? 'thu-vien@localhost');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT không hợp lệ.');

  const socket = createConnection({ host, port });
  socket.setTimeout(15_000, () => socket.destroy(new Error('SMTP timeout.')));
  const lines: string[] = [];
  const completedResponses: Array<{ code: number; text: string }> = [];
  let pending = '';
  let socketError: Error | undefined;
  let responseResolver: ((value: { code: number; text: string }) => void) | undefined;
  let responseRejecter: ((reason: Error) => void) | undefined;
  const response = (): Promise<{ code: number; text: string }> => {
    if (socketError) return Promise.reject(socketError);
    const completed = completedResponses.shift();
    if (completed) return Promise.resolve(completed);
    return new Promise((resolve, reject) => {
      responseResolver = resolve;
      responseRejecter = reject;
    });
  };

  socket.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8');
    const parts = pending.split('\r\n');
    pending = parts.pop() ?? '';
    for (const line of parts) {
      lines.push(line);
      const match = /^(\d{3})([ -])/.exec(line);
      if (match?.[2] === ' ') {
        const completed = { code: Number(match[1]), text: lines.join('\n') };
        if (responseResolver) responseResolver(completed);
        else completedResponses.push(completed);
        lines.length = 0;
        responseResolver = undefined;
        responseRejecter = undefined;
      }
    }
  });
  socket.on('error', (error) => {
    socketError = error;
    responseRejecter?.(error);
  });

  const expect = async (expected: number, command?: string): Promise<void> => {
    const received = response();
    if (command) socket.write(`${command}\r\n`);
    const result = await received;
    if (result.code !== expected) throw new Error(`SMTP ${result.code}: ${result.text.slice(0, 500)}`);
  };

  try {
    await expect(220);
    await expect(250, 'EHLO thu-vien.local');
    await expect(250, `MAIL FROM:<${from}>`);
    await expect(250, `RCPT TO:<${cleanHeader(message.to)}>`);
    await expect(354, 'DATA');
    const body = message.text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const data = [
      `From: <${from}>`, `To: <${cleanHeader(message.to)}>`,
      `Subject: ${encodedHeader(cleanHeader(message.subject))}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit',
      '', body, '.',
    ].join('\r\n');
    await expect(250, data);
    await expect(221, 'QUIT');
  } finally {
    socket.end();
  }
}
