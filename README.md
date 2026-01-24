# Mmm Fingers Game - HTML5 Mobile Game

A simple, performant HTML5/JavaScript game inspired by "Mmm Fingers" - optimized for iOS Safari and WKWebView.

## Features

- 🎮 Simple tap-to-eat gameplay
- 📱 Optimized for mobile devices (iOS Safari/WKWebView)
- ⚡ High performance with requestAnimationFrame
- 🎨 Clean, modern UI
- 📊 Score tracking
- 🔄 Game over and restart functionality

## How to Play

1. Food items fall from the top of the screen
2. Tap anywhere on the screen to open the character's mouth
3. Catch food items by timing your taps correctly
4. If food hits the ground, the game ends
5. Try to get the highest score!

## Performance Optimizations for iOS Safari/WKWebView

This game includes several optimizations specifically for iOS Safari and WKWebView:

1. **Touch Event Optimization**
   - Uses `touch-action: manipulation` to prevent default gestures
   - Prevents touch highlighting with `-webkit-tap-highlight-color: transparent`
   - Uses passive event listeners where appropriate

2. **Canvas Rendering**
   - Uses `requestAnimationFrame` for smooth 60fps animations
   - Limits delta time to prevent frame jumps
   - Uses `will-change` CSS property for better compositing

3. **Mobile Viewport**
   - Proper viewport meta tags for mobile
   - Prevents user scaling
   - Apple-specific meta tags for web app mode

4. **Memory Management**
   - Efficient array operations (reverse iteration for removals)
   - Minimal DOM manipulation
   - Canvas-based rendering instead of DOM elements

## Integration into Your Web App

### Option 1: Direct Embed (iframe)

```html
<iframe src="mmm-fingers-game.html" 
        width="100%" 
        height="600px" 
        frameborder="0"
        style="border-radius: 20px;">
</iframe>
```

### Option 2: Include as Component

1. Copy the HTML content into your app
2. Extract the CSS and JavaScript if needed
3. Adjust the canvas size to fit your layout

### Option 3: Standalone Page

Simply open `mmm-fingers-game.html` in a browser or link to it from your app.

## Customization

You can easily customize the game by modifying these variables in the JavaScript:

```javascript
// Food types and scoring
const foodTypes = [
    { color: '#FF6B6B', points: 10, size: 20 },
    { color: '#4ECDC4', points: 15, size: 25 },
    // Add more types...
];

// Game difficulty
const settings = {
    foodSpawnRate: 0.02,  // Increase for more food
    foodSpeed: 2,         // Increase for faster falling
    gravity: 0.1          // Increase for faster acceleration
};

// Character properties
character.mouthOpenDuration = 200; // How long mouth stays open (ms)
```

## Browser Compatibility

- ✅ iOS Safari 12+
- ✅ iOS WKWebView
- ✅ Chrome Mobile
- ✅ Firefox Mobile
- ✅ Desktop browsers (for testing)

## License

Free to use and modify for your web app.
