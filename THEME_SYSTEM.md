# Theme System

The application includes a dynamic color theme system with 5 beautiful variants that users can switch between in real-time.

## Available Themes

1. **Ocean Blue** (Professional & Trustworthy)

   - Primary: #0EA5E9
   - Perfect for a clean, professional look

2. **Sunset Orange** (Energetic & Creative)

   - Primary: #F97316
   - Great for a vibrant, energetic feel

3. **Forest Green** (Natural & Calm)

   - Primary: #10B981
   - Ideal for a calm, natural atmosphere

4. **Royal Purple** (Elegant & Luxurious) - **DEFAULT**

   - Primary: #8B5CF6
   - Elegant and modern design

5. **Coral Pink** (Modern & Playful)
   - Primary: #EC4899
   - Fun and playful aesthetic

## How to Use

### For Users

Click the color palette icon (🎨) in the header to open the theme selector dropdown. Select your preferred color variant, and the entire app will update instantly. Your choice is saved in localStorage.

### For Developers

#### Programmatic Theme Change

```tsx
import { useThemeVariant } from "./contexts/ThemeVariantContext";

function MyComponent() {
  const { variant, setVariant, gradientStyle } = useThemeVariant();

  // Change theme
  setVariant("ocean"); // or 'sunset', 'forest', 'purple', 'pink'

  // Use gradient in styles
  <div style={{ background: gradientStyle }}>...</div>;
}
```

#### Add New Variant

Edit `src/configs/theme.ts` and add a new entry to `colorVariants`:

```typescript
export const colorVariants = {
  // ... existing variants
  myTheme: {
    name: "My Theme",
    description: "My custom theme",
    light: { primary: "#...", secondary_1: "#...", secondary_2: "#..." },
    dark: { primary: "#...", secondary_1: "#...", secondary_2: "#..." },
    gradient: "linear-gradient(135deg, #... 0%, #... 100%)",
  },
};
```

## Architecture

- **ThemeVariantContext**: Manages the current theme variant selection
- **ThemeSelector Component**: UI for theme selection in the header
- **getThemeConfig()**: Generates complete Ant Design theme config based on variant
- **localStorage**: Persists user's theme choice

## Files

- `src/configs/theme.ts` - Theme configuration and variants
- `src/contexts/ThemeVariantContext.tsx` - Theme variant state management
- `src/components/themeSelector/ThemeSelector.tsx` - Theme selector UI component
- `src/App.tsx` - Theme provider integration
