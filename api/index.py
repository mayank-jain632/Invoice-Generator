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
    error_msg = f"Failed to import app from {backend_path}: {str(e)}\n{traceback.format_exc()}"
    print(error_msg, file=sys.stderr)
    
    async def error_handler(scope, receive, send):
        await send({
            'type': 'http.response.start',
            'status': 500,
            'headers': [[b'content-type', b'application/json']],
        })
        await send({
            'type': 'http.response.body',
            'body': f'{{"error": "Backend initialization failed: {str(e)}"}}'.encode(),
        })
    handler = error_handler
