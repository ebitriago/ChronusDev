#!/bin/bash
while true; do
    echo "--- Starting Localtunnel ---"
    npm exec localtunnel -- --port 3002 > lt.log 2>&1
    echo "Localtunnel exited. Restarting in 2 seconds..."
    sleep 2
done
