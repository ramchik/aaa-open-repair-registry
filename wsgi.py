"""
PythonAnywhere WSGI configuration file.

On PythonAnywhere:
1. Go to the "Web" tab
2. Set "Source code" to: /home/YOUR_USERNAME/carotid-registry
3. Set "WSGI configuration file" and edit it to contain:

    import sys
    path = '/home/YOUR_USERNAME/carotid-registry'
    if path not in sys.path:
        sys.path.append(path)
    from wsgi import application

4. Set "Virtualenv" to: /home/YOUR_USERNAME/.virtualenvs/carotid-registry
"""

import sys
import os

# Add your project directory to the sys.path
project_home = os.path.dirname(os.path.abspath(__file__))
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Import Flask app
from app import app as application
