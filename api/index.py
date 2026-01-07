import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app

# Vercel expects 'app' to be the ASGI application
# No need for 'handler' - just export 'app' directly
