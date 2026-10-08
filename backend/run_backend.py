"""
Launcher script for Student ScamGuard AI Backend.
Starts uvicorn on port 8000 and serves both the REST API and the frontend application.
"""

import sys
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    # Ensure app module is in path
    backend_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(backend_dir))
    
    print("=" * 60)
    print("  Student ScamGuard AI — Backend Server")
    print("  API Docs:  http://localhost:8000/docs")
    print("  Frontend:  http://localhost:8000/")
    print("=" * 60)
    
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
