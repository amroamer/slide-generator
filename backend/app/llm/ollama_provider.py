import httpx

from app.llm.base import LLMProvider

DEFAULT_MODEL = "qwen2.5:7b"


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(
        self,
        endpoint_url: str = "http://host.docker.internal:11434",
        model: str | None = None,
    ):
        self.endpoint_url = endpoint_url.rstrip("/")
        self.default_model = model or DEFAULT_MODEL

    async def _generate_impl(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        use_model = model or self.default_model

        payload: dict = {
            "model": use_model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
        }

        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{self.endpoint_url}/api/generate",
                json=payload,
            )
            resp.raise_for_status()

        data = resp.json()
        raw_text = data.get("response", "")

        if json_mode:
            return self._parse_json_response(raw_text)
        return {"text": raw_text}

    def get_available_models(self) -> list[dict]:
        """Fetch installed models from Ollama /api/tags."""
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.endpoint_url}/api/tags")
                resp.raise_for_status()
            models = resp.json().get("models", [])
            return [
                {
                    "model_id": m["name"],
                    "model_name": m["name"],
                    "description": f"{m.get('size', 0) / 1e9:.1f}GB"
                    if m.get("size")
                    else "Local model",
                }
                for m in models
            ]
        except Exception:
            return [
                {
                    "model_id": DEFAULT_MODEL,
                    "model_name": DEFAULT_MODEL,
                    "description": "Default local model (configure Ollama endpoint)",
                }
            ]
