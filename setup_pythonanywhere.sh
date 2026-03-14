#!/bin/bash
# =============================================================
# PythonAnywhere Setup Script
# Carotid Revascularization Registry
# =============================================================
#
# INSTRUCTIONS:
# 1. Upload all files to PythonAnywhere (via git clone or zip upload)
# 2. Open a Bash console on PythonAnywhere
# 3. Run: bash setup_pythonanywhere.sh
# 4. Go to Web tab and configure your web app
# =============================================================

set -e

echo "=== Carotid Registry - PythonAnywhere Setup ==="

# Get username
USERNAME=$(whoami)
PROJECT_DIR="/home/$USERNAME/carotid-registry"

echo "Project directory: $PROJECT_DIR"

# Create virtualenv
echo "Creating virtual environment..."
mkvirtualenv --python=/usr/bin/python3.10 carotid-registry 2>/dev/null || true
workon carotid-registry

# Install dependencies
echo "Installing dependencies..."
pip install -r "$PROJECT_DIR/requirements.txt"

# Initialize the database
echo "Initializing database..."
cd "$PROJECT_DIR"
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('Database created.')"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Go to the PythonAnywhere 'Web' tab"
echo "2. Click 'Add a new web app'"
echo "3. Select 'Manual configuration' -> Python 3.10"
echo "4. Set Source code to: $PROJECT_DIR"
echo "5. Set Virtualenv to: /home/$USERNAME/.virtualenvs/carotid-registry"
echo "6. Edit the WSGI configuration file and replace ALL contents with:"
echo ""
echo "   import sys"
echo "   path = '$PROJECT_DIR'"
echo "   if path not in sys.path:"
echo "       sys.path.append(path)"
echo "   from wsgi import application"
echo ""
echo "7. Click 'Reload' on the Web tab"
echo "8. Visit your site at: https://$USERNAME.pythonanywhere.com"
echo ""
