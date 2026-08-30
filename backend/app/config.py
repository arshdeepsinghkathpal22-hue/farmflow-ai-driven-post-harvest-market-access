"""Settings. Every value has a working default, so the app runs with no .env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    environment: str = "development"

    # A file in backend/data. No server, no account, no connection string.
    database_url: str = f"sqlite:///{(DATA_DIR / 'farmflow.db').as_posix()}"

    # Signs warehouse receipts. Fixed by default so a fresh clone still verifies
    # receipts issued by the previous run; override it for anything real.
    receipt_signing_key: str = "farmflow-demo-signing-key-do-not-use-in-production"

    # The single demo account. Printed at startup and shown on the login screen,
    # because a judge should never have to guess a password.
    demo_username: str = "farmer"
    demo_password: str = "farmflow"

    # Vite's dev server takes 5173, or the next free port after it when
    # something else already has one - which happens the moment two copies of
    # the app are open. `npm run preview` serves the built site on 4173. All of
    # them are listed so that starting the web app a second time does not
    # silently look like a backend outage.
    cors_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
        "http://localhost:4173,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,"
        "http://127.0.0.1:4173"
    )

    booking_confirm_window_minutes: int = 30

    # data.gov.in API key for the Agmarknet daily mandi prices dataset.
    # Empty by default: without it /api/prices/live answers 503 with a plain
    # reason and the app falls back to its modelled series, which keeps the
    # demo working in a hall with no key and no signal.
    mandi_api_key: str = ""
    mandi_resource_id: str = "9ef84268-d588-465a-a308-a864a43d0070"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
