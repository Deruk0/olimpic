const logos = {
  horizontal: { width: 1000, height: 209 },
  wordmark: { width: 1000, height: 252 },
  mark: { width: 512, height: 510 },
};

export function BrandLogo({ variant = "horizontal" }: { variant?: keyof typeof logos }) {
  const size = logos[variant];
  return <picture className={"brand-logo brand-" + variant}>
    <img src={"/brand/" + variant + ".webp"} alt="Olimpik" width={size.width} height={size.height} />
  </picture>;
}
