import openai

from app.llm.base import LLMProvider

DEFAULT_MODEL = "gpt-4o"

AVAILABLE_MODELS = [
    {
        "model_id": "gpt-4o",
        "model_name": "GPT-4o",
        "description": "Most capable OpenAI model",
    },
    {
        "model_id": "gpt-4o-mini",
        "model_name": "GPT-4o Mini",
        "description": "Fast and affordable",
    },
]


class OpenAIProvider(LLMProvider):
    provider_name = "openai"

    def __init__(self, api_key: str, model: str | None = None):
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.default_model = model or DEFAULT_MODEL

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        use_model = model or self.default_model

        kwargs: dict = {
            "model": use_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 4096,
        }

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)

        raw_text = response.choices[0].message.content

        if json_mode:
            return self._parse_json_response(raw_text)
        return {"text": raw_text}

    def get_available_models(self) -> list[dict]:
        return AVAILABLE_MODELS
