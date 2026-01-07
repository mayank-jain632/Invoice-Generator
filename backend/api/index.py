import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from app.main import app
    handler = app
except Exception as e:
    import traceback
    error_msg = f"Failed to import app: {str(e)}\n{traceback.format_exc()}"
    print(error_msg)
    raise
