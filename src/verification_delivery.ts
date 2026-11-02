import { z } from "zod";
import { infrai, InfraiError } from "./infrai.js";

export const verificationRequest = z.object({
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  deadline: z.string().datetime(),
  verificationMessageId: z.string().min(1),
});

export type VerificationRequest = z.infer<typeof verificationRequest>;

export function deadlineState(deadline: string, now: Date): "open" | "due" {
  return new Date(deadline).getTime() > now.getTime() ? "open" : "due";
}

export async function resendVerification(input: unknown, now = new Date()) {
  const request = verificationRequest.parse(input);
  const deadline = deadlineState(request.deadline, now);
  const resend = await infrai.sms.resend(request.verificationMessageId, `${request.courseId}:${request.learnerId}`);
  const events = await infrai.sms.events(resend.message_id);
  return { courseId: request.courseId, learnerId: request.learnerId, deadline, messageId: resend.message_id, events };
}

export function responseForError(error: unknown): { status: number; body: { error: string } } {
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    return { status: error.status, body: { error: error.message } };
  }
  return { status: 500, body: { error: "delivery request failed" } };
}

if (process.argv[1]?.endsWith("verification_delivery.ts")) {
  const raw = process.env.VERIFICATION_REQUEST;
  if (!raw) throw new Error("VERIFICATION_REQUEST must contain the JSON request body");
  resendVerification(JSON.parse(raw)).then(console.log).catch((error) => {
    console.error(responseForError(error));
    process.exitCode = 1;
  });
}
