import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from app.main import app
    handler = app
except Exception as e:
    import traceback
    error_msg = f"Failed to import app: {str(e)}\n{traceback.format_exc()}"
    print(error_msg, file=sys.stderr)
    
    # Create error response app
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    handler = FastAPI()
    
    @handler.get("/{path:path}")
    @handler.post("/{path:path}")
    async def error_handler(path: str):
        return JSONResponse(
            status_code=500,
            content={"detail": f"Backend initialization failed: {str(e)}"}
        )
