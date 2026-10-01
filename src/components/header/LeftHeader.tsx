export const BrandLockup = ({ large = false }: { large?: boolean }) => (
  <span className={large ? "brand-lockup large" : "brand-lockup"}>
    <span className="header-logo-plate">
      <img src="/logo.png" alt="" />
    </span>
    <img src="/keevo-word.png" alt="keevo" className="header-word" />
  </span>
);

const LeftHeader = () => {
  return (
    <div className="header_child">
      <BrandLockup />
    </div>
  );
};

export default LeftHeader;
