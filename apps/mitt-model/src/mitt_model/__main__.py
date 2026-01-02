"""Entry point for running mitt-model as a module."""
import uvicorn


def main() -> None:
    """Run the FastAPI server."""
    uvicorn.run("mitt_model.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
