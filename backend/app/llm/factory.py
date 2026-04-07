from app.config import settings
from app.llm.base import LLMProvider
from app.llm.ollama_provider import OllamaProvider


def get_provider(
    provider_name: str,
    api_key: str | None = None,
    endpoint_url: str | None = None,
    model: str | None = None,
) -> LLMProvider:
    """Return the correct LLM adapter based on provider name."""
    name = provider_name.lower().strip()

    if name == "ollama":
        url = endpoint_url or settings.OLLAMA_BASE_URL
        return OllamaProvider(endpoint_url=url, model=model)

    raise ValueError(f"Unknown LLM provider: {provider_name}")
