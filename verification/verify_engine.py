import os
import time
from playwright.sync_api import sync_playwright, expect

def main():
    print("Starting Playwright verification script...")
    os.makedirs("/app/verification", exist_ok=True)

    with sync_playwright() as p:
        # Launch headless browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Open localhost
        print("Navigating to http://localhost:5173/...")
        page.goto("http://localhost:5173/")

        # Wait for page load
        page.wait_for_timeout(2000)

        # Click on 'Ancient Temple' preset on the left sidebar (first match)
        print("Selecting 'Ancient Temple' Preset from left sidebar...")
        page.get_by_text("Ancient Temple").first.click(force=True)
        page.wait_for_timeout(1000)

        # Transition workspace to 'generate' by clicking the top switcher tab
        print("Transitioning workspace to 'generate'...")
        page.get_by_text("2. Generate").click(force=True)
        page.wait_for_timeout(1000)

        # Click "Confirm and Start Separation Passes"
        print("Clicking 'Confirm and Start Separation Passes'...")
        page.get_by_text("Confirm and Start Separation Passes").first.click(force=True)

        # Wait for edit workspace to load
        print("Waiting for local pixel pipeline compilation to complete...")
        page.wait_for_selector("text=3D Cinematic Workspace", timeout=25000)
        page.wait_for_timeout(3000)

        # Click accordion 4: "④ Atmospheric Effects" to expand it
        print("Expanding Atmospheric Effects accordion...")
        page.get_by_text("④ Atmospheric Effects").click(force=True)
        page.wait_for_timeout(1000)

        # Take a screenshot
        screenshot_path = "/app/verification/verification.png"
        print(f"Taking screenshot and saving to {screenshot_path}...")
        page.screenshot(path=screenshot_path)

        print("Playwright verification completed successfully!")
        browser.close()

if __name__ == "__main__":
    main()
