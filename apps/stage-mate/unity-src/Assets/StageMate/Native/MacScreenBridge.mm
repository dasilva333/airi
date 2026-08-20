#import <Cocoa/Cocoa.h>

extern "C" {
    void GetMacScreenDockRect(float* x, float* y, float* width, float* height) {
        if (!x || !y || !width || !height) return;
        
        NSScreen* screen = [NSScreen mainScreen];
        if (!screen) {
            *x = 0; *y = 0; *width = 0; *height = 0;
            return;
        }
        
        NSRect frame = [screen frame];
        NSRect visible = [screen visibleFrame];
        
        // On macOS Cocoa:
        // (0,0) is at the bottom-left of the screen.
        // visible.origin.y is the Dock height when the Dock is at the bottom.
        if (visible.origin.y > 0) {
            // Dock at bottom: Y spans [0 .. visible.origin.y]
            *x = (float)visible.origin.x;
            *y = 0;
            *width = (float)visible.size.width;
            *height = (float)visible.origin.y;
        } else if (visible.origin.x > 0) {
            // Dock on left
            *x = 0;
            *y = (float)visible.origin.y;
            *width = (float)visible.origin.x;
            *height = (float)visible.size.height;
        } else if (visible.size.width < frame.size.width) {
            // Dock on right
            *x = (float)visible.size.width;
            *y = (float)visible.origin.y;
            *width = (float)(frame.size.width - visible.size.width);
            *height = (float)frame.size.height;
        } else {
            // Dock is autohidden or flush
            float fallbackH = 66.0f;
            *x = 0;
            *y = 0;
            *width = (float)frame.size.width;
            *height = fallbackH;
        }
    }
}
