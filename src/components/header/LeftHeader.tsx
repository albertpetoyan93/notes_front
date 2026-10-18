// The 2keevo lockup: the key-shaped "2" followed by "keevo". One file per theme,
// so the mark keeps its colour in dark mode instead of being inverted.
export const BrandLockup = ({ large = false }: { large?: boolean }) => (
  <span className={large ? "brand-lockup large" : "brand-lockup"}>
    <img src="/brand/2keevo-lockup.svg" alt="2keevo" className="brand-on-light" />
    <img src="/brand/2keevo-lockup-dark.svg" alt="2keevo" className="brand-on-dark" />
  </span>
);
