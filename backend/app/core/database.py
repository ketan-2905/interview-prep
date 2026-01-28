import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv
load_dotenv() 

DATABASE_URL = os.getenv("DATABASE_URL")

# Ensure async driver is used
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

if not DATABASE_URL:
    # Fallback or error, but let's assume it's set as it was working with Prisma
    raise ValueError("DATABASE_URL is not set")


engine = create_async_engine(DATABASE_URL, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

# Dependency for FastAPI routes
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# Helper for non-route contexts (manual session management)
# Note: Caller is responsible for closing/committing if not using context manager,
# but using `async with` on the factory result is preferred.
