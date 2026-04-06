from app.config import settings
from app.llm.base import LLMProvider
from app.llm.claude_provider import ClaudeProvider
from app.llm.ollama_provider import OllamaProvider
from app.llm.openai_provider import OpenAIProvider


def get_provider(
    provider_name: str,
    api_key: str | None = None,
    endpoint_url: str | None = None,
    model: str | None = None,
) -> LLMProvider:
    """Return the correct LLM adapter based on provider name.

    Falls back to environment variables for api_key / endpoint if not provided.
    """
    name = provider_name.lower().strip()

    if name == "claude":
        key = api_key or settings.ANTHROPIC_API_KEY
        if not key:
            raise ValueError("Anthropic API key required for Claude provider")
        return ClaudeProvider(api_key=key, model=model)

    if name == "openai":
        key = api_key or settings.OPENAI_API_KEY
        if not key:
            raise ValueError("OpenAI API key required")
        return OpenAIProvider(api_key=key, model=model)

    if name == "ollama":
        url = endpoint_url or settings.OLLAMA_BASE_URL
        return OllamaProvider(endpoint_url=url, model=model)

    raise ValueError(f"Unknown LLM provider: {provider_name}")
