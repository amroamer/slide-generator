import json
import logging
import re
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

MAX_JSON_RETRIES = 3


class LLMProvider(ABC):
    """Abstract base for all LLM provider adapters."""

    provider_name: str

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        """Send prompts to the LLM and return parsed JSON (or raw dict)."""

    @abstractmethod
    def get_available_models(self) -> list[dict]:
        """Return list of {model_id, model_name, description}."""

    @staticmethod
    def _parse_json_response(raw_text: str) -> dict:
        """Strip markdown fences and parse JSON from LLM output."""
        text = raw_text.strip()
        # Remove ```json ... ``` or ``` ... ```
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
        return json.loads(text)

    async def generate_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        """Generate with automatic JSON-retry logic.

        If json_mode is True and parsing fails, retries up to MAX_JSON_RETRIES
        times with an increasingly strict JSON instruction appended.
        """
        if not json_mode:
            return await self.generate(
                system_prompt, user_prompt, model=model, json_mode=False
            )

        last_error: Exception | None = None
        for attempt in range(1, MAX_JSON_RETRIES + 1):
            suffix = ""
            if attempt == 2:
                suffix = (
                    "\n\nIMPORTANT: Your previous response was not valid JSON. "
                    "Return ONLY valid JSON with no markdown, no explanation."
                )
            elif attempt >= 3:
                suffix = (
                    "\n\nCRITICAL: Return ONLY a raw JSON object. "
                    "No markdown fences, no text before or after. Just {…}."
                )

            try:
                return await self.generate(
                    system_prompt,
                    user_prompt + suffix,
                    model=model,
                    json_mode=True,
                )
            except (json.JSONDecodeError, KeyError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "JSON parse failed on attempt %d/%d for %s: %s",
                    attempt,
                    MAX_JSON_RETRIES,
                    self.provider_name,
                    exc,
                )

        raise ValueError(
            f"Failed to get valid JSON from {self.provider_name} "
            f"after {MAX_JSON_RETRIES} attempts: {last_error}"
        )
