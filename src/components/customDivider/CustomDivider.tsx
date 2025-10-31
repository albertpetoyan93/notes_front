const CustomDivider = ({ line, gap }: any) => {
  return (
    <div
      style={{
        width: "100%",
        height: "1px",
        background: line && "#38445b33",
        marginTop: gap ? gap : "24px",
        marginBottom: gap ? gap : "24px",
      }}
    />
  );
};

export default CustomDivider;
