const logos = {
  horizontal: { width: 1000, height: 209 },
  wordmark: { width: 1000, height: 252 },
  stacked: { width: 600, height: 499 },
};

export function BrandLogo({ variant = "horizontal" }: { variant?: keyof typeof logos }) {
  const size = logos[variant];
  return <picture className={"brand-logo brand-" + variant}>
    {variant === "horizontal" && <source media="(max-width: 480px)" srcSet="/brand/mark.webp" />}
    <img src={"/brand/" + variant + ".webp"} alt="Olimpik" width={size.width} height={size.height} />
  </picture>;
}
