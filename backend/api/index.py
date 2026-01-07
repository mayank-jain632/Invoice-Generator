import sys
import os

# Add backend directory to Python path for Vercel
# In Vercel, __file__ will be /var/task/backend/api/index.py
# We need to add /var/task/backend to sys.path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from app.main import app
    handler = app
except Exception as e:
    import traceback
    error_msg = f"Failed to import app from {backend_path}: {str(e)}\n{traceback.format_exc()}"
    print(error_msg, file=sys.stderr)
    # Create a simple error handler
    async def error_handler(scope, receive, send):
        await send({
            'type': 'http.response.start',
            'status': 500,
            'headers': [[b'content-type', b'text/plain']],
        })
        await send({
            'type': 'http.response.body',
            'body': f'Backend initialization failed: {str(e)}'.encode(),
        })
    handler = error_handler
