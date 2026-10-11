# Direct LLM providers

Set this **single line** in the repository-root `.env` on the backend server,
replacing the placeholders with your own keys. Restart FastAPI after editing it.
Never put these keys in `NEXT_PUBLIC_*` variables or commit the `.env` file.

```dotenv
GREENPEAK_LLM_PROVIDERS='[{"provider_id":"gemini","model":"gemini-3.1-flash-lite","api_key":"YOUR_GEMINI_KEY"},{"provider_id":"cloudflare","model":"@cf/qwen/qwen3-30b-a3b-fp8","api_key":"YOUR_CLOUDFLARE_API_TOKEN","base_url":"https://api.cloudflare.com/client/v4/accounts/YOUR_CLOUDFLARE_ACCOUNT_ID/ai/v1"}]'
```

Providers are tried in array order. Both use their official direct endpoints.
This list replaces the legacy `GREENPEAK_LLM_*` single-provider settings entirely;
GapGPT is not a fallback when the list is populated. An absent/empty list preserves
the old single-provider configuration for existing installations.

The same router serves chat, daily/manual analysis, news analysis and the CLI.
On HTTP 402/429, an explicit 403 quota error, temporary server failure or network failure, it tries the next
provider. It respects `Retry-After` (seconds or HTTP date) and Gemini `RetryInfo`.
Without a retry hint it probes HTTP failures again after 60 seconds, or network
failures after 30 seconds. A 429 alone does not prove the daily quota is exhausted.
Cooldowns persist in `backend2/instance/llm_router.db` and are shared by workers
using that file on one host. Concurrent requests already in flight can still
reach the same provider; multiple hosts require a shared coordination store.
Requests stop with an error if all providers are unavailable. Invalid requests,
authentication/permission errors and invalid JSON responses are surfaced.

Use a **Free Tier** Gemini project and **Workers Free** Cloudflare account if you
require free-only operation. Routing cannot infer billing status: a paid account
can charge for a successful request without emitting a quota error. There is no
automatic upgrade, top-up or unconfigured paid fallback in this application.
Model availability and quotas depend on the account and can change. Check your
console before selecting a model. Each chat message normally makes two calls
(evidence planning and answering); other site analyses consume the same quotas.
Cloudflare Workers Free includes 10,000 Neurons per day across the account.
Neurons measure compute, not requests or tokens. The allocation resets at
00:00 UTC (03:30 Tehran). On Free, requests fail after exhausting that allowance;
do not upgrade to Workers Paid or configure paid AI Gateway credits for free-only
operation. The example Qwen model supports text generation and JSON output.
Other models may require a paid plan, so check the current model catalog.

To connect Cloudflare:

1. Sign in at https://dash.cloudflare.com and open **Workers AI**.
2. Select **Use REST API**, then **Create a Workers AI API Token**.
3. Review the permissions, create the token and copy it into
   `YOUR_CLOUDFLARE_API_TOKEN` in the `.env` line above.
4. Copy **Account ID** from the same page and replace
   `YOUR_CLOUDFLARE_ACCOUNT_ID` inside `base_url`. This is the account ID, not a
   domain's zone ID. A manually created token needs Workers AI Read and Edit.
5. Preserve the Gemini key and restart FastAPI.

If your existing `.env` still has a Groq or Mistral entry, replace it with Cloudflare;
updating `.env.example` alone does not modify the running configuration.

Add a third OpenAI-compatible provider later by appending an entry with a unique
`provider_id`, `model`, `api_key` and an explicit HTTPS `base_url`. New providers
must support the existing JSON-object response contract.

Official references:

- [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Cloudflare API token and Account ID](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [Cloudflare compatibility](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [Cloudflare free daily allowance](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Qwen model](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)
