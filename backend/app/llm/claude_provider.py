import anthropic

from app.llm.base import LLMProvider

DEFAULT_MODEL = "claude-sonnet-4-20250514"

AVAILABLE_MODELS = [
    {
        "model_id": "claude-sonnet-4-20250514",
        "model_name": "Claude Sonnet 4",
        "description": "Best balance of speed and intelligence",
    },
    {
        "model_id": "claude-haiku-4-5-20251001",
        "model_name": "Claude Haiku 4.5",
        "description": "Fastest and most affordable",
    },
]


class ClaudeProvider(LLMProvider):
    provider_name = "claude"

    def __init__(self, api_key: str, model: str | None = None):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.default_model = model or DEFAULT_MODEL

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        use_model = model or self.default_model

        system = system_prompt
        if json_mode:
            system += "\n\nReturn ONLY valid JSON. No markdown, no explanation."

        response = await self.client.messages.create(
            model=use_model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text

        if json_mode:
            return self._parse_json_response(raw_text)
        return {"text": raw_text}

    def get_available_models(self) -> list[dict]:
        return AVAILABLE_MODELS
