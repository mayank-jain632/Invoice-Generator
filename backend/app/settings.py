from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # load env from backend/.env or project root ../.env
    model_config = SettingsConfigDict(env_file=[".env", "../.env"], extra="ignore")

    # app config
    DEBUG: bool = False
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    DATABASE_URL: str = ""
    
    # auth
    SECRET_KEY: str = "change-this-secret-key-in-production"

    # email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""  # use app password
    FROM_EMAIL: str = ""
    REMINDER_TO_EMAIL: str = ""   # where reminders go (e.g., manager, timesheet inbox)
    INVOICE_TO_EMAIL: str = ""    # where invoices are sent
    CRON_SECRET: str = ""

    # business config
    COMPANY_NAME: str = "Your Company LLC"
    COMPANY_ADDRESS: str = "123 Main St, City, State"
    COMPANY_EMAIL: str = "billing@yourcompany.com"
    DEFAULT_CURRENCY: str = "USD"

settings = Settings()
