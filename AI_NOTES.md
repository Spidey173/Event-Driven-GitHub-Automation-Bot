# AI Collaboration & System Architecture Notes

This document details the AI tools used, architectural decisions, debugging pivots, and future improvements for the Event-Driven GitHub Automation Bot.

---

## 1. AI Tools Used

* **Gemini 3.5 Flash (High)** & **Antigravity IDE Agent** (Primary coding assistants)
* **Claude / ChatGPT** (General design brainstorming and mock API reference)

---

## 2. Key Decisions

### Decision 1: FastAPI instead of Node.js
* **Rationale**: Python's type annotations, combined with FastAPI's automatic OpenAPI schema generation (via Pydantic v2), yield a highly typed, self-documenting API. FastAPI's native async capabilities handle high concurrency webhook loads efficiently compared to traditional sync setups.

### Decision 2: BackgroundTasks instead of Celery + Redis
* **Rationale**: The AI initially suggested a complex Celery + Redis architecture to manage task scheduling. For an internship MVP running on free public hosts (Render, Neon), setting up and configuring a separate Redis broker and Celery worker adds significant deployment complexity and cost overhead. Simplifying the design to FastAPI's built-in `BackgroundTasks` executes automation scripts asynchronously in the background while keeping the infrastructure flat.

### Decision 3: Neon PostgreSQL instead of Supabase
* **Rationale**: Supabase provides a full backend-as-a-service layout. For this bot, we needed a thin SQL database mapper combined with complex backend logic. Neon provides an excellent serverless PostgreSQL database with no-card free tiers, which integrates natively with SQLAlchemy 2.0 and Alembic.

---

## 3. Biggest AI Mistake & Resolution

### The Mistake
During the scaffolding phase, the AI proposed a standard Pydantic configuration expecting a strict list representation (`List[str]`) for the `BACKEND_CORS_ORIGINS` setting. However, environment variable loaders (such as `pydantic-settings`) pull variables from `.env` files as raw string literals. Consequently, the server crashed immediately on startup with a `ValidationError`.

### How We Fixed It
Instead of reverting to string lists, we resolved the issue by introducing a custom Pydantic `@BeforeValidator` utility called `parse_cors`:
```python
def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str):
        if not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return [v.strip()]
    return v
```
This utility automatically parses comma-separated lists and JSON arrays, preventing startup crashes.

---

## 4. Future Improvements

1. **GitHub App Authentication**: Replace static user OAuth tokens with GitHub App JWT keys exchanged dynamically for installation tokens to support granular permissions.
2. **Dedicated Redis Queue**: Shift back to Celery + Redis if webhook execution volumes scale beyond single-instance memory thresholds.
3. **AI Issue Triage (Gemini API)**: Integrate Gemini API to analyze incoming issue titles and bodies, auto-summarize them, and suggest labels/triage priorities dynamically.
4. **Multi-Repository Config Panel**: Enable users to define distinct condition thresholds and custom actions for individual repositories in the dashboard.

---

## 5. AI Context / Instruction Files
* **Status**: No custom AI context or instruction files (such as `CLAUDE.md`, `AGENTS.md`, or `.cursorrules`) were used for this project. All prompts and instructions were given directly to the coding assistant.

