from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgreSQL
    POSTGRES_USER: str = "kpmg_slides"
    POSTGRES_PASSWORD: str = "secure_password_here"
    POSTGRES_DB: str = "slides_generator"
    DATABASE_URL: str = "postgresql+asyncpg://kpmg_slides:secure_password_here@db:5432/slides_generator"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    SECRET_KEY: str = "random-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM Providers
    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    DEFAULT_LLM_PROVIDER: str = "ollama"
    DEFAULT_LLM_MODEL: str = "gemma4:latest"

    # Application
    UPLOAD_MAX_SIZE_MB: int = 25
    FRONTEND_URL: str = "http://localhost:3000"
    DEBUG: bool = False


settings = Settings()
