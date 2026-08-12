from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to standard high resolution
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        print("Navigating to http://localhost:5173/")
        page.goto("http://localhost:5173/")

        # Wait for content to load
        page.wait_for_timeout(3000)

        # Capture main screen
        print("Taking main dashboard screenshot...")
        page.screenshot(path="/home/jules/verification/verification.png")

        # Click on "Simulate local AI Separation"
        print("Triggering AI Scanner simulation...")
        ai_btn = page.get_by_text("Simulate local AI Separation")
        if ai_btn.is_visible():
            ai_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path="/home/jules/verification/scanning_overlay.png")
            # Wait for scanning to auto-close (approx 4-5s total)
            page.wait_for_timeout(4000)

        # Click "Cinematic Export" button
        print("Opening Cinematic Export Modal...")
        export_btn = page.get_by_text("Cinematic Export")
        if export_btn.is_visible():
            export_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path="/home/jules/verification/export_modal.png")

        print("Verification script successfully completed.")
        browser.close()

if __name__ == "__main__":
    verify()
