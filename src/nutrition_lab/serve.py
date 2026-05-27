"""uvicorn entrypoint for the ``nutrition-lab-serve`` script."""
from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("NUTRITION_LAB_HOST", "127.0.0.1")
    port = int(os.environ.get("NUTRITION_LAB_PORT", "8000"))
    uvicorn.run("nutrition_lab.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
