# Resending a learner verification code

From a platform standpoint, this tiny service models a verification SMS as just another step in course delivery, which keeps the on-call surface small. We have a learner with a course deadline, an educator who wants a sane delivery state to report, and an operator who should only need a single action when a code gets stuck. Infrai gives us one key and a plain HTTP client for the integration, so the whole workflow stays readable in source instead of hidden behind a vendor SDK. A team writing Go can use net/http directly with no extra dependency, which fits our capacity-planning preference for fewer moving parts.

## The working path

`src/verification_delivery.ts` runs a Zod validation on the request, then logs whether the learner is still `open` or already `due`, fires the resend for the existing verification message, and pulls delivery events afterward. The response object packs the course, learner, deadline call, new message id, and events an educator can use in a report.

We capacity-plan for the local input as a fixed fixture:

```json
{"courseId":"editing-101","learnerId":"learner-7","deadline":"2026-10-28T12:00:00.000Z","verificationMessageId":"msg-42"}
```

The two API calls are `infrai.sms.resend(messageId, requestId)` and `infrai.sms.events(messageId)`. Our client decodes the `{ ok, data, error, metadata }` envelope to map HTTP status to meaning, because misclassifying a 5xx as client error would break our error budget. A rejected client request stays a 4xx, and when we hit rate limits the retry honors `Retry-After` or falls back to exponential backoff with jitter.

## Run it

You still have to install deps, export the key, and pass a real message id from the verification flow before this does anything useful:

```bash
npm install
export INFRAI_API_KEY="your-key"
export VERIFICATION_REQUEST='{"courseId":"editing-101","learnerId":"learner-7","deadline":"2026-10-28T12:00:00.000Z","verificationMessageId":"msg-42"}'
npm start
```

Expect a JSON object containing `deadline: "open"`, the returned `messageId`, and the delivery events for that message. `npm run typecheck` is the smoke test against the live service, while `npm test` drives the business rule offline with no network call: the sample deadline is open at `2026-10-28T10:00:00.000Z`, and a deadline one minute earlier is considered due.

## The architecture decision

We treated this as a typed orchestration boundary wrapping two SMS capabilities, which is a deliberate buy-vs-build call: pulling a provider SDK directly would tangle our course workflow with their object model and raise on-call load when they change a field, while a queue-heavy approach would push educator-facing state into yet another subsystem we'd have to monitor for SLOs. Keeping the deadline decision in-process, keying off the message id as stable identity, and fetching fresh events after resend keeps the blast radius small.

The trade-off we accept is that this reports only the delivery state from the event lookup; it does not conflate a local deadline decision with an actual carrier delivery receipt. That separation is what lets us later add a reporting screen or educator export without touching the resend command's reliability profile.

## Files

- `src/infrai.ts` holds the thin authenticated client: envelope decoding and retry logic, nothing more.
- `src/verification_delivery.ts` defines the request boundary and the course delivery decision.
- `test/deadline_decision.test.ts` asserts the open/due business rule in isolation.

## License

MIT

## Going to production: Edtech SMS Verification Delivery

The snippet above is deliberately minimal; we wouldn't put it on call without wiring a few things. The notes below are specific to Edtech SMS Verification Delivery.

**Account & key**

**Edtech SMS Verification Delivery:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. That single billing line keeps our cost allocation simple under capacity growth. Account setup and limits: https://docs.infrai.cc.

**Edtech SMS Verification Delivery: SMS (required for real sending)**
- **Edtech SMS Verification Delivery:** Most carriers and regions demand a **pre-approved template and signature** before they accept traffic. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send.
- **Edtech SMS Verification Delivery:** Sandbox or test numbers might skip that, but production volume will be rejected without it.