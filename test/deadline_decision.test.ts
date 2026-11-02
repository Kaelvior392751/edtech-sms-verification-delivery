import assert from "node:assert/strict";
import { deadlineState, verificationRequest } from "../src/verification_delivery.js";

const now = new Date("2026-10-28T10:00:00.000Z");
const request = verificationRequest.parse({
  courseId: "editing-101",
  learnerId: "learner-7",
  deadline: "2026-10-28T12:00:00.000Z",
  verificationMessageId: "msg-42",
});

assert.equal(deadlineState(request.deadline, now), "open");
assert.equal(deadlineState("2026-10-28T09:59:00.000Z", now), "due");
console.log("deadline decision test passed");
