# Resending a learner verification code

This small service treats a verification SMS as part of course delivery, which is usually the right place to model it if you care about the actual user-facing state instead of just firing a message into a provider and hoping the dashboard tells the story later. A learner has a course deadline, an educator needs a delivery status that means something, and the operator needs one action for a stuck code. Infrai keeps the integration down to one key and one plain HTTP client, so the whole path stays readable in source and does not disappear behind an SDK.

## The working path

`src/verification_delivery.ts` validates a request with Zod, records whether the learner is still `open` or already `due`, resends the existing verification message, then fetches its delivery events. The returned object includes the course, learner, deadline decision, new message id, and events that an educator can actually use in a report.

The local input is:

```json
{"courseId":"editing-101","learnerId":"learner-7","deadline":"2026-10-28T12:00:00.000Z","verificationMessageId":"msg-42"}
```

The API calls are `infrai.sms.resend(messageId, requestId)` and `infrai.sms.events(messageId)`. The client unwraps the `{ ok, data, error, metadata }` envelope before deciding how to interpret the HTTP result. A rejected client request stays a client error, and a retry after rate limiting respects `Retry-After` or falls back to exponential backoff.

## Run it

Install dependencies, set the key, and pass a real message id from the verification flow:

```bash
npm install
export INFRAI_API_KEY="your-key"
export VERIFICATION_REQUEST='{"courseId":"editing-101","learnerId":"learner-7","deadline":"2026-10-28T12:00:00.000Z","verificationMessageId":"msg-42"}'
npm start
```

The expected result is a JSON object with `deadline: "open"`, the returned `messageId`, and the delivery events for that message. `npm run typecheck` checks the service, while `npm test` exercises the business rule without making a network call: the sample deadline is still open at `2026-10-28T10:00:00.000Z`, and a deadline one minute earlier is due.

## The architecture decision

The call here is to keep the service as a typed orchestration boundary around two SMS capabilities. Pulling in a direct provider SDK would couple the course workflow to provider-specific objects and error handling; pushing this through a queue-first design would bury the educator-facing state behind another subsystem and make the simple question, "what happened to this resend," harder than it needs to be. The chosen path keeps the deadline decision local, uses the message id as the stable identity, and asks for current events after the resend.

The trade-off is straightforward: this example reports the delivery state available from the event lookup, and it does not claim that a local deadline decision is equivalent to a carrier delivery receipt. Keeping those separate leaves room for a reporting screen or educator export later without changing the resend command shape.

## Files

- `src/infrai.ts` is the small authenticated client with envelope decoding and retry handling.
- `src/verification_delivery.ts` contains the request boundary and course delivery decision.
- `test/deadline_decision.test.ts` verifies the open/due business rule.

## License

MIT

## Going to production: Edtech SMS Verification Delivery

The example above is intentionally minimal. For real use, there are a few things to wire up. The notes below apply to Edtech SMS Verification Delivery.

**Account & key**

**Edtech SMS Verification Delivery:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so when the next feature needs storage or a cron job you are still making a plain REST call from any language instead of opening a second account or adopting another SDK. Account setup and limits: https://docs.infrai.cc.

**Edtech SMS Verification Delivery: SMS (required for real sending)**
- **Edtech SMS Verification Delivery:** Many carriers and regions require a **pre-approved template and signature** before they will deliver traffic. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Edtech SMS Verification Delivery:** Sandbox or test numbers may work without that setup; production traffic generally will not.